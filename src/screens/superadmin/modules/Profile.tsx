import { useState, useEffect } from 'react';
import { User, Save, Loader2, Lock, Shield, Camera, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { convertToWebP } from '@/lib/imageUtils';
import { formatCpfCnpj, isCpfCnpj, docLabel } from '@/lib/utils';
import {
  inputCls, labelCls, btnGold,
} from '../shared';
import type { InternalUser } from '@/types';

export function ProfileModule({ success, error }: { success: (m: string) => void; error: (m: string) => void }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<InternalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState(false);

  // password change
  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // email change confirmation
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('internal_users')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        setProfile(data as InternalUser);
        setName(data.name ?? '');
        setPhone(data.phone ?? '');
        setCompanyName(data.company_name ?? '');
        setCnpj(data.cnpj ?? '');
      setDocError(null);
        setEmail(data.email ?? session.user.email ?? '');
        setAvatarUrl(data.avatar_url);
        setTwoFactor(data.two_factor_enabled ?? false);
      }
      setLoading(false);
    })();
  }, [session]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user?.id) return;
    if (file.size > 5 * 1024 * 1024) { error('Imagem muito grande (máx 5MB)'); return; }

    setSaving(true);
    try {
      const webpFile = await convertToWebP(file);
      const path = `${session.user.id}/avatar.webp`;
      const { error: upErr } = await supabase.storage.from('superadmin-avatars').upload(path, webpFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('superadmin-avatars').getPublicUrl(path);
      setAvatarUrl(`${urlData.publicUrl}?t=${Date.now()}`);
      success('Foto carregada! Clique em Salvar para confirmar.');
    } catch {
      error('Erro ao enviar imagem');
    }
    setSaving(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { error('Preencha o nome'); return; }
    if (!session?.user?.id) return;
    const docDigits = cnpj.replace(/\D/g, '');
    if (docDigits && !isCpfCnpj(cnpj)) { error(`${docLabel(cnpj)} inválido. Verifique os dígitos.`); return; }

    setSaving(true);
    const updates: Record<string, unknown> = {
      user_id: session.user.id,
      name,
      email: email || session.user.email || '',
      phone,
      company_name: companyName,
      cnpj: cnpj.replace(/\D/g, ''),
      avatar_url: avatarUrl ? avatarUrl.split('?')[0] : null,
      two_factor_enabled: twoFactor,
    };

    // email change requires Supabase Auth update
    if (emailChanged && email !== (profile?.email ?? session.user.email)) {
      const { error: authErr } = await supabase.auth.updateUser({ email });
      if (authErr) {
        error('Erro ao alterar e-mail: ' + authErr.message);
        setSaving(false);
        return;
      }
      success('E-mail alterado! Um link de confirmação foi enviado ao novo endereço.');
    }

    // upsert handles both existing row (update by user_id) and missing row (insert)
    const { data: upserted, error: dbErr } = await supabase
      .from('internal_users')
      .upsert(updates, { onConflict: 'user_id' })
      .select()
      .single();
    if (dbErr) {
      error('Erro ao salvar perfil');
      setSaving(false);
      return;
    }

    setProfile(upserted as InternalUser);
    success('Perfil atualizado com sucesso!');
    setEmailChanged(false);
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) { error('Preencha todos os campos de senha'); return; }
    if (newPw.length < 6) { error('A nova senha deve ter no mínimo 6 caracteres'); return; }
    if (newPw !== confirmPw) { error('As senhas não conferem'); return; }

    setPwLoading(true);
    try {
      // reauthenticate with current password before updating
      const { data: { user }, error: sessErr } = await supabase.auth.getUser();
      if (sessErr || !user?.email) throw new Error('Sessão inválida');
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (reauthErr) {
        error('Senha atual incorreta');
        setPwLoading(false);
        return;
      }

      const { error: authErr } = await supabase.auth.updateUser({ password: newPw });
      if (authErr) {
        error('Erro ao alterar senha: ' + authErr.message);
        setPwLoading(false);
        return;
      }
      success('Senha alterada com sucesso!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowPw(false);
    } catch {
      error('Erro ao alterar senha');
    }
    setPwLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
        <p className="text-xs text-slate-500">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar + Basic Info */}
      <form onSubmit={handleSave} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-[#D4AF37]" />
          <h3 className="text-sm font-black text-white">Dados do Perfil</h3>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37]/30 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-[#D4AF37]">
                  {(name || 'SA').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-[#D4AF37] text-slate-950 p-1.5 rounded-full cursor-pointer hover:bg-[#b8962e] transition-colors">
              <Camera className="h-3.5 w-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
          <div>
            <p className="text-xs text-slate-400">Foto do perfil</p>
            <p className="text-[10px] text-slate-500 mt-0.5">JPG, PNG ou GIF. Máx 5MB. Convertido para WebP.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome Completo</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailChanged(true); }}
            />
            {emailChanged && email !== profile?.email && (
              <p className="mt-1 text-[10px] text-amber-400">Será enviado um link de confirmação ao salvar</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className={labelCls}>Razão Social (Veloov)</label>
            <input className={inputCls} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Veloov Negocios e Servicos LTDA" />
          </div>
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
          {!docError && cnpj && isCpfCnpj(cnpj) && (
            <p className="mt-1 text-[10px] text-emerald-400">{docLabel(cnpj)} válido</p>
          )}
        </div>

        {/* 2FA toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs font-bold text-white">Autenticação em Duas Etapas (2FA)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Adiciona uma camada extra de segurança ao login</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTwoFactor(!twoFactor)}
            className={`relative w-11 h-6 rounded-full transition-colors ${twoFactor ? 'bg-[#D4AF37]' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${twoFactor ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={btnGold}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </button>
        </div>
      </form>

      {/* Password Change */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-4 w-4 text-[#D4AF37]" />
          <h3 className="text-sm font-black text-white">Trocar Senha</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelCls}>Senha Atual</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className={inputCls + ' pr-10'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Digite sua senha atual"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nova Senha</label>
              <input
                type={showPw ? 'text' : 'password'}
                className={inputCls}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className={labelCls}>Confirmar Nova Senha</label>
              <input
                type={showPw ? 'text' : 'password'}
                className={inputCls}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <KeyRound className="h-3 w-3" />
            A senha é atualizada na autenticação do sistema (Supabase Auth).
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={pwLoading} className={btnGold}>
              {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Alterar Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
