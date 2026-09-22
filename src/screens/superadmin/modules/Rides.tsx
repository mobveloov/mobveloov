import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { Ride, Company } from '@/types';

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: 'PENDENTE', cls: 'bg-amber-500/10 text-amber-400' },
  accepted: { text: 'ACEITA', cls: 'bg-blue-500/10 text-blue-400' },
  en_route: { text: 'A CAMINHO', cls: 'bg-blue-500/10 text-blue-400' },
  in_progress: { text: 'EM ANDAMENTO', cls: 'bg-purple-500/10 text-purple-400' },
  completed: { text: 'CONCLUÍDA', cls: 'bg-emerald-500/10 text-emerald-400' },
  canceled: { text: 'CANCELADA', cls: 'bg-red-500/10 text-red-400' },
};

const PAGE_SIZE = 15;

export function RidesModule({ success, error, globalSearch }: ModuleProps) {
  const [rides, setRides] = useState<(Ride & { company_name?: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detailRide, setDetailRide] = useState<Ride | null>(null);
  const [resending, setResending] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rideData } = await supabase.from('rides').select('*, companies(name)').order('created_at', { ascending: false }).limit(200);
    const { data: compData } = await supabase.from('companies').select('id, name').is('deleted_at', null);
    setRides((rideData ?? []) as (Ride & { company_name?: string })[]);
    setCompanies((compData ?? []) as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rides.filter((r) => {
    if (debouncedSearch && !(r.passenger_name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) && !(r.destination_label ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (companyFilter !== 'all' && r.company_id !== companyFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resendNotification = async (ride: Ride) => {
    setResending(true);
    try {
      await supabase.from('admin_logs').insert({
        company_id: ride.company_id,
        source: 'whatsapp',
        level: 'info',
        message: `Reenvio manual de notificação para corrida ${ride.id.slice(0, 8)}`,
        ride_id: ride.id,
      });
      success('Notificação reenviada');
    } catch {
      error('Erro ao reenviar notificação');
    }
    setResending(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar corrida..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todos status</option>
          {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s].text}</option>)}
        </select>
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todas empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando corridas..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<MessageCircle className="h-10 w-10" />} message="Nenhuma corrida encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Passageiro</th>
                  <th className="p-4 hidden md:table-cell">Origem</th>
                  <th className="p-4 hidden md:table-cell">Destino</th>
                  <th className="p-4 hidden lg:table-cell">Empresa</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 hidden md:table-cell">Data</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/30 transition-colors cursor-pointer" onClick={() => setDetailRide(r)}>
                    <td className="p-4 text-white font-bold">{r.passenger_name}</td>
                    <td className="p-4 hidden md:table-cell text-slate-400 truncate max-w-[120px]">{r.origin_label}</td>
                    <td className="p-4 hidden md:table-cell text-slate-400 truncate max-w-[120px]">{r.destination_label}</td>
                    <td className="p-4 hidden lg:table-cell text-slate-400">{r.company_name ?? '—'}</td>
                    <td className="p-4"><StatusBadge status={r.status} labels={STATUS_LABELS} /></td>
                    <td className="p-4 hidden md:table-cell text-slate-500 font-mono text-[10px]">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-4 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setDetailRide(r); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {detailRide && (
        <Modal open onClose={() => setDetailRide(null)} title="Detalhes da Corrida" maxWidth="520px">
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-slate-500 mb-1">Passageiro</p>
                <p className="text-white font-bold">{detailRide.passenger_name}</p>
                <p className="text-slate-400 font-mono">{detailRide.passenger_phone}</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-slate-500 mb-1">Status</p>
                <StatusBadge status={detailRide.status} labels={STATUS_LABELS} />
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg">
              <p className="text-slate-500 mb-1">Origem</p>
              <p className="text-white">{detailRide.origin_label}</p>
              <p className="text-slate-500 mt-2 mb-1">Destino</p>
              <p className="text-white">{detailRide.destination_label}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-slate-500 mb-1">Distância</p>
                <p className="text-white font-bold">{detailRide.distance_km.toFixed(1)} km</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-slate-500 mb-1">Duração</p>
                <p className="text-white font-bold">{detailRide.duration_min} min</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-slate-500 mb-1">Preço</p>
                <p className="text-emerald-400 font-bold">R$ {detailRide.estimated_price.toFixed(2)}</p>
              </div>
            </div>
            {detailRide.driver_name && (
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-slate-500 mb-1">Motorista</p>
                <p className="text-white font-bold">{detailRide.driver_name}</p>
                <p className="text-slate-400 font-mono">{detailRide.driver_phone}</p>
                <p className="text-slate-400">{detailRide.vehicle_model} - {detailRide.vehicle_plate}</p>
              </div>
            )}
            <div className="p-3 bg-slate-950 rounded-lg">
              <p className="text-slate-500 mb-1">Eventos de WhatsApp</p>
              {(detailRide.webhook_events ?? []).length > 0 ? (
                <div className="space-y-1">
                  {(detailRide.webhook_events ?? []).map((ev, i) => (
                    <div key={i} className="text-[10px] text-slate-400">
                      <span className="text-[#D4AF37] font-bold">{ev.event}</span> - {new Date(ev.timestamp).toLocaleString('pt-BR')}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Nenhum evento registrado</p>
              )}
            </div>
            <button
              onClick={() => resendNotification(detailRide)}
              disabled={resending}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-[#D4AF37]" />}
              Reenviar Notificação WhatsApp
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
