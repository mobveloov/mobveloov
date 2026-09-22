import { Shield, Lock } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div className="animate-slide-up">
      <div className="glass-card rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15">
            <Shield className="h-6 w-6 text-gold-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Política de Privacidade</h1>
            <p className="text-sm text-slate-400">Veloov Mobilidade — LGPD Compliance</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">1. Base Legal e Papel dos Agentes</h2>
            <p>
              Esta Política de Privacidade está em plena conformidade com a Lei Geral de Proteção de Dados
              (LGPD — Lei nº 13.709/2018).
            </p>
            <p>
              A <strong className="text-white">Veloov Mobilidade</strong> atua como <strong>Operadora
              (Sub-processadora)</strong> dos dados pessoais coletados na plataforma. A empresa local (Tenant)
              atua como <strong>Controladora</strong> dos dados, sendo responsável pelas decisões sobre o
              tratamento dos dados de seus passageiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">2. Dados Coletados</h2>
            <p>
              <strong className="text-white">Dados do passageiro:</strong> Nome e Telefone. Estes dados são
              tratados exclusivamente para a execução de solicitações preliminares de transporte, conforme
              autorizado pelo Art. 7, V, da LGPD (execução de contrato ou procedimento preliminar).
            </p>
            <p>
              <strong className="text-white">Identificação do dispositivo (Fingerprint):</strong> A plataforma
              utiliza uma identificação única de hardware (Device UUID) combinando fingerprint de Canvas,
              resolução de tela e tokens de rastreamento local. Esta identificação é utilizada exclusivamente
              para o legítimo interesse de prevenção a fraudes eletrônicas, conforme autorizado pelo Art. 7,
              IX, da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">3. Finalidade do Tratamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Execução de solicitações de transporte pelo passageiro (Art. 7, V, LGPD)</li>
              <li>Prevenção de fraude eletrônica e uso não autorizado de totens (Art. 7, IX, LGPD)</li>
              <li>Notificação de status da corrida ao passageiro via WhatsApp</li>
              <li>Comunicação entre a central de dispatch e motoristas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">4. Compartilhamento de Dados</h2>
            <p>
              Os dados do passageiro (Nome e Telefone) são compartilhados, no momento da solicitação da corrida,
              com a central de transporte da empresa Tenant e, quando configurado, com o provedor de integração
              externa (Machine API, Taxímetro, ou webhook customizado) para processamento do dispatch.
            </p>
            <p>
              A Veloov Mobilidade não compartilha dados com terceiros para fins de marketing ou publicidade.
              As chaves de API e credenciais de integração são armazenadas de forma segura no servidor, nunca
              expostas na interface do passageiro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">5. Segurança dos Dados</h2>
            <p>
              A plataforma adota medidas técnicas e organizacionais para proteger os dados pessoais:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Criptografia em trânsito (HTTPS/TLS)</li>
              <li>Isolamento de dados por empresa via Row Level Security (RLS) no banco de dados</li>
              <li>Cofre de chaves secretas (tenant_secrets) protegido por RLS</li>
              <li>Identificação de dispositivo para prevenção de fraude</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">6. Direitos do Titular</h2>
            <p>
              O passageiro (titular dos dados) possui os direitos garantidos pela LGPD, incluindo: acesso aos
              dados, correção, eliminação, portabilidade e revogação de consentimento. Tais solicitações devem
              ser dirigidas à empresa Tenant (Controladora), que repassará à Veloov Mobilidade quando aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">7. Retenção de Dados</h2>
            <p>
              Os dados de passageiros são retidos pelo período necessário à prestação do serviço e pelo prazo
              legal aplicável. O fingerprint do dispositivo é retido enquanto o totem estiver ativo e vinculado
              ao local, podendo ser removido pelo administrador do Tenant a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gold-300 mb-2">8. Contato</h2>
            <p>
              Para questões relacionadas à privacidade e proteção de dados, entre em contato com a Veloov
              Mobilidade através dos canais oficiais.
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
