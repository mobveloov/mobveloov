import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, Loader2, CheckCircle2, AlertCircle, ChevronDown,
  ChevronUp, Power, KeyRound, Zap, X, Info, Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { INTEGRATION_CATALOG, type IntegrationCategory, type ProviderDef } from '@/lib/integrationCatalog';
import { inputCls, labelCls } from '../shared';
import type { ModuleProps } from '../Layout';

interface CredentialRow {
  id: string;
  category: string;
  provider: string;
  label: string;
  credential_fields: Record<string, string> | null;
  priority: number;
  is_active: boolean;
  last_used_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
}

interface DraftCredential {
  id: string;
  category: string;
  provider: string;
  label: string;
  credentials: Record<string, string>;
  priority: number;
  is_active: boolean;
}

export function AdvancedIntegrationsModule({ success, error: toastError }: ModuleProps) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<IntegrationCategory | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftCredential[]>>({});
  const [saving, setSaving] = useState(false);
  const [showAddFor, setShowAddFor] = useState<IntegrationCategory | null>(null);
  const [newProv, setNewProv] = useState<ProviderDef | null>(null);
  const [newCreds, setNewCreds] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('integration_credentials_safe')
      .select('*')
      .is('tenant_id', null)
      .order('category')
      .order('priority');

    if (error) {
      toastError('Erro ao carregar integracoes globais');
    } else if (data) {
      setRows(data as CredentialRow[]);
      const draftMap: Record<string, DraftCredential[]> = {};
      for (const r of data as CredentialRow[]) {
        const key = r.category;
        if (!draftMap[key]) draftMap[key] = [];
        draftMap[key].push({
          id: r.id,
          category: r.category,
          provider: r.provider,
          label: r.label,
          credentials: r.credential_fields ?? {},
          priority: r.priority,
          is_active: r.is_active,
        });
      }
      setDrafts(draftMap);
    }
    setLoading(false);
  }, [toastError]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const cat of Object.keys(drafts)) {
        for (const draft of drafts[cat]) {
          await supabase
            .from('integration_credentials')
            .update({
              label: draft.label,
              credentials: draft.credentials,
              priority: draft.priority,
              is_active: draft.is_active,
              updated_at: new Date().toISOString(),
            })
            .eq('id', draft.id);
        }
      }
      success('Integracoes globais salvas com sucesso!');
    } catch {
      toastError('Erro ao salvar integracoes');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('integration_credentials').delete().eq('id', id);
    load();
  };

  const handleAddNew = async () => {
    if (!showAddFor || !newProv) return;
    setSaving(true);
    const existingForCat = drafts[showAddFor] ?? [];
    const nextPriority = existingForCat.length;

    const { error: insErr } = await supabase
      .from('integration_credentials')
      .insert({
        tenant_id: null,
        category: showAddFor,
        provider: newProv.value,
        label: newLabel || `${newProv.label} ${existingForCat.length + 1}`,
        credentials: newCreds,
        priority: nextPriority,
        is_active: true,
      });

    if (insErr) {
      toastError('Erro ao adicionar credencial: ' + insErr.message);
    } else {
      setShowAddFor(null);
      setNewProv(null);
      setNewCreds({});
      setNewLabel('');
      load();
    }
    setSaving(false);
  };

  const updateDraft = (cat: string, idx: number, field: keyof DraftCredential, value: unknown) => {
    setDrafts((prev) => {
      const arr = [...(prev[cat] ?? [])];
      (arr[idx] as Record<string, unknown>)[field] = value;
      return { ...prev, [cat]: arr };
    });
  };

  const updateDraftCred = (cat: string, idx: number, key: string, value: string) => {
    setDrafts((prev) => {
      const arr = [...(prev[cat] ?? [])];
      arr[idx] = { ...arr[idx], credentials: { ...arr[idx].credentials, [key]: value } };
      return { ...prev, [cat]: arr };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#D4AF37]" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider text-[#D4AF37]">Integracoes Globais (Fallback)</h3>
        </div>
        <p className="text-[11px] text-slate-500">
          Estas credenciais sao usadas por todas as empresas que nao tem sua propria configuracao para a categoria. Se uma empresa nao configurou um provedor, ou se todas as credenciais dela falharam, o sistema usa estas credenciais globais como fallback.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <p className="text-[11px] text-blue-300">
          <strong>Fallback automatico:</strong> Quando uma chave atinge limite ou falha, o sistema tenta a proxima credencial ativa da mesma categoria. Multiplas chaves do mesmo provedor sao suportadas (ex: 10 chaves Groq).
        </p>
      </div>

      <div className="space-y-3">
        {INTEGRATION_CATALOG.map((cat) => {
          const Icon = cat.icon;
          const catDrafts = drafts[cat.value] ?? [];
          const isOpen = expandedCat === cat.value;
          return (
            <div key={cat.value} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedCat(isOpen ? null : cat.value)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-800/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{cat.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{cat.description}</p>
                </div>
                {catDrafts.length > 0 && (
                  <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold text-[#D4AF37]">
                    {catDrafts.filter((d) => d.is_active).length} ativa{catDrafts.filter((d) => d.is_active).length !== 1 ? 's' : ''}
                  </span>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              </button>

              {isOpen && (
                <div className="border-t border-slate-800 p-4 space-y-3">
                  {catDrafts.length === 0 && !showAddFor && (
                    <p className="text-xs text-slate-500 py-2">Nenhuma integracao global configurada para esta categoria.</p>
                  )}

                  {catDrafts.map((d, idx) => {
                    const provDef = cat.providers.find((p) => p.value === d.provider);
                    if (!provDef) return null;
                    return (
                      <div key={idx} className="rounded-lg border border-slate-700 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                          <input
                            type="text"
                            value={d.label}
                            onChange={(e) => updateDraft(cat.value, idx, 'label', e.target.value)}
                            className="flex-1 bg-transparent text-sm font-semibold text-white outline-none border-b border-transparent focus:border-[#D4AF37]"
                            placeholder="Nome da credencial"
                          />
                          <button
                            onClick={() => updateDraft(cat.value, idx, 'is_active', !d.is_active)}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                              d.is_active
                                ? 'bg-green-500/15 text-green-400'
                                : 'bg-slate-700 text-slate-500'
                            }`}
                          >
                            <Power className="h-3 w-3" />
                            {d.is_active ? 'Ativa' : 'Inativa'}
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="rounded-md p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">{provDef.label} — {provDef.description}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {provDef.fields.map((f) => (
                            <div key={f.key}>
                              <label className={labelCls}>{f.label}</label>
                              <input
                                type={f.type}
                                value={d.credentials[f.key] ?? ''}
                                onChange={(e) => updateDraftCred(cat.value, idx, f.key, e.target.value)}
                                placeholder={f.placeholder ?? ''}
                                className={inputCls}
                              />
                            </div>
                          ))}
                        </div>
                        {d.last_error_at && (
                          <p className="text-[10px] text-red-400">Ultimo erro: {d.last_error_message ?? 'Erro desconhecido'}</p>
                        )}
                      </div>
                    );
                  })}

                  {showAddFor === cat.value && newProv && (
                    <div className="rounded-lg border-2 border-dashed border-[#D4AF37]/30 p-3 space-y-3 bg-[#D4AF37]/5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#D4AF37]">Nova credencial: {newProv.label}</p>
                        <button onClick={() => { setShowAddFor(null); setNewProv(null); setNewCreds({}); setNewLabel(''); }} className="text-slate-500 hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div>
                        <label className={labelCls}>Nome (opcional)</label>
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder={`${newProv.label} ${catDrafts.length + 1}`}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {newProv.fields.map((f) => (
                          <div key={f.key}>
                            <label className={labelCls}>{f.label}</label>
                            <input
                              type={f.type}
                              value={newCreds[f.key] ?? ''}
                              onChange={(e) => setNewCreds({ ...newCreds, [f.key]: e.target.value })}
                              placeholder={f.placeholder ?? ''}
                              className={inputCls}
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleAddNew}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Adicionar
                      </button>
                    </div>
                  )}

                  {showAddFor === cat.value && !newProv && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400">Escolha um provedor:</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {cat.providers.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => { setNewProv(p); setNewCreds({}); setNewLabel(''); }}
                            className="rounded-lg border border-slate-700 p-3 text-left transition-all hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5"
                          >
                            <p className="text-xs font-bold text-white">{p.label}</p>
                            <p className="text-[10px] text-slate-500">{p.description}</p>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowAddFor(null)} className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                    </div>
                  )}

                  {showAddFor !== cat.value && (
                    <button
                      onClick={() => { setShowAddFor(cat.value); setNewProv(null); }}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-600 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all w-full justify-center"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar credencial global
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-slate-900 hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Salvando...' : 'Salvar Alteracoes'}
      </button>
    </div>
  );
}
