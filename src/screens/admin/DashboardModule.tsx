import { useEffect, useState } from 'react';
import { Car, Clock, CheckCircle2, TrendingUp, ArrowRight, MapPin, Plug, DollarSign, Radio, Users, MessageCircle, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useNav, type AdminScreen } from '@/context/NavContext';
import { supabase } from '@/lib/supabase';
import { StatCard, Card, LoadingState } from '@/components/admin/ui';

interface DailyData { date: string; corridas: number; receita: number; }

export function DashboardModule() {
  const { company } = useAuth();
  const { goAdmin } = useNav();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, today: 0, revenue: 0 });
  const [chartData, setChartData] = useState<DailyData[]>([]);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ count: total }, { count: pending }, { count: completed }, { data: todayRides }, { data: completedRides }] = await Promise.all([
        supabase.from('rides').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('rides').select('*', { count: 'exact', head: true }).eq('company_id', company.id).in('status', ['pending', 'accepted', 'en_route', 'in_progress']),
        supabase.from('rides').select('*', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'completed'),
        supabase.from('rides').select('id').eq('company_id', company.id).gte('created_at', today.toISOString()),
        supabase.from('rides').select('estimated_price, created_at').eq('company_id', company.id).eq('status', 'completed'),
      ]);

      const revenue = (completedRides ?? []).reduce((sum, r) => sum + (r.estimated_price || 0), 0);

      setStats({
        total: total ?? 0,
        pending: pending ?? 0,
        completed: completed ?? 0,
        today: todayRides?.length ?? 0,
        revenue,
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentRides } = await supabase
        .from('rides')
        .select('created_at, estimated_price, status')
        .eq('company_id', company.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const dayMap = new Map<string, { corridas: number; receita: number }>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dayMap.set(key, { corridas: 0, receita: 0 });
      }

      (recentRides ?? []).forEach((r) => {
        const key = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const entry = dayMap.get(key);
        if (entry) {
          entry.corridas += 1;
          if (r.status === 'completed') entry.receita += r.estimated_price || 0;
        }
      });

      setChartData(Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })));
      setLoading(false);
    })();
  }, [company]);

  if (loading) return <LoadingState />;

  const quickActions: { icon: typeof Car; label: string; screen: AdminScreen; color: string }[] = [
    { icon: Radio, label: 'Central de Dispatch', screen: 'dispatch', color: 'text-gold-400' },
    { icon: MapPin, label: 'Gerenciar Totens', screen: 'locations', color: 'text-primary-400' },
    { icon: Plug, label: 'Configurar Integração', screen: 'integration', color: 'text-success-500' },
    { icon: DollarSign, label: 'Ajustar Preços', screen: 'pricing', color: 'text-warning-500' },
    { icon: Users, label: 'Cadastrar Motoristas', screen: 'drivers', color: 'text-primary-400' },
    { icon: MessageCircle, label: 'Conectar WhatsApp', screen: 'whatsapp', color: 'text-success-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-100">Visão Geral</h2>
        <p className="text-sm text-slate-500">Resumo operacional da sua empresa</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Car} label="Total de Corridas" value={stats.total} color="bg-gold-500/15 text-gold-400" />
        <StatCard icon={Clock} label="Em Andamento" value={stats.pending} color="bg-warning-500/15 text-warning-500" />
        <StatCard icon={CheckCircle2} label="Concluídas" value={stats.completed} color="bg-success-500/15 text-success-500" />
        <StatCard icon={TrendingUp} label="Receita Total" value={stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="bg-primary-500/15 text-primary-400" />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gold-400" />
            <h3 className="text-sm font-bold text-slate-200">Corridas nos últimos 7 dias</h3>
          </div>
          <span className="text-xs text-slate-500">{stats.today} hoje</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCorridas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', fontSize: '12px' }}
              labelStyle={{ color: '#94A3B8' }}
            />
            <Area type="monotone" dataKey="corridas" stroke="#D4AF37" strokeWidth={2} fill="url(#colorCorridas)" name="Corridas" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-300">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => goAdmin(a.screen)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-left transition-all hover:border-gold-500/30 hover:bg-slate-800/50"
              >
                <Icon className={`h-5 w-5 shrink-0 ${a.color}`} />
                <span className="flex-1 text-sm font-semibold text-slate-300">{a.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-400" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
