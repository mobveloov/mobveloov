import { useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, EmptyState, LoadingState } from '@/components/admin/ui';

interface LogEntry {
  id: string;
  source: string | null;
  level: string | null;
  message: string | null;
  admin_email: string | null;
  created_at: string;
}

export function AuditModule() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data } = await supabase
        .from('admin_logs')
        .select('id, source, level, message, admin_email, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(200);
      setEntries((data ?? []) as LogEntry[]);
      setLoading(false);
    })();
  }, [company]);

  const filtered = search
    ? entries.filter((e) =>
        (e.message ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.source ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.admin_email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  if (loading) return <LoadingState />;

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader icon={ScrollText} title="Log de Auditoria" subtitle="Registro de eventos do sistema" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por mensagem, origem ou usuário..."
          className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold-500/40 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
        />
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={ScrollText} message="Nenhum registro de log encontrado." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-semibold">Quando</th>
                  <th className="px-4 py-3 font-semibold">Nível</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.level === 'error' ? 'error' : e.level === 'warn' ? 'warning' : 'gold'}>
                        {e.level ?? 'info'}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400 text-xs">{e.source ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-md truncate">{e.message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
