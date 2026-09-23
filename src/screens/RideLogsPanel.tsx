import { useState, useEffect, useCallback } from 'react';
import { Car, Search, Loader2, MapPin, Phone, Clock, X, Hash, DollarSign, Route, Timer, User, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Ride, OrderStatus } from '@/types';

const STATUS_STYLES: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'PENDENTE', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  accepted: { label: 'ACEITA', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  en_route: { label: 'A CAMINHO', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  in_progress: { label: 'EM ANDAMENTO', cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  completed: { label: 'CONCLUÍDA', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  canceled: { label: 'CANCELADA', cls: 'bg-red-500/15 text-red-500 dark:text-red-400' },
};

const PAGE_SIZE = 15;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function RideLogsPanel() {
  const { company } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detailRide, setDetailRide] = useState<Ride | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(200);

    setRides((data ?? []) as Ride[]);
    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const filtered = rides.filter((r) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const matchesName = (r.passenger_name ?? '').toLowerCase().includes(q);
      const matchesDest = (r.destination_label ?? '').toLowerCase().includes(q);
      const matchesOrigin = (r.origin_label ?? '').toLowerCase().includes(q);
      const matchesPhone = (r.passenger_phone ?? '').toLowerCase().includes(q);
      const matchesOS = (r.machine_order_id ?? '').toLowerCase().includes(q);
      if (!matchesName && !matchesDest && !matchesOrigin && !matchesPhone && !matchesOS) return false;
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const displayPrice = (ride: Ride): { value: string; isFinal: boolean } => {
    if (ride.final_price != null) {
      return { value: ride.final_price.toFixed(2).replace('.', ','), isFinal: true };
    }
    return { value: ride.estimated_price.toFixed(2).replace('.', ','), isFinal: false };
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-4">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
        Histórico de corridas
      </h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por passageiro, telefone, OS, endereço..."
            className="w-full rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500/50"
        >
          <option value="all">Todos status</option>
          {Object.keys(STATUS_STYLES).map((s) => (
            <option key={s} value={s}>{STATUS_STYLES[s as OrderStatus].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 dark:border-slate-700/60 overflow-hidden bg-white dark:bg-slate-900/20">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Car className="mb-3 h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">Nenhuma corrida encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-slate-700 text-[10px] font-bold tracking-wider text-neutral-500 dark:text-slate-400 uppercase bg-neutral-50 dark:bg-slate-950/40">
                  <th className="p-4">Passageiro</th>
                  <th className="p-4 hidden md:table-cell">Origem</th>
                  <th className="p-4 hidden md:table-cell">Destino</th>
                  <th className="p-4 hidden lg:table-cell">OS Machine</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4 hidden md:table-cell">Data</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-800/60 text-xs">
                {paged.map((r) => {
                  const style = STATUS_STYLES[r.status as OrderStatus] ?? STATUS_STYLES.pending;
                  const price = displayPrice(r);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-neutral-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                      onClick={() => setDetailRide(r)}
                    >
                      <td className="p-4">
                        <p className="font-bold text-neutral-900 dark:text-white">{r.passenger_name}</p>
                        <p className="text-neutral-400 font-mono text-[10px] mt-0.5">{r.passenger_phone}</p>
                      </td>
                      <td className="p-4 hidden md:table-cell text-neutral-500 dark:text-slate-400 truncate max-w-[120px]">{r.origin_label || '—'}</td>
                      <td className="p-4 hidden md:table-cell text-neutral-500 dark:text-slate-400 truncate max-w-[120px]">{r.destination_label || '—'}</td>
                      <td className="p-4 hidden lg:table-cell">
                        {r.machine_order_id ? (
                          <span className="font-mono text-gold-600 dark:text-gold-400 font-bold">{r.machine_order_id}</span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.cls}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-extrabold text-gold-600 dark:text-gold-400">R$ {price.value}</p>
                        {price.isFinal && (
                          <p className="text-[9px] text-emerald-500 font-bold mt-0.5">VALOR FINAL</p>
                        )}
                      </td>
                      <td className="p-4 hidden md:table-cell text-neutral-400 dark:text-slate-500 font-mono text-[10px]">
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailRide(r); }}
                          className="bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 border border-neutral-200 dark:border-slate-700 text-neutral-900 dark:text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-neutral-200 dark:border-slate-700 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-neutral-500 dark:text-slate-400 px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-neutral-200 dark:border-slate-700 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Próxima
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detailRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailRide(null)}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">Detalhes da Corrida</h3>
              <button onClick={() => setDetailRide(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors">
                <X className="h-4 w-4 text-neutral-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3 text-xs">
              {/* Passenger + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><User className="h-3 w-3" /> Passageiro</p>
                  <p className="text-neutral-900 dark:text-white font-bold">{detailRide.passenger_name}</p>
                  <p className="text-neutral-400 dark:text-slate-400 font-mono mt-0.5">{detailRide.passenger_phone}</p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1">Status</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[detailRide.status as OrderStatus]?.cls ?? STATUS_STYLES.pending.cls}`}>
                    {STATUS_STYLES[detailRide.status as OrderStatus]?.label ?? '—'}
                  </span>
                </div>
              </div>

              {/* OS Machine */}
              {detailRide.machine_order_id && (
                <div className="p-3 rounded-xl bg-gold-50 dark:bg-gold-500/5 border border-gold-200 dark:border-gold-500/20">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><Hash className="h-3 w-3 text-gold-500" /> OS Machine</p>
                  <p className="font-mono font-bold text-gold-600 dark:text-gold-400 text-sm">{detailRide.machine_order_id}</p>
                </div>
              )}

              {/* Origin + Destination */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><MapPin className="h-3 w-3 text-gold-500" /> Origem</p>
                <p className="text-neutral-900 dark:text-white">{detailRide.origin_label || '—'}</p>
                <p className="text-neutral-500 dark:text-slate-500 mt-2 mb-1 flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-500" /> Destino</p>
                <p className="text-neutral-900 dark:text-white">{detailRide.destination_label || '—'}</p>
              </div>

              {/* Distance / Duration / Price */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><Route className="h-3 w-3" /> Distância</p>
                  <p className="text-neutral-900 dark:text-white font-bold">{detailRide.distance_km.toFixed(1)} km</p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><Timer className="h-3 w-3" /> Duração</p>
                  <p className="text-neutral-900 dark:text-white font-bold">{detailRide.duration_min} min</p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor</p>
                  {(() => {
                    const price = displayPrice(detailRide);
                    return (
                      <>
                        <p className={`font-bold ${price.isFinal ? 'text-emerald-500' : 'text-gold-600 dark:text-gold-400'}`}>R$ {price.value}</p>
                        {price.isFinal ? (
                          <p className="text-[9px] text-emerald-500 font-bold mt-0.5">VALOR FINAL</p>
                        ) : (
                          <p className="text-[9px] text-neutral-400 mt-0.5">ESTIMADO</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Price comparison when final_price exists */}
              {detailRide.final_price != null && detailRide.final_price !== detailRide.estimated_price && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1">Comparação de valores</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500 dark:text-slate-400">Estimado: <span className="font-bold">R$ {detailRide.estimated_price.toFixed(2).replace('.', ',')}</span></span>
                    <span className="text-neutral-400">→</span>
                    <span className="text-emerald-500 font-bold">Final: R$ {detailRide.final_price.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              )}

              {/* Driver info */}
              {detailRide.driver_name && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                  <p className="text-neutral-500 dark:text-slate-500 mb-1">Motorista</p>
                  <p className="text-neutral-900 dark:text-white font-bold">{detailRide.driver_name}</p>
                  {detailRide.driver_phone && <p className="text-neutral-400 dark:text-slate-400 font-mono mt-0.5">{detailRide.driver_phone}</p>}
                  <p className="text-neutral-400 dark:text-slate-400 mt-0.5">
                    {detailRide.vehicle_model ?? ''} {detailRide.vehicle_plate ? `· ${detailRide.vehicle_plate}` : ''}
                    {detailRide.vehicle_color ? ` · ${detailRide.vehicle_color}` : ''}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-100 dark:border-slate-800">
                <p className="text-neutral-500 dark:text-slate-500 mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Criada em</p>
                <p className="text-neutral-900 dark:text-white font-mono text-[11px]">{new Date(detailRide.created_at).toLocaleString('pt-BR')}</p>
                {detailRide.updated_at !== detailRide.created_at && (
                  <>
                    <p className="text-neutral-500 dark:text-slate-500 mt-2 mb-1">Atualizada em</p>
                    <p className="text-neutral-900 dark:text-white font-mono text-[11px]">{new Date(detailRide.updated_at).toLocaleString('pt-BR')}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
