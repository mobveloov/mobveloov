import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, Shield, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Input, Select, Button, Badge, EmptyState, LoadingState } from '@/components/admin/ui';

interface CompanyUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

export function UsersModule() {
  const { company } = useAuth();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('operador');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!company) return;
    const { data } = await supabase
      .from('company_admins')
      .select('id, user_id, role, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setUsers((data ?? []) as CompanyUser[]);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, [company]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !newEmail) return;
    setAdding(true);
    setError(null);

    const { data: authUser } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle();

    if (!authUser) {
      setError('Usuário não encontrado. Peça para a pessoa se cadastrar primeiro no painel.');
      setAdding(false);
      return;
    }

    const { error: err } = await supabase
      .from('company_admins')
      .insert({ company_id: company.id, user_id: authUser.id, role: newRole });

    if (err) {
      setError(err.message);
    } else {
      setNewEmail('');
      setShowAdd(false);
      loadUsers();
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    await supabase.from('company_admins').delete().eq('id', id);
    loadUsers();
  };

  const roleLabel = (r: string) => {
    const map: Record<string, string> = { admin: 'Administrador', operador: 'Operador', financeiro: 'Financeiro' };
    return map[r] ?? r;
  };

  const roleBadge = (r: string): 'gold' | 'default' | 'success' => {
    if (r === 'admin') return 'gold';
    if (r === 'financeiro') return 'success';
    return 'default';
  };

  if (loading) return <LoadingState />;

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader
        icon={UserCog}
        title="Usuários & Permissões"
        subtitle="Gerencie quem tem acesso ao painel"
        action={<Button onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4" /> Novo Usuário</Button>}
      />

      {showAdd && (
        <Card className="p-5">
          <form onSubmit={handleAdd} className="space-y-4">
            <Input label="E-mail do usuário" value={newEmail} onChange={setNewEmail} type="email" placeholder="usuario@empresa.com" required />
            <Select label="Papel" value={newRole} onChange={setNewRole} options={[
              { value: 'admin', label: 'Administrador — acesso total' },
              { value: 'operador', label: 'Operador — dispatch e corridas' },
              { value: 'financeiro', label: 'Financeiro — relatórios e faturamento' },
            ]} />
            {error && <p className="text-sm text-error-400">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Conceder Acesso
              </Button>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {users.length === 0 ? (
        <Card><EmptyState icon={UserCog} message="Nenhum usuário cadastrado além de você." /></Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{u.email ?? u.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">Adicionado em {new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={roleBadge(u.role)}>{roleLabel(u.role)}</Badge>
                <button onClick={() => handleRemove(u.id)} className="text-slate-600 hover:text-error-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
