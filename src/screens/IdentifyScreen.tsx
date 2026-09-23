import { useState } from 'react';
import { User, Phone, ArrowRight, Building2, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { formatPhone, isValidPhone, sanitizeText } from '@/lib/utils';

interface PassengerInfo {
  name: string;
  phone: string;
}

interface IdentifyScreenProps {
  onIdentify: (info: PassengerInfo) => void;
}

export function IdentifyScreen({ onIdentify }: IdentifyScreenProps) {
  const { goPassenger, tenantSlug } = useNav();
  const { company, location, loading, error, deviceLocked, licenseExpired } = useTenant();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = sanitizeText(name);
    if (cleanName.length < 3) {
      setFormError('Digite seu nome completo');
      return;
    }
    if (!isValidPhone(phone)) {
      setFormError('Digite um telefone válido com DDD');
      return;
    }

    onIdentify({ name: cleanName, phone });
    goPassenger('destination');
  };

  // No slug in URL — show landing with link to admin
  if (!tenantSlug) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-black/40 p-2 ring-1 ring-gold-400/30 shadow-[0_0_40px_rgba(212,175,55,0.16)]">
            <img src="/veloovrotas.png" alt="Veloov Rotas" className="h-full w-full object-contain" />
          </div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-gold-300/80">Mobilidade sob demanda</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Veloov Rotas
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Plataforma SaaS de dispatch urbano multi-empresa
          </p>
        </div>
        <div className="glass-card rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8 text-center shadow-2xl backdrop-blur-md">
          <p className="text-sm text-slate-300">
            Acesse o link da sua empresa para solicitar uma viagem.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            URL formato: <span className="font-mono text-gold-400">/empresa/local</span>
          </p>
        </div>
      </div>
    );
  }

  // Loading company data from URL slug
  if (loading) {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
        <p className="text-sm text-slate-400">Carregando empresa...</p>
      </div>
    );
  }

  // Company not found or inactive
  if (error || !company) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Empresa não encontrada
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {error ?? 'Verifique o link e tente novamente'}
          </p>
        </div>
      </div>
    );
  }

  // Device fingerprint hard-lock — frozen screen
  if (deviceLocked) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Acesso Negado
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Este link de Totem já está ativo em outro dispositivo físico. Para transferir este Totem de local, o Administrador deve liberar o dispositivo no Painel de Controle clicando em 'Limpar Dispositivo'.
          </p>
        </div>
      </div>
    );
  }

  // License expired — freeze screen with suspension overlay
  if (licenseExpired) {
    return (
      <div className="animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Serviço Temporariamente Suspenso
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Este Totem foi bloqueado devido ao vencimento da assinatura da empresa operadora.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Para regularizar, entre em contato com a administração.
          </p>
        </div>
      </div>
    );
  }

  // Company loaded — show passenger name/phone form directly
  return (
    <div className="animate-slide-up">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-black/40 p-2 ring-1 ring-gold-400/30 shadow-[0_0_40px_rgba(212,175,55,0.16)]">
          <img src="/veloovrotas.png" alt="Veloov Rotas" className="h-full w-full object-contain" />
        </div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-gold-300/80">Mobilidade sob demanda</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Solicitar viagem
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {company.name}
        </p>
        {location && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gold-300">
            <MapPin className="h-3 w-3" />
            {location.name}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="glass-card space-y-5 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-200">
            Nome completo
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Seu nome"
              className="input-field pl-12"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-200">
            Telefone
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                if (formError) setFormError(null);
              }}
              placeholder="(11) 99999-9999"
              className="input-field pl-12"
              inputMode="numeric"
            />
          </div>
        </div>

        {formError && <p className="text-xs font-medium text-error-500">{formError}</p>}

        <button type="submit" className="btn-primary w-full text-base flex items-center justify-center gap-2">
          {location?.pickup_address ? 'Avancar' : 'Escolher destino'}
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
