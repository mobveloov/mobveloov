import { useState, useMemo, useRef } from 'react';
import {
  BookOpen, Search, LayoutDashboard, Radio, Car, Users, MapPin,
  DollarSign, Plug, MessageCircle, Settings, Crown, UserCog,
  Wallet, BarChart3, Bell, ScrollText, ChevronRight, X,
  CheckCircle2, AlertCircle, Info, Smartphone, Zap, Server, Cloud,
  Building2, Clock, TrendingUp, Shield, HelpCircle,
} from 'lucide-react';

type SectionId =
  | 'dashboard' | 'dispatch' | 'rides' | 'drivers' | 'locations'
  | 'pricing' | 'integration' | 'whatsapp' | 'settings' | 'subscription'
  | 'users' | 'finance' | 'reports' | 'notifications' | 'audit' | 'faq';

interface SectionMeta {
  id: SectionId;
  label: string;
  icon: typeof BookOpen;
  group: string;
}

const SECTIONS: SectionMeta[] = [
  { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, group: 'Operação' },
  { id: 'dispatch', label: 'Dispatch', icon: Radio, group: 'Operação' },
  { id: 'rides', label: 'Corridas', icon: Car, group: 'Operação' },
  { id: 'drivers', label: 'Motoristas', icon: Users, group: 'Operação' },
  { id: 'locations', label: 'Totens & Locais', icon: MapPin, group: 'Operação' },
  { id: 'pricing', label: 'Preços', icon: DollarSign, group: 'Configuração' },
  { id: 'integration', label: 'Integração', icon: Plug, group: 'Configuração' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, group: 'Configuração' },
  { id: 'settings', label: 'Dados da Empresa', icon: Settings, group: 'Configuração' },
  { id: 'subscription', label: 'Assinatura', icon: Crown, group: 'Configuração' },
  { id: 'users', label: 'Usuários & Permissões', icon: UserCog, group: 'Gestão' },
  { id: 'finance', label: 'Financeiro', icon: Wallet, group: 'Gestão' },
  { id: 'reports', label: 'Relatórios', icon: BarChart3, group: 'Gestão' },
  { id: 'notifications', label: 'Notificações', icon: Bell, group: 'Gestão' },
  { id: 'audit', label: 'Auditoria', icon: ScrollText, group: 'Gestão' },
  { id: 'faq', label: 'Perguntas Frequentes', icon: HelpCircle, group: 'Ajuda' },
];

const GROUP_ORDER = ['Operação', 'Configuração', 'Gestão', 'Ajuda'];

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2.5 py-0.5 text-xs font-semibold text-gold-600 dark:text-gold-400">
      <Crown className="h-3 w-3" />
      {plan}
    </span>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-neutral-900 font-bold text-xs">
        {n}
      </span>
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <Step key={i} n={i + 1}>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-6">{item}</p>
        </Step>
      ))}
    </div>
  );
}

function SectionCard({ id, icon: Icon, title, summary, children }: {
  id: string;
  icon: typeof BookOpen;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card p-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <Icon className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{title}</h3>
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 leading-6">{summary}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
      <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function InfoList({ items }: { items: { label: string; desc: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">{item.label}:</span>
          <span className="text-neutral-600 dark:text-neutral-400">{item.desc}</span>
        </li>
      ))}
    </ul>
  );
}

function MockScreen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-50 dark:bg-neutral-800/50">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="h-2.5 w-2.5 rounded-full bg-error-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-warning-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-success-400/60" />
        <span className="ml-2 text-xs text-neutral-400">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ManualModule() {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS.filter(s => s.label.toLowerCase().includes(q));
  }, [search]);

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <BookOpen className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Manual do Usuário</h2>
          <p className="text-sm text-neutral-500">Guia completo tela por tela da plataforma Veloov</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="card p-3 mb-4 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no manual..."
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar TOC */}
        <aside className={`fixed lg:sticky top-0 lg:top-20 left-0 z-20 h-screen lg:h-[calc(100vh-6rem)] w-64 shrink-0 overflow-y-auto bg-white dark:bg-neutral-900 lg:bg-transparent border-r border-neutral-200 dark:border-neutral-700 lg:border-r-0 transition-transform lg:transition-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div className="p-4 lg:p-0">
            <div className="flex items-center justify-between mb-3 lg:hidden">
              <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Sumário</span>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
            {GROUP_ORDER.map(group => {
              const groupSections = filteredSections.filter(s => s.group === group);
              if (groupSections.length === 0) return null;
              return (
                <div key={group} className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">{group}</p>
                  <div className="space-y-0.5">
                    {groupSections.map(s => {
                      const Icon = s.icon;
                      const active = activeSection === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => scrollToSection(s.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                            active
                              ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300 font-semibold'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-left truncate">{s.label}</span>
                          {active && <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-4 right-4 z-30 lg:hidden flex h-12 w-12 items-center justify-center rounded-full bg-gold-500 text-neutral-900 shadow-lg"
        >
          <BookOpen className="h-5 w-5" />
        </button>

        {/* Main content */}
        <div ref={contentRef} className="flex-1 min-w-0 space-y-6 pb-12">

          {/* Dashboard */}
          <SectionCard
            id="dashboard"
            icon={LayoutDashboard}
            title="Visão Geral (Dashboard)"
            summary="O painel inicial mostra os principais indicadores da operação em tempo real e atalhos para as ações mais comuns."
          >
            <SubSection title="Indicadores (KPIs)">
              <InfoList items={[
                { label: 'Total de Corridas', desc: 'todas as corridas já registradas pela empresa, incluindo concluídas e canceladas.' },
                { label: 'Em Andamento', desc: 'corridas com status Aceito, A caminho ou Em viagem no momento.' },
                { label: 'Concluídas', desc: 'corridas finalizadas com sucesso.' },
                { label: 'Receita Total', desc: 'soma dos valores das corridas concluídas.' },
              ]} />
            </SubSection>
            <SubSection title="Gráfico de 7 dias">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                O gráfico de área mostra quantas corridas foram solicitadas por dia nos últimos 7 dias. Use-o para identificar padrões de demanda (ex: picos aos finais de semana).
              </p>
            </SubSection>
            <SubSection title="Ações Rápidas">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Seis botões de atalho para acessar rapidamente as áreas mais usadas:</p>
              <InfoList items={[
                { label: 'Dispatch', desc: 'abre a fila de corridas para atribuição manual de motoristas.' },
                { label: 'Totens', desc: 'gerencia os quiosques e locais de atendimento.' },
                { label: 'Integração', desc: 'configura como as corridas são processadas (Manual, Machine API ou Webhook).' },
                { label: 'Preços', desc: 'edita as tarifas por categoria de veículo.' },
                { label: 'Motoristas', desc: 'cadastro e gestão da frota.' },
                { label: 'WhatsApp', desc: 'configura notificações automáticas para passageiros.' },
              ]} />
            </SubSection>
          </SectionCard>

          {/* Dispatch */}
          <SectionCard
            id="dispatch"
            icon={Radio}
            title="Dispatch"
            summary="Painel em tempo real para gerenciar corridas pendentes e em andamento. Atualiza automaticamente quando uma nova corrida chega ou muda de status."
          >
            <SubSection title="Corridas Pendentes">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Lista as corridas solicitadas pelos totens que ainda não têm motorista atribuído. Cada card mostra:
              </p>
              <InfoList items={[
                { label: 'Passageiro', desc: 'nome e telefone de quem solicitou.' },
                { label: 'Trajeto', desc: 'endereços de origem e destino.' },
                { label: 'Valor', desc: 'preço estimado da corrida.' },
                { label: 'Categoria', desc: 'tipo de veículo solicitado (Econômico, Conforto, etc.).' },
              ]} />
            </SubSection>
            <SubSection title="Como atribuir um motorista manualmente">
              <Steps items={[
                'Na aba Dispatch, localize a corrida pendente desejada.',
                'Clique em "Designar motorista".',
                'Selecione um motorista disponível na lista que aparece (apenas motoristas marcados como Disponível aparecem).',
                'Confirme a atribuição. O motorista recebe uma notificação via WhatsApp com os dados da corrida.',
                'O status da corrida muda para "Aceito" e ela passa para a seção "Em andamento".',
              ]} />
            </SubSection>
            <SubSection title="Corridas Em Andamento">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Mostra as corridas ativas com seus respectivos status. Cada card exibe o motorista atribuído, trajeto e valor. Use o botão "Concluir" para finalizar uma corrida em viagem.
              </p>
            </SubSection>
            <SubSection title="Status de Corrida">
              <div className="space-y-1.5">
                {[
                  { status: 'Aguardando', color: 'bg-neutral-400', desc: 'corrida solicitada, sem motorista ainda.' },
                  { status: 'Aceito', color: 'bg-blue-500', desc: 'motorista atribuído, ainda não saiu.' },
                  { status: 'A caminho', color: 'bg-amber-500', desc: 'motorista a caminho do ponto de embarque.' },
                  { status: 'Em viagem', color: 'bg-green-500', desc: 'passageiro embarcou, corrida em andamento.' },
                  { status: 'Concluído', color: 'bg-emerald-600', desc: 'corrida finalizada com sucesso.' },
                  { status: 'Cancelado', color: 'bg-red-500', desc: 'corrida cancelada pelo operador, passageiro ou motorista.' },
                ].map(s => (
                  <div key={s.status} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">{s.status}</span>
                    <span className="text-neutral-500">— {s.desc}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </SectionCard>

          {/* Corridas */}
          <SectionCard
            id="rides"
            icon={Car}
            title="Corridas"
            summary="Histórico de todas as corridas realizadas, ordenado das mais recentes para as mais antigas."
          >
            <SubSection title="Como consultar o histórico">
              <Steps items={[
                'Clique na aba "Corridas" no menu lateral.',
                'A lista mostra as últimas 50 corridas, da mais recente para a mais antiga.',
                'Cada card exibe: status, data/hora, nome e telefone do passageiro, trajeto, valor, distância e motorista.',
              ]} />
            </SubSection>
            <SubSection title="Interpretando os status">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cada corrida tem um badge colorido indicando seu status: Aguardando (cinza), Aceito (azul), A caminho (âmbar), Em viagem (verde), Concluído (verde escuro) ou Cancelado (vermelho).
              </p>
            </SubSection>
            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 p-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Dica: Para relatórios detalhados com filtros por período e exportação CSV, use a aba "Relatórios".
              </p>
            </div>
          </SectionCard>

          {/* Motoristas */}
          <SectionCard
            id="drivers"
            icon={Users}
            title="Motoristas"
            summary="Cadastro e gestão da frota de motoristas para o modo de dispatch manual."
          >
            <SubSection title="Como cadastrar um motorista">
              <Steps items={[
                'Clique na aba "Motoristas" no menu lateral.',
                'Preencha o formulário no topo: Nome (mínimo 3 caracteres), Telefone (com DDD), Placa do veículo e Modelo do veículo.',
                'Clique em "Adicionar Motorista".',
                'O motorista aparece na lista como "Disponível" por padrão.',
              ]} />
            </SubSection>
            <SubSection title="Gerenciar disponibilidade">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Cada motorista tem um indicador Disponível/Indisponível. Use o botão de toggle para alterar o status:
              </p>
              <InfoList items={[
                { label: 'Disponível', desc: 'aparece na lista de seleção quando um operador vai atribuir um motorista a uma corrida.' },
                { label: 'Indisponível', desc: 'não aparece para atribuição. Use quando o motorista está em folga, almoço ou já tem corrida em andamento.' },
              ]} />
            </SubSection>
            <SubSection title="Remover um motorista">
              <Steps items={[
                'Localize o motorista na lista.',
                'Clique no ícone de lixeira ao lado do card.',
                'Confirme a exclusão na janela que aparece.',
              ]} />
            </SubSection>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Os motoristas cadastrados aqui são usados apenas no modo Dispatch Manual. Se você usa Machine API, os motoristas vêm da plataforma Machine.
              </p>
            </div>
          </SectionCard>

          {/* Totens & Locais */}
          <SectionCard
            id="locations"
            icon={MapPin}
            title="Totens & Locais"
            summary="Gerencie os quiosques/tablets onde os passageiros solicitam corridas. Cada totem gera um link único e tem vínculo exclusivo com um dispositivo físico."
          >
            <SubSection title="Como cadastrar um novo totem">
              <Steps items={[
                'Clique na aba "Totens & Locais" no menu lateral.',
                'Clique em "Adicionar Totem".',
                'Preencha o Nome do local (ex: "Recepção Hotel", "Lobby Principal").',
                'O Slug é gerado automaticamente a partir do nome, mas pode ser editado.',
                'Opcionalmente, preencha Cidade e Estado para integração com mapas.',
                'Clique em "Salvar". O totem é criado e um link único é gerado.',
              ]} />
            </SubSection>
            <SubSection title="Limite de totens por plano">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cada plano permite um número máximo de totens ativos. Ao tentar criar um totem além do limite, o sistema exibe uma mensagem sugerindo upgrade de plano.
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <PlanBadge plan="Bronze: 1 totem" />
                <PlanBadge plan="Prata: 3 totens" />
                <PlanBadge plan="Ouro: 5 totens" />
                <PlanBadge plan="Black: 10 totens" />
                <PlanBadge plan="Diamante: ilimitado" />
              </div>
            </SubSection>
            <SubSection title="Vínculo de dispositivo (Hardware Lock)">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Cada totem é vinculado automaticamente ao primeiro dispositivo que abre seu link. Isso impede que o totem seja aberto em um aparelho não autorizado.
              </p>
              <InfoList items={[
                { label: 'Primeiro acesso', desc: 'ao abrir o link do totem pela primeira vez, o dispositivo é registrado automaticamente.' },
                { label: 'Bloqueio', desc: 'se outra pessoa tentar abrir o mesmo link em um dispositivo diferente, o acesso é bloqueado.' },
                { label: 'Limpar dispositivo', desc: 'use o botão "Limpar Dispositivo" no card do totem para desvincular e permitir trocar de aparelho.' },
              ]} />
            </SubSection>
            <SubSection title="Como trocar um totem de dispositivo">
              <Steps items={[
                'Na aba "Totens & Locais", localize o totem desejado.',
                'Clique em "Limpar Dispositivo".',
                'Abra o link do totem no novo dispositivo. Ele será vinculado automaticamente.',
              ]} />
            </SubSection>
            <SubSection title="Link do totem">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cada totem tem um link no formato <span className="font-mono text-gold-500">/sua-empresa/nome-do-local</span>. Use o botão "Copiar" para copiar o link e "Abrir" para abri-lo em uma nova aba.
              </p>
            </SubSection>
            <SubSection title="Ativar/desativar um totem">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Use o botão de toggle no card do totem para ativá-lo ou desativá-lo. Totens inativos não aceitam solicitações de corrida, mas mantêm o vínculo de dispositivo.
              </p>
            </SubSection>
          </SectionCard>

          {/* Preços */}
          <SectionCard
            id="pricing"
            icon={DollarSign}
            title="Preços"
            summary="Configure as tarifas cobradas por cada categoria de veículo. Os preços podem variar por totem ou serem compartilhados entre todos."
          >
            <SubSection title="Categorias padrão">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                O sistema vem com 3 categorias pré-configuradas que você pode editar:
              </p>
              <InfoList items={[
                { label: 'Econômico', desc: 'categoria base, menor preço.' },
                { label: 'Conforto', desc: 'intermediária, veículos melhores.' },
                { label: 'Executivo', desc: 'premium, maior preço.' },
              ]} />
            </SubSection>
            <SubSection title="Campos de tarifação">
              <InfoList items={[
                { label: 'Taxa base', desc: 'valor fixo cobrado ao iniciar a corrida, independente da distância.' },
                { label: 'Preço por KM', desc: 'valor adicional por quilômetro rodado do origem ao destino.' },
                { label: 'Preço por minuto', desc: 'valor adicional por minuto de viagem (tempo de percurso).' },
                { label: 'Corrida mínima', desc: 'o menor valor que pode ser cobrado, mesmo para trajetos curtos.' },
                { label: 'Tempo estimado (ETA)', desc: 'tempo médio em minutos para o motorista chegar ao ponto de embarque. Exibido ao passageiro.' },
                { label: 'Ordem', desc: 'define a ordem de exibição das categorias no totem (menor número aparece primeiro).' },
                { label: 'Ativo', desc: 'categorias inativas não aparecem para o passageiro no totem.' },
              ]} />
            </SubSection>
            <SubSection title="Como criar uma nova categoria">
              <Steps items={[
                'Na aba "Preços", clique em "Adicionar Categoria".',
                'Preencha Nome, Descrição e todos os campos de tarifação.',
                'Escolha se a categoria se aplica a "Todos os locais" ou a um totem específico.',
                'Defina a ordem de exibição.',
                'Clique em "Salvar".',
              ]} />
            </SubSection>
            <SubSection title="Multiplicador de demanda (Surge)">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                O multiplicador de demanda aumenta proporcionalmente o preço de todas as categorias. Por exemplo, com multiplicador 1.5, uma corrida de R$ 20 passa a custar R$ 30. Use em horários de pico para equilibrar oferta e demanda.
              </p>
            </SubSection>
            <SubSection title="Preços por local">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Use os botões de filtro no topo para alternar entre "Todos os locais" e um totem específico. Cada totem pode ter suas próprias categorias e preços, ou usar as categorias gerais.
              </p>
            </SubSection>
            <SubSection title={`Categorias da Machine API ${PlanBadge ? '' : ''}`}>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Se você usa o modo Machine API, clique em "Carregar categorias" para buscar as categorias disponíveis na Machine e vinculá-las às suas categorias locais. As categorias vinculadas usam os preços em tempo real da Machine em vez dos valores configurados manualmente.
              </p>
            </SubSection>
          </SectionCard>

          {/* Integração */}
          <SectionCard
            id="integration"
            icon={Plug}
            title="Integração"
            summary="Define como as corridas solicitadas nos totens são processadas e enviadas aos motoristas."
          >
            <SubSection title="Dispatch Manual">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-neutral-200 dark:bg-neutral-700 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">Modo padrão</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Não usa nenhum software externo. As corridas aparecem no painel "Dispatch" e um operador designa motoristas manualmente.
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Quando usar: empresas pequenas com poucos motoristas, ou que querem controle total sobre cada atribuição.
              </p>
            </SubSection>
            <SubSection title="Machine API">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Integração direta com a plataforma Machine (taximachine.com.br). As corridas são enviadas automaticamente para a Machine, que designa o motorista.
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Campos necessários:</p>
              <InfoList items={[
                { label: 'API URL', desc: 'endereço da API da Machine (ex: https://v2.taximachine.com).' },
                { label: 'API Key', desc: 'chave de acesso fornecida pela Machine.' },
                { label: 'Usuário do Taxímetro', desc: 'login do seu usuário no Taxímetro.' },
                { label: 'Senha do Taxímetro', desc: 'senha do seu usuário no Taxímetro.' },
                { label: 'Localização', desc: 'cidade e estado da central (usada para buscar categorias e estimativas).' },
              ]} />
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                Quando usar: empresas que já usam a Machine como central de taxi e querem integração automática.
              </p>
            </SubSection>
            <SubSection title="Webhook Customizado">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Para qualquer outro provedor de taxi. As corridas são enviadas via POST para uma URL que você configura.
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Campos necessários:</p>
              <InfoList items={[
                { label: 'Webhook URL', desc: 'endereço que receberá as corridas.' },
                { label: 'Headers', desc: 'headers HTTP personalizados em formato JSON (ex: Authorization).' },
                { label: 'Template do payload', desc: 'modelo do corpo da requisição com variáveis como {{passenger_name}}, {{origin}}, {{destination}}, {{price}}.' },
              ]} />
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                Quando usar: empresas com sistema próprio de dispatch ou provedor diferente da Machine.
              </p>
            </SubSection>
            <SubSection title="Modo Simulação">
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 mb-2">
                <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  O Modo Simulação intercepta todas as solicitações de corrida e retorna uma resposta falsa, sem enviar para a Machine ou webhook. Use para testar o fluxo completo do totem ao painel sem custo.
                </p>
              </div>
              <Steps items={[
                'Na aba "Integração", ative o toggle "Modo Simulação".',
                'Solicite uma corrida pelo totem — ela será criada com status simulado.',
                'Para voltar ao modo real, desative o toggle e salve.',
              ]} />
            </SubSection>
            <SubSection title="Exigir cotação antes de solicitar">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Quando ativado, o totem obriga o passageiro a ver o preço estimado antes de confirmar a corrida. Desativado, a corrida é solicitada direto sem exibir o valor primeiro.
              </p>
            </SubSection>
          </SectionCard>

          {/* WhatsApp */}
          <SectionCard
            id="whatsapp"
            icon={MessageCircle}
            title="WhatsApp"
            summary="Configure o envio de notificações automáticas via WhatsApp para passageiros e motoristas. As regras variam conforme o plano da empresa."
          >
            <SubSection title="Provedores disponíveis">
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                  <Server className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Evolution API</p>
                    <p className="text-xs text-neutral-500">Auto-hospedada ou cloud. Conexão via QR code. Recomendado para quem quer controle total.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                  <Zap className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Z-API</p>
                    <p className="text-xs text-neutral-500">API simples via token, sem QR code. O número é conectado no painel da Z-API.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                  <Cloud className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Meta Cloud API</p>
                    <p className="text-xs text-neutral-500">WhatsApp Business oficial do Facebook/Meta. Requer token, Phone Number ID e WABA ID.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                  <Building2 className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">API Veloov</p>
                    <p className="text-xs text-neutral-500">Infraestrutura própria da Veloov. Sem configuração necessária.</p>
                  </div>
                </div>
              </div>
            </SubSection>
            <SubSection title="Como conectar via Evolution API (QR Code)">
              <Steps items={[
                'Na aba "WhatsApp", selecione "Evolution API" como provedor.',
                'Preencha a URL da sua instância Evolution (ex: https://api.sua-evolution.com).',
                'Preencha o token global da Evolution API.',
                'Confirme o nome da instância (gerado automaticamente a partir do slug da empresa).',
                'Clique em "Criar instância e gerar QR".',
                'Abra o WhatsApp no celular, vá em Configurações > Dispositivos conectados > Conectar aparelho.',
                'Escaneie o QR code exibido na tela.',
                'Aguarde o status mudar para "Conectado" (a verificação é automática a cada 5 segundos).',
              ]} />
            </SubSection>
            <SubSection title="Regras de notificação por plano">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                O conteúdo e a frequência das notificações enviadas ao passageiro variam conforme o plano ativo:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Plano</th>
                      <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Dados do Motorista</th>
                      <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Tempo Estimado</th>
                      <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Atualização de Distância</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {[
                      { plan: 'Bronze', driver: 'Sim', eta: 'Nao', dist: 'Nao' },
                      { plan: 'Prata', driver: 'Sim', eta: 'Sim', dist: 'Nao' },
                      { plan: 'Ouro', driver: 'Sim', eta: 'Sim', dist: 'A cada 5 min' },
                      { plan: 'Black', driver: 'Sim', eta: 'Sim', dist: 'A cada 2 min' },
                      { plan: 'Diamante', driver: 'Sim', eta: 'Sim', dist: 'A cada 2 min' },
                    ].map(r => (
                      <tr key={r.plan}>
                        <td className="py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">{r.plan}</td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{r.driver}</td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{r.eta}</td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{r.dist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-gold-500/10 p-3">
                <TrendingUp className="h-4 w-4 text-gold-500 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  O painel mostra um cartão com as regras do seu plano atual e sugestões de upgrade para receber notificações mais frequentes.
                </p>
              </div>
            </SubSection>
            <SubSection title="Contador de mensagens">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                O painel exibe quantas mensagens de WhatsApp foram enviadas no mês atual. Como cada mensagem tem custo na API do WhatsApp Business, use esse contador para monitorar o gasto real por plano.
              </p>
            </SubSection>
            <SubSection title="Cancelar corrida via WhatsApp">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                O passageiro pode cancelar uma corrida respondendo "cancelar" à mensagem recebida. O sistema processa o cancelamento automaticamente, cancela na Machine (se aplicável) e envia uma confirmação.
              </p>
            </SubSection>
          </SectionCard>

          {/* Dados da Empresa */}
          <SectionCard
            id="settings"
            icon={Settings}
            title="Dados da Empresa"
            summary="Informações cadastrais da empresa exibidas no painel e nos documentos fiscais."
          >
            <SubSection title="Identificação">
              <InfoList items={[
                { label: 'Nome da empresa', desc: 'nome exibido no painel e no totem.' },
                { label: 'CNPJ', desc: 'CNPJ usado para emissão de notas fiscais.' },
                { label: 'Cor da marca', desc: 'cor principal (hex) usada nos elementos visuais do totem. Padrão: dourado (#D4AF37).' },
              ]} />
            </SubSection>
            <SubSection title="Responsável">
              <InfoList items={[
                { label: 'Nome', desc: 'nome do responsável pela conta.' },
                { label: 'Telefone', desc: 'telefone de contato.' },
                { label: 'E-mail', desc: 'e-mail de contato para comunicação da Veloov.' },
              ]} />
            </SubSection>
            <SubSection title="Como editar">
              <Steps items={[
                'Na aba "Dados da Empresa", altere os campos desejados.',
                'Clique em "Salvar".',
                'A confirmação aparece no topo da tela.',
              ]} />
            </SubSection>
          </SectionCard>

          {/* Assinatura */}
          <SectionCard
            id="subscription"
            icon={Crown}
            title="Assinatura"
            summary="Gerencie o plano da empresa, ciclo de cobrança, forma de pagamento e histórico de faturas."
          >
            <SubSection title="Status da assinatura">
              <InfoList items={[
                { label: 'Ativo', desc: 'assinatura em dia, totens funcionando normalmente.' },
                { label: 'Período de Teste', desc: 'em trial, sem cobrança. Contagem regressiva de dias restantes é exibida.' },
                { label: 'Pagamento Pendente', desc: 'cobrança gerada mas ainda não paga. Totens continuam funcionando.' },
                { label: 'Expirado', desc: 'assinatura vencida. Totens bloqueados até regularização.' },
              ]} />
            </SubSection>
            <SubSection title="Como fazer upgrade ou downgrade">
              <Steps items={[
                'Na aba "Assinatura", role até a tabela de comparação de planos.',
                'Compare os recursos de cada plano (número de totens, notificações WhatsApp, relatórios, etc.).',
                'Clique em "Assinar" no plano desejado.',
                'Você será redirecionado para o checkout do Asaas para pagar o novo plano.',
                'A mudança é aplicada imediatamente após a confirmação do pagamento.',
              ]} />
            </SubSection>
            <SubSection title="Ciclo de cobrança">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Escolha entre quatro ciclos de cobrança: Mensal, Trimestral (3 meses), Semestral (6 meses) ou Anual (12 meses). Quanto maior o ciclo, maior o desconto aplicado sobre o valor mensal.
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-green-500/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  O cálculo é automático: valor mensal × número de meses - desconto percentual. Por exemplo, R$ 99/mês no plano anual (15% de desconto) = R$ 1.009,80/ano.
                </p>
              </div>
            </SubSection>
            <SubSection title="Forma de pagamento">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                As cobranças são processadas via Asaas. Formas aceitas: Pix e Cartão de crédito. Para atualizar a forma de pagamento, clique em "Gerenciar Pagamento" e serás redirecionado ao checkout do Asaas.
              </p>
            </SubSection>
            <SubSection title="Histórico de faturas">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                A tabela de faturas mostra: data, período cobrado, valor, status (Paga, Pendente, Vencida) e link de pagamento. Use o link "Pagamento" para pagar uma fatura pendente.
              </p>
            </SubSection>
            <SubSection title="Dados fiscais">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                A Razão Social e CNPJ exibidos são os mesmos cadastrados em "Dados da Empresa". Para alterar, vá à aba Dados da Empresa.
              </p>
            </SubSection>
          </SectionCard>

          {/* Usuários & Permissões */}
          <SectionCard
            id="users"
            icon={UserCog}
            title="Usuários & Permissões"
            summary="Gerencie quem tem acesso ao painel administrativo e qual nível de permissão cada pessoa tem."
          >
            <SubSection title="Perfis de acesso">
              <InfoList items={[
                { label: 'Admin', desc: 'acesso total a todas as abas e funcionalidades do painel.' },
                { label: 'Operador', desc: 'acesso apenas ao Dispatch e Corridas. Não vê preços, financeiro nem configurações.' },
                { label: 'Financeiro', desc: 'acesso apenas a Relatórios e Assinatura. Não vê dispatch nem configurações.' },
              ]} />
            </SubSection>
            <SubSection title="Como adicionar um usuário">
              <Steps items={[
                'Na aba "Usuários & Permissões", preencha o e-mail da pessoa no formulário no topo.',
                'Selecione o perfil: Admin, Operador ou Financeiro.',
                'Clique em "Adicionar Usuário".',
                'A pessoa precisa ter uma conta criada no Veloov com o mesmo e-mail. Se não tiver, o sistema exibirá um erro.',
              ]} />
            </SubSection>
            <SubSection title="Como remover um usuário">
              <Steps items={[
                'Localize o usuário na lista.',
                'Clique no ícone de lixeira ao lado do nome.',
                'O acesso é removido imediatamente.',
              ]} />
            </SubSection>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                O usuário precisa se cadastrar primeiro no Veloov (tela de login) com o mesmo e-mail para depois ser adicionado à empresa.
              </p>
            </div>
          </SectionCard>

          {/* Financeiro */}
          <SectionCard
            id="finance"
            icon={Wallet}
            title="Financeiro"
            summary="Acompanhe a receita das corridas concluídas e exporte os dados para contabilidade."
          >
            <SubSection title="Indicadores">
              <InfoList items={[
                { label: 'Receita de Hoje', desc: 'soma dos valores das corridas concluídas no dia atual.' },
                { label: 'Receita do Mês', desc: 'soma dos valores das corridas concluídas no mês atual.' },
                { label: 'Total Geral', desc: 'soma histórica de todas as corridas concluídas.' },
              ]} />
            </SubSection>
            <SubSection title="Tabela de receita">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Mostra as últimas 100 corridas concluídas com: Data, Motorista, Categoria (badge) e Valor (em verde, alinhado à direita).
              </p>
            </SubSection>
            <SubSection title="Como exportar para CSV">
              <Steps items={[
                'Na aba "Financeiro", clique em "Exportar CSV".',
                'Um arquivo chamado financeiro-AAAA-MM-DD.csv é baixado automaticamente.',
                'O arquivo contém: Data, Motorista, Categoria e Valor de cada corrida.',
                'Abra no Excel, Google Sheets ou software de contabilidade.',
              ]} />
            </SubSection>
          </SectionCard>

          {/* Relatórios */}
          <SectionCard
            id="reports"
            icon={BarChart3}
            title="Relatórios"
            summary="Análises gráficas do desempenho da operação com filtros por período e exportação."
          >
            <SubSection title="Filtro de período">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Selecione entre 7, 30 ou 90 dias no topo. Todos os indicadores e gráficos são recalculados com base no período escolhido.
              </p>
            </SubSection>
            <SubSection title="Indicadores">
              <InfoList items={[
                { label: 'Corridas no Período', desc: 'total de corridas solicitadas no intervalo selecionado.' },
                { label: 'Concluídas', desc: 'quantas foram finalizadas com sucesso.' },
                { label: 'Receita', desc: 'soma dos valores das corridas concluídas no período.' },
                { label: 'Ticket Médio', desc: 'receita dividida pelo número de corridas concluídas.' },
              ]} />
            </SubSection>
            <SubSection title="Gráficos">
              <InfoList items={[
                { label: 'Corridas por Categoria', desc: 'gráfico de barras mostrando qual categoria tem mais demanda.' },
                { label: 'Distribuição por Status', desc: 'gráfico de rosca com a proporção de Concluídas, Canceladas e Pendentes.' },
              ]} />
            </SubSection>
            <SubSection title="Como exportar relatório">
              <Steps items={[
                'Selecione o período desejado (7, 30 ou 90 dias).',
                'Clique em "Exportar CSV".',
                'O arquivo relatorio-Ndias-AAAA-MM-DD.csv é baixado com os dados detalhados.',
              ]} />
            </SubSection>
          </SectionCard>

          {/* Notificações */}
          <SectionCard
            id="notifications"
            icon={Bell}
            title="Notificações"
            summary="Central de eventos e alertas do sistema. Mostra o que está acontecendo em tempo real."
          >
            <SubSection title="Filtros">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                Use as abas no topo para filtrar por tipo:
              </p>
              <InfoList items={[
                { label: 'Todos', desc: 'todas as notificações sem filtro.' },
                { label: 'Erros', desc: 'apenas erros (ex: falha na Machine API, falha no envio de WhatsApp).' },
                { label: 'Avisos', desc: 'alertas que precisam atenção mas não são críticos.' },
                { label: 'Informações', desc: 'eventos informativos (ex: corrida criada, notificação enviada).' },
              ]} />
            </SubSection>
            <SubSection title="Como interpretar cada notificação">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cada entrada mostra: nível (ícone colorido), origem (badge indicando de qual parte do sistema veio), data/hora e mensagem descritiva. As origens mais comuns são: machine_api, poll_notification, distance_update e dispatch.
              </p>
            </SubSection>
            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 p-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                A lista mostra as últimas 100 notificações. Para um histórico completo e auditável, use a aba "Auditoria".
              </p>
            </div>
          </SectionCard>

          {/* Auditoria */}
          <SectionCard
            id="audit"
            icon={ScrollText}
            title="Auditoria"
            summary="Registro completo de todas as ações realizadas no painel, quem as executou e quando."
          >
            <SubSection title="Como consultar">
              <Steps items={[
                'Clique na aba "Auditoria" no menu lateral.',
                'A lista mostra as últimas 200 ações registradas.',
                'Use a barra de busca no topo para filtrar por ação, e-mail do usuário ou objeto afetado.',
              ]} />
            </SubSection>
            <SubSection title="Colunas da tabela">
              <InfoList items={[
                { label: 'Quando', desc: 'data e hora em que a ação ocorreu.' },
                { label: 'Usuário', desc: 'e-mail de quem executou a ação.' },
                { label: 'Ação', desc: 'tipo de ação (badge dourado, ex: create, update, delete).' },
                { label: 'Objeto', desc: 'o que foi afetado (ex: nome da corrida, do motorista, etc.).' },
              ]} />
            </SubSection>
            <div className="flex items-start gap-2 rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50 p-3">
              <Shield className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                O log de auditoria é somente leitura e não pode ser editado ou apagado. Isso garante rastreabilidade completa para conformidade.
              </p>
            </div>
          </SectionCard>

          {/* FAQ */}
          <SectionCard
            id="faq"
            icon={HelpCircle}
            title="Perguntas Frequentes"
            summary="Respostas para as dúvidas mais comuns sobre o uso da plataforma."
          >
            <div className="space-y-4">
              {[
                {
                  q: 'Meu totem não conecta, o que fazer?',
                  a: 'Verifique se o totem está ativo na aba "Totens & Locais". Se o dispositivo foi trocado, clique em "Limpar Dispositivo" e abra o link no novo aparelho. Confirme também que a assinatura não está vencida (aba "Assinatura").',
                },
                {
                  q: 'Como transfiro um totem para outro dispositivo?',
                  a: 'Na aba "Totens & Locais", localize o totem, clique em "Limpar Dispositivo" e abra o link no novo dispositivo. O vínculo é feito automaticamente.',
                },
                {
                  q: 'As corridas não chegam no Dispatch, por quê?',
                  a: 'Verifique na aba "Integração" qual modo está ativo. Se estiver em "Machine API" ou "Webhook", as corridas vão direto para o provedor externo e não aparecem no Dispatch manual. Mude para "Dispatch Manual" se quiser gerenciar as corridas no painel.',
                },
                {
                  q: 'As notificações de WhatsApp não são enviadas, o que verificar?',
                  a: 'Confirme se o WhatsApp está "Conectado" na aba "WhatsApp". Se usar Evolution API, verifique se a instância ainda está ativa no servidor. Verifique também na aba "Notificações" se há erros de envio registrados.',
                },
                {
                  q: 'Como alterar o preço das corridas?',
                  a: 'Na aba "Preços", edite os campos da categoria desejada (taxa base, preço por km, preço por minuto, corrida mínima). Se usar Machine API com categorias vinculadas, os preços vêm da Machine em tempo real — desvincule a categoria para usar preços próprios.',
                },
                {
                  q: 'O que é o Modo Simulação?',
                  a: 'O Modo Simulação intercepta todas as solicitações de corrida e retorna uma resposta falsa, sem enviar para a Machine ou webhook. Use para testar o fluxo do totem ao painel sem gerar corridas reais nem custos.',
                },
                {
                  q: 'Como faço upgrade do meu plano?',
                  a: 'Na aba "Assinatura", role até a tabela de planos, clique em "Assinar" no plano desejado e complete o pagamento no checkout do Asaas. A mudança é aplicada imediatamente após o pagamento.',
                },
                {
                  q: 'Posso ter preços diferentes em cada totem?',
                  a: 'Sim. Na aba "Preços", use os botões de filtro no topo para selecionar um totem específico e criar categorias exclusivas para ele. Ou use "Todos os locais" para compartilhar as mesmas categorias entre todos os totens.',
                },
                {
                  q: 'Quantos motoristas posso cadastrar?',
                  a: 'Não há limite de motoristas em nenhum plano. O limite é apenas no número de totens (quipamentos). Motoristas podem ser cadastrados livremente.',
                },
                {
                  q: 'Como cancelo uma corrida?',
                  a: 'Na aba "Dispatch", localize a corrida ativa e use o botão de cancelar. O passageiro também pode cancelar respondendo "cancelar" à mensagem de WhatsApp recebida.',
                },
              ].map((faq, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2">{faq.q}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-6">{faq.a}</p>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
