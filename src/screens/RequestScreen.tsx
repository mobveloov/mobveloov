import { useState, useRef, useEffect } from 'react';
import { User, Phone, Navigation, ArrowRight, MapPin, Loader2, CheckCircle2, HelpCircle } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { formatPhone, isValidPhone, sanitizeText } from '@/lib/utils';
import { MapView } from '@/components/MapView';
import { BackButton } from '@/components/Header';
import type { GeoPoint } from '@/types';

interface RequestScreenProps {
  origin: GeoPoint;
  onDestinationChange: (p: GeoPoint | null) => void;
  destination: GeoPoint | null;
}

interface SearchResult {
  lat: number;
  lon: number;
  display_name: string;
  type?: string;
  address?: { house_number?: string };
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

export function RequestScreen({ origin, onDestinationChange, destination }: RequestScreenProps) {
  const { goPassenger } = useNav();
  const { company, location } = useTenant();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [destQuery, setDestQuery] = useState(destination?.label ?? '');
  const [destNumber, setDestNumber] = useState(() => extractHouseNumber(destination?.label ?? ''));
  const [destResults, setDestResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destInputRef = useRef<HTMLInputElement | null>(null);

  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setDestResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } },
      );
      const data: SearchResult[] = await res.json();
      setDestResults(data);
    } catch {
      setDestResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDestInput = (value: string) => {
    setDestQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(value), 500);
  };

  const selectResult = (result: SearchResult, typedQuery: string) => {
    const typedNumber = extractHouseNumber(typedQuery);
    const rawLabel = result.display_name.split(',').slice(0, 4).join(', ');
    const finalLabel = typedNumber ? addHouseNumber(rawLabel, typedNumber) : rawLabel;
    const numberToSet = typedNumber || extractHouseNumber(rawLabel);
    const point: GeoPoint = { lat: result.lat, lng: result.lon, label: finalLabel };
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

    goPassenger('category');
  };

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  return (
    <div className="animate-slide-up">
      <BackButton onClick={() => goPassenger('identify')} label="Voltar" />

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
          Solicitar viagem
        </h1>
        {location && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gold-600 dark:text-gold-400">
            <MapPin className="h-3 w-3" />
            {location.name}
          </p>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-500/10 border border-success-500/20 px-4 py-3">
        <MapPin className="h-4 w-4 shrink-0 text-success-600" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-success-700 dark:text-success-400">Embarque</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{origin.label}</p>
        </div>
      </div>

      <div className="mb-4 h-40 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <MapView origin={origin} destination={destination} className="h-full w-full" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
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
          <label className="mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Destino
            </label>
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <HelpCircle className="h-3 w-3" />
              Opcional
            </span>
          </div>
          <div className="relative">
            <Navigation className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-500" />
            <input
              ref={destInputRef}
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
                  onClick={() => selectResult(r, destQuery)}
                  className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                >
                  <Navigation className="h-4 w-4 mt-0.5 shrink-0 text-primary-500" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
                    {r.display_name}
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
                onChange={(e) => setDestNumber(e.target.value)}
                placeholder="Número (opcional)"
                className="input-field flex-1 text-sm py-2"
              />
            </div>
          )}
          {!destination && destQuery.length === 0 && (
            <p className="mt-1.5 text-xs text-neutral-400">
              Se não souber o endereço, pode chamar sem destino. O valor sera calculado no final da corrida.
            </p>
          )}
        </div>

        {formError && <p className="text-xs font-medium text-error-500">{formError}</p>}

        <button type="submit" className="btn-primary w-full text-base flex items-center justify-center gap-2">
          {destination ? 'Ver categoria e preço' : 'Chamar corrida'}
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>

      {company && (
        <p className="mt-4 text-center text-xs text-neutral-400">
          Operado por {company.name}
        </p>
      )}
    </div>
  );
}
