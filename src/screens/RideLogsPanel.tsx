import { useState, useEffect } from 'react';
import { Car, Phone, Clock, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatTimeAgo } from '@/lib/utils';
import type { Ride, OrderStatus } from '@/types';

const STATUS_STYLES: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'Aguardando', cls: 'bg-warning-500/15 text-warning-600' },
  accepted: { label: 'Aceito', cls: 'bg-primary-500/15 text-primary-600' },
  en_route: { label: 'A caminho', cls: 'bg-primary-500/15 text-primary-600' },
  in_progress: { label: 'Em viagem', cls: 'bg-gold-500/15 text-gold-700 dark:text-gold-300' },
  completed: { label: 'Concluído', cls: 'bg-success-500/15 text-success-600' },
  canceled: { label: 'Cancelado', cls: 'bg-error-500/15 text-error-500' },
};

export function RideLogsPanel() {
  const { company } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setRides(data as Ride[]);
      setLoading(false);
    })();
  }, [company]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div className="animate-slide-up">
        <h2 className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Histórico de corridas
        </h2>
        <div className="card p-8 text-center">
          <Car className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Nenhuma corrida registrada ainda</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <h2 className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-100">
        Histórico de corridas
      </h2>
      <div className="space-y-3">
        {rides.map((ride) => {
          const style = STATUS_STYLES[ride.status as OrderStatus] ?? STATUS_STYLES.pending;
          return (
            <div key={ride.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.cls}`}>
                      {style.label}
                    </span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(ride.created_at)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {ride.passenger_name}
                  </p>
                  <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />
                    {ride.passenger_phone}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-gold-500 shrink-0" />
                      <span className="truncate">{ride.origin_label}</span>
                    </p>
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary-500 shrink-0" />
                      <span className="truncate">{ride.destination_label}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-gold-600 dark:text-gold-400">
                    R$ {ride.estimated_price.toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-xs text-neutral-400">{ride.distance_km.toFixed(1)} km</p>
                  {ride.driver_name && (
                    <p className="text-xs text-neutral-500 mt-1">{ride.driver_name}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
