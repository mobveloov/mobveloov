import { useState, useEffect, useRef } from 'react';
import { Clock, Navigation, Phone, X, CheckCircle2, Car, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/context/TenantContext';
import { useNav } from '@/context/NavContext';
import { dispatchRide, cancelRide, pollRideStatus } from '@/lib/machineApi';
import { MapView } from '@/components/MapView';
import { haversineDistance } from '@/lib/utils';
import type { GeoPoint, OrderStatus, Ride, VehicleCategory } from '@/types';

const STATUS_FLOW: OrderStatus[] = ['pending', 'accepted', 'en_route', 'in_progress', 'completed'];

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Aguardando motorista', color: 'text-warning-500', icon: Clock },
  accepted: { label: 'Motorista aceitou', color: 'text-primary-500', icon: CheckCircle2 },
  en_route: { label: 'Motorista chegou', color: 'text-primary-500', icon: Car },
  in_progress: { label: 'Viagem em andamento', color: 'text-gold-600', icon: Navigation },
  completed: { label: 'Viagem concluída', color: 'text-success-600', icon: CheckCircle2 },
  canceled: { label: 'Viagem cancelada', color: 'text-error-500', icon: X },
};

interface TrackingScreenProps {
  origin: GeoPoint;
  destination: GeoPoint | null;
  passengerName: string;
  passengerPhone: string;
}

export function TrackingScreen({ origin, destination, passengerName, passengerPhone }: TrackingScreenProps) {
  const { company, settings, categories, location } = useTenant();
  const { goPassenger, selectedCategoryId } = useNav();

  const [ride, setRide] = useState<Ride | null>(null);
  const [creating, setCreating] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [driverDistance, setDriverDistance] = useState<number | null>(null);
  const [kioskReleased, setKioskReleased] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);

  const createdRef = useRef(false);
  const rideRef = useRef<string | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCategory: VehicleCategory | null = categories.find((c) => c.id === selectedCategoryId) ?? null;

  const categoryLabel = selectedCategory?.label ?? settings?.category_label ?? 'Econômico';

  useEffect(() => {
    if (createdRef.current || !company || !settings) return;
    createdRef.current = true;

    (async () => {
      const insertPayload = {
        company_id: company.id,
        location_id: location?.id ?? null,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        origin_label: origin.label,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_label: destination?.label ?? null,
        destination_lat: destination?.lat ?? null,
        destination_lng: destination?.lng ?? null,
        distance_km: 0,
        duration_min: 0,
        category_label: categoryLabel,
        estimated_price: 0,
        status: 'pending',
      };

      const { data: dbRide, error: dbErr } = await supabase
        .from('rides')
        .insert(insertPayload)
        .select()
        .single();

      if (dbErr || !dbRide) {
        setApiError('Falha ao criar pedido');
        setCreating(false);
        return;
      }

      const typedRide = dbRide as Ride;
      rideRef.current = typedRide.id;
      setRide(typedRide);

      const integrationMode = settings.integration_mode ?? 'manual';

      if (integrationMode === 'manual') {
        // Manual mode: ride stays pending for internal dispatch board.
        // No external API call needed. Log to admin_logs for visibility.
        await supabase.from('admin_logs').insert({
          company_id: company.id,
          source: 'dispatch',
          level: 'info',
          message: `Nova corrida manual #${typedRide.id.slice(0, 8)} aguardando designação`,
          ride_id: typedRide.id,
        });
        setCreating(false);
        return;
      }

      // Machine API or Webhook mode: call edge function
      // Use machine_category_id when available so Machine API prices match exactly
      const categoryValue = selectedCategory?.machine_category_id || categoryLabel;
      const dispatchPayload = {
        companySlug: company.slug,
        integrationMode,
        rideId: typedRide.id,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        origin: { lat: origin.lat, lng: origin.lng, address: origin.label },
        destination: destination ? { lat: destination.lat, lng: destination.lng, address: destination.label } : undefined,
        category: categoryValue,
        price: 0,
        distance: 0,
        simulation_mode: settings?.simulation_mode ?? false,
      };

      const result = await dispatchRide(dispatchPayload);

      if (!result.success) {
        await supabase.from('admin_logs').insert({
          company_id: company.id,
          source: integrationMode === 'machine' ? 'machine_api' : 'webhook',
          level: 'error',
          message: result.error ?? 'Unknown dispatch error',
          ride_id: typedRide.id,
          payload: { request: dispatchPayload },
        });
        setApiError(result.error ?? null);
      } else if (result.data) {
        const d = result.data as Record<string, unknown>;
        const inner = (d.data ?? d) as Record<string, unknown>;
        const mchId = inner?.id_mch ? String(inner.id_mch) : inner?.id ? String(inner.id) : null;
        if (mchId) {
          setRide((prev) => prev ? { ...prev, machine_order_id: mchId } : prev);
        }
      }

      setCreating(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, settings, origin, destination, passengerName, passengerPhone, categoryLabel]);

  // Kiosk release: 5-minute rolling timer to unlock the screen for the next passenger
  useEffect(() => {
    if (!creating) {
      releaseTimerRef.current = setTimeout(() => {
        setKioskReleased(true);
      }, 5 * 60 * 1000);
    }
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, [creating]);

  // Unlock immediately when ride is accepted or driver is en route
  useEffect(() => {
    if (ride && (ride.status === 'accepted' || ride.status === 'en_route' || ride.status === 'in_progress' || ride.status === 'completed' || ride.status === 'canceled')) {
      setKioskReleased(true);
    }
  }, [ride?.status]);

  // Auto-return to identify screen once the ride is accepted or canceled,
  // so the totem is free for the next passenger. The current passenger
  // follows the ride via WhatsApp notifications.
  useEffect(() => {
    if (ride?.status === 'accepted' || ride?.status === 'canceled') {
      const delay = ride.status === 'accepted' ? 5000 : 4000;
      const timer = setTimeout(() => {
        goPassenger('identify');
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [ride?.status, goPassenger]);

  // Realtime subscription for status updates (works for all modes)
  useEffect(() => {
    const rideId = ride?.id;
    if (!rideId) return;

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          const updated = payload.new as Ride;
          setRide(updated);
          const idx = STATUS_FLOW.indexOf(updated.status as OrderStatus);
          if (idx >= 0) setStatusIndex(idx);
          if (updated.status === 'canceled' && rideRef.current) {
            const elapsed = Date.now() - new Date(updated.created_at).getTime();
            if (elapsed < 60_000) {
              setCancelReason('A central não encontrou motoristas disponíveis no momento.');
            } else {
              setCancelReason('A corrida foi cancelada pela central.');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.id]);

  // Poll Machine API for status updates every 30s (fallback — webhook is primary)
  useEffect(() => {
    if (creating || !ride?.id || !company) return;
    if (ride.status === 'completed' || ride.status === 'canceled') return;
    if (settings?.integration_mode !== 'machine') return;

    const rideId = ride.id;
    const machineOrderId = ride.machine_order_id;
    const companySlug = company.slug;

    const interval = setInterval(async () => {
      if (!rideRef.current) return;
      await pollRideStatus(companySlug, rideRef.current, machineOrderId);
      const { data: fresh } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();
      if (fresh) {
        setRide(fresh as Ride);
        const idx = STATUS_FLOW.indexOf((fresh as Ride).status as OrderStatus);
        if (idx >= 0) setStatusIndex(idx);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [creating, ride?.id, ride?.status, ride?.machine_order_id, company, settings]);

  // Poll driver position every 2 minutes and calculate distance to pickup
  useEffect(() => {
    if (creating || !ride || !company) return;
    if (ride.status === 'completed' || ride.status === 'canceled') return;
    if (ride.status === 'pending') return; // no driver assigned yet
    if (settings?.integration_mode !== 'machine') return;

    const fetchPosition = async () => {
      if (!rideRef.current) return;
      const { data: pos } = await supabase
        .from('ride_driver_positions')
        .select('lat, lng, updated_at')
        .eq('ride_id', rideRef.current)
        .single();

      if (pos) {
        const dist = haversineDistance(origin.lat, origin.lng, pos.lat, pos.lng);
        setDriverDistance(parseFloat(dist.toFixed(2)));
      }
    };

    fetchPosition();
    const interval = setInterval(fetchPosition, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [creating, ride, company, settings, origin]);

  const currentStatus = ride?.status ?? 'pending';
  const statusInfo = STATUS_LABELS[currentStatus];
  const StatusIcon = statusInfo.icon;
  const isCompleted = currentStatus === 'completed';
  const isCanceled = currentStatus === 'canceled';

  const handleCancel = async () => {
    if (!rideRef.current || !company) return;

    const integrationMode = settings?.integration_mode ?? 'manual';

    if (integrationMode === 'machine') {
      await cancelRide(company.slug, rideRef.current, ride?.machine_order_id ?? null);
    } else {
      await supabase
        .from('rides')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', rideRef.current);
    }
    setCancelReason('A corrida foi cancelada.');
    setRide((prev) => (prev ? { ...prev, status: 'canceled' } : prev));
  };

  if (creating) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-gold-500" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Solicitando seu motorista...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {!isCompleted && !isCanceled && (
        <button
          onClick={() => goPassenger('destination')}
          className="mb-4 text-sm font-medium text-neutral-600 dark:text-neutral-400"
        >
          ← Voltar
        </button>
      )}

      <div className="mb-4 h-48 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <MapView origin={origin} destination={destination ?? undefined} className="h-full w-full" />
      </div>

      <div className={`card p-5 mb-4 ${isCompleted ? 'border-success-500/30' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            isCompleted ? 'bg-success-500/15' : 'bg-gold-500/15'
          }`}>
            <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
          </div>
          <div>
            <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {statusInfo.label}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {origin.label.slice(0, 30)} → {destination ? destination.label.slice(0, 30) : 'A definir'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {STATUS_FLOW.map((s, i) => {
            const active = i <= statusIndex && !isCanceled;
            return (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  active
                    ? s === 'completed' ? 'bg-success-500' : 'bg-gold-500'
                    : 'bg-neutral-200 dark:bg-neutral-700'
                }`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-neutral-400">
          <span>Pedido</span>
          <span>Aceito</span>
          <span>Chegou</span>
          <span>Em viagem</span>
          <span>Concluído</span>
        </div>
      </div>

      {ride?.driver_name && currentStatus !== 'pending' && currentStatus !== 'canceled' && (
        <div className="card p-4 mb-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">Seu motorista</p>
              <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {ride.driver_name}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {ride.vehicle_color ? `${ride.vehicle_color} · ` : ''}{ride.vehicle_model} · {ride.vehicle_plate}
              </p>
            </div>
            <a
              href={`tel:${ride.driver_phone ?? ''}`}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/15 text-success-600 hover:bg-success-500/25 transition-colors"
            >
              <Phone className="h-5 w-5" />
            </a>
          </div>
          {driverDistance !== null && currentStatus === 'accepted' && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-gold-500/10 px-3 py-2">
              <Navigation className="h-4 w-4 text-gold-600 dark:text-gold-400" />
              <span className="text-sm font-semibold text-gold-700 dark:text-gold-300">
                {driverDistance >= 1
                  ? `Motorista a ${driverDistance.toFixed(1)} km do ponto de embarque`
                  : `Motorista a ${Math.round(driverDistance * 1000)} m do ponto de embarque`}
              </span>
            </div>
          )}
        </div>
      )}

      {(isCanceled || apiError) && (
        <div className="card p-4 mb-4 border-error-500/30 bg-error-500/5">
          <div className="flex items-start gap-2">
            <X className="h-5 w-5 shrink-0 text-error-500" />
            <div>
              <p className="text-sm font-semibold text-error-600 dark:text-error-500">
                {isCanceled ? 'Corrida cancelada' : 'Erro de comunicação com a central'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {cancelReason || apiError || 'Seu pedido foi registrado e será processado.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {!isCompleted && !isCanceled && currentStatus !== 'en_route' && currentStatus !== 'in_progress' && (
          <button onClick={handleCancel} className="btn-secondary flex-1 text-error-500">
            Cancelar
          </button>
        )}
        {(isCompleted || isCanceled) && (
          <button onClick={() => goPassenger('identify')} className="btn-primary flex-1 text-base">
            {isCanceled && cancelReason ? 'Tentar novamente' : 'Nova viagem'}
          </button>
        )}
      </div>

      {kioskReleased && !isCompleted && !isCanceled && (
        <div className="mt-4 rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4 text-center animate-fade-in">
          <p className="text-sm font-semibold text-gold-700 dark:text-gold-300">
            Tela liberada para o próximo passageiro
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Acompanhe sua corrida pelas notificações no WhatsApp.
          </p>
          <button
            onClick={() => goPassenger('identify')}
            className="btn-primary mt-3 w-full text-sm"
          >
            Solicitar nova viagem
          </button>
        </div>
      )}
    </div>
  );
}
