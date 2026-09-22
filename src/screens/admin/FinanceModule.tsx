import { useEffect, useState } from 'react';
import { Wallet, Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, EmptyState, LoadingState, StatCard } from '@/components/admin/ui';

interface RideFinance {
  id: string;
  estimated_price: number;
  status: string;
  driver_name: string | null;
  created_at: string;
  category_label: string;
}

export function FinanceModule() {
  const { company } = useAuth();
  const [rides, setRides] = useState<RideFinance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data } = await supabase
        .from('rides')
        .select('id, estimated_price, status, driver_name, created_at, category_label')
        .eq('company_id', company.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);
      setRides((data ?? []) as RideFinance[]);
      setLoading(false);
    })();
  }, [company]);

  if (loading) return <LoadingState />;

  const totalRevenue = rides.reduce((s, r) => s + (r.estimated_price || 0), 0);
  const todayRevenue = rides
    .filter((r) => {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return new Date(r.created_at) >= d;
    })
    .reduce((s, r) => s + (r.estimated_price || 0), 0);

  const monthRevenue = rides
    .filter((r) => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return new Date(r.created_at) >= d;
    })
    .reduce((s, r) => s + (r.estimated_price || 0), 0);

  const handleExport = () => {
    const headers = ['Data', 'Motorista', 'Categoria', 'Valor'];
    const rows = rides.map((r) => [
      new Date(r.created_at).toLocaleString('pt-BR'),
      r.driver_name ?? '',
      r.category_label ?? '',
      r.estimated_price?.toString() ?? '0',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle="Receita, comissões e repasses"
        action={
          <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={DollarSign} label="Receita de Hoje" value={todayRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="bg-success-500/15 text-success-500" />
        <StatCard icon={TrendingUp} label="Receita do Mês" value={monthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="bg-gold-500/15 text-gold-400" />
        <StatCard icon={TrendingDown} label="Total Geral" value={totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="bg-primary-500/15 text-primary-400" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-200">Últimas corridas concluídas</h3>
        </div>
        {rides.length === 0 ? (
          <EmptyState icon={Wallet} message="Nenhuma corrida concluída encontrada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Motorista</th>
                  <th className="px-4 py-3 font-semibold">Categoria</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-slate-300">{r.driver_name ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant="default">{r.category_label ?? '—'}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-success-500">
                      {(r.estimated_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
