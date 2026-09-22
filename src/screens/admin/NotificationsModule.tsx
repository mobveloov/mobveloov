import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, EmptyState, LoadingState } from '@/components/admin/ui';

interface LogEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  created_at: string;
  ride_id: string | null;
}

export function NotificationsModule() {
  const { company } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data } = await supabase
        .from('admin_logs')
        .select('id, level, source, message, created_at, ride_id')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs((data ?? []) as LogEntry[]);
      setLoading(false);
    })();
  }, [company]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  const iconFor = (level: string) => {
    if (level === 'error') return <XCircle className="h-4 w-4 text-error-400" />;
    if (level === 'warning') return <AlertTriangle className="h-4 w-4 text-warning-500" />;
    if (level === 'info') return <Info className="h-4 w-4 text-primary-400" />;
    return <CheckCircle2 className="h-4 w-4 text-success-500" />;
  };

  const badgeFor = (level: string): 'error' | 'warning' | 'default' | 'success' => {
    if (level === 'error') return 'error';
    if (level === 'warning') return 'warning';
    if (level === 'info') return 'default';
    return 'success';
  };

  if (loading) return <LoadingState />;

  const filters = ['all', 'error', 'warning', 'info'];

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader icon={Bell} title="Central de Notificações" subtitle="Alertas e eventos do sistema" />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === f ? 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/25' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'error' ? 'Erros' : f === 'warning' ? 'Avisos' : 'Informações'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Bell} message="Nenhuma notificação encontrada." /></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="flex items-start gap-3 p-4">
              <div className="mt-0.5 shrink-0">{iconFor(log.level)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={badgeFor(log.level)}>{log.source}</Badge>
                  <span className="text-xs text-slate-600">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-sm text-slate-300 break-words">{log.message}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
