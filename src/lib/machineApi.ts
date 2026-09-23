import type { VehicleCategory, GeoPoint, CategoryPricing, IntegrationMode } from '@/types';
import { haversineDistance } from './utils';

export function calculateCategoryPricing(
  origin: GeoPoint,
  destination: GeoPoint,
  category: VehicleCategory,
  surgeMultiplier: number = 1
): { distance: number; duration: number; pricing: CategoryPricing } {
  const distance = haversineDistance(
    origin.lat, origin.lng, destination.lat, destination.lng
  );

  const rawPrice =
    (category.base_fee +
      distance * category.per_km_rate +
      (distance * 1.5) * category.per_min_rate) *
    surgeMultiplier;
  const finalPrice = Math.max(category.min_fee, rawPrice);

  return {
    distance: parseFloat(distance.toFixed(2)),
    duration: parseFloat((distance * 1.5).toFixed(0)),
    pricing: {
      id: category.id,
      label: category.label,
      description: category.description,
      base_price: parseFloat(rawPrice.toFixed(2)),
      final_price: parseFloat(finalPrice.toFixed(2)),
      eta_minutes: category.eta_minutes,
      sort_order: category.sort_order,
    },
  };
}

export interface DispatchPayload {
  companySlug: string;
  integrationMode: IntegrationMode;
  rideId: string;
  passenger_name: string;
  passenger_phone: string;
  origin: { lat: number; lng: number; address: string };
  destination?: { lat: number; lng: number; address: string };
  category: string;
  price: number;
  distance: number;
  simulation_mode?: boolean;
}

export async function dispatchRide(
  payload: DispatchPayload
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: `Dispatch error ${response.status}: ${errorBody}` };
    }

    const data = await response.json();
    if (data.error) return { success: false, error: data.error };
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro de conexão com o dispatch';
    return { success: false, error: msg };
  }
}

export async function cancelRide(
  companySlug: string,
  rideId: string,
  machineOrderId?: string | null
): Promise<{ success: boolean }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        companySlug,
        integrationMode: 'machine',
        rideId,
        action: 'cancel_ride',
        machineOrderId: machineOrderId ?? undefined,
      }),
    });

    const data = await response.json();
    return { success: data.success ?? data.canceled ?? false };
  } catch {
    return { success: false };
  }
}

export async function pollRideStatus(
  companySlug: string,
  rideId: string,
  machineOrderId?: string | null
): Promise<{ success: boolean; status?: string; driver_name?: string | null; driver_phone?: string | null; vehicle_plate?: string | null; vehicle_model?: string | null; vehicle_color?: string | null }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        companySlug,
        integrationMode: 'machine',
        rideId,
        action: 'poll_status',
        machineOrderId: machineOrderId ?? undefined,
      }),
    });

    const data = await response.json();
    return {
      success: data.success ?? false,
      status: data.status,
      driver_name: data.driver_name ?? null,
      driver_phone: data.driver_phone ?? null,
      vehicle_plate: data.vehicle_plate ?? null,
      vehicle_model: data.vehicle_model ?? null,
      vehicle_color: data.vehicle_color ?? null,
    };
  } catch {
    return { success: false };
  }
}

export interface MachineCategory {
  id: string;
  nome: string;
  descricao?: string;
  raw?: Record<string, unknown>;
}

export interface MachineEstimateCategory {
  categoria_id: string;
  categoria_nome: string;
  estimativa_valor: number;
  tarifa_nome: string;
}

export interface MachineEstimate {
  estimativa_minutos: number;
  estimativa_km: number;
  categorias: MachineEstimateCategory[];
}

export async function fetchMachineEstimates(
  companySlug: string,
  origin: GeoPoint,
  destination: GeoPoint
): Promise<{ success: boolean; data?: MachineEstimate; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        companySlug,
        integrationMode: 'machine',
        rideId: 'estimates',
        action: 'estimates',
        origin: { lat: origin.lat, lng: origin.lng, address: origin.label },
        destination: { lat: destination.lat, lng: destination.lng, address: destination.label },
      }),
    });

    const data = await response.json();
    if (data.error) return { success: false, error: data.error };
    return { success: true, data: data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao buscar estimativas';
    return { success: false, error: msg };
  }
}

export async function fetchMachineCategories(
  companySlug: string,
  location?: { city?: string; state?: string; address?: string; bairro?: string; lat?: number; lng?: number }
): Promise<{ success: boolean; data?: MachineCategory[]; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        companySlug,
        integrationMode: 'machine',
        rideId: 'categories',
        action: 'list_categories',
        city: location?.city,
        state: location?.state,
        address: location?.address,
        bairro: location?.bairro,
        lat: location?.lat,
        lng: location?.lng,
      }),
    });

    const data = await response.json();
    if (data.error) return { success: false, error: data.error };
    return { success: true, data: data.categories };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao buscar categorias';
    return { success: false, error: msg };
  }
}
