import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Shield, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';

interface LogEntry {
  id: string;
  company_id: string | null;
  source: string | null;
  level: string | null;
  message: string | null;
  admin_email: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export function AuditModule({ globalSearch }: ModuleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_logs')
      .select('id, company_id, source, level, message, admin_email, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data ?? []) as LogEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter((l) => {
    const q = (debouncedSearch || globalSearch).toLowerCase();
    if (q && !(l.message ?? '').toLowerCase().includes(q) && !(l.source ?? '').toLowerCase().includes(q) && !(l.admin_email ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const levelColor = (level: string | null) => {
    if (level === 'error') return 'text-red-400';
    if (level === 'warn') return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar logs..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#D4AF37]" /> Segurança da Conta
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-300">Autenticação 2FA</span>
              </div>
              <span className="text-[10px] text-slate-600 font-bold">Opcional - não configurado</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-300">Sessões Ativas</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">1 sessão ativa</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[#D4AF37]" /> Log de Auditoria
          </h3>
          <p className="text-xs text-slate-500">Registro de todos os eventos do sistema em tempo real</p>
        </div>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando logs..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-10 w-10" />} message="Nenhum log encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Nível</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Mensagem</th>
                  <th className="p-4 hidden md:table-cell">Usuário</th>
                  <th className="p-4">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4">
                      <span className={`font-bold uppercase ${levelColor(l.level)}`}>{l.level ?? 'info'}</span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-slate-400">{l.source ?? '—'}</td>
                    <td className="p-4 text-slate-300 max-w-md truncate">{l.message ?? '—'}</td>
                    <td className="p-4 hidden md:table-cell text-slate-400 font-mono text-[10px]">{l.admin_email ?? '—'}</td>
                    <td className="p-4 text-slate-500 font-mono text-[10px] whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}
