import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LoadingState, inputCls, labelCls, btnGold } from '../shared';
import type { ModuleProps } from '../Layout';

export function ReportsModule({ success, error }: ModuleProps) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [reportType, setReportType] = useState('financial');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const days = parseInt(period);
    const startDate = new Date(); startDate.setDate(startDate.getDate() - days);

    const { data: companies } = await supabase.from('companies').select('id, name, status, created_at').is('deleted_at', null);
    const { data: invoices } = await supabase.from('invoices').select('*').gte('created_at', startDate.toISOString());
    const { count: ridesCount } = await supabase.from('rides').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString());
    const { data: ridesByCompany } = await supabase.from('rides').select('company_id').gte('created_at', startDate.toISOString());

    const ridesPerCompany: Record<string, number> = {};
    (ridesByCompany ?? []).forEach((r: { company_id: string }) => {
      ridesPerCompany[r.company_id] = (ridesPerCompany[r.company_id] ?? 0) + 1;
    });

    const totalRevenue = (invoices ?? []).filter((i: { status: string }) => i.status === 'paid').reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const totalPending = (invoices ?? []).filter((i: { status: string }) => i.status === 'pending').reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const totalOverdue = (invoices ?? []).filter((i: { status: string }) => i.status === 'overdue').reduce((s: number, i: { amount: number }) => s + i.amount, 0);

    setData({
      totalCompanies: (companies ?? []).length,
      activeCompanies: (companies ?? []).filter((c: { status: string }) => c.status === 'active').length,
      totalRevenue,
      totalPending,
      totalOverdue,
      totalRides: ridesCount ?? 0,
      ridesPerCompany,
      companies: companies ?? [],
    });
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!data) return;
    const d = data as { companies: { id: string; name: string; status: string }[]; ridesPerCompany: Record<string, number> };
    const headers = ['Empresa', 'Status', 'Corridas no Período'];
    const rows = d.companies.map((c) => [c.name, c.status, String(d.ridesPerCompany[c.id] ?? 0)]);
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-${reportType}-${period}d.csv`; a.click();
    URL.revokeObjectURL(url);
    success('Relatório exportado em CSV');
  };

  const exportPDF = () => {
    success('Relatório PDF gerado (abrirá janela de impressão)');
    window.print();
  };

  if (loading) return <LoadingState label="Gerando relatório..." />;

  const d = data as { totalCompanies: number; activeCompanies: number; totalRevenue: number; totalPending: number; totalOverdue: number; totalRides: number };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className={labelCls}>Tipo de Relatório</label>
          <select className={inputCls} value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="financial">Financeiro</option>
            <option value="operational">Operacional</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Período</label>
          <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
        <div className="flex gap-2 ml-auto pt-5">
          <button onClick={exportCSV} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={exportPDF} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <ReportCard label="Receita Total" value={`R$ ${d.totalRevenue.toFixed(2)}`} color="text-emerald-400" />
        <ReportCard label="Pendente" value={`R$ ${d.totalPending.toFixed(2)}`} color="text-amber-400" />
        <ReportCard label="Inadimplência" value={`R$ ${d.totalOverdue.toFixed(2)}`} color="text-red-400" />
        <ReportCard label="Empresas" value={String(d.totalCompanies)} color="text-blue-400" />
        <ReportCard label="Ativas" value={String(d.activeCompanies)} color="text-emerald-400" />
        <ReportCard label="Corridas" value={String(d.totalRides)} color="text-purple-400" />
      </div>

      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Corridas por Empresa no Período</h3>
        <div className="space-y-2">
          {(data as { companies: { id: string; name: string; status: string }[]; ridesPerCompany: Record<string, number> }).companies.map((c) => {
            const count = (data as { ridesPerCompany: Record<string, number> }).ridesPerCompany[c.id] ?? 0;
            const maxRides = Math.max(...Object.values((data as { ridesPerCompany: Record<string, number> }).ridesPerCompany), 1);
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-300 w-32 truncate">{c.name}</span>
                <div className="flex-1 bg-slate-950 rounded-lg h-6 overflow-hidden">
                  <div className="h-full bg-[#D4AF37]/30 rounded-lg flex items-center px-2" style={{ width: `${(count / maxRides) * 100}%` }}>
                    <span className="text-[10px] font-bold text-white">{count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <h3 className={`text-lg font-black mt-1 ${color}`}>{value}</h3>
    </div>
  );
}
