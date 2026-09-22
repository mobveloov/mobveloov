import { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, Plus, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { SupportTicket, SupportTicketReply, Company } from '@/types';

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  open: { text: 'ABERTO', cls: 'bg-amber-500/10 text-amber-400' },
  in_progress: { text: 'EM ANDAMENTO', cls: 'bg-blue-500/10 text-blue-400' },
  resolved: { text: 'RESOLVIDO', cls: 'bg-emerald-500/10 text-emerald-400' },
  closed: { text: 'FECHADO', cls: 'bg-slate-500/10 text-slate-400' },
};

const PRIORITY_LABELS: Record<string, { text: string; cls: string }> = {
  low: { text: 'BAIXA', cls: 'bg-slate-500/10 text-slate-400' },
  normal: { text: 'NORMAL', cls: 'bg-blue-500/10 text-blue-400' },
  high: { text: 'ALTA', cls: 'bg-amber-500/10 text-amber-400' },
  urgent: { text: 'URGENTE', cls: 'bg-red-500/10 text-red-400' },
};

const PAGE_SIZE = 10;

export function TicketsModule({ success, error, logAction }: ModuleProps) {
  const [tickets, setTickets] = useState<(SupportTicket & { company_name?: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportTicketReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tickData } = await supabase.from('support_tickets').select('*, companies(name)').order('created_at', { ascending: false });
    const { data: compData } = await supabase.from('companies').select('id, name').is('deleted_at', null);
    setTickets((tickData ?? []) as (SupportTicket & { company_name?: string })[]);
    setCompanies((compData ?? []) as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tickets.filter((t) => {
    if (debouncedSearch && !t.subject.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openDetail = async (t: SupportTicket) => {
    setDetailTicket(t);
    const { data } = await supabase.from('support_ticket_replies').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
    setReplies((data ?? []) as SupportTicketReply[]);
  };

  const sendReply = async () => {
    if (!detailTicket || !replyText.trim()) return;
    setSendingReply(true);
    const { error: err } = await supabase.from('support_ticket_replies').insert({
      ticket_id: detailTicket.id,
      author_name: 'SuperAdmin',
      author_role: 'admin',
      message: replyText.trim(),
    });
    if (err) { error('Erro ao enviar resposta'); setSendingReply(false); return; }
    if (detailTicket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', detailTicket.id);
    }
    setReplyText('');
    setSendingReply(false);
    const { data } = await supabase.from('support_ticket_replies').select('*').eq('ticket_id', detailTicket.id).order('created_at', { ascending: true });
    setReplies((data ?? []) as SupportTicketReply[]);
    success('Resposta enviada');
    load();
  };

  const updateStatus = async (status: string) => {
    if (!detailTicket) return;
    await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', detailTicket.id);
    success('Status atualizado');
    setDetailTicket({ ...detailTicket, status: status as SupportTicket['status'] });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar chamado..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todos status</option>
          {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s].text}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className={btnGold + ' ml-auto'}>
          <Plus className="h-4 w-4" /> Novo Chamado
        </button>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando chamados..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<LifeBuoy className="h-10 w-10" />} message="Nenhum chamado encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Assunto</th>
                  <th className="p-4 hidden md:table-cell">Empresa</th>
                  <th className="p-4">Prioridade</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 hidden md:table-cell">Data</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/30 transition-colors cursor-pointer" onClick={() => openDetail(t)}>
                    <td className="p-4 text-white font-bold">{t.subject}</td>
                    <td className="p-4 hidden md:table-cell text-slate-400">{t.company_name ?? '—'}</td>
                    <td className="p-4"><StatusBadge status={t.priority} labels={PRIORITY_LABELS} /></td>
                    <td className="p-4"><StatusBadge status={t.status} labels={STATUS_LABELS} /></td>
                    <td className="p-4 hidden md:table-cell text-slate-500 font-mono text-[10px]">{new Date(t.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-4 text-center">
                      <button onClick={(e) => { e.stopPropagation(); openDetail(t); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors">
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

      {showCreate && (
        <CreateTicketModal
          companies={companies}
          onClose={() => setShowCreate(false)}
          onCreated={(subject) => { success(`Chamado "${subject}" criado!`); setShowCreate(false); load(); }}
          onError={error}
        />
      )}

      {detailTicket && (
        <Modal open onClose={() => setDetailTicket(null)} title={detailTicket.subject} maxWidth="600px">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={detailTicket.status} labels={STATUS_LABELS} />
              <StatusBadge status={detailTicket.priority} labels={PRIORITY_LABELS} />
            </div>
            {detailTicket.description && (
              <div className="p-3 bg-slate-950 rounded-lg">
                <p className="text-xs text-slate-300">{detailTicket.description}</p>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {replies.map((r) => (
                <div key={r.id} className={`p-3 rounded-lg ${r.author_role === 'admin' ? 'bg-[#D4AF37]/5 border border-[#D4AF37]/20' : 'bg-slate-950 border border-slate-800'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-400">{r.author_name}</span>
                    <span className="text-[9px] text-slate-600">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-xs text-slate-300">{r.message}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Digite sua resposta..."
                className={inputCls}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              />
              <button onClick={sendReply} disabled={sendingReply} className="bg-[#D4AF37] hover:bg-[#b8962e] text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors disabled:opacity-50">
                {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              {detailTicket.status !== 'resolved' && (
                <button onClick={() => updateStatus('resolved')} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
                  Marcar Resolvido
                </button>
              )}
              {detailTicket.status !== 'closed' && (
                <button onClick={() => updateStatus('closed')} className="bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
                  Fechar Chamado
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateTicketModal({ companies, onClose, onCreated, onError }: {
  companies: Company[];
  onClose: () => void;
  onCreated: (subject: string) => void;
  onError: (msg: string) => void;
}) {
  const [companyId, setCompanyId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !subject) { onError('Preencha empresa e assunto'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('support_tickets').insert({
      company_id: companyId, subject, description, priority,
    });
    if (err) { onError('Erro ao criar chamado'); setSaving(false); return; }
    onCreated(subject);
  };

  return (
    <Modal open onClose={onClose} title="Novo Chamado de Suporte" maxWidth="500px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Empresa</label>
          <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Selecione...</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Assunto</label>
          <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelCls}>Descrição</label>
          <textarea className={inputCls + ' min-h-[80px] resize-y'} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Prioridade</label>
          <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnGold}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar Chamado
          </button>
        </div>
      </form>
    </Modal>
  );
}
