import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Input, Button, LoadingState } from '@/components/admin/ui';
import type { Company } from '@/types';

export function SettingsModule() {
  const { company } = useAuth();
  const [form, setForm] = useState<Partial<Company>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data } = await supabase.from('companies').select('*').eq('id', company.id).maybeSingle();
      if (data) setForm(data as Company);
      setLoading(false);
    })();
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: err } = await supabase
      .from('companies')
      .update({
        name: form.name,
        cnpj: form.cnpj,
        responsible_name: form.responsible_name,
        responsible_phone: form.responsible_phone,
        responsible_email: form.responsible_email,
        brand_color: form.brand_color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id);

    if (err) {
      setError('Erro ao salvar dados da empresa');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader icon={Settings} title="Dados da Empresa" subtitle="Informações cadastrais e de contato" />

      <form onSubmit={handleSave} className="space-y-5">
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Identificação</h3>
          <Input label="Nome da Empresa" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="CNPJ" value={form.cnpj ?? ''} onChange={(v) => setForm({ ...form, cnpj: v })} placeholder="00.000.000/0001-00" />
            <Input label="Cor da Marca" value={form.brand_color ?? ''} onChange={(v) => setForm({ ...form, brand_color: v })} placeholder="#D4AF37" />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Responsável</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome do Responsável" value={form.responsible_name ?? ''} onChange={(v) => setForm({ ...form, responsible_name: v })} />
            <Input label="Telefone" value={form.responsible_phone ?? ''} onChange={(v) => setForm({ ...form, responsible_phone: v })} placeholder="(00) 00000-0000" />
          </div>
          <Input label="E-mail" type="email" value={form.responsible_email ?? ''} onChange={(v) => setForm({ ...form, responsible_email: v })} placeholder="contato@empresa.com" />
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-success-500">
            <CheckCircle2 className="h-4 w-4" /> Dados salvos com sucesso!
          </div>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </form>
    </div>
  );
}
