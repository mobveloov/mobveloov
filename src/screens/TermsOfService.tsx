import { Shield, FileText } from 'lucide-react';

export function TermsOfService() {
  return (
    <div className="animate-slide-up">
      <div className="glass-card rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15">
            <FileText className="h-6 w-6 text-gold-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Termos de Uso</h1>
            <p className="text-sm text-slate-400">Veloov Mobilidade — Plataforma SaaS</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">1. Da Plataforma</h2>
            <p>
              A <strong className="text-white">Veloov Mobilidade</strong> atua exclusivamente como uma plataforma de
              intermediação tecnológica e fornecedora de software (SaaS). A Veloov Mobilidade NÃO possui frota de
              veículos, NÃO emprega ou contrata motoristas, e NÃO gerencia a prestação dos serviços de transporte.
            </p>
            <p>
              A plataforma disponibilizada pela Veloov Mobilidade consiste em um sistema de dispatch urbano
              multi-empresa (white-label), permitindo que empresas parceiras (Tenant) operem suas próprias centrais
              de transporte por meio de totens e painéis administrativos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">2. Zero Responsabilidade (Isenção)</h2>
            <p>
              Todas as responsabilidades civis ou criminais referentes a ocorrências de trânsito, comportamento de
              motoristas, valores cobrados, acidentes, atrasos ou qualquer outro aspecto relacionado à prestação
              do serviço de transporte são inteiramente da empresa local (Tenant) e de sua respectiva central de
              transporte, isentando completamente a Veloov Mobilidade de qualquer obrigação.
            </p>
            <p>
              A Veloov Mobilidade não se responsabiliza por falhas nas integrações de terceiros (Machine API,
              Taxímetro, Evolution API, ou qualquer outro provedor externo), sendo tais serviços de responsabilidade
              exclusiva de seus respectivos fornecedores e da empresa Tenant que os contrata.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">3. Do Acesso e Uso</h2>
            <p>
              O acesso à plataforma se dá mediante links específicos por empresa (Tenant) e por local de instalação
              de totem. Cada totem é protegido por um sistema de identificação de dispositivo (fingerprint) que
              impede o uso não autorizado em equipamentos não vinculados.
            </p>
            <p>
              O administrador de cada empresa é responsável por gerenciar seus próprios locais, motoristas, preços
              e configurações de integração. A Veloov Mobilidade não interfere na operação diária de cada Tenant.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">4. Dos Planos, Limites e Assinaturas</h2>
            <p>
              A Veloov Mobilidade adota um modelo de assinatura com <strong className="text-white">dimensões independentes</strong>:
              o <strong className="text-white">Volume de Totens</strong> (camada de capacidade física) e o
              <strong className="text-white"> Ciclo de Cobrança</strong> (camada de periodicidade financeira) são
              parâmetros contratuais distintos e livremente combináveis.
            </p>
            <p>
              <strong className="text-gold-300">4.1. Volume de Totens (Camada de Capacidade):</strong> A empresa contratante
              escolhe uma das quatro faixas de capacidade — <em>Bronze</em> (1 totem), <em>Prata</em> (3 totens),
              <em>Ouro</em> (5 totens) ou <em>Black</em> (10 totens). O limite de totens ativos é rigorosamente
              aplicado pela plataforma por meio de <strong className="text-white">gatilhos de hardware</strong> e
              <strong className="text-white"> bloqueios automáticos de implantação</strong>, impedindo o cadastro
              ou ativação de novas telas além do limite contratado, independentemente do ciclo de pagamento escolhido.
            </p>
            <p>
              <strong className="text-gold-300">4.2. Ciclo de Cobrança (Camada de Periodicidade):</strong> A empresa
              escolhe um dos quatro ciclos de faturamento — <em>Mensal</em> (preço base, sem desconto),
              <em>Trimestral</em> (3 meses, 5% de desconto), <em>Semestral</em> (6 meses, 10% de desconto) ou
              <em>Anual</em> (12 meses, 20% de desconto). O desconto é aplicado sobre o valor total do período
              (preço-base mensal multiplicado pelo número de meses).
            </p>
            <p>
              <strong className="text-gold-300">4.3. Combinação Livre:</strong> Qualquer Volume de Totens pode ser
              combinado com qualquer Ciclo de Cobrança. Por exemplo, uma empresa pode contratar 1 totem no ciclo
              Anual, ou 10 totens no ciclo Mensal. A escolha de um parâmetro não restringe o outro.
            </p>
            <p>
              <strong className="text-gold-300">4.4. Cálculo do Valor Final:</strong> O valor cobrado é calculado pela
              fórmula: <em>Preço Final = (Preço-base mensal do tier × Número de meses do ciclo) − Desconto percentual
              do período − Desconto personalizado do SuperAdmin</em>. O valor original (sem desconto) é exibido com
              tarja, e o valor final com desconto é exibido em destaque, sendo este último o valor serializado para
              o motor de pagamento Asaas.
            </p>
            <p>
              <strong className="text-gold-300">4.5. Independência Contratual:</strong> O limite de capacidade de
              totens e o ciclo de cobrança operam como parâmetros contratuais separados sob as regras da plataforma
              Veloov Mobilidade. O vencimento da licença (determinado pelo ciclo de pagamento) bloqueia todos os
              totens até a regularização, independentemente do volume contratado. O volume de totens determina
              quantos dispositivos podem ser ativados, independentemente do ciclo de pagamento vigente.
            </p>
            <p>
              O SuperAdmin da Veloov Mobilidade pode estender datas de expiração de licença, aplicar descontos
              customizados percentuais sobre o valor final, e suspender acesso a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">5. Da Privacidade e LGPD</h2>
            <p>
              O tratamento de dados pessoais está descrito em detalhes na nossa Política de Privacidade. A Veloov
              Mobilidade atua como Operadora (Sub-processadora) dos dados, e cada empresa Tenant atua como
              Controladora, nos termos da Lei nº 13.709/2018 (LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">6. Disposições Finais</h2>
            <p>
              Estes Termos de Uso podem ser atualizados a qualquer tempo. A continuidade de uso da plataforma após
              alterações constitui aceitação tácita dos termos revisados. Eventuais controvérsias serão dirimidas
              no foro da comarca da sede da Veloov Mobilidade.
            </p>
            <p className="text-xs text-slate-500 mt-4">
              Veloov Negocios e Servicos LTDA · CNPJ 68.559.312/0001-73
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
