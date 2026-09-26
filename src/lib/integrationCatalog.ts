import {
  Map, Navigation, CreditCard, MessageSquare, Bell, ShieldCheck, FileText,
  type LucideIcon,
} from 'lucide-react';

export type IntegrationCategory =
  | 'maps'
  | 'dispatch'
  | 'payments'
  | 'messaging'
  | 'transcription'
  | 'push'
  | 'compliance'
  | 'fiscal';

export interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  required?: boolean;
}

export interface ProviderDef {
  value: string;
  label: string;
  description: string;
  fields: ProviderField[];
  supportsSimulation?: boolean;
}

export interface CategoryDef {
  value: IntegrationCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  providers: ProviderDef[];
}

export const INTEGRATION_CATALOG: CategoryDef[] = [
  {
    value: 'maps',
    label: 'Mapas e Geocodificacao',
    description: 'Busca de enderecos, roteamento e calculo de distancia',
    icon: Map,
    providers: [
      {
        value: 'google_maps',
        label: 'Google Maps Platform',
        description: 'Directions, Geocoding, Places, Distance Matrix',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIza...', required: true },
        ],
      },
      {
        value: 'mapbox',
        label: 'Mapbox',
        description: 'Directions API, Geocoding API',
        fields: [
          { key: 'api_key', label: 'Access Token', type: 'password', placeholder: 'pk.eyJ1...', required: true },
        ],
      },
      {
        value: 'here',
        label: 'HERE Technologies',
        description: 'Geocoding e roteamento',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
        ],
      },
      {
        value: 'osrm',
        label: 'OpenStreetMap + OSRM',
        description: 'Self-hosted, opcao gratuita',
        fields: [
          { key: 'base_url', label: 'URL do servidor OSRM', type: 'url', placeholder: 'http://router.project-osrm.org', required: true },
        ],
      },
    ],
  },
  {
    value: 'dispatch',
    label: 'Dispatch / Motor de Corridas',
    description: 'Plataforma de despacho de motoristas',
    icon: Navigation,
    providers: [
      {
        value: 'machine',
        label: 'Machine API',
        description: 'Integracao direta com taximachine.com.br',
        fields: [
          { key: 'api_url', label: 'URL base da API', type: 'url', placeholder: 'https://api.taximachine.com.br', required: true },
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
          { key: 'taximetro_user', label: 'Usuario Taximetro', type: 'text' },
          { key: 'taximetro_pass', label: 'Senha Taximetro', type: 'password' },
        ],
        supportsSimulation: true,
      },
      {
        value: 'webhook',
        label: 'Webhook Customizado',
        description: 'Gateway generico para qualquer provedor',
        fields: [
          { key: 'webhook_url', label: 'URL do webhook', type: 'url', required: true },
          { key: 'webhook_headers', label: 'Headers (JSON)', type: 'text', placeholder: '{"Authorization": "Bearer ..."}' },
          { key: 'webhook_template', label: 'Template do payload', type: 'text' },
        ],
        supportsSimulation: true,
      },
      {
        value: 'manual',
        label: 'Dispatch Manual Interno',
        description: 'Sem software externo. Painel interno para designar motoristas.',
        fields: [],
        supportsSimulation: true,
      },
    ],
  },
  {
    value: 'payments',
    label: 'Pagamentos e Cobranca',
    description: 'Pagamento de corrida e cobranca de assinaturas',
    icon: CreditCard,
    providers: [
      {
        value: 'stripe',
        label: 'Stripe',
        description: 'Cartao internacional, assinaturas recorrentes',
        fields: [
          { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true },
          { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
        ],
      },
      {
        value: 'asaas',
        label: 'Asaas',
        description: 'Boleto, Pix, cartao — SaaS B2B nacional',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
          { key: 'webhook_token', label: 'Webhook Token', type: 'password' },
        ],
      },
      {
        value: 'pagar_me',
        label: 'Pagar.me',
        description: 'Processador de pagamentos brasileiro',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
        ],
      },
      {
        value: 'mercado_pago',
        label: 'Mercado Pago',
        description: 'Pix, cartao, boleto',
        fields: [
          { key: 'access_token', label: 'Access Token', type: 'password', required: true },
        ],
      },
      {
        value: 'pagseguro',
        label: 'PagSeguro / PagBank',
        description: 'Pix, cartao, boleto',
        fields: [
          { key: 'token', label: 'Token', type: 'password', required: true },
        ],
      },
    ],
  },
  {
    value: 'messaging',
    label: 'Mensageria (WhatsApp/SMS)',
    description: 'Envio de mensagens para passageiros e motoristas',
    icon: MessageSquare,
    providers: [
      {
        value: 'evolution',
        label: 'Evolution API',
        description: 'Servidor self-hosted, instancia unica',
        fields: [
          { key: 'evo_url', label: 'Base URL', type: 'url', placeholder: 'https://suaevolution.com', required: true },
          { key: 'evo_token', label: 'Global Master Token', type: 'password', required: true },
          { key: 'evo_instance', label: 'Nome da Instancia', type: 'text', placeholder: 'veloov' },
        ],
      },
      {
        value: 'meta_cloud',
        label: 'Meta Cloud API',
        description: 'WhatsApp Business oficial (Meta)',
        fields: [
          { key: 'access_token', label: 'Access Token', type: 'password', required: true },
          { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true },
          { key: 'waba_id', label: 'WABA ID', type: 'text' },
        ],
      },
      {
        value: 'twilio',
        label: 'Twilio',
        description: 'WhatsApp + SMS como fallback',
        fields: [
          { key: 'account_sid', label: 'Account SID', type: 'text', required: true },
          { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
          { key: 'from_number', label: 'Numero de origem', type: 'text' },
        ],
      },
      {
        value: 'zenvia',
        label: 'Zenvia',
        description: 'Alternativa nacional para SMS/WhatsApp',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
        ],
      },
    ],
  },
  {
    value: 'transcription',
    label: 'Transcricao de Audio',
    description: 'Converte audio do passageiro em texto (endereco por voz)',
    icon: MessageSquare,
    providers: [
      {
        value: 'groq',
        label: 'Groq',
        description: 'Whisper API de alta velocidade',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'gsk_...', required: true },
        ],
      },
      {
        value: 'openai',
        label: 'OpenAI',
        description: 'Whisper API da OpenAI',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
        ],
      },
    ],
  },
  {
    value: 'push',
    label: 'Notificacoes Push',
    description: 'Notificacoes para apps de motorista/passageiro',
    icon: Bell,
    providers: [
      {
        value: 'fcm',
        label: 'Firebase Cloud Messaging',
        description: 'Push notifications do Google/Android',
        fields: [
          { key: 'server_key', label: 'Server Key', type: 'password', required: true },
        ],
      },
      {
        value: 'onesignal',
        label: 'OneSignal',
        description: 'Plataforma de push multiplataforma',
        fields: [
          { key: 'app_id', label: 'App ID', type: 'text', required: true },
          { key: 'rest_api_key', label: 'REST API Key', type: 'password', required: true },
        ],
      },
    ],
  },
  {
    value: 'compliance',
    label: 'Verificacao de Motoristas',
    description: 'Consulta de CNH e antecedentes',
    icon: ShieldCheck,
    providers: [
      {
        value: 'serpro',
        label: 'Serpro',
        description: 'Consulta oficial de CNH e documentos',
        fields: [
          { key: 'client_id', label: 'Client ID', type: 'text', required: true },
          { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
        ],
      },
      {
        value: 'infosimples',
        label: 'Infosimples',
        description: 'Consulta de antecedentes e documentos',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
        ],
      },
    ],
  },
  {
    value: 'fiscal',
    label: 'Fiscal / Financeiro',
    description: 'Emissao de NF-e/NFS-e e exportacao contabil',
    icon: FileText,
    providers: [
      {
        value: 'focus_nfe',
        label: 'Focus NFe',
        description: 'Emissao de notas fiscais eletronicas',
        fields: [
          { key: 'api_token', label: 'API Token', type: 'password', required: true },
          { key: 'company_token', label: 'Company Token', type: 'password' },
        ],
      },
      {
        value: 'enotas',
        label: 'eNotas',
        description: 'Emissao automatizada de NF-e/NFS-e',
        fields: [
          { key: 'api_key', label: 'API Key', type: 'password', required: true },
        ],
      },
    ],
  },
];

export function getCategoryDef(cat: string): CategoryDef | undefined {
  return INTEGRATION_CATALOG.find((c) => c.value === cat);
}

export function getProviderDef(cat: string, prov: string): ProviderDef | undefined {
  return getCategoryDef(cat)?.providers.find((p) => p.value === prov);
}
