import { useState, useRef } from 'react';
import { User, Phone, ArrowRight, AlertCircle, Loader2, MapPin, Navigation, HelpCircle } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { formatPhone, isValidPhone, sanitizeText } from '@/lib/utils';
import type { GeoPoint } from '@/types';

interface PassengerInfo {
  name: string;
  phone: string;
}

interface IdentifyScreenProps {
  onIdentify: (info: PassengerInfo) => void;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  onDestinationChange: (p: GeoPoint | null) => void;
}

interface SearchResult {
  lat: number;
  lng: number;
  label: string;
  housenumber?: string;
}

function extractHouseNumber(value: string): string {
  const commaPart = value.split(',').map((p) => p.trim()).find((p) => /^\d+[A-Za-z]?$/.test(p));
  if (commaPart) return commaPart;
  const match = value.match(/(?:^|,|\s)\d+[A-Za-z]?(?=,|\s|$)/);
  return match?.[0].trim().replace(/^,\s*/, '') ?? '';
}

function addHouseNumber(label: string, houseNumber: string): string {
  const number = houseNumber.trim();
  if (!number || label.split(',').some((p) => p.trim() === number)) return label;
  const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? [parts[0], number, ...parts.slice(1)].join(', ') : `${label}, ${number}`;
}


export function IdentifyScreen({ onIdentify, origin, destination, onDestinationChange }: IdentifyScreenProps) {
  const { goPassenger, tenantSlug } = useNav();
  const { company, location, loading, error, deviceLocked, licenseExpired } = useTenant();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [destQuery, setDestQuery] = useState(destination?.label ?? '');
  const [destResults, setDestResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [destNumber, setDestNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFixedOrigin = !!(location?.pickup_address && location.pickup_lat != null && location.pickup_lng != null);

  const searchAddress = async (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      setDestResults([]);
      return;
    }

    setSearching(true);
    try {
      const nominatimParams = new URLSearchParams({
        format: 'json',
        q: trimmedQuery,
        addressdetails: '1',
        limit: '6',
        countrycodes: 'br',
      });
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`,
        { headers: { 'Accept-Language': 'pt-BR' } },
      );
      const nominatimResults = nominatimResponse.ok
        ? await nominatimResponse.json() as Array<{ lat: string; lon: string; display_name: string; address?: { house_number?: string } }>
        : [];

      if (nominatimResults.length > 0) {
        setDestResults(nominatimResults.map((result) => ({
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          label: result.display_name,
          housenumber: result.address?.house_number,
        })));
        return;
      }

      const photonResponse = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmedQuery)}&limit=6&lang=pt`,
      );
      if (!photonResponse.ok) {
        setDestResults([]);
        return;
      }

      const data = await photonResponse.json() as { features?: Array<{
        geometry: { coordinates: [number, number] };
        properties: { name?: string; street?: string; housenumber?: string; city?: string; state?: string; country?: string };
      }> };
      const results: SearchResult[] = (data.features ?? []).map((feature) => {
        const properties = feature.properties;
        const parts = [
          properties.name,
          properties.housenumber ? `${properties.housenumber} ${properties.street ?? ''}`.trim() : properties.street,
          properties.city,
          properties.state,
          properties.country,
        ].filter(Boolean);
        return {
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          label: parts.join(', '),
          housenumber: properties.housenumber,
        };
      });
      setDestResults(results);
    } catch {
      setDestResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDestInput = (value: string) => {
    setDestQuery(value);
    if (destination) onDestinationChange(null);
    setDestNumber('');
    setDestResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(value), 500);
  };

  const selectDestResult = (result: SearchResult, typedQuery: string) => {
    const typedNumber = extractHouseNumber(typedQuery);
    const rawLabel = result.label;
    const finalLabel = typedNumber ? addHouseNumber(rawLabel, typedNumber) : rawLabel;
    const numberToSet = typedNumber || result.housenumber || extractHouseNumber(rawLabel);
    const point: GeoPoint = { lat: result.lat, lng: result.lng, label: finalLabel };
    onDestinationChange(point);
    setDestQuery(finalLabel);
    setDestNumber(numberToSet);
    setDestResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = sanitizeText(name);
    if (cleanName.length < 3) {
      setFormError('Digite seu nome completo');
      return;
    }
    if (!isValidPhone(phone)) {
      setFormError('Digite um telefone válido com DDD');
      return;
    }

    onIdentify({ name: cleanName, phone });

    if (hasFixedOrigin && origin) {
      goPassenger('category');
    } else {
      goPassenger('destination');
    }
  };

  // No slug in URL — show landing with link to admin
  if (!tenantSlug) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-black/40 p-2 ring-1 ring-gold-400/30 shadow-[0_0_40px_rgba(212,175,55,0.16)]">
            <img src="/veloovrotas.png" alt="Veloov Rotas" className="h-full w-full object-contain" />
          </div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-gold-300/80">Mobilidade sob demanda</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Veloov Rotas
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Plataforma SaaS de dispatch urbano multi-empresa
          </p>
        </div>
        <div className="glass-card rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8 text-center shadow-2xl backdrop-blur-md">
          <p className="text-sm text-slate-300">
            Acesse o link da sua empresa para solicitar uma viagem.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            URL formato: <span className="font-mono text-gold-400">/empresa/local</span>
          </p>
        </div>
      </div>
    );
  }

  // Loading company data from URL slug
  if (loading) {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
        <p className="text-sm text-slate-400">Carregando empresa...</p>
      </div>
    );
  }

  // Company not found or inactive
  if (error || !company) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Empresa não encontrada
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {error ?? 'Verifique o link e tente novamente'}
          </p>
        </div>
      </div>
    );
  }

  // Device fingerprint hard-lock — frozen screen
  if (deviceLocked) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Acesso Negado
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Este link de Totem já está ativo em outro dispositivo físico. Para transferir este Totem de local, o Administrador deve liberar o dispositivo no Painel de Controle clicando em 'Limpar Dispositivo'.
          </p>
        </div>
      </div>
    );
  }

  // License expired — freeze screen with suspension overlay
  if (licenseExpired) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Serviço Temporariamente Suspenso
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Este Totem foi bloqueado devido ao vencimento da assinatura da empresa operadora.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Para regularizar, entre em contato com a administração.
          </p>
        </div>
      </div>
    );
  }

  // Company loaded — show passenger form with optional destination (when fixed origin)
  return (
    <div className="animate-slide-up">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-black/40 p-2 ring-1 ring-gold-400/30 shadow-[0_0_40px_rgba(212,175,55,0.16)]">
          <img src="/veloovrotas.png" alt="Veloov Rotas" className="h-full w-full object-contain" />
        </div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-gold-300/80">Mobilidade sob demanda</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Solicitar viagem
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {company.name}
        </p>
        {location && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gold-300">
            <MapPin className="h-3 w-3" />
            {location.name}
          </p>
        )}
      </div>

      {hasFixedOrigin && origin && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-500/10 border border-success-500/20 px-4 py-3">
          <MapPin className="h-4 w-4 shrink-0 text-success-600" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-success-700 dark:text-success-400">Embarque</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{origin.label}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card space-y-5 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-200">
            Nome completo
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Seu nome"
              className="input-field pl-12"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-200">
            Telefone
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                if (formError) setFormError(null);
              }}
              placeholder="(11) 99999-9999"
              className="input-field pl-12"
              inputMode="numeric"
            />
          </div>
        </div>

        {hasFixedOrigin && origin && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-200">
                Destino
              </label>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <HelpCircle className="h-3 w-3" />
                Opcional
              </span>
            </div>
            <div className="relative">
              <Navigation className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-500" />
              <input
                type="text"
                value={destQuery}
                onChange={(e) => handleDestInput(e.target.value)}
                placeholder="Para onde deseja ir? (opcional)"
                className="input-field pl-12"
              />
              {searching && (
                <Loader2 className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-400" />
              )}
            </div>
            {destResults.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-md">
                {destResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDestResult(r, destQuery)}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                  >
                    <Navigation className="h-4 w-4 mt-0.5 shrink-0 text-primary-500" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {destination && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={destNumber}
                  onChange={(e) => {
                    const newNumber = e.target.value;
                    setDestNumber(newNumber);
                    const baseLabel = destQuery.split(',').map((p) => p.trim()).filter((p) => !/^\d+[A-Za-z]?$/.test(p)).join(', ');
                    if (newNumber.trim()) {
                      const updated = addHouseNumber(baseLabel, newNumber);
                      setDestQuery(updated);
                      onDestinationChange({ lat: destination.lat, lng: destination.lng, label: updated });
                    } else {
                      setDestQuery(baseLabel);
                      onDestinationChange({ lat: destination.lat, lng: destination.lng, label: baseLabel });
                    }
                  }}
                  placeholder="Número do endereço"
                  className="input-field flex-1 text-sm py-2"
                />
              </div>
            )}
            {!destination && destQuery.length === 0 && (
              <p className="mt-1.5 text-xs text-slate-400">
                Digite o endereço e selecione uma sugestão para informar o número.
              </p>
            )}
          </div>
        )}

        {formError && <p className="text-xs font-medium text-error-500">{formError}</p>}

        <button type="submit" className="btn-primary w-full text-base flex items-center justify-center gap-2">
          {hasFixedOrigin ? 'Ver categorias' : 'Escolher destino'}
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
