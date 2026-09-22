import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, CheckCircle2 } from 'lucide-react';

export interface CityLocation {
  city: string;
  state: string;
  lat: string;
  lng: string;
}

interface CityAutocompleteProps {
  value: CityLocation;
  onChange: (loc: CityLocation) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    region?: string;
    'ISO3166-2-lvl4'?: string;
  };
}

export function CityAutocomplete({ value, onChange }: CityAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.city && selected) {
      setQuery(`${value.city} - ${value.state}`);
    } else if (value.city && !query) {
      setQuery(`${value.city} - ${value.state}`);
    }
  }, [value.city, value.state, selected, query]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(q.trim())}`;
        const resp = await fetch(url, {
          headers: { 'Accept-Language': 'pt-BR' },
        });
        if (resp.ok) {
          const data: NominatimResult[] = await resp.json();
          setResults(data);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleSelect = (r: NominatimResult) => {
    const cityName = r.address.city || r.address.town || r.address.village || r.address.municipality || '';
    const stateCode = r.address['ISO3166-2-lvl4']?.split('-')[1] || r.address.state || '';
    onChange({
      city: cityName,
      state: stateCode,
      lat: parseFloat(r.lat).toFixed(5),
      lng: parseFloat(r.lon).toFixed(5),
    });
    setSelected(true);
    setOpen(false);
    setResults([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setSelected(false);
    setOpen(true);
    search(v);
  };

  const handleFocus = () => {
    if (results.length > 0) setOpen(true);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Buscar cidade
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Digite o nome da cidade..."
          className="input-field pl-10"
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gold-500" />
        )}
        {selected && !searching && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success-500" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg max-h-64 overflow-y-auto">
          {results.map((r, i) => {
            const cityName = r.address.city || r.address.town || r.address.village || r.address.municipality || 'Cidade';
            const stateCode = r.address['ISO3166-2-lvl4']?.split('-')[1] || r.address.state || '';
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex items-start gap-2 w-full px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-0"
              >
                <MapPin className="h-4 w-4 text-gold-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                    {cityName} {stateCode && ` - ${stateCode}`}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {r.display_name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-gold-500/5 border border-gold-500/20 p-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-400">Cidade</p>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{value.city}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-400">Estado</p>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{value.state}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-400">Latitude</p>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{value.lat}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-400">Longitude</p>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{value.lng}</p>
          </div>
        </div>
      )}
    </div>
  );
}
