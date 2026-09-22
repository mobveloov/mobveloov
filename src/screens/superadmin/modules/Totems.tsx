import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Wifi, WifiOff, QrCode, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { Company, CompanyLocation } from '@/types';

const PAGE_SIZE = 12;

export function TotemsModule({ success, error, globalSearch }: ModuleProps) {
  const [totems, setTotems] = useState<(CompanyLocation & { company_name?: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: locs } = await supabase.from('company_locations').select('*, companies(name)').order('created_at', { ascending: false });
    const { data: comps } = await supabase.from('companies').select('id, name').is('deleted_at', null);
    setTotems((locs ?? []) as (CompanyLocation & { company_name?: string })[]);
    setCompanies((comps ?? []) as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const isOnline = (t: CompanyLocation) => t.is_active && t.updated_at && t.updated_at > fiveMinAgo;

  const filtered = totems.filter((t) => {
    if (debouncedSearch && !t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) && !(t.company_name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (companyFilter !== 'all' && t.company_id !== companyFilter) return false;
    if (statusFilter === 'online' && !isOnline(t)) return false;
    if (statusFilter === 'offline' && isOnline(t)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleActive = async (id: string, current: boolean) => {
    const { error: err } = await supabase.from('company_locations').update({ is_active: !current }).eq('id', id);
    if (err) { error('Erro ao alterar status'); return; }
    success('Status do totem alterado');
    load();
  };

  const generateQR = () => {
    setQrLoading(true);
    setTimeout(() => {
      setQrData('iVBORw0KGgoAAAANSUhEUgAA');
      setQrLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar totem..." />
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todas empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todos status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <button onClick={() => { setShowQR(true); setQrData(null); }} className={btnGold + ' ml-auto'}>
          <QrCode className="h-4 w-4" /> Parear Novo Totem
        </button>
      </div>

      {loading ? (
        <LoadingState label="Carregando totens..." />
      ) : paged.length === 0 ? (
        <EmptyState icon={<Smartphone className="h-10 w-10" />} message="Nenhum totem encontrado" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paged.map((t) => {
            const online = isOnline(t);
            return (
              <div key={t.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${online ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
                      {online ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-slate-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-[10px] text-slate-500">{t.company_name ?? '—'}</p>
                    </div>
                  </div>
                  <StatusBadge status={online ? 'online' : 'offline'} labels={{
                    online: { text: 'ONLINE', cls: 'bg-emerald-500/10 text-emerald-400' },
                    offline: { text: 'OFFLINE', cls: 'bg-slate-500/10 text-slate-400' },
                  }} />
                </div>
                <div className="space-y-1 text-[10px] text-slate-500">
                  <p>Cidade: {t.city ?? '—'}</p>
                  <p>Última sync: {t.updated_at ? new Date(t.updated_at).toLocaleString('pt-BR') : '—'}</p>
                  <p>Device: {(t.device_fingerprint ?? '—').slice(0, 16)}</p>
                </div>
                <button
                  onClick={() => toggleActive(t.id, t.is_active)}
                  className={`w-full mt-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${t.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                >
                  {t.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      <Modal open={showQR} onClose={() => setShowQR(false)} title="Parear Novo Totem" maxWidth="400px">
        <div className="flex flex-col items-center gap-4">
          {!qrData ? (
            <button onClick={generateQR} disabled={qrLoading} className={btnGold + ' w-full justify-center'}>
              {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              {qrLoading ? 'Gerando...' : 'Gerar QR Code de Pareamento'}
            </button>
          ) : (
            <>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center gap-3 min-h-[250px] justify-center">
                <img src={`data:image/png;base64,${qrData}`} alt="QR Code" className="w-40 h-40 rounded-lg border border-slate-800" />
                <p className="text-[10px] text-slate-500 animate-pulse">Aguardando leitura do QR Code...</p>
                <button onClick={() => setQrData(null)} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Gerar novo
                </button>
              </div>
            </>
          )}
          <button onClick={() => setShowQR(false)} className={btnGhost}>Fechar</button>
        </div>
      </Modal>
    </div>
  );
}
