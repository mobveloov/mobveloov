import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.787.0";
import Pbf from "npm:pbf@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

// R2 config — read from integration_credentials table (global, tenant_id = NULL)
// Falls back to env vars if not found in DB. The R2 .pbf file is used ONLY as a
// fallback when both Overpass endpoints fail — the primary path is live Overpass API.
// R2 reads are expensive (Class B operations) so we only touch R2 on Overpass failure.
let R2_ENDPOINT = "";
let R2_ACCESS_KEY_ID = "";
let R2_SECRET_ACCESS_KEY = "";
let R2_BUCKET = "mobveloov";
let R2_FILE_KEY = "brazil-260925.osm.pbf";
let r2Client: S3Client | null = null;

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

// --- OSM PBF protobuf decoders (pure JS, no native deps) ---
// Based on the OSM PBF format spec: https://wiki.openstreetmap.org/wiki/PBF_Format

function readBlobHeader(pbf: Pbf): { type: string; datasize: number } {
  const obj = { type: "", datasize: 0 };
  pbf.readFields(
    (tag: number, _o: { type: string; datasize: number }, p: Pbf) => {
      if (tag === 1) _o.type = p.readString();
      else if (tag === 3) _o.datasize = p.readVarint(true);
    },
    obj,
    pbf,
  );
  return obj;
}

function readBlob(pbf: Pbf): { raw: Uint8Array | null; zlib_data: Uint8Array | null; raw_size: number } {
  const result: { raw: Uint8Array | null; zlib_data: Uint8Array | null; raw_size: number } = {
    raw: null,
    zlib_data: null,
    raw_size: 0,
  };
  pbf.readFields(
    (tag: number, _obj: unknown, p: Pbf) => {
      if (tag === 1) result.raw = p.readBytes();
      else if (tag === 2) result.raw_size = p.readVarint(true);
      else if (tag === 3) result.zlib_data = p.readBytes();
    },
    result,
    pbf,
  );
  return result;
}

// Full PrimitiveBlock decoder including DenseNodes
function decodePrimitiveBlock(
  data: Uint8Array,
  bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number },
): {
  ways: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }>;
  nodes: Map<number, [number, number]>;
} {
  const pbf = new Pbf(data);

  let stringTable: string[] = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;

  interface DecodedWay {
    id: number;
    keys: number[];
    vals: number[];
    refs: number[];
  }
  interface DenseData {
    ids: number[];
    lats: number[];
    lons: number[];
    keysVals: number[];
  }
  const wayList: DecodedWay[] = [];
  let denseData: DenseData | null = null;
  const standaloneNodes: Array<{ id: number; lat: number; lon: number; keys: number[]; vals: number[] }> = [];

  pbf.readFields(
    (tag: number, _obj: unknown, p: Pbf) => {
      if (tag === 1) {
        // StringTable
        p.readFields(
          (stTag: number, _o: unknown, sp: Pbf) => {
            if (stTag === 1) stringTable.push(sp.readString());
          },
          {},
          p,
        );
      } else if (tag === 2) {
        // PrimitiveGroup
        p.readFields(
          (pgTag: number, _go: unknown, gp: Pbf) => {
            if (pgTag === 1) {
              // Node (standalone)
              const n: { id: number; lat: number; lon: number; keys: number[]; vals: number[] } = {
                id: 0,
                lat: 0,
                lon: 0,
                keys: [],
                vals: [],
              };
              gp.readFields(
                (nTag: number, _no: unknown, np: Pbf) => {
                  if (nTag === 1) n.id = np.readVarint(true);
                  else if (nTag === 2) n.keys.push(np.readVarint(true));
                  else if (nTag === 3) n.vals.push(np.readVarint(true));
                  else if (nTag === 8) n.lat = np.readSVarint();
                  else if (nTag === 9) n.lon = np.readSVarint();
                },
                n,
                gp,
              );
              standaloneNodes.push(n);
            } else if (pgTag === 2) {
              // Way
              const w: DecodedWay = { id: 0, keys: [], vals: [], refs: [] };
              gp.readFields(
                (wTag: number, _wo: unknown, wp: Pbf) => {
                  if (wTag === 1) w.id = wp.readVarint(true);
                  else if (wTag === 2) w.keys.push(wp.readVarint(true));
                  else if (wTag === 3) w.vals.push(wp.readVarint(true));
                  else if (wTag === 8) {
                    let lastRef = 0;
                    while (wp.pos < wp.length) {
                      lastRef += wp.readSVarint();
                      w.refs.push(lastRef);
                    }
                  }
                },
                w,
                gp,
              );
              wayList.push(w);
            } else if (pgTag === 3) {
              // DenseNodes
              const dd: DenseData = { ids: [], lats: [], lons: [], keysVals: [] };
              gp.readFields(
                (dTag: number, _do: unknown, dp: Pbf) => {
                  if (dTag === 1) {
                    dp.readFields(
                      (ddTag: number, _ddo: unknown, ddp: Pbf) => {
                        if (ddTag === 1) {
                          let last = 0;
                          while (ddp.pos < ddp.length) {
                            last += ddp.readSVarint();
                            dd.ids.push(last);
                          }
                        } else if (ddTag === 8) {
                          let last = 0;
                          while (ddp.pos < ddp.length) {
                            last += ddp.readSVarint();
                            dd.lats.push(last);
                          }
                        } else if (ddTag === 9) {
                          let last = 0;
                          while (ddp.pos < ddp.length) {
                            last += ddp.readSVarint();
                            dd.lons.push(last);
                          }
                        } else if (ddTag === 10) {
                          while (ddp.pos < ddp.length) {
                            dd.keysVals.push(ddp.readVarint(true));
                          }
                        }
                      },
                      {},
                      dp,
                    );
                  }
                },
                dd,
                gp,
              );
              denseData = dd;
            } else {
              gp.skip();
            }
          },
          {},
          p,
        );
      } else if (tag === 17) {
        // PrimitiveGroup (alternative field number in some encodings)
        p.readFields(
          (pgTag: number, _go: unknown, gp: Pbf) => {
            if (pgTag === 2) {
              const w: DecodedWay = { id: 0, keys: [], vals: [], refs: [] };
              gp.readFields(
                (wTag: number, _wo: unknown, wp: Pbf) => {
                  if (wTag === 1) w.id = wp.readVarint(true);
                  else if (wTag === 2) w.keys.push(wp.readVarint(true));
                  else if (wTag === 3) w.vals.push(wp.readVarint(true));
                  else if (wTag === 8) {
                    let lastRef = 0;
                    while (wp.pos < wp.length) {
                      lastRef += wp.readSVarint();
                      w.refs.push(lastRef);
                    }
                  }
                },
                w,
                gp,
              );
              wayList.push(w);
            } else if (pgTag === 3) {
              const dd: DenseData = { ids: [], lats: [], lons: [], keysVals: [] };
              gp.readFields(
                (dTag: number, _do: unknown, dp: Pbf) => {
                  if (dTag === 1) {
                    dp.readFields(
                      (ddTag: number, _ddo: unknown, ddp: Pbf) => {
                        if (ddTag === 1) {
                          let last = 0;
                          while (ddp.pos < ddp.length) {
                            last += ddp.readSVarint();
                            dd.ids.push(last);
                          }
                        } else if (ddTag === 8) {
                          let last = 0;
                          while (ddp.pos < ddp.length) {
                            last += ddp.readSVarint();
                            dd.lats.push(last);
                          }
                        } else if (ddTag === 9) {
                          let last = 0;
                          while (ddp.pos < ddp.length) {
                            last += ddp.readSVarint();
                            dd.lons.push(last);
                          }
                        } else if (ddTag === 10) {
                          while (ddp.pos < ddp.length) {
                            dd.keysVals.push(ddp.readVarint(true));
                          }
                        }
                      },
                      {},
                      dp,
                    );
                  }
                },
                dd,
                gp,
              );
              denseData = dd;
            } else {
              gp.skip();
            }
          },
          {},
          p,
        );
      } else if (tag === 19) granularity = pbf.readVarint(true) || 100;
      else if (tag === 20) latOffset = pbf.readVarint(true);
      else if (tag === 21) lonOffset = pbf.readVarint(true);
    },
    {},
    pbf,
  );

  const getString = (idx: number): string => stringTable[idx] ?? "";

  // Build node map from DenseNodes
  const nodeMap = new Map<number, [number, number]>();
  const nodeTags = new Map<number, Record<string, string>>();

  if (denseData) {
    const dd = denseData;
    for (let i = 0; i < dd.ids.length; i++) {
      const lat = latOffset + dd.lats[i] * granularity;
      const lon = lonOffset + dd.lons[i] * granularity;
      const latDeg = lat * 1e-9;
      const lonDeg = lon * 1e-9;
      nodeMap.set(dd.ids[i], [latDeg, lonDeg]);

      // Parse tags from keysVals (dense format: key1, val1, key2, val2, ..., 0 separator)
      let kvi = 0;
      const tags: Record<string, string> = {};
      while (kvi < dd.keysVals.length) {
        const k = dd.keysVals[kvi];
        if (k === 0) {
          kvi++;
          break;
        }
        const v = dd.keysVals[kvi + 1];
        if (k > 0 && v > 0) {
          tags[getString(k)] = getString(v);
        }
        kvi += 2;
      }
      if (Object.keys(tags).length > 0) {
        nodeTags.set(dd.ids[i], tags);
      }
    }
  }

  // Add standalone nodes
  for (const n of standaloneNodes) {
    const lat = (latOffset + n.lat * granularity) * 1e-9;
    const lon = (lonOffset + n.lon * granularity) * 1e-9;
    nodeMap.set(n.id, [lat, lon]);
    const tags: Record<string, string> = {};
    for (let i = 0; i < n.keys.length; i++) {
      tags[getString(n.keys[i])] = getString(n.vals[i]);
    }
    if (Object.keys(tags).length > 0) {
      nodeTags.set(n.id, tags);
    }
  }

  // Build ways with coordinates from refs + nodeMap
  const ways: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }> = [];
  for (const w of wayList) {
    const tags: Record<string, string> = {};
    for (let i = 0; i < w.keys.length; i++) {
      tags[getString(w.keys[i])] = getString(w.vals[i]);
    }

    // Only keep ways with highway tag or addr:street tag
    if (!tags["highway"] && !tags["addr:street"] && !tags["addr:housenumber"]) continue;

    const coords: Array<[number, number]> = [];
    for (const ref of w.refs) {
      const node = nodeMap.get(ref);
      if (node) {
        // Filter by bbox
        if (
          node[0] >= bbox.min_lat && node[0] <= bbox.max_lat &&
          node[1] >= bbox.min_lon && node[1] <= bbox.max_lon
        ) {
          coords.push(node);
        }
      }
    }

    if (coords.length === 0 && w.refs.length === 0) continue;

    ways.push({ id: w.id, tags, nodes: coords });
  }

  // Also extract nodes with addr:housenumber + addr:street as "ways" with a single point
  for (const [nodeId, tags] of nodeTags) {
    if (tags["addr:housenumber"] && tags["addr:street"]) {
      const coord = nodeMap.get(nodeId);
      if (coord) {
        ways.push({
          id: nodeId,
          tags,
          nodes: [coord],
        });
      }
    }
  }

  return { ways, nodes: nodeMap };
}

// Fetch the .pbf file from R2 and extract OSM ways for the given bounding box.
// This is the fallback path — only used when both Overpass endpoints are down.
// The .pbf is a binary OSM PBF format (protobuf blocks with zlib compression).
// We use the `pbf` npm package (pure JS, no native deps) to decode the protobuf
// structure and extract ways with highway/addr tags within the bbox.
async function fetchR2Fallback(
  bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number },
): Promise<{
  ways: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }>;
  nodes: Map<number, [number, number]>;
} | null> {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("R2 fallback skipped: credentials not configured");
    return null;
  }

  // Lazily create the S3 client (only when R2 is actually needed)
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }

  const startTime = Date.now();

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_FILE_KEY,
    });
    const response = await r2Client.send(command);
    if (!response.Body) {
      console.error("R2 fallback: empty response body");
      return null;
    }

    // Download the full .pbf file into memory
    const stream = response.body as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 600 * 1024 * 1024; // 600MB safety cap

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalBytes += value.byteLength;
        if (totalBytes > MAX_BYTES) {
          console.error(`R2 fallback: file exceeds ${MAX_BYTES} bytes, aborting`);
          return null;
        }
      }
    }

    const pbfData = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      pbfData.set(chunk, offset);
      offset += chunk.byteLength;
    }

    console.log(`R2 fallback: downloaded ${pbfData.byteLength} bytes from ${R2_BUCKET}/${R2_FILE_KEY}`);

    // Parse PBF blocks: [4-byte BE header length] [BlobHeader protobuf] [Blob protobuf]
    const allWays: Array<{ id: number; tags: Record<string, string>; nodes: Array<[number, number]> }> = [];
    const allNodes = new Map<number, [number, number]>();
    let pos = 0;
    let blockCount = 0;
    let dataBlockCount = 0;

    while (pos < pbfData.byteLength - 4) {
      const headerLen = (pbfData[pos] << 24) | (pbfData[pos + 1] << 16) | (pbfData[pos + 2] << 8) | pbfData[pos + 3];
      pos += 4;
      if (headerLen <= 0 || pos + headerLen > pbfData.byteLength) break;

      const headerBytes = pbfData.slice(pos, pos + headerLen);
      pos += headerLen;

      // Decode BlobHeader to get type + datasize
      const headerPbf = new Pbf(headerBytes);
      const header = readBlobHeader(headerPbf);
      blockCount++;

      if (header.type !== "OSMData") {
        // Skip the blob
        pos += header.datasize;
        continue;
      }

      if (pos + header.datasize > pbfData.byteLength) break;
      const blobBytes = pbfData.slice(pos, pos + header.datasize);
      pos += header.datasize;

      // Decode Blob to get raw or zlib_data
      const blobPbf = new Pbf(blobBytes);
      const blob = readBlob(blobPbf);

      let blockData: Uint8Array;
      if (blob.zlib_data && blob.zlib_data.length > 0) {
        try {
          const ds = new DecompressionStream("deflate");
          const writer = ds.writable.getWriter();
          writer.write(blob.zlib_data);
          writer.close();
          const dreader = ds.readable.getReader();
          const outChunks: Uint8Array[] = [];
          let outTotal = 0;
          while (true) {
            const { done: ddone, value: dvalue } = await dreader.read();
            if (ddone) break;
            if (dvalue) {
              outChunks.push(dvalue);
              outTotal += dvalue.byteLength;
            }
          }
          blockData = new Uint8Array(outTotal);
          let ooff = 0;
          for (const c of outChunks) {
            blockData.set(c, ooff);
            ooff += c.byteLength;
          }
        } catch (err) {
          console.error(`R2 fallback: decompress failed for block ${dataBlockCount}:`, err);
          continue;
        }
      } else if (blob.raw && blob.raw.length > 0) {
        blockData = blob.raw;
      } else {
        continue;
      }

      dataBlockCount++;

      // Decode the PrimitiveBlock protobuf
      try {
        const decoded = decodePrimitiveBlock(blockData, bbox);
        for (const w of decoded.ways) {
          allWays.push(w);
        }
        for (const [nid, coord] of decoded.nodes) {
          allNodes.set(nid, coord);
        }
      } catch (err) {
        console.error(`R2 fallback: decode failed for block ${dataBlockCount}:`, err);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`R2 fallback: parsed ${blockCount} blocks (${dataBlockCount} data blocks), ${allWays.length} ways, ${allNodes.size} nodes in ${elapsed}ms`);

    if (allWays.length === 0) {
      console.log("R2 fallback: no ways extracted from .pbf");
      return null;
    }

    return { ways: allWays, nodes: allNodes };
  } catch (err) {
    console.error("R2 fallback error:", err);
    return null;
  }
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
  // Map common abbreviations to full state names for better Nominatim results
  const stateNames: Record<string, string> = {
    SP: "São Paulo", RJ: "Rio de Janeiro", MG: "Minas Gerais", RS: "Rio Grande do Sul",
    PR: "Paraná", SC: "Santa Catarina", BA: "Bahia", CE: "Ceará", PE: "Pernambuco",
    GO: "Goiás", DF: "Distrito Federal", ES: "Espírito Santo", MT: "Mato Grosso",
    MS: "Mato Grosso do Sul", PA: "Pará", PB: "Paraíba", RN: "Rio Grande do Norte",
    AL: "Alagoas", PI: "Piauí", MA: "Maranhão", SE: "Sergipe", RO: "Rondônia",
    TO: "Tocantins", AC: "Acre", AM: "Amazonas", AP: "Amapá", RR: "Roraima",
  };
  const stateName = stateNames[stateSigla.toUpperCase()] ?? stateSigla;
  const query = `${city}, ${stateName}, Brazil`;
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

  // Log R2 file reference for audit — the .pbf is only read on Overpass failure (Class B cost avoidance)
  console.log(`R2 configured: ${R2_ENDPOINT ? `${R2_BUCKET}/${R2_FILE_KEY}` : "not configured (Overpass-only mode)"}`);

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

    // Third Overpass mirror (Mail.ru)
    try {
      const resp3 = await fetch("https://maps.mail.ru/osm/tools/overpass/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: `[out:json][timeout:120];(way["highway"](${bbox.min_lat},${bbox.min_lon},${bbox.max_lat},${bbox.max_lon});way["addr:street"](${bbox.min_lat},${bbox.min_lon},${bbox.max_lat},${bbox.max_lon}););out geom;`,
      });
      if (resp3.ok) {
        const data = await resp3.json() as { elements: Array<Record<string, unknown>> };
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
            import_source: "overpass_mailru",
          }).eq("id", cidadeId);
          return new Response(JSON.stringify({
            success: true,
            cidade_id: cidadeId,
            source: "overpass_mailru",
            ...result,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } catch { /* fall through to R2 */ }

    // R2 fallback — read the .pbf file from Cloudflare R2 when all Overpass endpoints fail.
    // This only runs on Overpass failure, not on every request, to avoid R2 Class B costs.
    console.log("All Overpass endpoints failed — attempting R2 .pbf fallback");
    const r2Data = await fetchR2Fallback(bbox);
    if (r2Data && r2Data.ways.length > 0) {
      const result = await processCityData(cidadeId, r2Data);
      await supabase.from("cidades").update({
        import_status: "completed",
        imported_at: new Date().toISOString(),
        import_source: "r2_fallback",
      }).eq("id", cidadeId);
      return new Response(JSON.stringify({
        success: true,
        cidade_id: cidadeId,
        source: "r2_fallback",
        ...result,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
