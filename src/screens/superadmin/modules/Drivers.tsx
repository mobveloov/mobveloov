import { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Save, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, ConfirmModal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { Driver, Company } from '@/types';

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: 'PENDENTE', cls: 'bg-amber-500/10 text-amber-400' },
  approved: { text: 'APROVADO', cls: 'bg-emerald-500/10 text-emerald-400' },
  blocked: { text: 'BLOQUEADO', cls: 'bg-red-500/10 text-red-400' },
};

const PAGE_SIZE = 12;

export function DriversModule({ success, error, logAction, globalSearch }: ModuleProps) {
  const [drivers, setDrivers] = useState<(Driver & { company_name?: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: drvData } = await supabase.from('drivers').select('*, companies(name)').order('created_at', { ascending: false });
    const { data: compData } = await supabase.from('companies').select('id, name').is('deleted_at', null);
    setDrivers((drvData ?? []) as (Driver & { company_name?: string })[]);
    setCompanies((compData ?? []) as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = drivers.filter((d) => {
    if (debouncedSearch && !d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) && !(d.phone ?? '').includes(debouncedSearch)) return false;
    if (companyFilter !== 'all' && d.company_id !== companyFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('drivers').delete().eq('id', deleteTarget.id);
    if (err) { error('Erro ao excluir motorista'); return; }
    success('Motorista excluído');
    await logAction('delete_driver', 'driver', deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar motorista..." />
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="all">Todas empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className={btnGold + ' ml-auto'}>
          <Plus className="h-4 w-4" /> Novo Motorista
        </button>
      </div>

      {loading ? (
        <LoadingState label="Carregando motoristas..." />
      ) : paged.length === 0 ? (
        <EmptyState icon={<Car className="h-10 w-10" />} message="Nenhum motorista encontrado" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paged.map((d) => (
            <div key={d.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-slate-800">
                    <Car className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{d.name}</p>
                    <p className="text-[10px] text-slate-500">{d.company_name ?? '—'}</p>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${d.is_available ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </div>
              <div className="space-y-1 text-[10px] text-slate-500">
                <p>Telefone: {d.phone}</p>
                <p>Placa: {d.vehicle_plate ?? '—'}</p>
                <p>Modelo: {d.vehicle_model ?? '—'}</p>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditDriver(d)} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-1.5 rounded-lg text-[11px] transition-colors">Editar</button>
                <button onClick={() => setDeleteTarget(d)} className="text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {(showCreate || editDriver) && (
        <DriverFormModal
          driver={editDriver ?? undefined}
          companies={companies}
          onClose={() => { setShowCreate(false); setEditDriver(null); }}
          onSaved={(name) => { success(editDriver ? 'Motorista atualizado!' : `Motorista "${name}" criado!`); setShowCreate(false); setEditDriver(null); load(); }}
          onError={error}
          onLog={logAction}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Motorista"
        message={`Excluir "${deleteTarget?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

function DriverFormModal({ driver, companies, onClose, onSaved, onError, onLog }: {
  driver?: Driver;
  companies: Company[];
  onClose: () => void;
  onSaved: (name: string) => void;
  onError: (msg: string) => void;
  onLog: (action: string, type?: string, id?: string, name?: string) => Promise<void>;
}) {
  const [name, setName] = useState(driver?.name ?? '');
  const [phone, setPhone] = useState(driver?.phone ?? '');
  const [companyId, setCompanyId] = useState(driver?.company_id ?? '');
  const [plate, setPlate] = useState(driver?.vehicle_plate ?? '');
  const [model, setModel] = useState(driver?.vehicle_model ?? '');
  const [available, setAvailable] = useState(driver?.is_available ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !companyId) { onError('Preencha nome, telefone e empresa'); return; }
    setSaving(true);
    const payload = { name, phone, company_id: companyId, vehicle_plate: plate || null, vehicle_model: model || null, is_available: available };
    if (driver) {
      const { error: err } = await supabase.from('drivers').update(payload).eq('id', driver.id);
      if (err) { onError('Erro ao atualizar'); setSaving(false); return; }
      await onLog('update_driver', 'driver', driver.id, name);
    } else {
      const { error: err } = await supabase.from('drivers').insert(payload);
      if (err) { onError('Erro ao criar motorista'); setSaving(false); return; }
      await onLog('create_driver', 'driver', undefined, name);
    }
    onSaved(name);
  };

  return (
    <Modal open onClose={onClose} title={driver ? 'Editar Motorista' : 'Novo Motorista'} maxWidth="500px">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelCls}>Empresa</label>
          <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Selecione...</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Placa</label>
            <input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Modelo do Veículo</label>
            <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="accent-[#D4AF37]" />
          <span className="text-xs text-slate-300">Disponível</span>
        </label>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnGold}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
