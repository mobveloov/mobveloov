import { useState, useEffect, useCallback } from 'react';
import { Users, Ban, CheckCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  ConfirmModal, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { Passenger, Company } from '@/types';

const PAGE_SIZE = 15;

export function PassengersModule({ success, error, logAction, globalSearch }: ModuleProps) {
  const [passengers, setPassengers] = useState<(Passenger & { company_name?: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [blockTarget, setBlockTarget] = useState<Passenger | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Passenger | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: passData } = await supabase.from('passengers').select('*, companies(name)').order('created_at', { ascending: false });
    const { data: compData } = await supabase.from('companies').select('id, name').is('deleted_at', null);
    setPassengers((passData ?? []) as (Passenger & { company_name?: string })[]);
    setCompanies((compData ?? []) as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = passengers.filter((p) => {
    if (debouncedSearch && !p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) && !(p.phone ?? '').includes(debouncedSearch)) return false;
    if (companyFilter !== 'all' && p.company_id !== companyFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleBlock = async () => {
    if (!blockTarget) return;
    const newBlocked = !blockTarget.is_blocked;
    const { error: err } = await supabase.from('passengers').update({ is_blocked: newBlocked, updated_at: new Date().toISOString() }).eq('id', blockTarget.id);
    if (err) { error('Erro ao alterar status'); setBlockTarget(null); return; }
    success(newBlocked ? 'Passageiro bloqueado' : 'Passageiro desbloqueado');
    await logAction(newBlocked ? 'block_passenger' : 'unblock_passenger', 'passenger', blockTarget.id, blockTarget.name);
    setBlockTarget(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('passengers').delete().eq('id', deleteTarget.id);
    if (err) { error('Erro ao excluir'); return; }
    success('Passageiro excluído');
    await logAction('delete_passenger', 'passenger', deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar passageiro..." />
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todas empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando passageiros..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} message="Nenhum passageiro encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Nome</th>
                  <th className="p-4">Telefone</th>
                  <th className="p-4 hidden md:table-cell">Empresa</th>
                  <th className="p-4 hidden md:table-cell">Corridas</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 text-white font-bold">{p.name}</td>
                    <td className="p-4 text-slate-300 font-mono">{p.phone}</td>
                    <td className="p-4 hidden md:table-cell text-slate-400">{p.company_name ?? '—'}</td>
                    <td className="p-4 hidden md:table-cell text-slate-300 font-bold">{p.total_rides}</td>
                    <td className="p-4">
                      <StatusBadge status={p.is_blocked ? 'blocked' : 'active'} labels={{
                        active: { text: 'ATIVO', cls: 'bg-emerald-500/10 text-emerald-400' },
                        blocked: { text: 'BLOQUEADO', cls: 'bg-red-500/10 text-red-400' },
                      }} />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setBlockTarget(p)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${p.is_blocked ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                          {p.is_blocked ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded-lg transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmModal
        open={!!blockTarget}
        title={blockTarget?.is_blocked ? 'Desbloquear Passageiro' : 'Bloquear Passageiro'}
        message={blockTarget?.is_blocked ? `Desbloquear "${blockTarget?.name}"?` : `Bloquear "${blockTarget?.name}"? O passageiro não poderá solicitar corridas.`}
        confirmLabel={blockTarget?.is_blocked ? 'Desbloquear' : 'Bloquear'}
        onConfirm={toggleBlock}
        onCancel={() => setBlockTarget(null)}
        danger={!blockTarget?.is_blocked}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Passageiro"
        message={`Excluir "${deleteTarget?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
