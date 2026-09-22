import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Save, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SearchBar, Pagination, EmptyState, LoadingState, StatusBadge,
  Modal, ConfirmModal, inputCls, labelCls, btnGold, btnGhost, useDebounce,
} from '../shared';
import type { ModuleProps } from '../Layout';
import type { InternalUser } from '@/types';

const ROLE_LABELS: Record<string, { text: string; cls: string }> = {
  admin: { text: 'ADMIN TOTAL', cls: 'bg-[#D4AF37]/10 text-[#D4AF37]' },
  support: { text: 'SUPORTE', cls: 'bg-blue-500/10 text-blue-400' },
  finance: { text: 'FINANCEIRO', cls: 'bg-emerald-500/10 text-emerald-400' },
};

const PAGE_SIZE = 10;

export function UsersModule({ success, error, logAction }: ModuleProps) {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<InternalUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InternalUser | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('internal_users').select('*').order('created_at', { ascending: false });
    setUsers((data ?? []) as InternalUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => !debouncedSearch || u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || u.email.toLowerCase().includes(debouncedSearch.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('internal_users').delete().eq('id', deleteTarget.id);
    if (err) { error('Erro ao excluir usuário'); return; }
    success('Usuário interno removido');
    await logAction('delete_internal_user', 'internal_user', deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar usuário..." />
        <button onClick={() => setShowCreate(true)} className={btnGold + ' ml-auto'}>
          <Plus className="h-4 w-4" /> Novo Usuário
        </button>
      </div>

      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState label="Carregando usuários..." />
        ) : paged.length === 0 ? (
          <EmptyState icon={<Shield className="h-10 w-10" />} message="Nenhum usuário interno encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-950/40">
                  <th className="p-4">Nome</th>
                  <th className="p-4">E-mail</th>
                  <th className="p-4">Papel</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paged.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 text-white font-bold">{u.name}</td>
                    <td className="p-4 text-slate-300 font-mono">{u.email}</td>
                    <td className="p-4"><StatusBadge status={u.role} labels={ROLE_LABELS} /></td>
                    <td className="p-4">
                      <StatusBadge status={u.is_active ? 'active' : 'inactive'} labels={{
                        active: { text: 'ATIVO', cls: 'bg-emerald-500/10 text-emerald-400' },
                        inactive: { text: 'INATIVO', cls: 'bg-slate-500/10 text-slate-400' },
                      }} />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setEditUser(u)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors">Editar</button>
                        <button onClick={() => setDeleteTarget(u)} className="text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded-lg transition-colors"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {(showCreate || editUser) && (
        <UserFormModal
          user={editUser ?? undefined}
          onClose={() => { setShowCreate(false); setEditUser(null); }}
          onSaved={(name) => { success(editUser ? 'Usuário atualizado!' : `Usuário "${name}" criado!`); setShowCreate(false); setEditUser(null); load(); }}
          onError={error}
          onLog={logAction}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Remover Usuário"
        message={`Remover "${deleteTarget?.name}" do acesso interno?`}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

function UserFormModal({ user, onClose, onSaved, onError, onLog }: {
  user?: InternalUser;
  onClose: () => void;
  onSaved: (name: string) => void;
  onError: (msg: string) => void;
  onLog: (action: string, type?: string, id?: string, name?: string) => Promise<void>;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState(user?.role ?? 'support');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) { onError('Preencha nome e e-mail'); return; }
    setSaving(true);
    const payload = { name, email, role, is_active: isActive, updated_at: new Date().toISOString() };
    if (user) {
      const { error: err } = await supabase.from('internal_users').update(payload).eq('id', user.id);
      if (err) { onError('Erro ao atualizar'); setSaving(false); return; }
      await onLog('update_internal_user', 'internal_user', user.id, name);
    } else {
      const { data: authUser } = await supabase.auth.admin.createUser({ email, password: 'TempPass123!', email_confirm: true });
      if (authUser?.user) {
        const { error: err } = await supabase.from('internal_users').insert({ ...payload, user_id: authUser.user.id });
        if (err) { onError('Erro ao criar usuário interno'); setSaving(false); return; }
        await onLog('create_internal_user', 'internal_user', undefined, name);
      } else {
        onError('Erro ao criar usuário de auth');
        setSaving(false);
        return;
      }
    }
    onSaved(name);
  };

  return (
    <Modal open onClose={onClose} title={user ? 'Editar Usuário Interno' : 'Novo Usuário Interno'} maxWidth="480px">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelCls}>Nome</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} />
        </div>
        <div>
          <label className={labelCls}>Papel</label>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'support' | 'finance')}>
            <option value="admin">Admin Total (acesso a tudo)</option>
            <option value="support">Suporte (empresas, totens, corridas)</option>
            <option value="finance">Financeiro (faturamento, relatórios)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#D4AF37]" />
          <span className="text-xs text-slate-300">Usuário ativo</span>
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
