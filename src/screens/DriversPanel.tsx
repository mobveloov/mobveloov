import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Loader2, Phone, Car, Check, X, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatPhone, sanitizeText } from '@/lib/utils';
import type { Driver } from '@/types';

export function DriversPanel() {
  const { company } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDrivers = async () => {
    if (!company) return;
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setDrivers((data ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => {
    loadDrivers();
  }, [company]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setError(null);

    const cleanName = sanitizeText(name);
    if (cleanName.length < 3) {
      setError('Nome do motorista é obrigatório');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Telefone inválido');
      return;
    }

    setSaving(true);
    const { error: insErr } = await supabase
      .from('drivers')
      .insert({
        company_id: company.id,
        name: cleanName,
        phone: digits,
        vehicle_plate: plate || null,
        vehicle_model: model || null,
        is_available: true,
      });

    if (insErr) {
      setError('Erro ao cadastrar motorista');
      setSaving(false);
      return;
    }

    setName('');
    setPhone('');
    setPlate('');
    setModel('');
    setShowAdd(false);
    setSaving(false);
    loadDrivers();
  };

  const toggleAvailable = async (driver: Driver) => {
    await supabase
      .from('drivers')
      .update({ is_available: !driver.is_available, updated_at: new Date().toISOString() })
      .eq('id', driver.id);
    loadDrivers();
  };

  const handleDelete = async (driver: Driver) => {
    if (!confirm(`Excluir motorista "${driver.name}"?`)) return;
    await supabase.from('drivers').delete().eq('id', driver.id);
    loadDrivers();
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
            <Users className="h-5 w-5 text-gold-600 dark:text-gold-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Motoristas
            </h2>
            <p className="text-sm text-neutral-500">
              Frota local para dispatch manual
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <Plus className="h-4 w-4" />
          Novo motorista
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="card p-5 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">Nome</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" className="input-field" autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">Telefone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 99999-9999" className="input-field" inputMode="numeric" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">Placa</label>
              <input type="text" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC-1234" className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">Veículo</label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Honda Civic" className="input-field" />
            </div>
          </div>
          {error && <p className="text-xs text-error-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Cadastrar motorista'}
          </button>
        </form>
      )}

      {drivers.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Nenhum motorista cadastrado</p>
          <p className="text-xs text-neutral-400 mt-1">Cadastre motoristas para usar o dispatch manual</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map((driver) => (
            <div key={driver.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  driver.is_available ? 'bg-success-500/15' : 'bg-neutral-200 dark:bg-neutral-700'
                }`}>
                  <Car className={`h-5 w-5 ${driver.is_available ? 'text-success-600' : 'text-neutral-400'}`} />
                </div>
                <div>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{driver.name}</p>
                  <p className="text-xs text-neutral-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {driver.phone}
                  </p>
                  {driver.vehicle_model && (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {driver.vehicle_model} · {driver.vehicle_plate}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAvailable(driver)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                    driver.is_available
                      ? 'bg-success-500/15 text-success-600'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                  }`}
                >
                  {driver.is_available ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {driver.is_available ? 'Disponível' : 'Indisponível'}
                </button>
                <button
                  onClick={() => handleDelete(driver)}
                  className="text-error-500 hover:text-error-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
