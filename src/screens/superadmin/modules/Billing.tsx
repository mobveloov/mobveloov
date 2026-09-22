import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { Invoice, Company } from '@/types';

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  paid: { text: 'PAGA', cls: 'bg-emerald-500/10 text-emerald-400' },
  pending: { text: 'PENDENTE', cls: 'bg-amber-500/10 text-amber-400' },
  overdue: { text: 'ATRASADA', cls: 'bg-red-500/10 text-red-400' },
};

const PAGE_SIZE = 15;

export function BillingModule({ success, error, globalSearch }: ModuleProps) {
  const [invoices, setInvoices] = useState<(Invoice & { company_name?: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCompanyId, setGenCompanyId] = useState('');
  const [genAmount, setGenAmount] = useState('');
  const [genDueDate, setGenDueDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const globalDebounced = useDebounce(globalSearch, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: invData } = await supabase.from('invoices').select('*, companies(name)').order('created_at', { ascending: false });
    const { data: compData } = await supabase.from('companies').select('id, name').is('deleted_at', null);
    setInvoices((invData ?? []) as (Invoice & { company_name?: string })[]);
    setCompanies((compData ?? []) as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter((inv) => {
    const q = (debouncedSearch || globalDebounced).toLowerCase();
    if (q && !(inv.company_name ?? '').toLowerCase().includes(q)) return false;
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genCompanyId || !genAmount) { error('Preencha empresa e valor'); return; }
    setGenerating(true);
    const { error: err } = await supabase.from('invoices').insert({
      company_id: genCompanyId,
      amount: parseFloat(genAmount),
      status: 'pending',
      due_date: genDueDate ? new Date(genDueDate + 'T23:59:59').toISOString() : null,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (err) { error('Erro ao gerar fatura'); setGenerating(false); return; }
    success('Fatura gerada com sucesso');
    setShowGenerate(false);
    setGenCompanyId(''); setGenAmount(''); setGenDueDate('');
    setGenerating(false);
    load();
  };

  const markAsPaid = async (id: string) => {
    const { error: err } = await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    if (err) { error('Erro ao marcar como paga'); return; }
    success('Fatura marcada como paga');
    load();
  };

  const exportCSV = () => {
    const headers = ['Empresa', 'Valor', 'Status', 'Vencimento', 'Pago em', 'Criado em'];
    const rows = filtered.map((i) => [
      i.company_name ?? '', i.amount.toFixed(2), i.status,
      i.due_date ? new Date(i.due_date).toLocaleDateString('pt-BR') : '',
      i.paid_at ? new Date(i.paid_at).toLocaleDateString('pt-BR') : '',
      new Date(i.created_at).toLocaleDateString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'faturamento.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recebido</p>
          <h3 className="text-xl font-black text-emerald-400 mt-1">R$ {totalPaid.toFixed(2)}</h3>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pendente</p>
          <h3 className="text-xl font-black text-amber-400 mt-1">R$ {totalPending.toFixed(2)}</h3>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inadimplência</p>
          <h3 className="text-xl font-black text-red-400 mt-1">R$ {totalOverdue.toFixed(2)}</h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar fatura..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#D4AF37]">
          <option value="all">Todos status</option>
          <option value="paid">Pagas</option>
          <option value="pending">Pendentes</option>
          <option value="overdue">Atrasadas</option>
        </select>
        <button onClick={exportCSV} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
        <button onClick={() => setShowGenerate(true)} className={btnGold + ' ml-auto'}>
          <CreditCard className="h-4 w-4" /> Gerar Fatura
        </button>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando faturas..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-10 w-10" />} message="Nenhuma fatura encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Empresa</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4 hidden md:table-cell">Vencimento</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 text-white font-bold">{inv.company_name ?? '—'}</td>
                    <td className="p-4 text-emerald-400 font-bold">R$ {inv.amount.toFixed(2)}</td>
                    <td className="p-4 hidden md:table-cell font-mono text-slate-300">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="p-4"><StatusBadge status={inv.status} labels={STATUS_LABELS} /></td>
                    <td className="p-4 text-center">
                      {inv.status !== 'paid' && (
                        <button onClick={() => markAsPaid(inv.id)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded-lg text-[11px] transition-colors">
                          Marcar Paga
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {showGenerate && (
        <Modal open onClose={() => setShowGenerate(false)} title="Gerar Nova Fatura" maxWidth="480px">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className={labelCls}>Empresa</label>
              <select className={inputCls} value={genCompanyId} onChange={(e) => setGenCompanyId(e.target.value)}>
                <option value="">Selecione...</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input type="number" step="0.01" className={inputCls} value={genAmount} onChange={(e) => setGenAmount(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Vencimento</label>
                <input type="date" className={inputCls} value={genDueDate} onChange={(e) => setGenDueDate(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowGenerate(false)} className={btnGhost}>Cancelar</button>
              <button type="submit" disabled={generating} className={btnGold}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Gerar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
