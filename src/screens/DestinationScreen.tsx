import { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, ArrowRight, Loader2, LocateFixed, CheckCircle2 } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { MapView } from '@/components/MapView';
import { BackButton } from '@/components/Header';
import type { GeoPoint } from '@/types';

interface DestinationScreenProps {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  onOriginChange: (p: GeoPoint | null) => void;
  onDestinationChange: (p: GeoPoint | null) => void;
  fixedOrigin?: boolean;
}

interface SearchResult {
  lat: number;
  lon: number;
  display_name: string;
  type?: string;
  address?: {
    house_number?: string;
  };
}

function normalizeHouseNumber(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

async function geocodeExactHouseNumber(address: string, houseNumber: string): Promise<{ lat: number; lng: number } | null> {
  const expectedNumber = normalizeHouseNumber(houseNumber);

  try {
    const params = new URLSearchParams({
      format: 'json',
      q: address,
      addressdetails: '1',
      limit: '10',
      countrycodes: 'br',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
    if (response.ok) {
      const results: SearchResult[] = await response.json();
      const exactResult = results.find(
        (result) => normalizeHouseNumber(result.address?.house_number ?? '') === expectedNumber
      );
      if (exactResult) {
        return { lat: parseFloat(exactResult.lat.toString()), lng: parseFloat(exactResult.lon.toString()) };
      }
    }
  } catch {
    // try the secondary geocoder below
  }

  try {
    const params = new URLSearchParams({ q: address, limit: '10', lang: 'pt' });
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!response.ok) return null;

    const data = await response.json() as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { housenumber?: string };
      }>;
    };
    const exactFeature = data.features?.find(
      (feature) => normalizeHouseNumber(feature.properties?.housenumber ?? '') === expectedNumber
    );
    const coordinates = exactFeature?.geometry?.coordinates;
    if (!coordinates) return null;
    return { lat: coordinates[1], lng: coordinates[0] };
  } catch {
    return null;
  }
}

function extractHouseNumber(value: string): string {
  const commaPart = value.split(',').map((part) => part.trim()).find((part) => /^\d+[A-Za-z]?$/.test(part));
  if (commaPart) return commaPart;
  const match = value.match(/(?:^|,|\s)\d+[A-Za-z]?(?=,|\s|$)/);
  return match?.[0].trim().replace(/^,\s*/, '') ?? '';
}

function addHouseNumber(label: string, houseNumber: string): string {
  const number = houseNumber.trim();
  if (!number || label.split(',').some((part) => part.trim() === number)) return label;
  const parts = label.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? [parts[0], number, ...parts.slice(1)].join(', ') : `${label}, ${number}`;
}

export function DestinationScreen({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  fixedOrigin = false,
}: DestinationScreenProps) {
  const { goPassenger } = useNav();
  const [originQuery, setOriginQuery] = useState(origin?.label ?? '');
  const [destQuery, setDestQuery] = useState(destination?.label ?? '');
  const [originNumber, setOriginNumber] = useState(() => extractHouseNumber(origin?.label ?? ''));
  const [destNumber, setDestNumber] = useState(() => extractHouseNumber(destination?.label ?? ''));
  const [originResults, setOriginResults] = useState<SearchResult[]>([]);
  const [destResults, setDestResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState<'origin' | 'dest' | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originSetByGps = useRef(false);

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data = await res.json();
      return data?.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  const useGpsLocation = async () => {
    if (!navigator.geolocation) {
      setGpsError('Seu dispositivo não suporta localização por GPS');
      return;
    }

    setLocating(true);
    setGpsError(null);

    const requestPosition = (enableHighAccuracy: boolean): Promise<GeolocationPosition> => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy,
        timeout: enableHighAccuracy ? 15000 : 12000,
        maximumAge: 30000,
      });
    });

    try {
      let position: GeolocationPosition;
      try {
        position = await requestPosition(false);
      } catch (firstError) {
        const error = firstError as GeolocationPositionError;
        if (error.code === error.PERMISSION_DENIED) throw error;
        position = await requestPosition(true);
      }

      const { latitude: lat, longitude: lng } = position.coords;
      originSetByGps.current = true;
      const label = await reverseGeocode(lat, lng);
      onOriginChange({ lat, lng, label });
      setOriginQuery(label);
      setOriginNumber(extractHouseNumber(label));
      setOriginResults([]);
      setGpsActive(true);
    } catch (caughtError) {
      const error = caughtError as GeolocationPositionError;
      if (error.code === error.PERMISSION_DENIED) {
        setGpsError('Permita a localização no navegador para usar o GPS.');
      } else {
        setGpsError('Não foi possível obter sua localização. Verifique se a permissão está ativada e tente novamente.');
      }
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!fixedOrigin && !origin && !originSetByGps.current) {
      useGpsLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchAddress = async (query: string, type: 'origin' | 'dest') => {
    if (query.length < 3) {
      if (type === 'origin') setOriginResults([]);
      else setDestResults([]);
      return;
    }

    setSearching(type);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data: SearchResult[] = await res.json();
      if (type === 'origin') setOriginResults(data);
      else setDestResults(data);
    } catch {
      // network error — clear results silently
    } finally {
      setSearching(null);
    }
  };

  const handleInput = (value: string, type: 'origin' | 'dest') => {
    if (type === 'origin') {
      setOriginQuery(value);
      if (gpsActive) setGpsActive(false);
    } else {
      setDestQuery(value);
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(value, type), 500);
  };

  const selectResult = async (result: SearchResult, type: 'origin' | 'dest', typedQuery: string) => {
    const typedNumber = extractHouseNumber(typedQuery);
    const rawLabel = result.display_name.split(',').slice(0, 4).join(', ');
    const finalLabel = typedNumber ? addHouseNumber(rawLabel, typedNumber) : rawLabel;
    const numberToSet = typedNumber || extractHouseNumber(rawLabel);

    let lat = parseFloat(result.lat.toString());
    let lng = parseFloat(result.lon.toString());

    if (typedNumber) {
      const exactResult = await geocodeExactHouseNumber(finalLabel, typedNumber);
      if (exactResult) {
        lat = parseFloat(exactResult.lat.toString());
        lng = parseFloat(exactResult.lon.toString());
      }
    }

    const point: GeoPoint = { lat, lng, label: finalLabel };
    if (type === 'origin') {
      onOriginChange(point);
      setOriginQuery(finalLabel);
      setOriginNumber(numberToSet);
      setOriginResults([]);
      setGpsActive(false);
    } else {
      onDestinationChange(point);
      setDestQuery(finalLabel);
      setDestNumber(numberToSet);
      setDestResults([]);
    }
  };

  const regeocodeWithNumber = async (
    basePoint: GeoPoint,
    number: string,
    type: 'origin' | 'dest'
  ): Promise<void> => {
    if (!number.trim()) {
      const baseLabel = basePoint.label.split(',').filter((part) => part.trim() !== extractHouseNumber(basePoint.label)).join(', ').trim();
      if (type === 'origin') {
        onOriginChange({ ...basePoint, label: baseLabel });
        setOriginQuery(baseLabel);
      } else {
        onDestinationChange({ ...basePoint, label: baseLabel });
        setDestQuery(baseLabel);
      }
      return;
    }

    const baseLabel = basePoint.label.split(',').filter((part) => part.trim() !== extractHouseNumber(basePoint.label)).join(', ').trim();
    const fullAddress = addHouseNumber(baseLabel, number);

    if (type === 'origin') setSearching('origin');
    else setSearching('dest');

    try {
      const exactResult = await geocodeExactHouseNumber(fullAddress, number);
      const newPoint: GeoPoint = exactResult
        ? {
            lat: parseFloat(exactResult.lat.toString()),
            lng: parseFloat(exactResult.lon.toString()),
            label: fullAddress,
          }
        : { ...basePoint, label: fullAddress };

      if (type === 'origin') {
        onOriginChange(newPoint);
        setOriginQuery(fullAddress);
      } else {
        onDestinationChange(newPoint);
        setDestQuery(fullAddress);
      }
    } finally {
      setSearching(null);
    }
  };

  const applyOriginNumber = (value: string) => {
    setOriginNumber(value);
  };

  const applyDestNumber = (value: string) => {
    setDestNumber(value);
  };

  const canProceed = origin && destination;

  return (
    <div className="animate-slide-up">
      <BackButton onClick={() => goPassenger('identify')} label="Voltar" />

      <h1 className="mb-6 text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
        {fixedOrigin ? 'Para onde deseja ir?' : 'Para onde vamos?'}
      </h1>

      <div className="mb-4 h-48 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <MapView origin={origin} destination={destination} className="h-full w-full" />
      </div>

      {fixedOrigin && origin && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-500/10 border border-success-500/20 px-4 py-3">
          <MapPin className="h-4 w-4 shrink-0 text-success-600" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-success-700 dark:text-success-400">Embarque fixo</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{origin.label}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Ponto de partida
            </label>
            <button
              type="button"
              onClick={useGpsLocation}
              disabled={locating}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                gpsActive
                  ? 'text-success-600'
                  : 'text-gold-600 dark:text-gold-400 hover:text-gold-700 dark:hover:text-gold-300'
              }`}
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : gpsActive ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <LocateFixed className="h-3.5 w-3.5" />
              )}
              {locating ? 'Localizando...' : gpsActive ? 'GPS ativo' : 'Usar minha localização'}
            </button>
          </div>
          <div className="relative">
            <MapPin className={`absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 ${gpsActive ? 'text-success-500' : 'text-gold-500'}`} />
            <input
              type="text"
              value={originQuery}
              onChange={(e) => handleInput(e.target.value, 'origin')}
              placeholder={locating ? 'Obtendo sua localização...' : 'Endereço de origem'}
              className={`input-field pl-12 ${gpsActive ? 'border-success-500/40 bg-success-500/5' : ''}`}
              autoFocus={!origin}
            />
            {searching === 'origin' && (
              <Loader2 className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-400" />
            )}
          </div>
          {gpsError && (
            <div className="mt-1.5 flex flex-col gap-2">
              <p className="text-xs text-error-500 flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {gpsError}
              </p>
              <button
                type="button"
                onClick={useGpsLocation}
                disabled={locating}
                className="flex items-center gap-1.5 text-xs font-semibold text-gold-600 dark:text-gold-400 hover:text-gold-700 dark:hover:text-gold-300 transition-colors w-fit"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          )}
          {gpsActive && (
            <p className="mt-1.5 text-xs text-success-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Localização detectada pelo GPS. Você pode editar o endereço se precisar.
            </p>
          )}
          {originResults.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-md">
              {originResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectResult(r, 'origin', originQuery)}
                  className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                >
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gold-500" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
                    {r.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
          {origin && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={originNumber}
                onChange={(e) => applyOriginNumber(e.target.value)}
                onBlur={() => origin && regeocodeWithNumber(origin, originNumber, 'origin')}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="Número (opcional)"
                className="input-field flex-1 text-sm py-2"
              />
              {!originNumber && (
                <span className="text-xs text-neutral-400 whitespace-nowrap">Sem número</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Destino
          </label>
          <div className="relative">
            <Navigation className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-500" />
            <input
              type="text"
              value={destQuery}
              onChange={(e) => handleInput(e.target.value, 'dest')}
              placeholder="Para onde deseja ir?"
              className="input-field pl-12"
            />
            {searching === 'dest' && (
              <Loader2 className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-400" />
            )}
          </div>
          {destResults.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-md">
              {destResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectResult(r, 'dest', destQuery)}
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
                onChange={(e) => applyDestNumber(e.target.value)}
                onBlur={() => destination && regeocodeWithNumber(destination, destNumber, 'dest')}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="Número (opcional)"
                className="input-field flex-1 text-sm py-2"
              />
              {!destNumber && (
                <span className="text-xs text-neutral-400 whitespace-nowrap">Sem número</span>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => goPassenger('category')}
        disabled={!canProceed}
        className="btn-primary mt-6 w-full text-base flex items-center justify-center gap-2"
      >
        Ver categorias
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}
