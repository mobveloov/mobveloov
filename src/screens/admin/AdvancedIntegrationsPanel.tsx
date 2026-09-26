import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, Loader2, CheckCircle2, AlertCircle, ChevronDown,
  ChevronUp, Power, KeyRound, Zap, X, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { INTEGRATION_CATALOG, type IntegrationCategory, type ProviderDef } from '@/lib/integrationCatalog';

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
  id?: string;
  category: IntegrationCategory;
  provider: string;
  label: string;
  credentials: Record<string, string>;
  priority: number;
  is_active: boolean;
}

export function AdvancedIntegrationsPanel() {
  const { company } = useAuth();
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<IntegrationCategory | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftCredential[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddFor, setShowAddFor] = useState<IntegrationCategory | null>(null);
  const [newProv, setNewProv] = useState<ProviderDef | null>(null);
  const [newCreds, setNewCreds] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('integration_credentials_safe')
      .select('*')
      .eq('tenant_id', company.id)
      .order('category')
      .order('priority');

    if (err) {
      setError('Erro ao carregar integracoes');
    } else if (data) {
      setRows(data as CredentialRow[]);
      const draftMap: Record<string, DraftCredential[]> = {};
      for (const r of data as CredentialRow[]) {
        const key = r.category;
        if (!draftMap[key]) draftMap[key] = [];
        draftMap[key].push({
          id: r.id,
          category: r.category as IntegrationCategory,
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
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      for (const cat of Object.keys(drafts)) {
        for (const draft of drafts[cat]) {
          if (draft.id) {
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
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erro ao salvar integracoes');
    }
    setSaving(false);
  };

  const handleDelete = async (cat: string, id: string) => {
    if (!company) return;
    await supabase.from('integration_credentials').delete().eq('id', id);
    load();
  };

  const handleAddNew = async () => {
    if (!company || !showAddFor || !newProv) return;
    setSaving(true);
    setError(null);

    const existingForCat = drafts[showAddFor] ?? [];
    const nextPriority = existingForCat.length;

    const { error: insErr } = await supabase
      .from('integration_credentials')
      .insert({
        tenant_id: company.id,
        category: showAddFor,
        provider: newProv.value,
        label: newLabel || `${newProv.label} ${existingForCat.length + 1}`,
        credentials: newCreds,
        priority: nextPriority,
        is_active: true,
      });

    if (insErr) {
      setError('Erro ao adicionar credencial: ' + insErr.message);
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
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-5">
      <div className="mb-2 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15">
          <Zap className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Integracoes</h2>
          <p className="text-sm text-neutral-500">
            Configure todas as APIs que sua empresa utiliza. Adicione multiplas credenciais por provedor — se uma falhar, o sistema usa a proxima automaticamente.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Fallback automatico:</strong> Quando uma chave de API atinge limite ou falha, o sistema tenta a proxima credencial ativa da mesma categoria, na ordem de prioridade. Nada trava.
          <br /><br />
          <strong>Outras integracoes:</strong> Transcricao de audio, WhatsApp e Dispatch tem configuracao dedicada nas abas "WhatsApp", "Bot de Corridas" e "Integracao".
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-error-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-success-500">
          <CheckCircle2 className="h-4 w-4" /> Integracoes salvas com sucesso!
        </div>
      )}

      <div className="space-y-3">
        {INTEGRATION_CATALOG.map((cat) => {
          const Icon = cat.icon;
          const catDrafts = drafts[cat.value] ?? [];
          const isOpen = expandedCat === cat.value;
          return (
            <div key={cat.value} className="card overflow-hidden">
              <button
                onClick={() => setExpandedCat(isOpen ? null : cat.value)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700">
                  <Icon className="h-4.5 w-4.5 text-neutral-600 dark:text-neutral-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-neutral-900 dark:text-neutral-100">{cat.label}</p>
                  <p className="text-xs text-neutral-500 truncate">{cat.description}</p>
                </div>
                {catDrafts.length > 0 && (
                  <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-bold text-gold-700 dark:text-gold-300">
                    {catDrafts.filter((d) => d.is_active).length} ativa{catDrafts.filter((d) => d.is_active).length !== 1 ? 's' : ''}
                  </span>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
                  {catDrafts.length === 0 && !showAddFor && (
                    <p className="text-xs text-neutral-400 py-2">Nenhuma integracao configurada para esta categoria.</p>
                  )}

                  {catDrafts.map((d, idx) => {
                    const provDef = cat.providers.find((p) => p.value === d.provider);
                    if (!provDef) return null;
                    return (
                      <div key={idx} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5 text-neutral-400" />
                          <input
                            type="text"
                            value={d.label}
                            onChange={(e) => updateDraft(cat.value, idx, 'label', e.target.value)}
                            className="flex-1 bg-transparent text-sm font-semibold text-neutral-900 dark:text-neutral-100 outline-none border-b border-transparent focus:border-gold-500"
                            placeholder="Nome da credencial"
                          />
                          <button
                            onClick={() => updateDraft(cat.value, idx, 'is_active', !d.is_active)}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                              d.is_active
                                ? 'bg-success-500/15 text-success-600 dark:text-success-400'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                            }`}
                          >
                            <Power className="h-3 w-3" />
                            {d.is_active ? 'Ativa' : 'Inativa'}
                          </button>
                          <button
                            onClick={() => handleDelete(cat.value, d.id!)}
                            className="rounded-md p-1 text-neutral-400 hover:text-error-500 hover:bg-error-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400">{provDef.label} — {provDef.description}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {provDef.fields.map((f) => (
                            <div key={f.key}>
                              <label className="mb-1 block text-[10px] font-semibold text-neutral-500">{f.label}</label>
                              <input
                                type={f.type}
                                value={d.credentials[f.key] ?? ''}
                                onChange={(e) => updateDraftCred(cat.value, idx, f.key, e.target.value)}
                                placeholder={f.placeholder ?? ''}
                                className="input-field text-xs py-1.5"
                              />
                            </div>
                          ))}
                        </div>
                        {d.last_error_at && (
                          <p className="text-[10px] text-error-500">
                            Ultimo erro: {d.last_error_message ?? 'Erro desconhecido'}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {showAddFor === cat.value && newProv && (
                    <div className="rounded-lg border-2 border-dashed border-gold-500/30 p-3 space-y-3 bg-gold-500/5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gold-700 dark:text-gold-300">Nova credencial: {newProv.label}</p>
                        <button onClick={() => { setShowAddFor(null); setNewProv(null); setNewCreds({}); setNewLabel(''); }} className="text-neutral-400 hover:text-neutral-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-neutral-500">Nome (opcional)</label>
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder={`${newProv.label} ${catDrafts.length + 1}`}
                          className="input-field text-xs py-1.5"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {newProv.fields.map((f) => (
                          <div key={f.key}>
                            <label className="mb-1 block text-[10px] font-semibold text-neutral-500">{f.label}</label>
                            <input
                              type={f.type}
                              value={newCreds[f.key] ?? ''}
                              onChange={(e) => setNewCreds({ ...newCreds, [f.key]: e.target.value })}
                              placeholder={f.placeholder ?? ''}
                              className="input-field text-xs py-1.5"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleAddNew}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-neutral-900 hover:bg-gold-400 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Adicionar
                      </button>
                    </div>
                  )}

                  {showAddFor === cat.value && !newProv && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-neutral-500">Escolha um provedor:</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {cat.providers.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => { setNewProv(p); setNewCreds({}); setNewLabel(''); }}
                            className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 text-left transition-all hover:border-gold-500/40 hover:bg-gold-500/5"
                          >
                            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{p.label}</p>
                            <p className="text-[10px] text-neutral-500">{p.description}</p>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowAddFor(null)} className="text-xs text-neutral-400 hover:text-neutral-600">
                        Cancelar
                      </button>
                    </div>
                  )}

                  {showAddFor !== cat.value && (
                    <button
                      onClick={() => { setShowAddFor(cat.value); setNewProv(null); }}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 px-3 py-2 text-xs font-semibold text-neutral-500 hover:border-gold-500/40 hover:text-gold-600 dark:hover:text-gold-400 transition-all w-full justify-center"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar credencial
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
        className="flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold text-neutral-900 hover:bg-gold-400 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Salvando...' : 'Salvar Alteracoes'}
      </button>
    </div>
  );
}
