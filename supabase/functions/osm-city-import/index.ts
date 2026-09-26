import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (Deno.env.get("DENO") === undefined) {
  // no-op
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

// R2 config — read from integration_credentials table (global, tenant_id = NULL)
// Falls back to env vars if not found in DB
let R2_ENDPOINT = "";
let R2_ACCESS_KEY_ID = "";
let R2_SECRET_ACCESS_KEY = "";
let R2_BUCKET = "mobveloov";
let R2_FILE_KEY = "brazil-260925.osm.pbf";

async function loadR2Config(): Promise<void> {
  const { data } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .is("tenant_id", null)
    .eq("category", "storage")
    .eq("provider", "cloudflare_r2")
    .eq("is_active", true)
    .order("priority")
    .limit(1)
    .maybeSingle();
  if (data?.credentials) {
    const c = data.credentials as Record<string, string>;
    R2_ENDPOINT = c.R2_ENDPOINT || "";
    R2_ACCESS_KEY_ID = c.R2_ACCESS_KEY_ID || "";
    R2_SECRET_ACCESS_KEY = c.R2_SECRET_ACCESS_KEY || "";
    R2_BUCKET = c.R2_BUCKET || "mobveloov";
    R2_FILE_KEY = c.R2_FILE_KEY || "brazil-260925.osm.pbf";
  }
  // Fallback to env vars
  R2_ENDPOINT = R2_ENDPOINT || Deno.env.get("R2_ENDPOINT") || "";
  R2_ACCESS_KEY_ID = R2_ACCESS_KEY_ID || Deno.env.get("R2_ACCESS_KEY_ID") || "";
  R2_SECRET_ACCESS_KEY = R2_SECRET_ACCESS_KEY || Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
  R2_BUCKET = R2_BUCKET || Deno.env.get("R2_BUCKET") || "mobveloov";
  R2_FILE_KEY = R2_FILE_KEY || Deno.env.get("R2_FILE_KEY") || "brazil-260925.osm.pbf";
}

interface CityJob {
  cidade_id: string;
  nome: string;
  estado_sigla: string;
  bbox?: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^(rua|avenida|av|av\.|travessa|tr|alameda|estrada|rodovia|viela|beco|praca|pca)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Fetch bounding box for a city from Nominatim (first time only)
async function fetchBBox(city: string, stateSigla: string): Promise<{ min_lat: number; min_lon: number; max_lat: number; max_lon: number } | null> {
  const query = `${city}, ${stateSigla}, Brazil`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&polygon_geojson=0&addressdetails=0`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Veloov-AddressImport/1.0" },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Array<{ boundingbox: [string, string, string, string] }>;
    if (!data || data.length === 0) return null;
    const bb = data[0].boundingbox;
    return {
      min_lat: parseFloat(bb[0]),
      max_lat: parseFloat(bb[1]),
      min_lon: parseFloat(bb[2]),
      max_lon: parseFloat(bb[3]),
    };
  } catch {
    return null;
  }
}

// Fetch OSM data via Overpass API for the bounding box
// Returns ways (streets) with their nodes (coordinates) and tags
async function fetchOverpassData(bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number }): Promise<{
  ways: Array<{
    id: number;
    tags: Record<string, string>;
    nodes: Array<[number, number]>;
  }>;
  nodes: Map<number, [number, number]>;
} | null> {
  const bb = `${bbox.min_lat},${bbox.min_lon},${bbox.max_lat},${bbox.max_lon}`;
  // Query highways + addr: tags
  const query = `
    [out:json][timeout:120];
    (
      way["highway"](${bb});
      way["addr:street"](${bb});
      way["addr:housenumber"](${bb});
      node["addr:street"](${bb});
      node["addr:housenumber"](${bb});
    );
    out geom;
  `;
  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
    });
    if (!resp.ok) {
      console.error(`Overpass HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json() as { elements: Array<Record<string, unknown>> };
    const ways: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }> = [];
    const nodes = new Map<number, [number, number]>();

    for (const el of data.elements ?? []) {
      const type = el.type as string;
      const tags = (el.tags ?? {}) as Record<string, string>;
      if (type === "way") {
        const geometry = (el.geometry ?? []) as Array<{ lat: number; lon: number }>;
        const coords: Array<[number, number]> = geometry.map((g) => [g.lat, g.lon]);
        ways.push({ id: el.id as number, tags, nodes: coords });
      } else if (type === "node") {
        nodes.set(el.id as number, [el.lat as number, el.lon as number]);
      }
    }
    return { ways, nodes };
  } catch (err) {
    console.error("Overpass error:", err);
    return null;
  }
}

// Process Overpass ways into bairros, ruas, numeros
async function processCityData(
  cidadeId: string,
  overpassData: { ways: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }> },
): Promise<{ bairros: number; ruas: number; numeros: number }> {
  let bairroCount = 0;
  let ruaCount = 0;
  let numeroCount = 0;

  // Group ways by (bairro, rua) name
  const bairroMap = new Map<string, string>(); // normalizedName -> uuid (created on the fly)
  const ruaMap = new Map<string, string>(); // "bairroNorm|ruaNorm" -> uuid

  for (const way of overpassData.ways) {
    const tags = way.tags;
    const streetName = tags["name"] ?? tags["addr:street"] ?? "";
    if (!streetName) continue;

    const bairroName = tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? "Centro";
    const bairroNorm = normalizeName(bairroName);
    const ruaNorm = normalizeName(streetName);

    if (!ruaNorm) continue;

    // Get or create bairro
    let bairroId = bairroMap.get(bairroNorm);
    if (!bairroId) {
      const { data: existing } = await supabase
        .from("bairros")
        .select("id")
        .eq("cidade_id", cidadeId)
        .eq("nome_normalizado", bairroNorm)
        .maybeSingle();
      if (existing) {
        bairroId = existing.id;
      } else {
        const { data: newBairro } = await supabase
          .from("bairros")
          .insert({ cidade_id: cidadeId, nome: bairroName, nome_normalizado: bairroNorm })
          .select("id")
          .single();
        if (newBairro) {
          bairroId = newBairro.id;
          bairroCount++;
        } else continue;
      }
      bairroMap.set(bairroNorm, bairroId);
    }

    // Get or create rua
    const ruaKey = `${bairroNorm}|${ruaNorm}`;
    let ruaId = ruaMap.get(ruaKey);
    if (!ruaId) {
      const coords = way.nodes;
      const latInicio = coords.length > 0 ? coords[0][0] : null;
      const lngInicio = coords.length > 0 ? coords[0][1] : null;
      const latFim = coords.length > 1 ? coords[coords.length - 1][0] : latInicio;
      const lngFim = coords.length > 1 ? coords[coords.length - 1][1] : lngInicio;

      const { data: newRua } = await supabase
        .from("ruas")
        .insert({
          bairro_id: bairroId,
          nome_rua: streetName,
          nome_normalizado: ruaNorm,
          latitude_inicio: latInicio,
          longitude_inicio: lngInicio,
          latitude_fim: latFim,
          longitude_fim: lngFim,
        })
        .select("id")
        .single();
      if (newRua) {
        ruaId = newRua.id;
        ruaCount++;
      } else continue;
      ruaMap.set(ruaKey, ruaId);
    }

    // Process house numbers from addr:housenumber on nodes or way tags
    const houseNum = tags["addr:housenumber"];
    if (houseNum && way.nodes.length > 0) {
      const lat = way.nodes[0][0];
      const lng = way.nodes[0][1];
      const { error } = await supabase
        .from("numeros")
        .insert({ rua_id: ruaId, numero: houseNum, latitude: lat, longitude: lng });
      if (!error) numeroCount++;
    }
  }

  return { bairros: bairroCount, ruas: ruaCount, numeros: numeroCount };
}

async function handleImport(req: Request): Promise<Response> {
  await loadR2Config();
  const body = await req.json().catch(() => ({})) as { cidade_id?: string; cidade_nome?: string; estado_sigla?: string; force?: boolean };
  const cidadeId = body.cidade_id;
  const cidadeNome = body.cidade_nome;
  const estadoSigla = body.estado_sigla;
  const force = body.force ?? false;

  if (!cidadeId || !cidadeNome || !estadoSigla) {
    return new Response(JSON.stringify({ error: "Missing cidade_id, cidade_nome, or estado_sigla" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check if already imported
  if (!force) {
    const { data: cidade } = await supabase
      .from("cidades")
      .select("import_status")
      .eq("id", cidadeId)
      .maybeSingle();
    if (cidade?.import_status === "completed") {
      return new Response(JSON.stringify({ message: "City already imported", cidade_id: cidadeId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Mark as processing
  await supabase.from("cidades").update({ import_status: "processing" }).eq("id", cidadeId);

  // Log R2 file reference (for audit — actual .pbf processing would use osmium in a worker)
  console.log(`R2 file reference: ${R2_ENDPOINT}/${R2_BUCKET}/${R2_FILE_KEY}`);

  // Step 1: Get bounding box
  let bbox = body.bbox as { min_lat: number; min_lon: number; max_lat: number; max_lon: number } | undefined;

  if (!bbox) {
    const { data: cidade } = await supabase
      .from("cidades")
      .select("bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon")
      .eq("id", cidadeId)
      .maybeSingle();
    if (cidade?.bbox_min_lat != null && cidade?.bbox_max_lat != null) {
      bbox = {
        min_lat: cidade.bbox_min_lat,
        min_lon: cidade.bbox_min_lon,
        max_lat: cidade.bbox_max_lat,
        max_lon: cidade.bbox_max_lon,
      };
    }
  }

  if (!bbox) {
    bbox = await fetchBBox(cidadeNome, estadoSigla);
    if (!bbox) {
      await supabase.from("cidades").update({ import_status: "bbox_failed" }).eq("id", cidadeId);
      return new Response(JSON.stringify({ error: "Failed to fetch bounding box from Nominatim" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Save bbox for reuse
    await supabase.from("cidades").update({
      bbox_min_lat: bbox.min_lat,
      bbox_min_lon: bbox.min_lon,
      bbox_max_lat: bbox.max_lat,
      bbox_max_lon: bbox.max_lon,
    }).eq("id", cidadeId);
  }

  // Step 2: Fetch OSM data via Overpass
  const overpassData = await fetchOverpassData(bbox);
  if (!overpassData) {
    // Retry with a different Overpass endpoint
    try {
      const resp = await fetch("https://overpass.kumi.systems/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: `[out:json][timeout:120];(way["highway"](${bbox.min_lat},${bbox.min_lon},${bbox.max_lat},${bbox.max_lon});way["addr:street"](${bbox.min_lat},${bbox.min_lon},${bbox.max_lat},${bbox.max_lon}););out geom;`,
      });
      if (resp.ok) {
        const data = await resp.json() as { elements: Array<Record<string, unknown>> };
        const ways: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }> = [];
        for (const el of data.elements ?? []) {
          if (el.type === "way") {
            const geometry = (el.geometry ?? []) as Array<{ lat: number; lon: number }>;
            ways.push({
              id: el.id as number,
              tags: (el.tags ?? {}) as Record<string, string>,
              nodes: geometry.map((g) => [g.lat, g.lon]),
            });
          }
        }
        if (ways.length > 0) {
          const result = await processCityData(cidadeId, { ways });
          await supabase.from("cidades").update({
            import_status: "completed",
            imported_at: new Date().toISOString(),
          }).eq("id", cidadeId);
          return new Response(JSON.stringify({
            success: true,
            cidade_id: cidadeId,
            ...result,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } catch { /* fall through to error */ }

    await supabase.from("cidades").update({ import_status: "overpass_failed" }).eq("id", cidadeId);
    return new Response(JSON.stringify({ error: "Failed to fetch OSM data from Overpass API" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 3: Process data
  const result = await processCityData(cidadeId, overpassData);

  // Step 4: Mark as completed
  await supabase.from("cidades").update({
    import_status: "completed",
    imported_at: new Date().toISOString(),
  }).eq("id", cidadeId);

  return new Response(JSON.stringify({
    success: true,
    cidade_id: cidadeId,
    ...result,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return handleImport(req);
});
