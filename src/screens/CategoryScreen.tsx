import { useState, useEffect, useRef } from 'react';
import { Car, Clock, ArrowRight, Sparkles, Loader2, MapPin, AlertCircle, HelpCircle } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { MapView } from '@/components/MapView';
import { BackButton } from '@/components/Header';
import { formatCurrency } from '@/lib/utils';
import { calculateCategoryPricing, fetchMachineEstimates, type MachineEstimateCategory } from '@/lib/machineApi';
import type { GeoPoint, CategoryPricing, VehicleCategory } from '@/types';

interface CategoryScreenProps {
  origin: GeoPoint;
  destination: GeoPoint;
}

interface QuoteCache {
  key: string;
  data: Record<string, MachineEstimateCategory>;
  distance: number | null;
  duration: number | null;
  timestamp: number;
}

let quoteCache: QuoteCache | null = null;
const CACHE_TTL = 120000;

export function CategoryScreen({ origin, destination }: CategoryScreenProps) {
  const { goPassenger, selectCategory, selectedCategoryId } = useNav();
  const { settings, company, categories } = useTenant();
  const [machineEstimates, setMachineEstimates] = useState<Record<string, MachineEstimateCategory>>({});
  const [machineDistance, setMachineDistance] = useState<number | null>(null);
  const [machineDuration, setMachineDuration] = useState<number | null>(null);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const isMachineMode = settings?.integration_mode === 'machine';
  const hasLinkedCategories = categories.some((c) => c.machine_category_id);
  const requirePrice = settings?.require_price_before_dispatch ?? false;

  useEffect(() => {
    if (!company || !settings || !isMachineMode || !hasLinkedCategories) return;

    const cacheKey = `${company.slug}:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
    if (quoteCache && quoteCache.key === cacheKey && Date.now() - quoteCache.timestamp < CACHE_TTL) {
      setMachineEstimates(quoteCache.data);
      setMachineDistance(quoteCache.distance);
      setMachineDuration(quoteCache.duration);
      setEstimateError(Object.keys(quoteCache.data).length === 0 ? 'no_estimates' : null);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    setLoadingEstimates(true);
    setEstimateError(null);

    (async () => {
      const result = await fetchMachineEstimates(company.slug, origin, destination);
      if (currentFetchId !== fetchIdRef.current) return;

      if (result.success && result.data?.categorias && result.data.categorias.length > 0) {
        const map: Record<string, MachineEstimateCategory> = {};
        for (const cat of result.data.categorias) {
          map[String(cat.categoria_id)] = cat;
        }
        setMachineEstimates(map);
        const dist = result.data.estimativa_km != null ? parseFloat(Number(result.data.estimativa_km).toFixed(2)) : null;
        const dur = result.data.estimativa_minutos != null ? parseFloat(Number(result.data.estimativa_minutos).toFixed(0)) : null;
        setMachineDistance(dist);
        setMachineDuration(dur);
        setEstimateError(null);
        quoteCache = { key: cacheKey, data: map, distance: dist, duration: dur, timestamp: Date.now() };
      } else {
        setMachineEstimates({});
        setMachineDistance(null);
        setMachineDuration(null);
        setEstimateError(result.error ?? 'no_estimates');
        quoteCache = { key: cacheKey, data: {}, distance: null, duration: null, timestamp: Date.now() };
      }
      setLoadingEstimates(false);
    })();
  }, [company, settings, origin, destination, isMachineMode, hasLinkedCategories]);

  if (!settings) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-sm text-neutral-500">Configurações de preço indisponíveis</p>
      </div>
    );
  }

  const surge = settings.surge_multiplier;
  const estimatesAvailable = Object.keys(machineEstimates).length > 0;

  const pricedCategories: (CategoryPricing & { machine_category_id?: string })[] = categories.length > 0
    ? categories.map((cat: VehicleCategory) => {
        const localPricing = calculateCategoryPricing(origin, destination, cat, surge).pricing;
        const machineCat = cat.machine_category_id ? machineEstimates[cat.machine_category_id] : null;
        if (machineCat) {
          return {
            ...localPricing,
            base_price: parseFloat(Number(machineCat.estimativa_valor).toFixed(2)),
            final_price: parseFloat(Number(machineCat.estimativa_valor).toFixed(2)),
            machine_category_id: cat.machine_category_id,
          };
        }
        return localPricing;
      })
    : [
        {
          id: 'default',
          label: settings.category_label,
          description: settings.category_description,
          base_price: 0,
          final_price: Math.max(
            settings.min_fee,
            (settings.base_fee + 0 * settings.per_km_rate) * surge
          ),
          eta_minutes: settings.eta_minutes,
          sort_order: 0,
        },
      ];

  const sorted = [...pricedCategories].sort((a, b) => a.sort_order - b.sort_order);

  const showMachineError = isMachineMode && hasLinkedCategories && !loadingEstimates && !estimatesAvailable && estimateError !== null;

  const isPriceUnavailable = (cat: CategoryPricing & { machine_category_id?: string }): boolean => {
    if (!isMachineMode || !hasLinkedCategories) return false;
    if (loadingEstimates) return false;
    if (estimatesAvailable && cat.machine_category_id && machineEstimates[cat.machine_category_id]) return false;
    return true;
  };

  return (
    <div className="animate-slide-up">
      <BackButton onClick={() => goPassenger('destination')} label="Voltar" />

      <h1 className="mb-4 text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
        Escolha sua viagem
      </h1>

      <div className="mb-4 h-44 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <MapView origin={origin} destination={destination} className="h-full w-full" />
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="mt-0.5 flex flex-col items-center">
            <div className="flex h-3 w-3 items-center justify-center rounded-full bg-gold-500" />
            <div className="h-6 w-0.5 bg-neutral-300 dark:bg-neutral-600" />
            <div className="flex h-3 w-3 items-center justify-center rounded-full bg-primary-500" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-neutral-400">Origem</p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-1">
                {origin.label}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-neutral-400">Destino</p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-1">
                {destination.label}
              </p>
            </div>
          </div>
        </div>
        {machineDistance !== null && machineDuration !== null && (
          <div className="flex items-center gap-4 border-t border-neutral-200 dark:border-neutral-700 pt-3 text-sm">
            <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <MapPin className="h-4 w-4 text-gold-500" />
              {machineDistance.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <Clock className="h-4 w-4 text-gold-500" />
              ~{machineDuration} min
            </span>

          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
          Categorias disponíveis
        </p>
        {loadingEstimates && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Calculando preços...
          </span>
        )}

      </div>

      {showMachineError && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-warning-500/30 bg-warning-500/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-warning-500" />
          <div>
            <p className="text-sm font-semibold text-warning-600 dark:text-warning-400">
              Não conseguimos calcular o valor exato agora
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {requirePrice
                ? 'A cotação em tempo real indisponível no momento. Tente novamente em instantes.'
                : 'O motorista informará o valor da corrida no ato.'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((cat, idx) => {
          const isSelected = selectedCategoryId === cat.id;
          const isGold = cat.label.toLowerCase().includes('execut') || cat.label.toLowerCase().includes('premium');
          const Icon = isGold ? Sparkles : Car;
          const isCalculating = loadingEstimates && (!estimatesAvailable || (hasLinkedCategories && !cat.machine_category_id));
          const hasMachinePrice = !!(cat as CategoryPricing & { machine_category_id?: string }).machine_category_id && estimatesAvailable;
          const priceUnavailable = isPriceUnavailable(cat);
          const showFallbackPrice = priceUnavailable && !isCalculating;
          const disableButton = (isCalculating && !hasMachinePrice && isMachineMode && hasLinkedCategories) || (showFallbackPrice && requirePrice);

          return (
            <button
              key={cat.id}
              onClick={() => {
                const useMachineDist = machineDistance !== null && machineDuration !== null;
                selectCategory(
                  cat.id,
                  useMachineDist ? machineDistance : undefined,
                  useMachineDist ? machineDuration : undefined,
                  cat.final_price,
                );
                goPassenger('tracking');
              }}
              disabled={disableButton}
              className={`card p-5 w-full text-left transition-all duration-200 hover:shadow-md active:scale-[0.99] group ${
                isSelected ? 'border-gold-500 ring-2 ring-gold-500/30' : 'hover:border-gold-500/50'
              } ${idx === 0 ? 'border-gold-500/30' : ''} ${
                disableButton ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  isGold ? 'bg-gold-500/20' : 'bg-gold-500/15'
                } group-hover:bg-gold-500/25`}>
                  <Icon className="h-7 w-7 text-gold-600 dark:text-gold-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {cat.label}
                    </p>
                    {isCalculating && !hasMachinePrice ? (
                      <span className="flex items-center gap-1.5 text-sm text-neutral-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculando...
                      </span>
                    ) : showFallbackPrice ? (
                      <span className="flex items-center gap-1.5 text-base font-bold text-neutral-400 dark:text-neutral-500">
                        <HelpCircle className="h-4 w-4" />
                        Valor a confirmar
                      </span>
                    ) : (
                      <span className="text-2xl font-extrabold text-gold-600 dark:text-gold-400">
                        {formatCurrency(cat.final_price)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {cat.description}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {cat.eta_minutes} min
                    </span>
                    {hasMachinePrice && cat.base_price > cat.final_price && (
                      <span className="text-neutral-400 line-through">
                        {formatCurrency(cat.base_price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`mt-3 flex items-center justify-center gap-2 text-sm font-semibold ${
                showFallbackPrice && requirePrice
                  ? 'text-neutral-400'
                  : 'text-gold-600 dark:text-gold-400'
              }`}>
                {showFallbackPrice && requirePrice
                  ? 'Cotação indisponível'
                  : showFallbackPrice
                  ? 'Solicitar (valor a confirmar)'
                  : 'Solicitar'}
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>

      {company && (
        <p className="mt-4 text-center text-xs text-neutral-400">
          Operado por {company.name}
        </p>
      )}
    </div>
  );
}
