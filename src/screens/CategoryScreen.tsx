import { Car, Clock, ArrowRight, Sparkles, MapPin } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { MapView } from '@/components/MapView';
import { BackButton } from '@/components/Header';
import type { GeoPoint } from '@/types';

interface CategoryScreenProps {
  origin: GeoPoint;
  destination: GeoPoint | null;
}

export function CategoryScreen({ origin, destination }: CategoryScreenProps) {
  const { goPassenger, selectCategory, selectedCategoryId } = useNav();
  const { settings, company, categories } = useTenant();

  if (!settings) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-sm text-neutral-500">Configurações indisponíveis</p>
      </div>
    );
  }

  const availableCategories = categories.length > 0
    ? [...categories].sort((a, b) => a.sort_order - b.sort_order)
    : [
        {
          id: 'default',
          label: settings.category_label,
          description: settings.category_description,
          eta_minutes: settings.eta_minutes,
          sort_order: 0,
        },
      ];

  return (
    <div className="animate-slide-up">
      <BackButton onClick={() => goPassenger('destination')} label="Voltar" />

      <h1 className="mb-4 text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
        Escolha sua viagem
      </h1>

      <div className="mb-4 h-44 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <MapView origin={origin} destination={destination ?? undefined} className="h-full w-full" />
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
                {destination ? destination.label : 'A definir pelo motorista'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-neutral-200 dark:border-neutral-700 pt-3 text-sm text-neutral-600 dark:text-neutral-400">
          <MapPin className="h-4 w-4 text-gold-500" />
          <span>O valor da corrida sera informado pelo motorista no final.</span>
        </div>
      </div>

      <p className="mb-3 text-sm font-bold text-neutral-700 dark:text-neutral-300">
        Categorias disponíveis
      </p>

      <div className="space-y-3">
        {availableCategories.map((cat, idx) => {
          const isSelected = selectedCategoryId === cat.id;
          const isGold = cat.label.toLowerCase().includes('execut') || cat.label.toLowerCase().includes('premium');
          const Icon = isGold ? Sparkles : Car;

          return (
            <button
              key={cat.id}
              onClick={() => {
                selectCategory(cat.id, null, null, 0);
                goPassenger('tracking');
              }}
              className={`card p-5 w-full text-left transition-all duration-200 hover:shadow-md active:scale-[0.99] group ${
                isSelected ? 'border-gold-500 ring-2 ring-gold-500/30' : 'hover:border-gold-500/50'
              } ${idx === 0 ? 'border-gold-500/30' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  isGold ? 'bg-gold-500/20' : 'bg-gold-500/15'
                } group-hover:bg-gold-500/25`}>
                  <Icon className="h-7 w-7 text-gold-600 dark:text-gold-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {cat.label}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {cat.description}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {cat.eta_minutes} min
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-gold-600 dark:text-gold-400">
                Solicitar
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
