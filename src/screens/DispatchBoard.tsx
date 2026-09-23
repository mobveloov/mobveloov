import { useState, useEffect } from 'react';
import { Radio, User, Phone, MapPin, Car, CheckCircle2, X, Loader2, Send, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatTimeAgo } from '@/lib/utils';
import { RideChat } from '@/components/RideChat';
import type { Ride, Driver, OrderStatus } from '@/types';

const STATUS_LABELS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'Aguardando', cls: 'bg-warning-500/15 text-warning-600' },
  accepted: { label: 'Aceito', cls: 'bg-primary-500/15 text-primary-600' },
  en_route: { label: 'A caminho', cls: 'bg-primary-500/15 text-primary-600' },
  in_progress: { label: 'Em viagem', cls: 'bg-gold-500/15 text-gold-700 dark:text-gold-300' },
  completed: { label: 'Concluído', cls: 'bg-success-500/15 text-success-600' },
  canceled: { label: 'Cancelado', cls: 'bg-error-500/15 text-error-500' },
};

export function DispatchBoard() {
  const { company } = useAuth();
  const [pendingRides, setPendingRides] = useState<Ride[]>([]);
  const [activeRides, setActiveRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAssignFor, setShowAssignFor] = useState<string | null>(null);

  const loadData = async () => {
    if (!company) return;

    const { data: pending } = await supabase
      .from('rides')
      .select('*')
      .eq('company_id', company.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);

    setPendingRides((pending ?? []) as Ride[]);

    const { data: active } = await supabase
      .from('rides')
      .select('*')
      .eq('company_id', company.id)
      .in('status', ['accepted', 'en_route', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20);

    setActiveRides((active ?? []) as Ride[]);

    const { data: drs } = await supabase
      .from('drivers')
      .select('*')
      .eq('company_id', company.id)
      .eq('is_available', true)
      .order('name', { ascending: true });

    setDrivers((drs ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    if (!company) return;

    const channel = supabase
      .channel(`dispatch-${company.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `company_id=eq.${company.id}` },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers', filter: `company_id=eq.${company.id}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company]);

  const assignDriver = async (ride: Ride, driver: Driver) => {
    setAssigning(ride.id);
    setShowAssignFor(null);

    const { error: updErr } = await supabase
      .from('rides')
      .update({
        status: 'accepted',
        driver_name: driver.name,
        driver_phone: driver.phone,
        vehicle_plate: driver.vehicle_plate,
        vehicle_model: driver.vehicle_model,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ride.id);

    if (updErr) {
      setAssigning(null);
      return;
    }

    // Try to send WhatsApp notification to driver via edge function
    if (company) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            companySlug: company.slug,
            integrationMode: 'manual',
            rideId: ride.id,
            action: 'notify_driver',
            driverPhone: driver.phone,
            driverName: driver.name,
            passengerName: ride.passenger_name,
            passengerPhone: ride.passenger_phone,
            origin: ride.origin_label,
            destination: ride.destination_label,
            price: ride.estimated_price,
          }),
        });
      } catch {
        // best-effort notification
      }
    }

    // Mark driver as unavailable
    await supabase
      .from('drivers')
      .update({ is_available: false, updated_at: new Date().toISOString() })
      .eq('id', driver.id);

    setAssigning(null);
    loadData();
  };

  const cancelRide = async (ride: Ride) => {
    await supabase
      .from('rides')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', ride.id);
    loadData();
  };

  const completeRide = async (ride: Ride) => {
    await supabase
      .from('rides')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', ride.id);

    // Free the driver
    if (ride.driver_phone) {
      const { data: dr } = await supabase
        .from('drivers')
        .select('id')
        .eq('company_id', ride.company_id)
        .eq('phone', ride.driver_phone)
        .maybeSingle();
      if (dr) {
        await supabase
          .from('drivers')
          .update({ is_available: true, updated_at: new Date().toISOString() })
          .eq('id', dr.id);
      }
    }
    loadData();
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <Radio className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Central de dispatch
          </h2>
          <p className="text-sm text-neutral-500">
            Designe motoristas para corridas pendentes em tempo real
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning-500/20">
            <Clock className="h-3 w-3 text-warning-600" />
          </span>
          Pendentes ({pendingRides.length})
        </h3>
        {pendingRides.length === 0 ? (
          <div className="card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success-500" />
            <p className="text-sm text-neutral-500">Nenhuma corrida pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRides.map((ride) => (
              <div key={ride.id} className="card p-4 border-l-4 border-l-warning-500">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-neutral-400" />
                      <p className="font-bold text-neutral-900 dark:text-neutral-100">{ride.passenger_name}</p>
                      <span className="text-xs text-neutral-400">{formatTimeAgo(ride.created_at)}</span>
                    </div>
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
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
                    <p className="text-xs text-neutral-400">{ride.category_label}</p>
                  </div>
                </div>

                {showAssignFor === ride.id ? (
                  <div className="border-t border-neutral-100 dark:border-neutral-700 pt-3">
                    <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                      Selecione um motorista:
                    </p>
                    {drivers.length === 0 ? (
                      <p className="text-xs text-neutral-400">Nenhum motorista disponível. Cadastre motoristas no painel "Motoristas".</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {drivers.map((driver) => (
                          <button
                            key={driver.id}
                            onClick={() => assignDriver(ride, driver)}
                            disabled={assigning === ride.id}
                            className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gold-500/10 transition-colors text-left"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/15">
                              <Car className="h-4 w-4 text-success-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{driver.name}</p>
                              <p className="text-xs text-neutral-400">
                                {driver.vehicle_model ?? 'Sem veículo'} {driver.vehicle_plate ? `· ${driver.vehicle_plate}` : ''}
                              </p>
                            </div>
                            {assigning === ride.id && <Loader2 className="h-4 w-4 animate-spin text-gold-500" />}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowAssignFor(null)}
                      className="mt-2 text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAssignFor(ride.id)}
                      disabled={assigning === ride.id}
                      className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5"
                    >
                      <Send className="h-4 w-4" />
                      Designar motorista
                    </button>
                    <button
                      onClick={() => cancelRide(ride)}
                      className="btn-secondary px-3 py-2 text-error-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeRides.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/20">
              <Car className="h-3 w-3 text-primary-600" />
            </span>
            Em andamento ({activeRides.length})
          </h3>
          <div className="space-y-3">
            {activeRides.map((ride) => {
              const st = STATUS_LABELS[ride.status as OrderStatus] ?? STATUS_LABELS.pending;
              return (
                <div key={ride.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {ride.passenger_name}
                        </p>
                      </div>
                      <p className="text-xs text-neutral-500">
                        Motorista: {ride.driver_name ?? '—'}
                      </p>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {ride.origin_label} → {ride.destination_label}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-sm font-extrabold text-gold-600 dark:text-gold-400">
                        R$ {ride.estimated_price.toFixed(2).replace('.', ',')}
                      </p>
                      {ride.status === 'in_progress' && (
                        <button
                          onClick={() => completeRide(ride)}
                          className="text-xs font-semibold text-success-600 hover:text-success-700"
                        >
                          Concluir
                        </button>
                      )}
                    </div>
                  </div>
                  <RideChat
                    rideId={ride.id}
                    rideStatus={ride.status}
                    passengerName={ride.passenger_name}
                    passengerPhone={ride.passenger_phone}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
