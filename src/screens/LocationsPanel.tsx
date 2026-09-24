import { useState, useEffect, useRef } from 'react';
import { MapPin, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Save, Building2, ExternalLink, Copy, Smartphone, Lock, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { slugify } from '@/lib/utils';
import type { CompanyLocation } from '@/types';

interface AddressSearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

export function LocationsPanel() {
  const { company, session } = useAuth();
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [pickupResults, setPickupResults] = useState<AddressSearchResult[]>([]);
  const [pickupSearching, setPickupSearching] = useState(false);
  const pickupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLocations = async () => {
    if (!company) return;
    const { data } = await supabase
      .from('company_locations')
      .select('*')
      .eq('company_id', company.id)
      .is('bot_connection_id', null)
      .order('sort_order', { ascending: true });
    setLocations((data ?? []) as CompanyLocation[]);
    setLoading(false);
  };

  useEffect(() => {
    loadLocations();
  }, [company]);

  const resetForm = () => {
    setName('');
    setSlug('');
    setCity('');
    setState('');
    setLat('');
    setLng('');
    setPickupAddress('');
    setPickupLat('');
    setPickupLng('');
    setPickupResults([]);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setError(null);

    const finalSlug = slugify(slug || name);
    if (!finalSlug || !name) {
      setError('Preencha o nome do local');
      return;
    }

    // Check totem limit for new locations
    if (!editingId) {
      const { data: comp } = await supabase
        .from('companies')
        .select('plan_id')
        .eq('id', company.id)
        .maybeSingle();

      let totemLimit = 1;
      if (comp?.plan_id) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('totem_limit')
          .eq('id', comp.plan_id)
          .maybeSingle();
        if (plan) totemLimit = plan.totem_limit;
      }

      if (locations.length >= totemLimit) {
        setError(`Limite de Totens atingido para o plano atual (${totemLimit}). Faça o upgrade de seu plano para cadastrar novas telas.`);
        return;
      }
    }

    setSaving(true);

    const payload = {
      company_id: company.id,
      slug: finalSlug,
      name,
      city: city || null,
      state: state || null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      pickup_address: pickupAddress || null,
      pickup_lat: pickupLat ? parseFloat(pickupLat) : null,
      pickup_lng: pickupLng ? parseFloat(pickupLng) : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error: updErr } = await supabase
        .from('company_locations')
        .update(payload)
        .eq('id', editingId);
      if (updErr) {
        setError(updErr.code === '23505' ? 'Já existe um local com este slug' : 'Erro ao salvar local');
        setSaving(false);
        return;
      }
    } else {
      const { error: insErr } = await supabase
        .from('company_locations')
        .insert(payload);
      if (insErr) {
        setError(insErr.code === '23505' ? 'Já existe um local com este slug' : 'Erro ao criar local');
        setSaving(false);
        return;
      }
    }

    setSuccess(editingId ? 'Local atualizado!' : 'Local criado!');
    setSaving(false);
    resetForm();
    loadLocations();
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleEdit = (loc: CompanyLocation) => {
    setEditingId(loc.id);
    setName(loc.name);
    setSlug(loc.slug);
    setCity(loc.city ?? '');
    setState(loc.state ?? '');
    setLat(loc.lat?.toString() ?? '');
    setLng(loc.lng?.toString() ?? '');
    setPickupAddress(loc.pickup_address ?? '');
    setPickupLat(loc.pickup_lat?.toString() ?? '');
    setPickupLng(loc.pickup_lng?.toString() ?? '');
    setShowForm(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (loc: CompanyLocation) => {
    if (!confirm(`Excluir o local "${loc.name}"? As categorias vinculadas ficarão sem local.`)) return;
    await supabase.from('company_locations').delete().eq('id', loc.id);
    loadLocations();
  };

  const handleToggle = async (loc: CompanyLocation) => {
    await supabase
      .from('company_locations')
      .update({ is_active: !loc.is_active, updated_at: new Date().toISOString() })
      .eq('id', loc.id);
    loadLocations();
  };

  const searchPickupAddress = async (query: string) => {
    if (query.length < 3) {
      setPickupResults([]);
      return;
    }
    setPickupSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data: AddressSearchResult[] = await res.json();
      setPickupResults(data);
    } catch {
      setPickupResults([]);
    } finally {
      setPickupSearching(false);
    }
  };

  const handlePickupInput = (value: string) => {
    setPickupAddress(value);
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(() => searchPickupAddress(value), 500);
  };

  const selectPickupResult = (result: AddressSearchResult) => {
    const label = result.display_name.split(',').slice(0, 4).join(', ');
    setPickupAddress(label);
    setPickupLat(result.lat);
    setPickupLng(result.lon);
    setPickupResults([]);
  };

  const copyUrl = (loc: CompanyLocation) => {
    const url = `${window.location.origin}/${company?.slug}/${loc.slug}`;
    navigator.clipboard.writeText(url);
    setSuccess('Link copiado!');
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleClearDevice = async (loc: CompanyLocation) => {
    if (!confirm(`Limpar o dispositivo vinculado ao totem "${loc.name}"? Isso permite que um novo monitor seja pareado a este link.`)) return;
    const adminEmail = session?.user?.email ?? 'unknown';
    await supabase
      .from('company_locations')
      .update({ device_fingerprint: null, updated_at: new Date().toISOString() })
      .eq('id', loc.id);
    await supabase.from('admin_logs').insert({
      company_id: company?.id ?? null,
      source: 'device_binding',
      level: 'info',
      message: `Vínculo de dispositivo do totem "${loc.name}" limpo por ${adminEmail}`,
      admin_email: adminEmail,
      payload: { location_id: loc.id, location_slug: loc.slug, action: 'clear_binding' },
    });
    setSuccess('Dispositivo liberado! O totem pode ser pareado novamente.');
    setTimeout(() => setSuccess(null), 3000);
    loadLocations();
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  const labelCls = 'mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300';

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <MapPin className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Locais e Totems
          </h2>
          <p className="text-sm text-neutral-500">
            Cada local gera um link exclusivo para o totem
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            Novo local
          </button>
        )}
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 text-sm text-success-600 bg-success-500/10 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="card p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
              {editingId ? 'Editar local' : 'Novo local'}
            </h3>
            <button type="button" onClick={resetForm} className="text-xs text-neutral-400 hover:text-neutral-600">
              Cancelar
            </button>
          </div>

          <div>
            <label className={labelCls}>Nome do local</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingId) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Hospital, Leme, Jaboticabal..."
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Slug (URL do totem)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="hospital"
              className="input-field"
            />
            {company && slug && (
              <p className="mt-1.5 text-xs text-neutral-400">
                URL do totem: <span className="font-mono text-gold-600 dark:text-gold-400">
                {window.location.origin}/{company.slug}/{slug}
                </span>
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-4 space-y-3">
            <p className="text-xs font-bold text-gold-700 dark:text-gold-300">
              Localização (opcional)
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Busque a cidade para preencher automaticamente. Usado para o GPS do totem.
            </p>
            <CityAutocomplete
              value={{ city, state, lat, lng }}
              onChange={(loc) => {
                setCity(loc.city);
                setState(loc.state);
                setLat(loc.lat);
                setLng(loc.lng);
              }}
            />
          </div>

          <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-4 space-y-3">
            <p className="text-xs font-bold text-primary-700 dark:text-primary-300">
              Endereço de embarque fixo
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Defina o endereço exato onde este totem está instalado. O passageiro não precisará digitar a origem — apenas o destino.
            </p>
            <div className="relative">
              <Navigation className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-500" />
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => handlePickupInput(e.target.value)}
                placeholder="Ex: Rua das Flores, 123, Centro"
                className="input-field pl-12"
              />
              {pickupSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-400" />
              )}
            </div>
            {pickupResults.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-md">
                {pickupResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectPickupResult(r)}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                  >
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary-500" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
                      {r.display_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {pickupAddress && pickupLat && (
              <p className="flex items-center gap-1 text-xs text-success-600">
                <CheckCircle2 className="h-3 w-3" />
                Endereço definido: {pickupAddress}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar local'}
          </button>
        </form>
      )}

      {locations.length === 0 && !showForm ? (
        <div className="card p-8 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500 mb-2">Nenhum local cadastrado</p>
          <p className="text-xs text-neutral-400">
            Crie locais para gerar links exclusivos de totem em diferentes pontos da cidade
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    loc.is_active ? 'bg-gold-500/15' : 'bg-neutral-200 dark:bg-neutral-700'
                  }`}>
                    <Building2 className={`h-5 w-5 ${loc.is_active ? 'text-gold-600 dark:text-gold-400' : 'text-neutral-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{loc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-mono">/{company?.slug}/{loc.slug}</span>
                      {loc.city && <span>· {loc.city}/{loc.state}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    loc.is_active ? 'bg-success-500/15 text-success-600' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                  }`}>
                    {loc.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button
                    onClick={() => copyUrl(loc)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-gold-500/10 hover:text-gold-600 transition-colors"
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`/${company?.slug}/${loc.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-gold-500/10 hover:text-gold-600 transition-colors"
                    title="Abrir totem"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleEdit(loc)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    title="Editar"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(loc)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    title={loc.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {loc.is_active ? <MapPin className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(loc)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-error-500 hover:bg-error-500/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {loc.device_fingerprint && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-warning-500" />
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Dispositivo vinculado</span>
                    <span className="font-mono text-[10px] text-neutral-400">{loc.device_fingerprint.slice(0, 12)}…</span>
                  </div>
                  <button
                    onClick={() => handleClearDevice(loc)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-warning-600 hover:text-warning-700 transition-colors"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Limpar Dispositivo
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
