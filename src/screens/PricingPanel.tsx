import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Save, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Car, RefreshCw, Link2, Info, MapPin, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { fetchMachineCategories, type MachineCategory } from '@/lib/machineApi';
import type { VehicleCategory, CompanyLocation } from '@/types';

const DEFAULT_CATEGORIES = [
  { label: 'Econômico', description: 'Veículo compacto, melhor preço', base_fee: 5.00, per_km_rate: 2.50, per_min_rate: 0.50, min_fee: 8.00, eta_minutes: 5, sort_order: 0 },
  { label: 'Conforto', description: 'Veículo espaçoso, mais conforto', base_fee: 7.00, per_km_rate: 3.50, per_min_rate: 0.70, min_fee: 12.00, eta_minutes: 7, sort_order: 1 },
  { label: 'Executivo', description: 'Veículo premium, alto padrão', base_fee: 10.00, per_km_rate: 5.00, per_min_rate: 1.00, min_fee: 20.00, eta_minutes: 10, sort_order: 2 },
];

interface CategoryFormData {
  id?: string;
  label: string;
  description: string;
  base_fee: string;
  per_km_rate: string;
  per_min_rate: string;
  min_fee: string;
  eta_minutes: string;
  sort_order: string;
  is_active: boolean;
  machine_category_id: string;
  machine_category_name: string;
}

function catToForm(c: VehicleCategory): CategoryFormData {
  return {
    id: c.id,
    label: c.label,
    description: c.description,
    base_fee: c.base_fee.toString(),
    per_km_rate: c.per_km_rate.toString(),
    per_min_rate: c.per_min_rate.toString(),
    min_fee: c.min_fee.toString(),
    eta_minutes: c.eta_minutes.toString(),
    sort_order: c.sort_order.toString(),
    is_active: c.is_active,
    machine_category_id: c.machine_category_id ?? '',
    machine_category_name: c.machine_category_name ?? '',
  };
}

export function PricingPanel() {
  const { company } = useAuth();
  const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [forms, setForms] = useState<CategoryFormData[]>([]);
  const [surge, setSurge] = useState('1.00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machineCats, setMachineCats] = useState<MachineCategory[]>([]);
  const [loadingMachineCats, setLoadingMachineCats] = useState(false);
  const [integrationMode, setIntegrationMode] = useState<string>('manual');
  const [catCity, setCatCity] = useState('');
  const [catState, setCatState] = useState('');
  const [catLat, setCatLat] = useState('');
  const [catLng, setCatLng] = useState('');
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load company locations first
  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data: locs } = await supabase
        .from('company_locations')
        .select('*')
        .eq('company_id', company.id)
        .order('sort_order', { ascending: true });
      const locList = (locs ?? []) as CompanyLocation[];
      setCompanyLocations(locList);

      if (locList.length > 0) {
        setSelectedLocationId(locList[0].id);
      } else {
        setLoading(false);
      }

      const { data: sett } = await supabase
        .from('company_settings')
        .select('surge_multiplier, integration_mode')
        .eq('company_id', company.id)
        .maybeSingle();

      if (sett) {
        setSurge((sett as { surge_multiplier: number }).surge_multiplier.toString());
        setIntegrationMode((sett as { integration_mode: string }).integration_mode ?? 'manual');
      }

      const { data: cred } = await supabase
        .from('company_credentials')
        .select('city, state, lat, lng')
        .eq('company_id', company.id)
        .maybeSingle();

      if (cred) {
        setCatCity(cred.city ?? '');
        setCatState(cred.state ?? '');
        setCatLat(cred.lat?.toString() ?? '');
        setCatLng(cred.lng?.toString() ?? '');
      }
      setLocationLoaded(true);
    })();
  }, [company?.id]);

  // Load categories for the selected location only
  const loadCategories = useCallback(async (locationId: string) => {
    setLoading(true);
    const { data: cats } = await supabase
      .from('vehicle_categories')
      .select('*')
      .eq('company_id', company!.id)
      .eq('location_id', locationId)
      .order('sort_order', { ascending: true });

    const catList = (cats ?? []) as VehicleCategory[];
    setCategories(catList);

    if (catList.length > 0) {
      setForms(catList.map(catToForm));
    } else {
      setForms(DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        base_fee: c.base_fee.toString(),
        per_km_rate: c.per_km_rate.toString(),
        per_min_rate: c.per_min_rate.toString(),
        min_fee: c.min_fee.toString(),
        eta_minutes: c.eta_minutes.toString(),
        sort_order: c.sort_order.toString(),
        is_active: true,
        machine_category_id: '',
        machine_category_name: '',
      })));
    }
    setLoading(false);
  }, [company]);

  useEffect(() => {
    if (selectedLocationId) {
      loadCategories(selectedLocationId);
    }
  }, [selectedLocationId, loadCategories]);

  const updateForm = (idx: number, field: keyof CategoryFormData, value: string | boolean) => {
    setForms((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const handleMachineCatChange = (idx: number, catId: string) => {
    const machineCategory = machineCats.find((category) => category.id === catId);
    if (!machineCategory) return;

    setForms((prev) => prev.map((form, i) => {
      if (i !== idx) return form;
      return {
        ...form,
        label: machineCategory.nome || form.label,
        description: machineCategory.descricao ?? form.description,
        machine_category_id: machineCategory.id,
        machine_category_name: machineCategory.nome,
      };
    }));
  };

  const loadMachineCategories = async () => {
    if (!company) return;
    setLoadingMachineCats(true);
    setError(null);
    const result = await fetchMachineCategories(company.slug);
    if (result.success && result.data) {
      setMachineCats(result.data);
      const hasUnlinked = forms.length === 0 || forms.every((f) => !f.machine_category_id);
      if (hasUnlinked) {
        setForms(result.data.map((machineCategory, index) => ({
          label: machineCategory.nome,
          description: machineCategory.descricao ?? '',
          base_fee: '0',
          per_km_rate: '0',
          per_min_rate: '0',
          min_fee: '0',
          eta_minutes: '0',
          sort_order: index.toString(),
          is_active: true,
          machine_category_id: machineCategory.id,
          machine_category_name: machineCategory.nome,
        })));
      } else {
        setForms((prev) => prev.map((form) => {
          if (!form.machine_category_id) return form;
          const mc = result.data!.find((c) => c.id === form.machine_category_id);
          if (!mc) return form;
          return {
            ...form,
            label: mc.nome || form.label,
            description: mc.descricao ?? form.description,
            machine_category_name: mc.nome,
          };
        }));
      }
    } else {
      setError(result.error ?? 'Não foi possível carregar as categorias da Machine API. Verifique se a localização da empresa está configurada no painel de integração.');
    }
    setLoadingMachineCats(false);
  };

  const addCategory = () => {
    setForms((prev) => [...prev, {
      label: 'Nova categoria',
      description: '',
      base_fee: '5.00',
      per_km_rate: '2.50',
      per_min_rate: '0.50',
      min_fee: '8.00',
      eta_minutes: '5',
      sort_order: prev.length.toString(),
      is_active: true,
      machine_category_id: '',
      machine_category_name: '',
    }]);
  };

  const removeCategory = (idx: number) => {
    setForms((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !selectedLocationId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    if (forms.length === 0) {
      setError('Adicione pelo menos uma categoria');
      setSaving(false);
      return;
    }

    // Only touch categories for THIS location — never others
    const currentIds = new Set(categories.map((c) => c.id));
    const formIds = new Set(forms.filter((f) => f.id).map((f) => f.id));
    const toDelete = [...currentIds].filter((id) => !formIds.has(id));

    for (const id of toDelete) {
      await supabase.from('vehicle_categories').delete().eq('id', id);
    }

    for (const form of forms) {
      const payload = {
        company_id: company.id,
        location_id: selectedLocationId,
        label: form.label,
        description: form.description,
        base_fee: parseFloat(form.base_fee) || 0,
        per_km_rate: parseFloat(form.per_km_rate) || 0,
        per_min_rate: parseFloat(form.per_min_rate) || 0,
        min_fee: parseFloat(form.min_fee) || 0,
        eta_minutes: parseInt(form.eta_minutes) || 5,
        sort_order: parseInt(form.sort_order) || 0,
        is_active: form.is_active,
        machine_category_id: form.machine_category_id || null,
        machine_category_name: form.machine_category_name || null,
        updated_at: new Date().toISOString(),
      };

      if (form.id) {
        const { error: updErr } = await supabase
          .from('vehicle_categories')
          .update(payload)
          .eq('id', form.id);
        if (updErr) {
          setError(`Erro ao atualizar categoria "${form.label}"`);
          setSaving(false);
          return;
        }
      } else {
        const { error: insErr } = await supabase
          .from('vehicle_categories')
          .insert(payload);
        if (insErr) {
          setError(`Erro ao criar categoria "${form.label}"`);
          setSaving(false);
          return;
        }
      }
    }

    await supabase
      .from('company_settings')
      .upsert({
        company_id: company.id,
        surge_multiplier: parseFloat(surge) || 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' });

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);

    // Reload categories for this location only
    await loadCategories(selectedLocationId);
  };

  const handleCopyToAll = async () => {
    if (!company || !selectedLocationId) return;
    const targetLocations = companyLocations.filter((l) => l.id !== selectedLocationId);
    if (targetLocations.length === 0) return;

    setCopying(true);
    setError(null);
    setCopied(false);

    try {
      for (const loc of targetLocations) {
        // Delete existing categories in target location
        await supabase
          .from('vehicle_categories')
          .delete()
          .eq('company_id', company.id)
          .eq('location_id', loc.id);

        // Insert copies of current forms
        const inserts = forms.map((form) => ({
          company_id: company.id,
          location_id: loc.id,
          label: form.label,
          description: form.description,
          base_fee: parseFloat(form.base_fee) || 0,
          per_km_rate: parseFloat(form.per_km_rate) || 0,
          per_min_rate: parseFloat(form.per_min_rate) || 0,
          min_fee: parseFloat(form.min_fee) || 0,
          eta_minutes: parseInt(form.eta_minutes) || 5,
          sort_order: parseInt(form.sort_order) || 0,
          is_active: form.is_active,
          machine_category_id: form.machine_category_id || null,
          machine_category_name: form.machine_category_name || null,
        }));

        if (inserts.length > 0) {
          const { error: insErr } = await supabase
            .from('vehicle_categories')
            .insert(inserts);
          if (insErr) {
            setError(`Erro ao copiar para "${loc.name}": ${insErr.message}`);
            setCopying(false);
            return;
          }
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao copiar categorias';
      setError(msg);
    } finally {
      setCopying(false);
    }
  };

  if (loading && companyLocations.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  if (companyLocations.length === 0) {
    return (
      <div className="animate-slide-up">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
            <DollarSign className="h-5 w-5 text-gold-600 dark:text-gold-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Tabela de preços</h2>
            <p className="text-sm text-neutral-500">Defina preços por categoria de veículo</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Nenhum totem cadastrado</p>
          <p className="text-xs text-neutral-500 mt-1">Crie pelo menos um totem na aba "Totens & Locais" para configurar preços.</p>
        </div>
      </div>
    );
  }

  const labelCls = 'mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400';
  const isMachineMode = integrationMode === 'machine';
  const selectedLocation = companyLocations.find((l) => l.id === selectedLocationId);

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <DollarSign className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Tabela de preços</h2>
          <p className="text-sm text-neutral-500">Defina preços independentes por totem e categoria</p>
        </div>
      </div>

      {/* Totem selector — mandatory, no "all" option */}
      <div className="card p-4 mb-4">
        <label className="mb-2 block text-sm font-bold text-neutral-700 dark:text-neutral-300">
          Editando categorias do totem:
        </label>
        <div className="flex flex-wrap gap-2">
          {companyLocations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setSelectedLocationId(loc.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                selectedLocationId === loc.id
                  ? 'bg-gold-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-gold-500/10'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              {loc.name}
            </button>
          ))}
        </div>
        {selectedLocation && (
          <p className="mt-2 text-xs text-neutral-500">
            As alterações abaixo afetam apenas o totem <strong className="text-neutral-700 dark:text-neutral-300">{selectedLocation.name}</strong>. Os outros totens não são modificados.
          </p>
        )}
      </div>

      {isMachineMode && (
        <div className="card p-4 mb-4 border-gold-500/30 bg-gold-500/5">
          <div className="flex items-start gap-3">
            <Link2 className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                Vincular categorias à Machine API
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-3">
                As categorias vinculadas à Machine usam o preço calculado em tempo real pela central para cada corrida. A tarifa é configurada no painel da Machine — não aqui.
              </p>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <MapPin className="h-4 w-4 text-gold-500" />
                  {catCity ? (
                    <span>{catCity} - {catState} <span className="text-neutral-400">({catLat}, {catLng})</span></span>
                  ) : (
                    <span className="text-neutral-400">Localização não configurada</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadMachineCategories}
                  disabled={loadingMachineCats || !catCity}
                  className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  {loadingMachineCats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {loadingMachineCats ? 'Carregando...' : 'Carregar categorias'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {locationLoaded && !catCity
                  ? 'Configure a localização da empresa no painel de Integração para habilitar a busca automática.'
                  : 'A localização é carregada automaticamente do painel de integração.'}
              </p>
              {machineCats.length > 0 && (
                <>
                  <p className="mt-2 text-xs text-success-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {machineCats.length} categorias carregadas da Machine API.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {machineCats.map((mc) => (
                      <span key={mc.id} className="badge-gold text-[10px] flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {mc.id} — {mc.nome}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <label className={labelCls}>Multiplicador de demanda (surge)</label>
              <input
                type="number"
                step="0.01"
                value={surge}
                onChange={(e) => setSurge(e.target.value)}
                className="input-field w-32"
              />
            </div>
            <p className="text-xs text-neutral-400 max-w-[180px] text-right">
              Aplicado sobre todas as categorias. 1.0 = preço normal.
            </p>
          </div>

          {forms.map((form, idx) => (
            <div key={idx} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-gold-500" />
                  <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                    Categoria {idx + 1}
                  </span>
                  {form.machine_category_id && (
                    <span className="badge-gold text-[10px] flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      Machine ID: {form.machine_category_id}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeCategory(idx)}
                  className="text-error-500 hover:text-error-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nome</label>
                  <input type="text" value={form.label} onChange={(e) => updateForm(idx, 'label', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className={labelCls}>Descrição</label>
                  <input type="text" value={form.description} onChange={(e) => updateForm(idx, 'description', e.target.value)} className="input-field" />
                </div>

                {isMachineMode && (
                  <div className="col-span-2">
                    <label className={labelCls}>Categoria na Machine API</label>
                    {machineCats.length > 0 ? (
                      <>
                        <select
                          value={form.machine_category_id}
                          onChange={(e) => handleMachineCatChange(idx, e.target.value)}
                          className="input-field"
                        >
                          <option value="">— Sem vinculação (usa preço local) —</option>
                          {machineCats.map((mc) => (
                            <option key={mc.id} value={mc.id}>
                              {mc.id} — {mc.nome}
                            </option>
                          ))}
                        </select>
                        {form.machine_category_id && (
                          <p className="mt-1.5 text-[11px] text-success-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Categoria vinculada. O preço será calculado pela Machine em tempo real.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <Info className="h-3 w-3" />
                        Clique em "Carregar categorias da Machine API" acima para vincular
                      </div>
                    )}
                  </div>
                )}

                {form.machine_category_id ? (
                  <div className="col-span-2">
                    <div className="rounded-lg bg-gold-500/5 border border-gold-500/20 p-3 text-xs text-neutral-600 dark:text-neutral-400">
                      <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Preço gerenciado pela Machine API</p>
                      <p>A tarifa desta categoria é configurada no painel da Machine. O preço final é calculado em tempo real para cada corrida.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Taxa base (R$)</label>
                      <input type="number" step="0.01" value={form.base_fee} onChange={(e) => updateForm(idx, 'base_fee', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className={labelCls}>Por km (R$)</label>
                      <input type="number" step="0.01" value={form.per_km_rate} onChange={(e) => updateForm(idx, 'per_km_rate', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className={labelCls}>Por min (R$)</label>
                      <input type="number" step="0.01" value={form.per_min_rate} onChange={(e) => updateForm(idx, 'per_min_rate', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className={labelCls}>Corrida mínima (R$)</label>
                      <input type="number" step="0.01" value={form.min_fee} onChange={(e) => updateForm(idx, 'min_fee', e.target.value)} className="input-field" />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>Tempo espera (min)</label>
                  <input type="number" value={form.eta_minutes} onChange={(e) => updateForm(idx, 'eta_minutes', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className={labelCls}>Ordem</label>
                  <input type="number" value={form.sort_order} onChange={(e) => updateForm(idx, 'sort_order', e.target.value)} className="input-field" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm(idx, 'is_active', e.target.checked)}
                  className="h-4 w-4 rounded accent-gold-500"
                />
                Categoria ativa (visível para passageiros)
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={addCategory}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Adicionar categoria a {selectedLocation?.name ?? 'totem'}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-success-600">
              <CheckCircle2 className="h-4 w-4" />
              Preços de {selectedLocation?.name} salvos com sucesso!
            </div>
          )}
          {copied && (
            <div className="flex items-center gap-2 text-sm text-success-600">
              <CheckCircle2 className="h-4 w-4" />
              Categorias copiadas para todos os outros totens!
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {saving ? 'Salvando...' : `Salvar categorias de ${selectedLocation?.name ?? 'totem'}`}
            </button>

            {companyLocations.length > 1 && (
              <button
                type="button"
                onClick={handleCopyToAll}
                disabled={copying || saving}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                {copying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                {copying ? 'Copiando...' : 'Copiar para todos os totens'}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
