import { useState, useEffect, useMemo } from 'react';
import {
  Building2, Hotel, Hospital, Plane, Car, ArrowRight, Check, Loader2,
  AlertCircle, Monitor, Smartphone, Zap, Shield, Clock, MapPin, Users,
  ChevronRight, ChevronLeft, Crown, LogIn, Sparkles, MonitorSmartphone
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNav } from '@/context/NavContext';
import { slugify, formatCpfCnpj, isCpfCnpj, docLabel } from '@/lib/utils';
import type { SubscriptionPlan } from '@/types';

const TOTEM_TIERS = [
  { id: 'bronze', label: 'Bronze', totems: 1, tier: 'A', basePrice: 99, icon: '🥉' },
  { id: 'prata', label: 'Prata', totems: 3, tier: 'B', basePrice: 267, icon: '🥈' },
  { id: 'ouro', label: 'Ouro', totems: 5, tier: 'C', basePrice: 435, icon: '🥇' },
  { id: 'black', label: 'Black', totems: 10, tier: 'C+', basePrice: 690, icon: '👑' },
] as const;

const BILLING_CYCLES = [
  { id: 'monthly', label: 'Mensal', months: 1, discount: 0, suffix: '/mês' },
  { id: 'quarterly', label: 'Trimestral', months: 3, discount: 0.05, suffix: '/trimestre' },
  { id: 'semiannual', label: 'Semestral', months: 6, discount: 0.10, suffix: '/semestre' },
  { id: 'annual', label: 'Anual', months: 12, discount: 0.20, suffix: '/ano' },
] as const;

type TotemTierId = typeof TOTEM_TIERS[number]['id'];
type BillingCycleId = typeof BILLING_CYCLES[number]['id'];

export function LandingPage() {
  const { navigate } = useNav();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPlans((data ?? []) as SubscriptionPlan[]);
    })();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-gold-500/15 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-black/80 px-6 py-16 sm:px-12 sm:py-24">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 10 L70 40 L65 40 L65 70 L35 70 L35 40 L30 40 Z' fill='%23D4AF37'/%3E%3C/svg%3E")`,
          backgroundSize: '120px',
        }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-300">Plataforma SaaS Multi-Empresa</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            Totens e PWAs automatizados para{' '}
            <span className="bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent">
              hotéis, hospitais e grandes fluxos
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Conectamos seu estabelecimento ao seu provedor de mobilidade em minutos.
            Totens auto-atendidos, dispatch inteligente e painel administrativo completo.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => {
                setShowForm(true);
                document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-primary flex items-center gap-2 text-base"
            >
              Cadastrar Minha Empresa
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('tenant_login')}
              className="flex items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-800/50 px-6 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:border-gold-500/40 hover:text-gold-300"
            >
              <LogIn className="h-4 w-4" />
              Acessar Painel
            </button>
          </div>
        </div>
      </section>

      {/* Value Proposition Cards */}
      <section className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[
          { icon: Hotel, title: 'Hotéis & Resorts', desc: 'Totems no lobby para hóspedes solicitarem transporte direto do quarto ou recepção.' },
          { icon: Hospital, title: 'Hospitais & Clínicas', desc: 'PWAs auto-atendidas para pacientes e visitantes aguardarem o motorista com conforto.' },
          { icon: Plane, title: 'Aeroportos & Terminais', desc: 'Fluxo de alta demanda com dispatch automático e integração à sua central de mobilidade.' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="glass-card rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-gold-500/30 hover:shadow-xl hover:shadow-gold-500/5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15">
                <Icon className="h-6 w-6 text-gold-400" />
              </div>
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.desc}</p>
            </div>
          );
        })}
      </section>

      {/* Features Grid */}
      <section className="mt-12">
        <h2 className="mb-6 text-center text-2xl font-bold text-white">Tudo que sua central precisa</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Monitor, title: 'Totens Auto-atendidos', desc: 'Kiosques com lock de hardware anti-fraude' },
            { icon: Car, title: 'Dispatch Inteligente', desc: 'Machine API, webhook ou manual' },
            { icon: Smartphone, title: 'PWA Instalável', desc: 'Funciona offline e instala no celular' },
            { icon: Zap, title: 'WhatsApp Automático', desc: 'Notificações de status em tempo real' },
            { icon: Shield, title: 'Anti-Fraude', desc: 'Fingerprint de dispositivo por totem' },
            { icon: Clock, title: 'Tempo Real', desc: 'Acompanhamento ao vivo da corrida' },
            { icon: MapPin, title: 'Multi-Local', desc: 'Vários totens, várias cidades' },
            { icon: Users, title: 'Multi-Empresa', desc: 'White-label completo por tenant' },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4 transition-all hover:border-gold-500/20">
                <Icon className="mb-2 h-5 w-5 text-gold-400" />
                <p className="text-sm font-bold text-white">{f.title}</p>
                <p className="mt-1 text-xs leading-4 text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Registration Form */}
      <section id="cadastro" className="mt-16 scroll-mt-20">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-300">Cadastro B2B</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white">Cadastrar Minha Empresa</h2>
          <p className="mt-2 text-sm text-slate-400">Três passos para ativar sua central de mobilidade</p>
        </div>

        {showForm ? (
          <RegistrationForm plans={plans} />
        ) : (
          <div className="glass-card mx-auto max-w-2xl rounded-2xl border border-slate-700/50 bg-slate-900/60 p-10 text-center backdrop-blur-md">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-gold-400/60" />
            <p className="text-lg font-semibold text-white">Pronto para começar?</p>
            <p className="mt-2 text-sm text-slate-400">
              Cadastre sua empresa, escolha seu plano e gere o boleto de pagamento automaticamente.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-6 inline-flex items-center gap-2"
            >
              Iniciar Cadastro
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </section>

      {/* Footer Links */}
      <section className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm">
        <button onClick={() => navigate('terms')} className="text-slate-400 hover:text-gold-300 transition-colors">
          Termos de Uso
        </button>
        <button onClick={() => navigate('privacy')} className="text-slate-400 hover:text-gold-300 transition-colors">
          Política de Privacidade
        </button>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">Veloov Negócios e Serviços LTDA · CNPJ 68.559.312/0001-73</span>
      </section>
    </div>
  );
}

function RegistrationForm({ plans }: { plans: SubscriptionPlan[] }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ checkout_url: string | null; slug: string; asaas_error: string | null; status?: string } | null>(null);

  // Step 1 fields
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 fields
  const [slug, setSlug] = useState('');
  const [slugChecked, setSlugChecked] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);

  // Step 3 fields
  const [selectedTier, setSelectedTier] = useState<TotemTierId | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleId>('monthly');
  const [customDiscount] = useState(0); // SuperAdmin can set per-company; 0 at registration
  const [hasMobilityService, setHasMobilityService] = useState(false);

  // Dynamic price calculation
  const { fullPrice, finalPrice, tierData, cycleData } = useMemo(() => {
    const tier = TOTEM_TIERS.find(t => t.id === selectedTier);
    const cycle = BILLING_CYCLES.find(c => c.id === selectedCycle)!;
    if (!tier) return { fullPrice: 0, finalPrice: 0, tierData: null, cycleData: cycle };

    const gross = tier.basePrice * cycle.months;
    const periodDiscount = gross * cycle.discount;
    const customDiscountAmount = (gross - periodDiscount) * (customDiscount / 100);
    const final = gross - periodDiscount - customDiscountAmount;

    return { fullPrice: gross, finalPrice: final, tierData: tier, cycleData: cycle };
  }, [selectedTier, selectedCycle, customDiscount]);

  const canSubmit = selectedTier !== null;

  const formatPhoneInput = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const checkSlug = async () => {
    if (!slug || slug.length < 3) return;
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    setSlugAvailable(!data);
    setSlugChecked(true);
  };

  useEffect(() => {
    if (slug) {
      const t = setTimeout(() => checkSlug(), 500);
      return () => clearTimeout(t);
    }
  }, [slug]);

  const canProceedStep1 = companyName.length >= 2 && isCpfCnpj(cnpj) &&
    responsibleName.length >= 2 && phone.replace(/\D/g, '').length >= 10 && email.includes('@');
  const canProceedStep2 = slug.length >= 3 && slugAvailable;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedTier) return;
    setSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const tier = TOTEM_TIERS.find(t => t.id === selectedTier)!;
      const cycle = BILLING_CYCLES.find(c => c.id === selectedCycle)!;

      const response = await fetch(`${supabaseUrl}/functions/v1/register-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          company_name: companyName,
          cnpj: cnpj.replace(/\D/g, ''),
          responsible_name: responsibleName,
          responsible_phone: phone.replace(/\D/g, ''),
          responsible_email: email,
          slug,
          totem_tier: selectedTier,
          totem_limit: tier.totems,
          message_tier: tier.tier,
          billing_cycle: selectedCycle,
          billing_months: cycle.months,
          billing_discount: cycle.discount,
          final_price: finalPrice,
          has_mobility_service: hasMobilityService,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Erro ao cadastrar empresa');
        setSubmitting(false);
        return;
      }

      setResult({
        checkout_url: data.checkout_url,
        slug: data.slug,
        asaas_error: data.asaas_error,
        status: data.status,
      });
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de conexão');
      setSubmitting(false);
    }
  };

  // Success screen
  if (result) {
    return (
      <div className="glass-card mx-auto max-w-xl rounded-2xl border border-gold-500/30 bg-slate-900/70 p-8 text-center backdrop-blur-md">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-success-500/15">
          <Check className="h-8 w-8 text-success-500" />
        </div>
        <h3 className="text-2xl font-extrabold text-white">Empresa Cadastrada!</h3>
        <p className="mt-3 text-sm text-slate-300">
          Sua empresa <strong className="text-gold-300">{companyName}</strong> foi registrada com sucesso.
          Seu painel estará disponível em{' '}
          <span className="font-mono text-gold-400">/{slug}/admin</span>
        </p>

        {result.checkout_url ? (
          <div className="mt-6">
            <p className="mb-4 text-sm text-slate-400">
              Clique no botão abaixo para concluir o pagamento da sua assinatura via Asaas.
            </p>
            <a
              href={result.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Crown className="h-5 w-5" />
              Ir para Pagamento
            </a>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="text-sm font-semibold text-amber-300">
              Cadastro recebido! Aguardando confirmação de pagamento.
            </p>
            <p className="mt-2 text-sm text-amber-200/80">
              Sua empresa foi registrada com status <strong>Pendente de Pagamento</strong>.
              Nossa equipe entrará em contato pelo e-mail <strong className="text-amber-100">{email}</strong> e telefone informados
              para confirmar sua assinatura e ativar o acesso ao painel.
            </p>
          </div>
        )}

        <a
          href={`/${slug}/admin`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-400 hover:text-gold-300"
        >
          Acessar meu painel administrativo
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-200';
  const inputCls = 'w-full rounded-xl border border-slate-600/50 bg-slate-800/60 px-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all';

  return (
    <div className="glass-card mx-auto max-w-2xl rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-md sm:p-8">
      {/* Step Indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
              s === step ? 'bg-gold-500 text-neutral-900' :
              s < step ? 'bg-success-500/20 text-success-500' :
              'bg-slate-700/50 text-slate-500'
            }`}>
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className={`h-1 w-12 rounded-full ${s < step ? 'bg-success-500/40' : 'bg-slate-700/50'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Corporate Details */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-bold text-white">Dados da Empresa</h3>

          <div>
            <label className={labelCls}>Nome da Empresa</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Taxi Express Ltda"
              className={inputCls}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>{cnpj.replace(/\D/g, '').length <= 11 ? 'CPF' : 'CNPJ'}</label>
            <input
              type="text"
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
              className={inputCls}
            />
            {docError && <p className="mt-1 text-xs text-red-400">{docError}</p>}
            {!docError && cnpj && isCpfCnpj(cnpj) && (
              <p className="mt-1 text-xs text-emerald-400">{docLabel(cnpj)} válido</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Responsável Legal</label>
            <input
              type="text"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Nome completo do responsável"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Telefone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(00) 00000-0000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="responsavel@empresa.com"
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Continuar
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Step 2: Slug / Subdomain */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-bold text-white">Escolha seu Subdomínio</h3>
          <p className="text-sm text-slate-400">
            Este será o endereço de acesso ao seu painel e totens.
          </p>

          <div>
            <label className={labelCls}>Subdomínio (slug)</label>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-600/50 bg-slate-800/60 focus-within:ring-2 focus-within:ring-gold-500">
              <span className="flex items-center pl-4 text-sm text-slate-500">veloov.com/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugChecked(false);
                }}
                placeholder="sua-empresa"
                className="flex-1 bg-transparent px-2 py-3.5 text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            {slug.length >= 3 && slugChecked && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                {slugAvailable ? (
                  <>
                    <Check className="h-4 w-4 text-success-500" />
                    <span className="text-success-500">Disponível!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-error-500" />
                    <span className="text-error-500">Este subdomínio já está em uso</span>
                  </>
                )}
              </div>
            )}
            {slug.length >= 3 && !slugChecked && (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Verificando disponibilidade...
              </p>
            )}
            {slug.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg bg-slate-800/40 p-3 text-xs text-slate-400">
                <p>Painel admin: <span className="font-mono text-gold-400">/{slug}/admin</span></p>
                <p>Totem: <span className="font-mono text-gold-400">/{slug}/local</span></p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-600/50 bg-slate-800/50 px-5 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              Continuar
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Totem Tier + Billing Cycle Selection */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in">
          <h3 className="text-lg font-bold text-white">Escolha seu Plano</h3>
          <p className="text-sm text-slate-400">
            Selecione o volume de totens e o ciclo de cobrança independentemente.
          </p>

          {/* Layer 1: Totem Volume Tiers */}
          <div>
            <p className="mb-2.5 text-sm font-semibold text-gold-300">1. Volume de Totens</p>
            <div className="grid grid-cols-2 gap-3">
              {TOTEM_TIERS.map((tier) => {
                const isSelected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id as TotemTierId)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500/10 ring-2 ring-gold-500/30'
                        : 'border-slate-700/50 bg-slate-800/40 hover:border-gold-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-white">{tier.label}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {tier.totems === 1 ? '1 totem' : `${tier.totems} totens`}
                        </p>
                        <p className="mt-0.5 text-xs text-gold-400/70">WhatsApp Tier {tier.tier}</p>
                      </div>
                      {isSelected && <Check className="h-5 w-5 text-gold-400" />}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      R$ {tier.basePrice.toFixed(2).replace('.', ',')}<span className="text-xs font-normal text-slate-500">/mês base</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layer 2: Billing Cycle */}
          <div>
            <p className="mb-2.5 text-sm font-semibold text-gold-300">2. Ciclo de Cobrança</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BILLING_CYCLES.map((cycle) => {
                const isSelected = selectedCycle === cycle.id;
                return (
                  <button
                    key={cycle.id}
                    onClick={() => setSelectedCycle(cycle.id as BillingCycleId)}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500/10 ring-2 ring-gold-500/30'
                        : 'border-slate-700/50 bg-slate-800/40 hover:border-gold-500/30'
                    }`}
                  >
                    <p className="text-sm font-bold text-white">{cycle.label}</p>
                    {cycle.discount > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-success-400">
                        {Math.round(cycle.discount * 100)}% OFF
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Preço base</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional: Urban Mobility Service */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 transition-all hover:border-gold-500/30">
            <input
              type="checkbox"
              checked={hasMobilityService}
              onChange={(e) => setHasMobilityService(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-600 text-gold-500 focus:ring-gold-500"
            />
            <div>
              <p className="text-sm font-semibold text-white">Serviço de Mobilidade Urbana (Opcional)</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Marque se sua empresa presta serviço de mobilidade urbana. A nota fiscal será emitida com o serviço municipal correto em vez do serviço padrão.
              </p>
            </div>
          </label>

          {/* Dynamic Price Display */}
          {selectedTier && tierData && (
            <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 to-transparent p-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                    {tierData.label} · {cycleData.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {tierData.totems === 1 ? '1 totem' : `${tierData.totems} totens`} · {cycleData.months} {cycleData.months === 1 ? 'mês' : 'meses'}
                  </p>
                </div>
                <div className="text-right">
                  {cycleData.discount > 0 && (
                    <p className="text-sm text-slate-500 line-through">
                      R$ {fullPrice.toFixed(2).replace('.', ',')}
                    </p>
                  )}
                  <p className="text-3xl font-extrabold text-gold-400">
                    R$ {finalPrice.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
              {cycleData.discount > 0 && (
                <p className="mt-2 text-xs text-success-400">
                  Você economiza R$ {(fullPrice - finalPrice).toFixed(2).replace('.', ',')} com o ciclo {cycleData.label.toLowerCase()}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-error-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-600/50 bg-slate-800/50 px-5 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  Finalizar Cadastro
                  <Check className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
