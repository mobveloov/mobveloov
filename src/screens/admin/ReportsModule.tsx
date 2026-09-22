import { useEffect, useState } from 'react';
import { BarChart3, Download, Calendar } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Select, Button, LoadingState, StatCard } from '@/components/admin/ui';

interface RideRow {
  status: string;
  estimated_price: number;
  created_at: string;
  category_label: string;
}

export function ReportsModule() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');
  const [rides, setRides] = useState<RideRow[]>([]);

  useEffect(() => {
    if (!company) return;
    (async () => {
      setLoading(true);
      const days = parseInt(period);
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('rides')
        .select('status, estimated_price, created_at, category_label')
        .eq('company_id', company.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      setRides((data ?? []) as RideRow[]);
      setLoading(false);
    })();
  }, [company, period]);

  if (loading) return <LoadingState />;

  const totalRevenue = rides.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.estimated_price || 0), 0);
  const completedCount = rides.filter((r) => r.status === 'completed').length;
  const canceledCount = rides.filter((r) => r.status === 'canceled').length;
  const avgTicket = completedCount > 0 ? totalRevenue / completedCount : 0;

  const statusData = [
    { name: 'Concluídas', value: completedCount, color: '#10B981' },
    { name: 'Canceladas', value: canceledCount, color: '#EF4444' },
    { name: 'Pendentes', value: rides.length - completedCount - canceledCount, color: '#F59E0B' },
  ].filter((d) => d.value > 0);

  const categoryMap = new Map<string, number>();
  rides.forEach((r) => {
    const cat = r.category_label || 'Sem categoria';
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  });
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));

  const handleExport = () => {
    const headers = ['Data', 'Status', 'Categoria', 'Valor'];
    const rows = rides.map((r) => [
      new Date(r.created_at).toLocaleString('pt-BR'),
      r.status,
      r.category_label ?? '',
      r.estimated_price?.toString() ?? '0',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${period}dias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Relatórios & Analytics"
        subtitle="Desempenho operacional por período"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>Últimos</span>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 focus:border-gold-500/40 focus:outline-none"
            >
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
            </select>
            <Button onClick={handleExport}><Download className="h-4 w-4" /> CSV</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BarChart3} label="Corridas no Período" value={rides.length} color="bg-gold-500/15 text-gold-400" />
        <StatCard icon={BarChart3} label="Concluídas" value={completedCount} color="bg-success-500/15 text-success-500" />
        <StatCard icon={BarChart3} label="Receita" value={totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="bg-primary-500/15 text-primary-400" />
        <StatCard icon={BarChart3} label="Ticket Médio" value={avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="bg-warning-500/15 text-warning-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-200">Corridas por Categoria</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="value" fill="#D4AF37" radius={[8, 8, 0, 0]} name="Corridas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-600">Sem dados no período</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-200">Distribuição por Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94A3B8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-600">Sem dados no período</p>
          )}
        </Card>
      </div>
    </div>
  );
}
