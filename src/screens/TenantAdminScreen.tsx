import { useEffect, useState } from 'react';
import { AlertCircle, CreditCard, Clock, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNav } from '@/context/NavContext';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DashboardModule } from '@/screens/admin/DashboardModule';
import { SettingsModule } from '@/screens/admin/SettingsModule';
import { UsersModule } from '@/screens/admin/UsersModule';
import { NotificationsModule } from '@/screens/admin/NotificationsModule';
import { AuditModule } from '@/screens/admin/AuditModule';
import { ReportsModule } from '@/screens/admin/ReportsModule';
import { FinanceModule } from '@/screens/admin/FinanceModule';
import { SubscriptionModule } from '@/screens/admin/SubscriptionModule';
import { IntegrationPanel } from '@/screens/IntegrationPanel';
import { PricingPanel } from '@/screens/PricingPanel';
import { RideLogsPanel } from '@/screens/RideLogsPanel';
import { WhatsAppPanel } from '@/screens/WhatsAppPanel';
import { DriversPanel } from '@/screens/DriversPanel';
import { DispatchBoard } from '@/screens/DispatchBoard';
import { LocationsPanel } from '@/screens/LocationsPanel';

export function TenantAdminScreen() {
  const { company, signOut } = useAuth();
  const { adminScreen, navigate } = useNav();
  const [integrationMode, setIntegrationMode] = useState<string>('manual');

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data: sett } = await supabase
        .from('company_settings')
        .select('integration_mode')
        .eq('company_id', company.id)
        .maybeSingle();
      if (sett) setIntegrationMode((sett as { integration_mode: string }).integration_mode ?? 'manual');
    })();
  }, [company]);

  if (!company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhuma empresa associada a esta conta</p>
          <button onClick={() => signOut()} className="mt-4 text-sm text-gold-400">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const isLicenseExpired = company.expires_at ? new Date(company.expires_at) < new Date() : false;

  if (isLicenseExpired) {
    return <BillingLockoutScreen companyName={company.name} expiresAt={company.expires_at} checkoutUrl={company.asaas_checkout_url} onSignOut={() => { signOut(); navigate('tenant_login'); }} />;
  }

  const modeLabel = integrationMode === 'machine' ? 'Machine API' : integrationMode === 'webhook' ? 'Webhook' : 'Manual';

  return (
    <AdminLayout modeLabel={modeLabel}>
      {adminScreen === 'dashboard' && <DashboardModule />}
      {adminScreen === 'locations' && <LocationsPanel />}
      {adminScreen === 'integration' && <IntegrationPanel />}
      {adminScreen === 'pricing' && <PricingPanel />}
      {adminScreen === 'dispatch' && <DispatchBoard />}
      {adminScreen === 'drivers' && <DriversPanel />}
      {adminScreen === 'rides' && <RideLogsPanel />}
      {adminScreen === 'whatsapp' && <WhatsAppPanel />}
      {adminScreen === 'settings' && <SettingsModule />}
      {adminScreen === 'users' && <UsersModule />}
      {adminScreen === 'notifications' && <NotificationsModule />}
      {adminScreen === 'audit' && <AuditModule />}
      {adminScreen === 'reports' && <ReportsModule />}
      {adminScreen === 'finance' && <FinanceModule />}
      {adminScreen === 'subscription' && <SubscriptionModule />}
      {adminScreen === 'manual' && <UserManual />}
    </AdminLayout>
  );
}

function UserManual() {
  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-100">Manual do Usuário</h2>
        <p className="text-sm text-slate-500">Passo a passo da plataforma Veloov</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-neutral-900 font-bold text-sm">1</span>
          <h3 className="text-base font-bold text-slate-100">Central de Passageiro (O Totem)</h3>
        </div>
        <p className="text-sm text-slate-400 leading-6">
          A Central de Passageiro é a tela que o público utiliza para solicitar corridas. Para abrir o totem,
          acesse o link gerado para cada local diretamente no navegador do quiosque ou tablet. O link tem o formato
          <span className="font-mono text-gold-400"> /sua-empresa/nome-do-local</span>.
        </p>
        <p className="text-sm text-slate-400 leading-6">
          Ao abrir o link pela primeira vez, o dispositivo é automaticamente vinculado ao totem (hardware lock).
          Se outra pessoa tentar abrir o mesmo link em um dispositivo diferente, o acesso será bloqueado. Para
          trocar de monitor, use o botão "Limpar Dispositivo" na aba Totens & Locais.
        </p>
        <p className="text-sm text-slate-400 leading-6">
          O passageiro informa nome e telefone, escolhe o destino, seleciona a categoria e confirma a corrida.
          A tela de acompanhamento mostra o status em tempo real.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-neutral-900 font-bold text-sm">2</span>
          <h3 className="text-base font-bold text-slate-100">Configurações de Integração</h3>
        </div>
        <p className="text-sm text-slate-400 leading-6">
          Na seção "Integração", você escolhe como sua empresa processa as corridas. Existem três modos:
        </p>
        <ul className="list-disc pl-5 text-sm text-slate-400 space-y-1">
          <li><strong className="text-slate-200">Dispatch Manual:</strong> Sem software externo. As corridas aparecem no painel "Dispatch" para um operador designar motoristas manualmente.</li>
          <li><strong className="text-slate-200">Machine API:</strong> Integração direta com a plataforma Machine (taximachine.com.br). As credenciais (API Key, usuário e senha do Taxímetro) são preenchidas aqui e enviadas automaticamente pelo servidor.</li>
          <li><strong className="text-slate-200">Webhook Customizado:</strong> Para qualquer outro provedor. Configure a URL, headers e template do payload.</li>
        </ul>
        <p className="text-sm text-slate-400 leading-6">
          Você também pode ativar o <strong className="text-slate-200">Modo Simulação</strong> para testar o fluxo completo sem enviar
          requisições reais. O sistema retorna um mock de corrida criada.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-neutral-900 font-bold text-sm">3</span>
          <h3 className="text-base font-bold text-slate-100">Configuração do WhatsApp</h3>
        </div>
        <p className="text-sm text-slate-400 leading-6">
          Na seção "WhatsApp", você conecta uma instância da Evolution API para enviar notificações de status
          de corrida aos passageiros e motoristas.
        </p>
        <ul className="list-disc pl-5 text-sm text-slate-400 space-y-1">
          <li>Preencha a URL da Evolution API e o token global.</li>
          <li>Digite um nome para a instância (ex: nome da empresa).</li>
          <li>Clique em "Criar instância" — um QR Code será exibido.</li>
          <li>Abra o WhatsApp no celular, vá em Configurações → Dispositivos conectados e escaneie o QR Code.</li>
          <li>Quando o status mudar para "Conectado", as notificações automáticas estarão ativas.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-neutral-900 font-bold text-sm">4</span>
          <h3 className="text-base font-bold text-slate-100">Painel de Valores</h3>
        </div>
        <p className="text-sm text-slate-400 leading-6">
          Na seção "Preços", você configura os valores cobrados por cada categoria de veículo. Para cada categoria,
          você define:
        </p>
        <ul className="list-disc pl-5 text-sm text-slate-400 space-y-1">
          <li><strong className="text-slate-200">Taxa base:</strong> valor fixo cobrado ao iniciar a corrida.</li>
          <li><strong className="text-slate-200">Preço por KM:</strong> valor adicionado por quilômetro rodado.</li>
          <li><strong className="text-slate-200">Preço por minuto:</strong> valor adicionado por minuto de viagem.</li>
          <li><strong className="text-slate-200">Taxa mínima:</strong> o menor valor que pode ser cobrado.</li>
          <li><strong className="text-slate-200">Tempo estimado (ETA):</strong> minutos para chegada do motorista.</li>
        </ul>
      </div>
    </div>
  );
}

function BillingLockoutScreen({ companyName, expiresAt, checkoutUrl, onSignOut }: {
  companyName: string;
  expiresAt: string | null;
  checkoutUrl: string | null;
  onSignOut: () => void;
}) {
  const expiredDate = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'N/A';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-100">{companyName}</h1>
          <button onClick={onSignOut} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-error-400 transition-colors">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>

        <div className="rounded-2xl border border-error-500/30 bg-slate-900/60 p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/15">
            <AlertCircle className="h-8 w-8 text-error-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Assinatura Vencida</h2>
          <p className="mt-3 text-sm text-slate-300">
            A assinatura da sua empresa venceu em <strong className="text-error-400">{expiredDate}</strong>.
            Todos os totens foram bloqueados até que o pagamento seja regularizado.
          </p>

          <div className="mt-6 rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 text-left">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-5 w-5 text-gold-400" />
              <h3 className="text-sm font-bold text-gold-300">Regularizar Pagamento</h3>
            </div>
            <p className="text-xs text-slate-400 leading-5">
              Para desbloquear seus totens e restaurar o acesso ao painel completo,
              efetue o pagamento da sua assinatura.
            </p>

            {checkoutUrl ? (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-6 py-3.5 text-sm font-semibold text-neutral-900 transition-all hover:bg-gold-400">
                <CreditCard className="h-4 w-4" /> Ir para o Pagamento
              </a>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400">
                Entre em contato com o suporte da Veloov Mobilidade para gerar um novo link de pagamento.
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>Totens bloqueados desde {expiredDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
