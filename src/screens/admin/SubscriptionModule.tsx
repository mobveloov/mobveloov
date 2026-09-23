import { useEffect, useState } from 'react';
import { Crown, CreditCard, Check, Clock, AlertCircle, Download, Loader2, Calendar, TrendingUp, Diamond, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, Button, LoadingState, StatCard } from '@/components/admin/ui';
import type { SubscriptionPlan, Invoice, Company } from '@/types';

export function SubscriptionModule() {
  const { company } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [totemCount, setTotemCount] = useState(0);
  const [rideCount, setRideCount] = useState(0);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const [{ data: plansData }, { data: compData }, { count: totems }, { count: rides }, { data: invoicesData }] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('companies').select('*').eq('id', company.id).maybeSingle(),
        supabase.from('company_locations').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('rides').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('invoices').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(20),
      ]);

      setPlans((plansData ?? []) as SubscriptionPlan[]);
      setCompanyData(compData as Company | null);
      setTotemCount(totems ?? 0);
      setRideCount(rides ?? 0);
      setInvoices((invoicesData ?? []) as Invoice[]);

      if (compData?.plan_id) {
        const plan = (plansData ?? []).find((p) => p.id === compData.plan_id);
        if (plan) setCurrentPlan(plan as SubscriptionPlan);
      }
      setLoading(false);
    })();
  }, [company]);

  if (loading) return <LoadingState />;

  const planStatus = companyData?.status ?? 'active';
  const expiresAt = companyData?.expires_at;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const isTrial = planStatus === 'trial';

  const statusBadge = (): 'success' | 'warning' | 'error' | 'gold' => {
    if (isExpired) return 'error';
    if (isTrial) return 'gold';
    if (planStatus === 'pending_pagamento') return 'warning';
    return 'success';
  };

  const statusLabel = () => {
    if (isExpired) return 'Expirado';
    if (isTrial) return 'Período de Teste';
    if (planStatus === 'pending_pagamento') return 'Pagamento Pendente';
    if (planStatus === 'active') return 'Ativo';
    return 'Ativo';
  };

  const getPriceForCycle = (plan: SubscriptionPlan) => {
    const base = plan.base_monthly_price || plan.price || 0;
    if (billingCycle === 'annual' && plan.annual_price > 0) return plan.annual_price;
    if (billingCycle === 'semiannual' && plan.semiannual_price > 0) return plan.semiannual_price;
    if (billingCycle === 'quarterly' && plan.quarterly_price > 0) return plan.quarterly_price;
    return base;
  };

  const cycleLabel = billingCycle === 'annual' ? '/ano' : billingCycle === 'semiannual' ? '/semestre' : billingCycle === 'quarterly' ? '/trimestre' : '/mês';

  const handleCheckout = (plan: SubscriptionPlan) => {
    if (companyData?.asaas_checkout_url) {
      window.open(companyData.asaas_checkout_url, '_blank', 'noopener,noreferrer');
    }
  };

  const isUnlimited = (plan: SubscriptionPlan) => plan.totem_limit >= 999999;

  const planFeatures = (plan: SubscriptionPlan): string[] => {
    const features = [
      isUnlimited(plan) ? 'Totens ilimitados' : `${plan.totem_limit} ${plan.totem_limit === 1 ? 'totem' : 'totens'}`,
      'Motoristas ilimitados',
      'Corridas ilimitadas',
    ];
    if (plan.sort_order >= 2) features.push('Integração via API e Webhook');
    if (plan.sort_order >= 3) features.push('Relatórios avançados', 'Multi-filial');
    if (plan.sort_order >= 4) features.push('Suporte prioritário', 'Gerente de conta dedicado');
    if (plan.sort_order >= 5) features.push('Onboarding/implantação assistida', 'SLA de suporte garantido (resposta em até 1h)');
    return features;
  };

  const invoiceStatusBadge = (status: string): 'success' | 'warning' | 'error' => {
    if (status === 'paid') return 'success';
    if (status === 'pending') return 'warning';
    return 'error';
  };

  const invoiceStatusLabel = (status: string) => {
    if (status === 'paid') return 'Paga';
    if (status === 'pending') return 'Pendente';
    if (status === 'overdue') return 'Vencida';
    return status;
  };

  return (
    <div className="animate-slide-up space-y-6">
      <PageHeader icon={Crown} title="Assinatura" subtitle="Gerencie seu plano e pagamentos" />

      {/* Current plan status card */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 bg-gradient-to-r from-gold-500/10 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-500/15 ring-1 ring-gold-500/30">
                <Crown className="h-7 w-7 text-gold-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-100">{currentPlan?.name ?? 'Nenhum plano'}</h3>
                  <Badge variant={statusBadge()}>{statusLabel()}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {currentPlan ? `R$ ${getPriceForCycle(currentPlan).toFixed(2).replace('.', ',')} ${cycleLabel}` : '—'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {companyData?.asaas_checkout_url && (
                <Button onClick={() => window.open(companyData.asaas_checkout_url, '_blank', 'noopener,noreferrer')}>
                  <CreditCard className="h-4 w-4" /> Gerenciar Pagamento
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500">Próxima cobrança</span>
            </div>
            <p className="text-sm font-semibold text-slate-200">
              {expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500">Totens usados</span>
            </div>
            <p className="text-sm font-semibold text-slate-200">
              {totemCount}
              {currentPlan && isUnlimited(currentPlan)
                ? <span className="ml-1.5 text-xs text-gold-400">· Ilimitado</span>
                : <> de {currentPlan?.totem_limit ?? '—'}</>
              }
              {currentPlan && !isUnlimited(currentPlan) && totemCount > currentPlan.totem_limit && (
                <span className="ml-2 text-xs text-error-400">excedeu</span>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500">Corridas totais</span>
            </div>
            <p className="text-sm font-semibold text-slate-200">{rideCount}</p>
          </div>
        </div>

        {isExpired && (
          <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl border border-error-500/30 bg-error-500/10 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-error-400" />
            <div>
              <p className="text-sm font-semibold text-error-300">Assinatura vencida</p>
              <p className="text-xs text-slate-400">Seus totens estão bloqueados. Regularize o pagamento para restaurar o acesso.</p>
            </div>
          </div>
        )}

        {isTrial && (
          <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-4">
            <Clock className="h-5 w-5 shrink-0 text-gold-400" />
            <div>
              <p className="text-sm font-semibold text-gold-300">Período de teste</p>
              <p className="text-xs text-slate-400">
                {expiresAt
                  ? `Expira em ${Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)} dias. Escolha um plano para continuar.`
                  : 'Escolha um plano para continuar usando a plataforma.'}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Billing cycle toggle */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {([
          ['monthly', 'Mensal', null],
          ['quarterly', 'Trimestral', '3 meses'],
          ['semiannual', 'Semestral', '6 meses'],
          ['annual', 'Anual', 'Economize'],
        ] as const).map(([cycle, label, badge]) => (
          <button
            key={cycle}
            onClick={() => setBillingCycle(cycle)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${billingCycle === cycle ? 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/25' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {label}
            {badge && <span className="ml-2 rounded-full bg-success-500/15 px-2 py-0.5 text-xs text-success-500">{badge}</span>}
          </button>
        ))}
      </div>

      {/* Plans comparison */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          const price = getPriceForCycle(plan);
          const isDiamante = isUnlimited(plan);
          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col p-5 ${
                isCurrent ? 'ring-2 ring-gold-500/40' : ''
              } ${
                isDiamante ? 'border-gold-500/40 bg-gradient-to-b from-gold-500/10 to-transparent' : ''
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-neutral-900">Seu plano</span>
                </div>
              )}
              {isDiamante && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1 text-xs font-bold text-neutral-900">
                    <Sparkles className="h-3 w-3" />
                    Premium
                  </span>
                </div>
              )}
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  {isDiamante && <Diamond className="h-4 w-4 text-gold-400" />}
                  <h4 className="text-base font-extrabold text-slate-100">{plan.name}</h4>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-slate-100">
                  R$ {price.toFixed(2).replace('.', ',')}
                  <span className="text-sm font-normal text-slate-500">{cycleLabel}</span>
                </p>
              </div>
              <ul className="mb-5 flex-1 space-y-2">
                {planFeatures(plan).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                    <Check className="h-4 w-4 shrink-0 text-success-500" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button variant="secondary" disabled className="w-full">Plano atual</Button>
              ) : (
                <Button onClick={() => handleCheckout(plan)} className="w-full">
                  Assinar {billingCycle === 'monthly' ? 'mensal' : billingCycle === 'quarterly' ? 'trimestral' : billingCycle === 'semiannual' ? 'semestral' : 'anual'}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Payment method */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">Forma de Pagamento</h3>
          {companyData?.asaas_checkout_url && (
            <Button variant="secondary" onClick={() => window.open(companyData.asaas_checkout_url, '_blank', 'noopener,noreferrer')}>
              <CreditCard className="h-4 w-4" /> Alterar
            </Button>
          )}
        </div>
        {companyData?.asaas_customer_id ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/30 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/15">
                <CreditCard className="h-5 w-5 text-success-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">Pagamento via Asaas</p>
                <p className="text-xs text-slate-500">Cartão de crédito ou Pix</p>
              </div>
              <Badge variant="success">Ativo</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/20 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15">
                  <CreditCard className="h-4 w-4 text-gold-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Cartão de crédito</p>
                  <p className="text-[11px] text-slate-500">Cobrança automática mensal</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/20 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15">
                  <CreditCard className="h-4 w-4 text-gold-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Pix</p>
                  <p className="text-[11px] text-slate-500">Pagamento instantâneo</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/20 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
              <CreditCard className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400">Nenhuma forma de pagamento cadastrada</p>
              <p className="text-xs text-slate-600">Selecione um plano acima para iniciar o pagamento</p>
            </div>
          </div>
        )}
      </Card>

      {/* Invoice history */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-200">Histórico de Faturas</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-600">Nenhuma fatura encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Período</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      {inv.period_start && inv.period_end
                        ? `${new Date(inv.period_start).toLocaleDateString('pt-BR')} - ${new Date(inv.period_end).toLocaleDateString('pt-BR')}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-200">
                      R$ {(inv.amount || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-4 py-3"><Badge variant={invoiceStatusBadge(inv.status)}>{invoiceStatusLabel(inv.status)}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{inv.payment_method ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Fiscal data */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-bold text-slate-200">Dados Fiscais</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Razão Social</p>
            <p className="text-sm font-semibold text-slate-200">{companyData?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">CNPJ</p>
            <p className="text-sm font-semibold text-slate-200">{companyData?.cnpj ?? '—'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Os dados fiscais são editados na seção "Dados da Empresa". Para emitir notas fiscais, garanta que o CNPJ esteja correto.
        </p>
      </Card>
    </div>
  );
}
