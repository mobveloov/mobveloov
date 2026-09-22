import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Users, Wifi, Car, AlertCircle, TrendingUp, TrendingDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LoadingState } from '../shared';
import type { ModuleProps } from '../Layout';

interface KPI { label: string; value: string; sub: string; icon: React.ReactNode; color: string; }

export function DashboardModule({ globalSearch }: ModuleProps) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [companyGrowth, setCompanyGrowth] = useState<{ label: string; value: number }[]>([]);
  const [rideVolume, setRideVolume] = useState<{ label: string; value: number }[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string; time: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: companies } = await supabase.from('companies').select('id, status, plan_id, custom_discount, expires_at, created_at, deleted_at').is('deleted_at', null);
    const { data: plans } = await supabase.from('subscription_plans').select('*').eq('is_active', true);
    const { data: locations } = await supabase.from('company_locations').select('id, is_active, updated_at');
    const { count: ridesToday } = await supabase.from('rides').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    let mrr = 0;
    let active = 0;
    let suspended = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let churnThisMonth = 0;

    for (const comp of (companies ?? [])) {
      const plan = (plans ?? []).find((p) => p.id === comp.plan_id);
      if (comp.status === 'active') {
        active++;
        const basePrice = plan?.base_monthly_price ?? plan?.price ?? 0;
        mrr += basePrice * (1 - (comp.custom_discount ?? 0) / 100);
        if (comp.expires_at && new Date(comp.expires_at) < now) {
          overdueAmount += basePrice * (1 - (comp.custom_discount ?? 0) / 100);
          overdueCount++;
        }
      } else if (comp.status === 'suspended' || comp.status === 'paused') {
        suspended++;
        if (comp.updated_at && new Date(comp.updated_at) >= lastMonthStart) churnThisMonth++;
      }
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const online = (locations ?? []).filter((l: { is_active?: boolean; updated_at?: string }) => l.is_active && l.updated_at && l.updated_at > fiveMinAgo).length;

    setKpis([
      { label: 'MRR', value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: `${active} ativas`, icon: <DollarSign className="h-5 w-5" />, color: 'emerald' },
      { label: 'Empresas Ativas', value: String(active), sub: `${suspended} suspensas`, icon: <Users className="h-5 w-5" />, color: 'blue' },
      { label: 'Totens Online', value: `${online}/${(locations ?? []).length}`, sub: online > 0 ? 'Conectados' : 'Offline', icon: <Wifi className="h-5 w-5" />, color: 'gold' },
      { label: 'Corridas Hoje', value: String(ridesToday ?? 0), sub: 'Disparos hoje', icon: <Car className="h-5 w-5" />, color: 'purple' },
      { label: 'Inadimplência', value: `R$ ${overdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: `${overdueCount} empresas`, icon: <AlertCircle className="h-5 w-5" />, color: 'red' },
      { label: 'Churn (Mês)', value: String(churnThisMonth), sub: 'Cancelamentos', icon: churnThisMonth > 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />, color: 'amber' },
    ]);

    // Growth chart - 12 months
    const growth: { label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1);
      const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true }).gte('created_at', ms.toISOString()).lt('created_at', me.toISOString());
      growth.push({ label: ms.toLocaleDateString('pt-BR', { month: 'short' }), value: count ?? 0 });
    }
    setCompanyGrowth(growth);

    // Ride volume - 7 days
    const vol: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const ds = new Date(); ds.setDate(ds.getDate() - i); ds.setHours(0, 0, 0, 0);
      const de = new Date(ds); de.setDate(de.getDate() + 1);
      const { count } = await supabase.from('rides').select('*', { count: 'exact', head: true }).gte('created_at', ds.toISOString()).lt('created_at', de.toISOString());
      vol.push({ label: ds.toLocaleDateString('pt-BR', { weekday: 'short' }), value: count ?? 0 });
    }
    setRideVolume(vol);

    // Alerts
    const alertList: { type: string; message: string; time: string }[] = [];
    for (const loc of (locations ?? [])) {
      if (loc.updated_at && new Date(loc.updated_at) < new Date(Date.now() - 60 * 60 * 1000)) {
        alertList.push({ type: 'totem', message: `Totem offline há mais de 1h`, time: new Date(loc.updated_at).toLocaleString('pt-BR') });
      }
    }
    for (const comp of (companies ?? [])) {
      if (comp.expires_at && new Date(comp.expires_at) < now && comp.status === 'active') {
        alertList.push({ type: 'payment', message: `Pagamento atrasado: ${comp.id}`, time: new Date(comp.expires_at).toLocaleString('pt-BR') });
      }
    }
    setAlerts(alertList.slice(0, 10));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    gold: 'bg-[#D4AF37]/10 text-[#D4AF37]',
    purple: 'bg-purple-500/10 text-purple-400',
    red: 'bg-red-500/10 text-red-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };

  if (loading) return <LoadingState label="Carregando dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${colorMap[kpi.color] ?? colorMap.blue}`}>{kpi.icon}</div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
            <h3 className="text-lg font-black text-white mt-0.5">{kpi.value}</h3>
            <p className="text-[10px] text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Crescimento de Empresas" subtitle="Últimos 12 meses" data={companyGrowth} color="#D4AF37" />
        <ChartCard title="Volume de Corridas" subtitle="Últimos 7 dias" data={rideVolume} color="#3b82f6" />
      </div>

      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#D4AF37]" />
          Alertas Recentes
        </h3>
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum alerta no momento</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.type === 'totem' ? 'bg-amber-400' : 'bg-red-400'}`} />
                <p className="text-xs text-slate-300 flex-1">{a.message}</p>
                <span className="text-[10px] text-slate-500 font-mono">{a.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, data, color }: { title: string; subtitle: string; data: { label: string; value: number }[]; color: string }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const width = 320;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${padding.top + chartH} L ${points[0]?.x ?? 0} ${padding.top + chartH} Z`;
  const gradId = `grad-${title.replace(/\s/g, '')}`;

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="mb-3 text-xs text-slate-400">{subtitle}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 140 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={padding.left} y1={padding.top + t * chartH} x2={width - padding.right} y2={padding.top + t * chartH} stroke="currentColor" strokeWidth="0.5" className="text-slate-800" />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
            {i % 2 === 0 && <text x={p.x} y={height - 5} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 8 }}>{p.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}
