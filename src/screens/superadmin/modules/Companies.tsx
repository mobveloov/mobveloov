import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Save, Loader2, AlertCircle, Trash2, Lock,
  Crown, KeyRound, Eye, EyeOff, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { slugify, formatCpfCnpj, isCpfCnpj, docLabel } from '@/lib/utils';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  ConfirmModal, Modal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { Company, SubscriptionPlan } from '@/types';

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  active: { text: 'ATIVO', cls: 'bg-emerald-500/10 text-emerald-400' },
  suspended: { text: 'SUSPENSO', cls: 'bg-red-500/10 text-red-400' },
  trial: { text: 'TRIAL', cls: 'bg-blue-500/10 text-blue-400' },
  paused: { text: 'PAUSADO', cls: 'bg-amber-500/10 text-amber-400' },
  pending_pagamento: { text: 'PEND. PAGAMENTO', cls: 'bg-orange-500/10 text-orange-400' },
  pending: { text: 'PENDENTE', cls: 'bg-orange-500/10 text-orange-400' },
};

const PAGE_SIZE = 10;

export function CompaniesModule({ success, error, logAction, globalSearch }: ModuleProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Company | null>(null);
  const [approveTarget, setApproveTarget] = useState<Company | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Company | null>(null);
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null);
  const [dueDateValue, setDueDateValue] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const globalDebounced = useDebounce(globalSearch, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: compData } = await supabase.from('companies').select('*, subscription_plans(name, totem_limit, price, base_monthly_price)').is('deleted_at', null).order('created_at', { ascending: false });
    const { data: planData } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    setCompanies((compData ?? []) as Company[]);
    setPlans((planData ?? []) as SubscriptionPlan[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter((c) => {
    const q = (debouncedSearch || globalDebounced).toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !(c.cnpj ?? '').includes(q) && !(c.slug ?? '').includes(q)) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('companies').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', deleteTarget.id);
    if (err) {
      error('Erro ao excluir empresa');
    } else {
      success(`Empresa "${deleteTarget.name}" excluída (soft delete)`);
      await logAction('delete_company', 'company', deleteTarget.id, deleteTarget.name);
      load();
    }
    setDeleteTarget(null);
  };

  const saveDueDate = async (companyId: string) => {
    setSavingDueDate(true);
    const { error: err } = await supabase.from('companies').update({
      expires_at: dueDateValue ? new Date(dueDateValue + 'T23:59:59').toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', companyId);
    if (err) { error('Erro ao atualizar vencimento'); }
    else { success('Vencimento atualizado'); await logAction('update_due_date', 'company', companyId); }
    setSavingDueDate(false);
    setEditingDueDate(null);
    load();
  };

  const approveCompany = async () => {
    if (!approveTarget) return;
    const { error: err } = await supabase.from('companies').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', approveTarget.id);
    if (err) { error('Erro ao aprovar empresa'); }
    else {
      success(`Empresa "${approveTarget.name}" aprovada e ativada!`);
      await logAction('approve_company', 'company', approveTarget.id, approveTarget.name);
      load();
    }
    setApproveTarget(null);
  };

  const rejectCompany = async () => {
    if (!rejectTarget) return;
    const { error: err } = await supabase.from('companies').update({ status: 'suspended', suspend_reason: 'Cadastro recusado pelo SuperAdmin', updated_at: new Date().toISOString() }).eq('id', rejectTarget.id);
    if (err) { error('Erro ao recusar empresa'); }
    else {
      success(`Empresa "${rejectTarget.name}" recusada e suspensa`);
      await logAction('reject_company', 'company', rejectTarget.id, rejectTarget.name);
      load();
    }
    setRejectTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar empresa..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#D4AF37]">
          <option value="all">Todos</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
          <option value="trial">Trial</option>
          <option value="paused">Pausadas</option>
          <option value="pending_pagamento">Pend. Pagamento</option>
          <option value="pending">Pendentes</option>
        </select>
        <button onClick={() => setShowCreate(true)} className={btnGold + ' ml-auto'}>
          <Plus className="h-4 w-4" /> Nova Empresa
        </button>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando empresas..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<Building2 className="h-10 w-10" />} message="Nenhuma empresa encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Empresa / CNPJ</th>
                  <th className="p-4">Plano</th>
                  <th className="p-4 hidden md:table-cell">Vencimento</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((comp) => {
                  const plan = plans.find((p) => p.id === comp.plan_id);
                  const isExpired = comp.expires_at ? new Date(comp.expires_at) < new Date() : false;
                  const isPending = comp.status === 'pending_pagamento' || comp.status === 'pending';
                  return (
                    <tr key={comp.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${comp.status === 'active' ? 'bg-[#D4AF37]/15' : isPending ? 'bg-orange-500/15' : 'bg-slate-800'}`}>
                            <Building2 className={`h-4 w-4 ${comp.status === 'active' ? 'text-[#D4AF37]' : isPending ? 'text-orange-400' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <p className="text-white font-bold">{comp.name}</p>
                            <p className="text-slate-500 font-mono text-[10px]">{comp.cnpj ? formatCpfCnpj(comp.cnpj) : '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[#D4AF37] font-bold flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          {plan?.name ?? '—'}
                        </span>
                      </td>
                      <td className="p-4 hidden md:table-cell font-mono">
                        {editingDueDate === comp.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={dueDateValue}
                              onChange={(e) => setDueDateValue(e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-white"
                              autoFocus
                            />
                            <button onClick={() => saveDueDate(comp.id)} disabled={savingDueDate} className="text-emerald-400 hover:text-emerald-300">
                              {savingDueDate ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            </button>
                            <button onClick={() => setEditingDueDate(null)} className="text-slate-400 hover:text-white">
                              <XCircle className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingDueDate(comp.id); setDueDateValue(comp.expires_at ? comp.expires_at.slice(0, 10) : ''); }}
                            className="text-left hover:text-[#D4AF37] transition-colors"
                          >
                            {comp.expires_at ? (
                              <span className={isExpired ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                {new Date(comp.expires_at).toLocaleDateString('pt-BR')}
                              </span>
                            ) : <span className="text-slate-500">—</span>}
                          </button>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={comp.status} labels={STATUS_LABELS} />
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPending && (
                            <>
                              <button onClick={() => setApproveTarget(comp)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors flex items-center gap-1" title="Aprovar">
                                <CheckCircle className="h-3 w-3" /> Aprovar
                              </button>
                              <button onClick={() => setRejectTarget(comp)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors" title="Recusar">
                                <XCircle className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          {!isPending && (
                            <>
                              <button onClick={() => setEditCompany(comp)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors">
                                Editar
                              </button>
                              <button onClick={() => setPasswordTarget(comp)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors" title="Resetar senha">
                                <KeyRound className="h-3 w-3" />
                              </button>
                              <button onClick={() => setDeleteTarget(comp)} className="text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded-lg transition-colors" title="Excluir">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {showCreate && (
        <CreateCompanyModal
          plans={plans}
          onClose={() => setShowCreate(false)}
          onCreated={(name) => { success(`Empresa "${name}" criada!`); setShowCreate(false); load(); }}
          onError={(msg) => error(msg)}
          onLog={logAction}
        />
      )}

      {editCompany && (
        <EditCompanyModal
          company={editCompany}
          plans={plans}
          onClose={() => setEditCompany(null)}
          onSaved={() => { success('Alterações salvas!'); setEditCompany(null); load(); }}
          onError={(msg) => error(msg)}
          onLog={logAction}
        />
      )}

      {passwordTarget && (
        <PasswordResetModal
          company={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onReset={() => { success('Senha resetada com sucesso!'); setPasswordTarget(null); }}
          onError={(msg) => error(msg)}
          onLog={logAction}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Empresa"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir Definitivamente"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />

      <ConfirmModal
        open={!!approveTarget}
        title="Aprovar Empresa"
        message={`Aprovar "${approveTarget?.name}"? A empresa será ativada e poderá usar o sistema.`}
        confirmLabel="Aprovar e Ativar"
        onConfirm={approveCompany}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmModal
        open={!!rejectTarget}
        title="Recusar Cadastro"
        message={`Recusar "${rejectTarget?.name}"? A empresa será suspensa e não poderá usar o sistema.`}
        confirmLabel="Recusar e Suspender"
        onConfirm={rejectCompany}
        onCancel={() => setRejectTarget(null)}
        danger
      />
    </div>
  );
}

function CreateCompanyModal({ plans, onClose, onCreated, onError, onLog }: {
  plans: SubscriptionPlan[];
  onClose: () => void;
  onCreated: (name: string) => void;
  onError: (msg: string) => void;
  onLog: (action: string, type?: string, id?: string, name?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('');
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState<'active' | 'trial'>('active');
  const [trialDays, setTrialDays] = useState('7');
  const [expiresAt, setExpiresAt] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);

  const generateTempPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setAdminPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { onError('Preencha o nome da empresa'); return; }
    setCreating(true);
    const payload: Record<string, unknown> = { slug: slugify(slug || name), name, status };
    if (planId) payload.plan_id = planId;
    if (cnpj) payload.cnpj = cnpj.replace(/\D/g, '');
    if (responsibleName) payload.responsible_name = responsibleName;
    if (responsiblePhone) payload.responsible_phone = responsiblePhone;
    if (responsibleEmail) payload.responsible_email = responsibleEmail;
    if (status === 'trial') {
      const d = new Date(); d.setDate(d.getDate() + (parseInt(trialDays) || 7));
      payload.expires_at = d.toISOString();
    } else if (expiresAt) {
      payload.expires_at = new Date(expiresAt + 'T23:59:59').toISOString();
    }
    const { data: companyData, error: err } = await supabase.from('companies').insert(payload).select('id, slug').single();
    if (err) { onError('Erro ao criar empresa. Slug pode já existir.'); setCreating(false); return; }

    if (adminPassword && responsibleEmail && companyData) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-company-admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            action: 'create_admin',
            company_id: companyData.id,
            email: responsibleEmail,
            password: adminPassword,
            force_password_change: true,
          }),
        });
        if (!response.ok) {
          const errData = await response.json();
          onError('Aviso: empresa criada, mas erro ao criar admin: ' + (errData.error ?? 'desconhecido'));
        }
      } catch { /* non-critical, company is created */ }
    }

    await onLog('create_company', 'company', companyData.id, name);
    onCreated(name);
  };

  return (
    <Modal open onClose={onClose} title="Nova Empresa Parceira" maxWidth="560px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Slug (URL)</label>
            <input className={inputCls} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="auto-gerado" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{cnpj.replace(/\D/g, '').length <= 11 ? 'CPF' : 'CNPJ'}</label>
            <input
              className={inputCls}
              value={cnpj}
              onChange={(e) => {
                const formatted = formatCpfCnpj(e.target.value);
                setCnpj(formatted);
                const digits = formatted.replace(/\D/g, '');
                if (!digits) { setDocError(null); return; }
                if (digits.length === 11 || digits.length === 14) {
                  setDocError(isCpfCnpj(formatted) ? null : `${docLabel(formatted)} inválido`);
                } else {
                  setDocError(null);
                }
              }}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
            />
            {docError && <p className="mt-1 text-[10px] text-red-400">{docError}</p>}
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'trial')}>
              <option value="active">Ativa</option>
              <option value="trial">Trial</option>
            </select>
          </div>
        </div>
        {status === 'trial' && (
          <div>
            <label className={labelCls}>Dias de Trial</label>
            <input type="number" className={inputCls} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} min="1" max="365" />
          </div>
        )}
        {status === 'active' && (
          <div>
            <label className={labelCls}>Data de Vencimento do Plano</label>
            <input type="date" className={inputCls} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelCls}>Plano</label>
          <select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Sem plano</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.totem_limit} totens)</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Responsável</label>
            <input className={inputCls} value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={responsiblePhone} onChange={(e) => setResponsiblePhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input type="email" className={inputCls} value={responsibleEmail} onChange={(e) => setResponsibleEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Senha de Acesso (admin)</label>
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} className={inputCls + ' pr-10'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Gerar ou digitar" />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button type="button" onClick={generateTempPassword} className="mt-1.5 text-xs text-[#D4AF37] hover:text-[#b8962e] font-bold flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Gerar senha temporária
          </button>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={creating} className={btnGold}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar Empresa
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditCompanyModal({ company, plans, onClose, onSaved, onError, onLog }: {
  company: Company;
  plans: SubscriptionPlan[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  onLog: (action: string, type?: string, id?: string, name?: string) => Promise<void>;
}) {
  const [name, setName] = useState(company.name);
  const [cnpj, setCnpj] = useState(company.cnpj ?? '');
  const [docError, setDocError] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState(company.responsible_name ?? '');
  const [responsiblePhone, setResponsiblePhone] = useState(company.responsible_phone ?? '');
  const [responsibleEmail, setResponsibleEmail] = useState(company.responsible_email ?? '');
  const [status, setStatus] = useState(company.status);
  const [planId, setPlanId] = useState(company.plan_id ?? '');
  const [expiresAt, setExpiresAt] = useState(company.expires_at ? company.expires_at.slice(0, 10) : '');
  const [customDiscount, setCustomDiscount] = useState(company.custom_discount?.toString() ?? '');
  const [suspendReason, setSuspendReason] = useState(company.suspend_reason ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {
      name, cnpj: cnpj.replace(/\D/g, ''), responsible_name: responsibleName, responsible_phone: responsiblePhone,
      responsible_email: responsibleEmail, status, plan_id: planId || null,
      expires_at: expiresAt ? new Date(expiresAt + 'T23:59:59').toISOString() : null,
      custom_discount: customDiscount ? parseFloat(customDiscount) : 0,
      suspend_reason: status === 'suspended' ? suspendReason : null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase.from('companies').update(payload).eq('id', company.id);
    if (err) { onError('Erro ao salvar'); setSaving(false); return; }
    await onLog('update_company', 'company', company.id, company.name);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`Editar: ${company.name}`} maxWidth="560px">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{cnpj.replace(/\D/g, '').length <= 11 ? 'CPF' : 'CNPJ'}</label>
            <input
              className={inputCls}
              value={cnpj}
              onChange={(e) => {
                const formatted = formatCpfCnpj(e.target.value);
                setCnpj(formatted);
                const digits = formatted.replace(/\D/g, '');
                if (!digits) { setDocError(null); return; }
                if (digits.length === 11 || digits.length === 14) {
                  setDocError(isCpfCnpj(formatted) ? null : `${docLabel(formatted)} inválido`);
                } else {
                  setDocError(null);
                }
              }}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
            />
            {docError && <p className="mt-1 text-[10px] text-red-400">{docError}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Responsável</label>
            <input className={inputCls} value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={responsiblePhone} onChange={(e) => setResponsiblePhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input type="email" className={inputCls} value={responsibleEmail} onChange={(e) => setResponsibleEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as Company['status'])}>
            <option value="active">Ativa</option>
            <option value="suspended">Suspensa</option>
            <option value="trial">Trial</option>
            <option value="paused">Pausada</option>
            <option value="pending_pagamento">Pendente de Pagamento</option>
          </select>
        </div>
        {status === 'suspended' && (
          <div>
            <label className={labelCls}>Motivo da Suspensão</label>
            <input className={inputCls} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Ex: Pagamento em atraso" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Plano</label>
            <select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Sem plano</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.totem_limit} totens)</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vencimento do Plano</label>
            <input type="date" className={inputCls} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Desconto Manual (%)</label>
          <input type="number" step="0.01" min="0" max="100" className={inputCls} value={customDiscount} onChange={(e) => setCustomDiscount(e.target.value)} />
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

function PasswordResetModal({ company, onClose, onReset, onError, onLog }: {
  company: Company;
  onClose: () => void;
  onReset: () => void;
  onError: (msg: string) => void;
  onLog: (action: string, type?: string, id?: string, name?: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [forceChange, setForceChange] = useState(true);
  const [saving, setSaving] = useState(false);

  const generateTemp = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { onError('Senha deve ter ao menos 6 caracteres'); return; }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-company-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          action: 'reset_password',
          company_id: company.id,
          password: newPassword,
          force_password_change: forceChange,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        onError(result.error ?? 'Erro ao resetar senha');
        setSaving(false);
        return;
      }
      await onLog('reset_password', 'company', company.id, company.name);
      onReset();
    } catch {
      onError('Erro de conexão ao resetar senha');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Resetar Senha: ${company.name}`} maxWidth="480px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Nova Senha</label>
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} className={inputCls + ' pr-10'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button type="button" onClick={generateTemp} className="text-xs text-[#D4AF37] hover:text-[#b8962e] font-bold flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Gerar senha temporária
        </button>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={forceChange} onChange={(e) => setForceChange(e.target.checked)} className="accent-[#D4AF37]" />
          <span className="text-xs text-slate-300">Forçar troca no próximo login</span>
        </label>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnGold}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Resetar Senha
          </button>
        </div>
      </form>
    </Modal>
  );
}
