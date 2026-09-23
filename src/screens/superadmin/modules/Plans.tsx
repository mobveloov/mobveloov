import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, Save, Loader2, Trash2, Eye, Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, ConfirmModal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { SubscriptionPlan } from '@/types';

const PAGE_SIZE = 12;

export function PlansModule({ success, error, logAction }: ModuleProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [companies, setCompanies] = useState<{ plan_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [previewPlan, setPreviewPlan] = useState<SubscriptionPlan | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: planData } = await supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true });
    const { data: compData } = await supabase.from('companies').select('plan_id').is('deleted_at', null);
    setPlans((planData ?? []) as SubscriptionPlan[]);
    setCompanies(compData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = plans.filter((p) => !debouncedSearch || p.name.toLowerCase().includes(debouncedSearch.toLowerCase()));

  const countCompanies = (planId: string) => companies.filter((c) => c.plan_id === planId).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (countCompanies(deleteTarget.id) > 0) { error('Não é possível excluir um plano com empresas vinculadas'); setDeleteTarget(null); return; }
    const { error: err } = await supabase.from('subscription_plans').delete().eq('id', deleteTarget.id);
    if (err) { error('Erro ao excluir plano'); return; }
    success(`Plano "${deleteTarget.name}" excluído`);
    await logAction('delete_plan', 'plan', deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar plano..." />
        <button onClick={() => setShowCreate(true)} className={btnGold + ' ml-auto'}>
          <Plus className="h-4 w-4" /> Novo Plano
        </button>
      </div>

      {loading ? (
        <LoadingState label="Carregando planos..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-10 w-10" />} message="Nenhum plano encontrado" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white">{p.name}</h3>
                <StatusBadge status={p.is_active ? 'active' : 'inactive'} labels={{
                  active: { text: 'ATIVO', cls: 'bg-emerald-500/10 text-emerald-400' },
                  inactive: { text: 'INATIVO', cls: 'bg-slate-500/10 text-slate-400' },
                }} />
              </div>
              <div className="space-y-2 text-xs text-slate-400 flex-1">
                <div className="flex justify-between"><span>Mensal</span><span className="text-emerald-400 font-bold">R$ {(p.base_monthly_price ?? p.price ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Trimestral</span><span className="text-amber-400 font-bold">R$ {(p.quarterly_price ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Semestral</span><span className="text-amber-400 font-bold">R$ {(p.semiannual_price ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Anual</span><span className="text-amber-400 font-bold">R$ {(p.annual_price ?? 0).toFixed(2)}</span></div>
                <div className="h-px bg-slate-800 my-2" />
                <div className="flex justify-between items-center"><span>Desc. Trimestral</span><span className="text-[#D4AF37] font-bold flex items-center gap-1"><Percent className="h-3 w-3" />{(p.quarterly_discount_percent ?? 0).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center"><span>Desc. Semestral</span><span className="text-[#D4AF37] font-bold flex items-center gap-1"><Percent className="h-3 w-3" />{(p.semiannual_discount_percent ?? 0).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center"><span>Desc. Anual</span><span className="text-[#D4AF37] font-bold flex items-center gap-1"><Percent className="h-3 w-3" />{(p.annual_discount_percent ?? 0).toFixed(0)}%</span></div>
                <div className="h-px bg-slate-800 my-2" />
                <div className="flex justify-between"><span>Totens</span><span className="text-white font-bold">{p.totem_limit}</span></div>
                <div className="flex justify-between"><span>Tier WhatsApp</span><span className="text-[#D4AF37] font-bold">{p.message_tier ?? 'A'}</span></div>
                <div className="flex justify-between"><span>Empresas</span><span className="text-white font-bold">{countCompanies(p.id)}</span></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditPlan(p)} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2 rounded-lg text-[11px] transition-colors">Editar</button>
                <button onClick={() => setPreviewPlan(p)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 rounded-lg text-[11px] transition-colors"><Eye className="h-3 w-3" /></button>
                <button onClick={() => setDeleteTarget(p)} className="text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && <Pagination page={1} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPage={() => {}} />}

      {showCreate && <PlanFormModal onClose={() => setShowCreate(false)} onSaved={(name) => { success(`Plano "${name}" criado!`); setShowCreate(false); load(); }} onError={error} onLog={logAction} />}
      {editPlan && <PlanFormModal plan={editPlan} onClose={() => setEditPlan(null)} onSaved={() => { success('Plano atualizado!'); setEditPlan(null); load(); }} onError={error} onLog={logAction} />}

      {previewPlan && (
        <Modal open onClose={() => setPreviewPlan(null)} title={`Preview: ${previewPlan.name}`} maxWidth="400px">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-3 bg-slate-950 rounded-lg"><span className="text-slate-400">Mensal</span><span className="text-emerald-400 font-bold">R$ {(previewPlan.base_monthly_price ?? previewPlan.price ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between p-3 bg-slate-950 rounded-lg"><span className="text-slate-400">Trimestral</span><span className="text-amber-400 font-bold">R$ {(previewPlan.quarterly_price ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between p-3 bg-slate-950 rounded-lg"><span className="text-slate-400">Semestral</span><span className="text-amber-400 font-bold">R$ {(previewPlan.semiannual_price ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between p-3 bg-slate-950 rounded-lg"><span className="text-slate-400">Anual</span><span className="text-amber-400 font-bold">R$ {(previewPlan.annual_price ?? 0).toFixed(2)}</span></div>
          </div>
        </Modal>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Plano"
        message={`Excluir "${deleteTarget?.name}"? Empresas vinculadas não serão afetadas, mas não poderão mais contratar este plano.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

function PlanFormModal({ plan, onClose, onSaved, onError, onLog }: {
  plan?: SubscriptionPlan;
  onClose: () => void;
  onSaved: (name: string) => void;
  onError: (msg: string) => void;
  onLog: (action: string, type?: string, id?: string, name?: string) => Promise<void>;
}) {
  const [name, setName] = useState(plan?.name ?? '');
  const [totemLimit, setTotemLimit] = useState(plan?.totem_limit?.toString() ?? '1');
  const [baseMonthly, setBaseMonthly] = useState(plan?.base_monthly_price?.toString() ?? plan?.price?.toString() ?? '0');
  const [quarterlyDiscount, setQuarterlyDiscount] = useState(plan?.quarterly_discount_percent?.toString() ?? '5');
  const [semiannualDiscount, setSemiannualDiscount] = useState(plan?.semiannual_discount_percent?.toString() ?? '10');
  const [annualDiscount, setAnnualDiscount] = useState(plan?.annual_discount_percent?.toString() ?? '15');

  const calcPrice = (months: number, discountPct: string) => {
    const base = parseFloat(baseMonthly) || 0;
    const disc = parseFloat(discountPct) || 0;
    return (base * months * (1 - disc / 100)).toFixed(2);
  };

  const quarterly = calcPrice(3, quarterlyDiscount);
  const semiannual = calcPrice(6, semiannualDiscount);
  const annual = calcPrice(12, annualDiscount);
  const [messageTier, setMessageTier] = useState(plan?.message_tier ?? 'A');
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(plan?.sort_order?.toString() ?? '0');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { onError('Preencha o nome'); return; }
    setSaving(true);
    const payload = {
      name, totem_limit: parseInt(totemLimit) || 1,
      base_monthly_price: parseFloat(baseMonthly) || 0,
      quarterly_price: parseFloat(quarterly) || 0,
      semiannual_price: parseFloat(semiannual) || 0,
      annual_price: parseFloat(annual) || 0,
      quarterly_discount_percent: parseFloat(quarterlyDiscount) || 0,
      semiannual_discount_percent: parseFloat(semiannualDiscount) || 0,
      annual_discount_percent: parseFloat(annualDiscount) || 0,
      message_tier: messageTier,
      is_active: isActive,
      sort_order: parseInt(sortOrder) || 0,
      billing_period: 'monthly',
      price: parseFloat(baseMonthly) || 0,
    };
    if (plan) {
      const { error: err } = await supabase.from('subscription_plans').update(payload).eq('id', plan.id);
      if (err) { onError('Erro ao atualizar'); setSaving(false); return; }
      await onLog('update_plan', 'plan', plan.id, name);
    } else {
      const { error: err } = await supabase.from('subscription_plans').insert(payload);
      if (err) { onError('Erro ao criar plano'); setSaving(false); return; }
      await onLog('create_plan', 'plan', undefined, name);
    }
    onSaved(name);
  };

  return (
    <Modal open onClose={onClose} title={plan ? 'Editar Plano' : 'Novo Plano'} maxWidth="520px">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelCls}>Nome</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Limite de Totens</label>
            <input type="number" className={inputCls} value={totemLimit} onChange={(e) => setTotemLimit(e.target.value)} min="1" />
          </div>
          <div>
            <label className={labelCls}>Tier WhatsApp</label>
            <select className={inputCls} value={messageTier} onChange={(e) => setMessageTier(e.target.value)}>
              <option value="A">Tier A (Básico)</option>
              <option value="B">Tier B (ETA)</option>
              <option value="C">Tier C (Rastreamento)</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Valor mensal (R$)</label>
          <input type="number" step="0.01" className={inputCls} value={baseMonthly} onChange={(e) => setBaseMonthly(e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-500">Os valores de trimestral, semestral e anual sao calculados automaticamente: mensal × meses - desconto.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Desc. Trimestral (%)</label>
            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={quarterlyDiscount} onChange={(e) => setQuarterlyDiscount(e.target.value)} />
            <p className="mt-1 text-[11px] text-emerald-400 font-bold">R$ {quarterly}</p>
          </div>
          <div>
            <label className={labelCls}>Desc. Semestral (%)</label>
            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={semiannualDiscount} onChange={(e) => setSemiannualDiscount(e.target.value)} />
            <p className="mt-1 text-[11px] text-emerald-400 font-bold">R$ {semiannual}</p>
          </div>
          <div>
            <label className={labelCls}>Desc. Anual (%)</label>
            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={annualDiscount} onChange={(e) => setAnnualDiscount(e.target.value)} />
            <p className="mt-1 text-[11px] text-emerald-400 font-bold">R$ {annual}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Ordem</label>
            <input type="number" className={inputCls} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Ativo para novas contratações</label>
            <select className={inputCls} value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>
        </div>
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
