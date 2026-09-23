import { useState, useEffect } from 'react';
import { Plug, Save, Loader2, CheckCircle2, AlertCircle, Hand, Cpu, Webhook, BookOpen, ChevronDown, ExternalLink, Key, MapPin, User, Shield, Zap, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import type { CompanySettings, CompanyCredentials, IntegrationMode } from '@/types';

const MODES: { value: IntegrationMode; label: string; description: string; icon: typeof Hand }[] = [
  { value: 'manual', label: 'Dispatch Manual', description: 'Sem software externo. Painel interno para designar motoristas.', icon: Hand },
  { value: 'machine', label: 'Machine API', description: 'Integração direta com a plataforma Machine (taximachine.com.br).', icon: Cpu },
  { value: 'webhook', label: 'Webhook Customizado', description: 'Gateway genérico para qualquer provedor (Gaudium, TaxiMachine, etc).', icon: Webhook },
];

const SIMULATION_NOTE = 'Ative o modo simulação para testar o fluxo sem enviar requisições reais. Retorna um mock de corrida criada.';

export function IntegrationPanel() {
  const { company } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [credentials, setCredentials] = useState<CompanyCredentials | null>(null);
  const [mode, setMode] = useState<IntegrationMode>('manual');
  const [machineUrl, setMachineUrl] = useState('https://api.taximachine.com.br');
  const [machineKey, setMachineKey] = useState('');
  const [taximetroUser, setTaximetroUser] = useState('');
  const [taximetroPass, setTaximetroPass] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookHeaders, setWebhookHeaders] = useState('{}');
  const [webhookTemplate, setWebhookTemplate] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [requirePrice, setRequirePrice] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data: sett } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (sett) {
        setSettings(sett as CompanySettings);
        setMode((sett as CompanySettings).integration_mode ?? 'manual');
        setSimulationMode((sett as CompanySettings).simulation_mode ?? false);
        setRequirePrice((sett as CompanySettings).require_price_before_dispatch ?? false);
      }

      const { data: cred } = await supabase
        .from('company_credentials')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (cred) {
        setCredentials(cred as CompanyCredentials);
        setMachineUrl(cred.machine_api_url || 'https://api.taximachine.com.br');
        setMachineKey(cred.machine_api_key || '');
        setTaximetroUser(cred.taximetro_username || '');
        setTaximetroPass(cred.taximetro_password || '');
        setWebhookUrl(cred.webhook_url || '');
        setWebhookHeaders(JSON.stringify(cred.webhook_headers ?? {}, null, 2));
        setWebhookTemplate(cred.webhook_payload_template || '');
        setCity(cred.city || '');
        setState(cred.state || '');
        setLat(cred.lat?.toString() || '');
        setLng(cred.lng?.toString() || '');
      }

      setLoading(false);
    })();
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(webhookHeaders);
    } catch {
      setError('Headers do webhook devem ser JSON válido');
      setSaving(false);
      return;
    }

    if (settings) {
      const { error: settErr } = await supabase
        .from('company_settings')
        .update({ integration_mode: mode, simulation_mode: simulationMode, require_price_before_dispatch: requirePrice, updated_at: new Date().toISOString() })
        .eq('company_id', company.id);
      if (settErr) {
        setError('Erro ao salvar modo de integração');
        setSaving(false);
        return;
      }
    } else {
      const { error: settErr } = await supabase
        .from('company_settings')
        .insert({ company_id: company.id, integration_mode: mode, simulation_mode: simulationMode, require_price_before_dispatch: requirePrice });
      if (settErr) {
        setError('Erro ao criar configuração');
        setSaving(false);
        return;
      }
    }

    const credPayload = {
      company_id: company.id,
      machine_api_url: machineUrl,
      machine_api_key: machineKey || null,
      taximetro_username: taximetroUser || null,
      taximetro_password: taximetroPass || null,
      webhook_url: webhookUrl || null,
      webhook_headers: parsedHeaders,
      webhook_payload_template: webhookTemplate || null,
      city: city || null,
      state: state || null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      updated_at: new Date().toISOString(),
    };

    const { error: credErr } = await supabase
      .from('company_credentials')
      .upsert(credPayload, { onConflict: 'company_id' });

    if (credErr) {
      setError('Erro ao salvar credenciais');
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  const labelCls = 'mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300';

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <Plug className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Motor de integração
          </h2>
          <p className="text-sm text-neutral-500">
            Escolha como sua empresa processa e despacha corridas
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`card p-4 w-full text-left transition-all ${
                  active
                    ? 'border-gold-500 ring-2 ring-gold-500/30 bg-gold-500/5'
                    : 'hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    active ? 'bg-gold-500 text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${active ? 'text-gold-700 dark:text-gold-300' : 'text-neutral-900 dark:text-neutral-100'}`}>
                      {m.label}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {m.description}
                    </p>
                  </div>
                  {active && <CheckCircle2 className="h-5 w-5 text-gold-500 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {mode === 'machine' && (
          <div className="card p-5 space-y-4 border-t-2 border-gold-500/20">
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-gold-500" />
              Configuração Machine API
            </h3>
            <div>
              <label className={labelCls}>URL base da API</label>
              <input
                type="url"
                value={machineUrl}
                onChange={(e) => setMachineUrl(e.target.value)}
                placeholder="https://api.taximachine.com.br"
                className="input-field"
              />
            </div>
            <div>
              <label className={labelCls}>API Key</label>
              <input
                type="password"
                value={machineKey}
                onChange={(e) => setMachineKey(e.target.value)}
                placeholder={credentials?.machine_api_key ? '••••••••• (digite para alterar)' : 'Cole sua API key'}
                className="input-field"
              />
            </div>
            <div className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-4 space-y-3">
              <p className="text-xs font-bold text-gold-700 dark:text-gold-300">
                Localização da central
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Busque a cidade da sua central. A cidade, estado e coordenadas são preenchidos automaticamente.
              </p>
              <CityAutocomplete
                value={{ city, state, lat, lng }}
                onChange={(loc) => {
                  setCity(loc.city);
                  setState(loc.state);
                  setLat(loc.lat);
                  setLng(loc.lng);
                }}
              />
            </div>
            <div>
              <label className={labelCls}>Usuário Taxímetro</label>
              <input
                type="text"
                value={taximetroUser}
                onChange={(e) => setTaximetroUser(e.target.value)}
                placeholder={credentials?.taximetro_username ? '•••••• (digite para alterar)' : 'Login do Taxímetro'}
                className="input-field"
              />
            </div>
            <div>
              <label className={labelCls}>Senha Taxímetro</label>
              <input
                type="password"
                value={taximetroPass}
                onChange={(e) => setTaximetroPass(e.target.value)}
                placeholder={credentials?.taximetro_password ? '••••••••• (digite para alterar)' : 'Senha do Taxímetro'}
                className="input-field"
              />
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3">
              <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1.5">Webhook de status (Machine API v2)</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                Configure este URL em sua central Machine para receber atualizacoes de status das corridas em tempo real:
              </p>
              <code className="block text-xs text-gold-700 dark:text-gold-400 bg-white dark:bg-neutral-900 rounded px-3 py-2 border border-neutral-200 dark:border-neutral-700 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/machine` : '/api/webhooks/machine'}
              </code>
            </div>

            <button
              type="button"
              onClick={() => setShowDocs(!showDocs)}
              className="w-full flex items-center justify-between rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-left transition-colors hover:bg-gold-500/10"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-gold-700 dark:text-gold-300">
                <BookOpen className="h-4 w-4" />
                Guia de integracao Machine API v2
              </span>
              <ChevronDown className={`h-4 w-4 text-gold-600 transition-transform ${showDocs ? 'rotate-180' : ''}`} />
            </button>

            {showDocs && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
                <div className="border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-800/50 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">API de Integracao v2</p>
                      <p className="text-xs text-neutral-500">Machine by Gaudium — docs.machine.global</p>
                    </div>
                    <a
                      href="https://docs.machine.global/pages/v2/welcome"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-gold-600 dark:text-gold-400 hover:underline"
                    >
                      Documentacao oficial
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-5 text-sm">
                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      <Shield className="h-4 w-4 text-gold-500 shrink-0" />
                      Autenticacao
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Toda requisicao exige dois cabecalhos de autenticacao. O header <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-gold-600 dark:text-gold-400 font-mono text-[11px]">api-key</code> contem a chave da API da sua central, e o header <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-gold-600 dark:text-gold-400 font-mono text-[11px]">Authorization</code> usa autenticacao Basic com suas credenciais de Taximetro (usuario:senha em Base64).
                    </p>
                    <div className="rounded-lg bg-neutral-900 dark:bg-neutral-950 px-3 py-2.5 overflow-x-auto">
                      <pre className="text-[11px] text-neutral-300 font-mono leading-relaxed">{`api-key: SUA_CHAVE_API
Authorization: Basic base64(USUARIO:SENHA)`}</pre>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Requisicoes sem chave ou com credenciais invalidas retornam <span className="font-semibold text-error-500">400</span> ou <span className="font-semibold text-error-500">403</span>.
                    </p>
                  </section>

                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      <Key className="h-4 w-4 text-gold-500 shrink-0" />
                      Onde obter suas credenciais
                    </h4>
                    <ol className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed list-decimal list-inside">
                      <li>Acesse sua central em <span className="font-semibold">taximachine.com.br</span></li>
                      <li>Va em <span className="font-semibold">Minha equipe &gt; Usuarios &gt; Permissoes</span> e habilite o acesso a Integracao</li>
                      <li>A API Key esta disponivel na secao de Integracao do painel da central</li>
                      <li>O usuario e senha sao os mesmos do login do Taximetro</li>
                    </ol>
                  </section>

                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      <MapPin className="h-4 w-4 text-gold-500 shrink-0" />
                      Ambientes
                    </h4>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Homologacao (Testes)</p>
                        <code className="block text-[11px] text-gold-600 dark:text-gold-400 font-mono mt-1 break-all">https://api-vendas.taximachine.com.br/api/v2/integracao</code>
                        <p className="text-[11px] text-neutral-500 mt-1">Ambiente de testes — acoes sao simuladas.</p>
                      </div>
                      <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 p-3">
                        <p className="text-xs font-bold text-gold-700 dark:text-gold-300">Producao</p>
                        <code className="block text-[11px] text-gold-600 dark:text-gold-400 font-mono mt-1 break-all">https://api.taximachine.com.br/api/v2/integracao</code>
                        <p className="text-[11px] text-neutral-500 mt-1">Operacoes reais e permanentes.</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      <Zap className="h-4 w-4 text-gold-500 shrink-0" />
                      Fluxo de integracao Veloov
                    </h4>
                    <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      <div className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-neutral-900">1</span>
                        <p>Passageiro solicita corrida no totem. Veloov envia para a Machine API via <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-gold-600 dark:text-gold-400 font-mono text-[11px]">POST /corridas</code></p>
                      </div>
                      <div className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-neutral-900">2</span>
                        <p>Motorista aceita na plataforma Machine. A Machine envia webhook de status para Veloov</p>
                      </div>
                      <div className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-neutral-900">3</span>
                        <p>Veloov atualiza o status no totem e notifica o passageiro via WhatsApp com dados do motorista</p>
                      </div>
                      <div className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-neutral-900">4</span>
                        <p>Passageiro pode cancelar respondendo "cancelar" no WhatsApp. Veloov cancela na Machine API</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      <Clock className="h-4 w-4 text-gold-500 shrink-0" />
                      Status e ciclo de vida
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      A Machine API utiliza codigos de status de uma letra. O Veloov traduz automaticamente para o passageiro:
                    </p>
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Codigo</th>
                            <th className="px-3 py-2 text-left font-semibold">Significado</th>
                            <th className="px-3 py-2 text-left font-semibold">Veloov</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                          {[
                            ['A', 'Aceita', 'Motorista a caminho'],
                            ['AP', 'A caminho do ponto', 'Motorista chegou'],
                            ['E', 'Em execucao', 'Viagem em andamento'],
                            ['F', 'Finalizada', 'Viagem concluida'],
                            ['C', 'Cancelada', 'Corrida cancelada'],
                            ['D/G/P/N', 'Aguardando', 'Procurando motorista'],
                          ].map(([code, meaning, veloov]) => (
                            <tr key={code} className="text-neutral-600 dark:text-neutral-400">
                              <td className="px-3 py-2 font-mono font-semibold text-gold-600 dark:text-gold-400">{code}</td>
                              <td className="px-3 py-2">{meaning}</td>
                              <td className="px-3 py-2 text-neutral-500">{veloov}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      <User className="h-4 w-4 text-gold-500 shrink-0" />
                      HATEOAS e navegacao
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      A API v2 usa HATEOAS: cada resposta inclui um objeto <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-gold-600 dark:text-gold-400 font-mono text-[11px]">__links</code> com os endpoints relacionados. O Veloov navega automaticamente por estes links para detalhes da corrida, cancelamento e posicao do motorista.
                    </p>
                  </section>

                  <section className="rounded-lg bg-gold-500/10 border border-gold-500/20 p-3">
                    <p className="text-xs text-gold-700 dark:text-gold-300 font-semibold mb-1">Rate Limit</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      A API aplica limite de requisicoes por janela de 60 segundos, calculado por grupo de endpoints e multiplicado por um fator da central. Exceder o limite retorna <span className="font-semibold text-error-500">429</span>. O Veloov respeita estes limites automaticamente.
                    </p>
                  </section>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'webhook' && (
          <div className="card p-5 space-y-4 border-t-2 border-gold-500/20">
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
              <Webhook className="h-4 w-4 text-gold-500" />
              Configuração Webhook Customizado
            </h3>
            <div>
              <label className={labelCls}>URL do webhook</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.seu-provedor.com/rides"
                className="input-field"
              />
            </div>
            <div>
              <label className={labelCls}>Headers customizados (JSON)</label>
              <textarea
                value={webhookHeaders}
                onChange={(e) => setWebhookHeaders(e.target.value)}
                placeholder='{"Authorization": "Bearer seu-token", "X-Tenant": "empresa"}'
                className="input-field font-mono text-xs"
                rows={3}
              />
              <p className="mt-1 text-xs text-neutral-400">
                Headers HTTP enviados com cada requisição de dispatch.
              </p>
            </div>
            <div>
              <label className={labelCls}>Template do payload (JSON com variáveis)</label>
              <textarea
                value={webhookTemplate}
                onChange={(e) => setWebhookTemplate(e.target.value)}
                placeholder='{"passenger": {"name": "{{passenger_name}}", "phone": "{{passenger_phone}}"}, "origin": "{{origin}}", "destination": "{{destination}}", "price": {{price}}}'
                className="input-field font-mono text-xs"
                rows={5}
              />
              <p className="mt-1 text-xs text-neutral-400">
                Variáveis disponíveis: {'{{passenger_name}}, {{passenger_phone}}, {{origin}}, {{destination}}, {{category}}, {{price}}, {{distance}}, {{ride_id}}'}
              </p>
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div className="card p-5 border-t-2 border-gold-500/20">
            <div className="flex items-start gap-3">
              <Hand className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  Modo Dispatch Manual
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  As corridas dos passageiros aparecem no painel interno "Dispatch".
                  Um operador designa manualmente um motorista da frota cadastrada,
                  e uma notificação por WhatsApp é enviada ao motorista.
                  Nenhuma integração externa é necessária.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-error-500">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-success-600">
            <CheckCircle2 className="h-4 w-4" />
            Configuração salva com sucesso!
          </div>
        )}

        <div className="card p-4 border border-gold-500/20 bg-gold-500/5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={simulationMode}
              onChange={(e) => setSimulationMode(e.target.checked)}
              className="h-5 w-5 rounded accent-gold-500"
            />
            <div>
              <p className="text-sm font-bold text-gold-700 dark:text-gold-300">Modo Simulação</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{SIMULATION_NOTE}</p>
            </div>
          </label>
        </div>

        <div className="card p-4 border border-gold-500/20 bg-gold-500/5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requirePrice}
              onChange={(e) => setRequirePrice(e.target.checked)}
              className="h-5 w-5 rounded accent-gold-500"
            />
            <div>
              <p className="text-sm font-bold text-gold-700 dark:text-gold-300">Exigir cotação antes de solicitar</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Quando ativo, o passageiro não consegue solicitar a corrida se a cotação em tempo real falhar. Desative para permitir corridas com valor a confirmar pelo motorista.</p>
            </div>
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </form>
    </div>
  );
}
