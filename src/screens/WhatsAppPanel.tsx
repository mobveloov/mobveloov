import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, QrCode, Loader2, CheckCircle2, XCircle, RefreshCw, Power, AlertCircle, Server, Cloud, Zap, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { slugify } from '@/lib/utils';
import type { WhatsAppInstance, WhatsAppStatus, WhatsAppProvider } from '@/types';

const PROVIDERS: {
  value: WhatsAppProvider;
  label: string;
  description: string;
  icon: typeof Server;
}[] = [
  { value: 'evolution', label: 'Evolution API', description: 'Auto-hospedada ou cloud. QR code para conectar.', icon: Server },
  { value: 'zapi', label: 'Z-API', description: 'API simples via token. Sem QR code.', icon: Zap },
  { value: 'meta_cloud', label: 'Meta Cloud API', description: 'WhatsApp Business oficial do Facebook/Meta.', icon: Cloud },
  { value: 'veloov', label: 'API Veloov', description: 'Infraestrutura própria Veloov. Sem configuração.', icon: Building2 },
];

export function WhatsAppPanel() {
  const { company } = useAuth();
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [provider, setProvider] = useState<WhatsAppProvider>('evolution');
  const [apiUrl, setApiUrl] = useState('');
  const [globalToken, setGlobalToken] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [providerToken, setProviderToken] = useState('');
  const [providerPhoneId, setProviderPhoneId] = useState('');
  const [providerWabaId, setProviderWabaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInstance = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('company_id', company.id)
      .maybeSingle();

    if (data) {
      const wi = data as WhatsAppInstance;
      setInstance(wi);
      setProvider(wi.whatsapp_provider ?? 'evolution');
      setApiUrl(wi.evolution_api_url || wi.provider_api_url || '');
      setGlobalToken(wi.evolution_global_token || '');
      setInstanceName(wi.instance_name || slugify(company.slug));
      setProviderToken(wi.provider_token || '');
      setProviderPhoneId(wi.provider_phone_id || '');
      setProviderWabaId(wi.provider_waba_id || '');
    } else {
      setInstanceName(slugify(company.slug));
    }
    setLoading(false);
  }, [company]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const clearPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => clearPolling(), []);

  const upsertInstance = async (extra?: Partial<WhatsAppInstance>) => {
    if (!company) return;
    const payload = {
      company_id: company.id,
      whatsapp_provider: provider,
      evolution_api_url: provider === 'evolution' ? apiUrl : null,
      evolution_global_token: provider === 'evolution' ? (globalToken || null) : null,
      instance_name: instanceName,
      provider_api_url: provider === 'zapi' ? apiUrl : null,
      provider_token: provider === 'zapi' || provider === 'meta_cloud' ? (providerToken || null) : null,
      provider_phone_id: provider === 'meta_cloud' ? (providerPhoneId || null) : null,
      provider_waba_id: provider === 'meta_cloud' ? (providerWabaId || null) : null,
      ...extra,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase
      .from('whatsapp_instances')
      .upsert(payload, { onConflict: 'company_id' });
    if (err) throw err;
    await loadInstance();
  };

  const handleSaveProvider = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (provider === 'veloov') {
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setSuccess('API Veloov ativada! As notificações serão enviadas pelo número da Veloov.');
      } else if (provider === 'zapi') {
        if (!apiUrl || !providerToken) {
          setError('Preencha a URL da Z-API e o token.');
          setActionLoading(false);
          return;
        }
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setSuccess('Z-API configurada com sucesso!');
      } else if (provider === 'meta_cloud') {
        if (!providerToken || !providerPhoneId || !providerWabaId) {
          setError('Preencha token, phone ID e WABA ID da Meta Cloud API.');
          setActionLoading(false);
          return;
        }
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setSuccess('Meta Cloud API configurada com sucesso!');
      } else if (provider === 'evolution') {
        if (!apiUrl || !globalToken || !instanceName) {
          setError('Preencha URL, token global e nome da instância.');
          setActionLoading(false);
          return;
        }
        await upsertInstance({ connection_status: 'disconnected' });
        setSuccess('Configuração salva. Clique em "Criar instância e gerar QR" para conectar.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!company || !apiUrl || !globalToken || !instanceName) {
      setError('Preencha URL, token global e nome da instância');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: globalToken,
        },
        body: JSON.stringify({
          instanceName,
          token: globalToken,
          qrcode: true,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Erro ${res.status}: ${body}`);
      }

      const data = await res.json();

      await upsertInstance({
        connection_status: 'connecting',
        qr_code: data?.qrcode?.base64 ?? data?.qrcode ?? null,
      });

      setSuccess('Instância criada! Escaneie o QR code.');
      startPolling();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar instância';
      setError(msg);
      await upsertInstance({ connection_status: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFetchQR = async () => {
    if (!instance || !apiUrl || !globalToken) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: globalToken },
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}`);
      }

      const data = await res.json();

      if (data?.status === 'open' || data?.instance?.status === 'open') {
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setSuccess('WhatsApp conectado!');
        clearPolling();
      } else if (data?.qrcode?.base64 || data?.base64) {
        const qr = data?.qrcode?.base64 ?? data?.base64;
        await upsertInstance({ connection_status: 'connecting', qr_code: qr });
      } else {
        setError('QR code não disponível. Crie a instância primeiro.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar QR';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const startPolling = () => {
    clearPolling();
    pollRef.current = setInterval(async () => {
      if (!instance || !apiUrl || !globalToken) return;

      try {
        const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: globalToken },
        });
        if (!res.ok) return;
        const data = await res.json();

        const state = data?.instance?.state?.toUpperCase() ?? data?.status?.toUpperCase() ?? '';

        if (state === 'OPEN' || state === 'CONNECTED') {
          await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
          setSuccess('WhatsApp conectado!');
          clearPolling();
        }
      } catch {
        // silent polling errors
      }
    }, 5000);
  };

  const handleDisconnect = async () => {
    if (!instance || !apiUrl || !globalToken) return;
    setActionLoading(true);
    try {
      await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: globalToken },
      });
      await upsertInstance({ connection_status: 'disconnected', qr_code: null });
      setSuccess('Desconectado');
    } catch {
      setError('Erro ao desconectar');
    } finally {
      setActionLoading(false);
    }
  };

  const statusDisplay: Record<WhatsAppStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
    connected: { label: 'Conectado', icon: CheckCircle2, cls: 'text-success-600' },
    connecting: { label: 'Conectando...', icon: Loader2, cls: 'text-warning-500' },
    disconnected: { label: 'Desconectado', icon: XCircle, cls: 'text-neutral-400' },
    error: { label: 'Erro', icon: AlertCircle, cls: 'text-error-500' },
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  const status = instance?.connection_status ?? 'disconnected';
  const StatusIcon = statusDisplay[status].icon;
  const labelCls = 'mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-300';

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <MessageCircle className="h-5 w-5 text-gold-600 dark:text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            WhatsApp — Notificações
          </h2>
          <p className="text-sm text-neutral-500">
            Escolha o provedor de WhatsApp para avisar os passageiros
          </p>
        </div>
      </div>

      <div className="card p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${statusDisplay[status].cls} ${status === 'connecting' ? 'animate-spin' : ''}`} />
          <span className={`font-semibold ${statusDisplay[status].cls}`}>
            {statusDisplay[status].label}
          </span>
          <span className="ml-2 text-xs text-neutral-400">
            ({PROVIDERS.find(p => p.value === provider)?.label})
          </span>
        </div>
        {status === 'connected' && provider === 'evolution' && (
          <button
            onClick={handleDisconnect}
            disabled={actionLoading}
            className="flex items-center gap-1.5 text-sm text-error-500 hover:text-error-600"
          >
            <Power className="h-4 w-4" />
            Desconectar
          </button>
        )}
      </div>

      <div className="space-y-3 mb-5">
        {PROVIDERS.map((p) => {
          const Icon = p.icon;
          const active = provider === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setProvider(p.value);
                setError(null);
                setSuccess(null);
              }}
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
                    {p.label}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {p.description}
                  </p>
                </div>
                {active && <CheckCircle2 className="h-5 w-5 text-gold-500 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      {status === 'connected' && provider !== 'evolution' ? (
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success-600" />
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            WhatsApp ativo via {PROVIDERS.find(p => p.value === provider)?.label}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            Notificações automáticas serão enviadas aos passageiros.
          </p>
          <button
            onClick={() => {
              setProvider(provider);
              upsertInstance({ connection_status: 'disconnected' }).catch(() => {});
            }}
            className="mt-4 text-sm text-error-500 hover:text-error-600"
          >
            Trocar provedor
          </button>
        </div>
      ) : provider === 'evolution' && status === 'connected' ? (
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success-600" />
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            WhatsApp ativo via Evolution API
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            Notificações automáticas serão enviadas aos passageiros.
          </p>
        </div>
      ) : (
        <>
          {provider === 'evolution' && instance?.qr_code && (
            <div className="card p-6 mb-4 text-center">
              <h3 className="mb-3 text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5 text-gold-500" />
                Escaneie o QR code
              </h3>
              <img
                src={instance.qr_code.startsWith('data:') ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                alt="WhatsApp QR Code"
                className="mx-auto rounded-xl border border-neutral-200 dark:border-neutral-700 max-w-[260px]"
              />
              <p className="mt-3 text-xs text-neutral-400">
                Abra o WhatsApp {'>'} Configurações {'>'} Aparelhos conectados {'>'} Conectar aparelho
              </p>
              <button
                onClick={handleFetchQR}
                disabled={actionLoading}
                className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-gold-600 dark:text-gold-400 hover:text-gold-700"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar QR
              </button>
            </div>
          )}

          <div className="card p-6 space-y-4">
            {provider === 'evolution' && (
              <>
                <div>
                  <label className={labelCls}>Evolution API URL</label>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.sua-evolution.com"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className={labelCls}>Token global</label>
                  <input
                    type="password"
                    value={globalToken}
                    onChange={(e) => setGlobalToken(e.target.value)}
                    placeholder="Token da Evolution API"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className={labelCls}>Nome da instância</label>
                  <input
                    type="text"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="empresa-exemplo"
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    Identificador único da instância (baseado no slug da empresa)
                  </p>
                </div>
              </>
            )}

            {provider === 'zapi' && (
              <>
                <div>
                  <label className={labelCls}>URL da API Z-API</label>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.z-api.com/instances/SEU-ID"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className={labelCls}>Token da instância</label>
                  <input
                    type="password"
                    value={providerToken}
                    onChange={(e) => setProviderToken(e.target.value)}
                    placeholder="Token de autenticação Z-API"
                    className="input-field"
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  A Z-API não usa QR code. O número é conectado diretamente no painel da Z-API.
                </p>
              </>
            )}

            {provider === 'meta_cloud' && (
              <>
                <div>
                  <label className={labelCls}>Token de acesso (Meta)</label>
                  <input
                    type="password"
                    value={providerToken}
                    onChange={(e) => setProviderToken(e.target.value)}
                    placeholder="EAAxxxxxxxxxxx (token permanente)"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone Number ID</label>
                  <input
                    type="text"
                    value={providerPhoneId}
                    onChange={(e) => setProviderPhoneId(e.target.value)}
                    placeholder="123456789012345"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp Business Account ID (WABA)</label>
                  <input
                    type="text"
                    value={providerWabaId}
                    onChange={(e) => setProviderWabaId(e.target.value)}
                    placeholder="123456789012345"
                    className="input-field"
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  Configure no Facebook Business Manager &gt; WhatsApp Manager. Use um token permanente do sistema.
                </p>
              </>
            )}

            {provider === 'veloov' && (
              <div className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  A API Veloov usa a infraestrutura própria da Veloov para enviar WhatsApp.
                  Não há configuração necessária — as notificações são enviadas automaticamente
                  pelo número da Veloov. Ideal para empresas que não querem gerenciar
                  seu próprio número de WhatsApp Business.
                </p>
                <p className="mt-2 text-xs text-neutral-400">
                  Custo por mensagem pode ser aplicado. Entre em contato com a Veloov para detalhes.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-error-500">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-sm text-success-600">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}

            {provider === 'evolution' && !instance?.qr_code && (
              <button
                onClick={handleCreateInstance}
                disabled={actionLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Power className="h-5 w-5" />}
                Criar instância e gerar QR
              </button>
            )}

            {provider !== 'evolution' && (
              <button
                onClick={handleSaveProvider}
                disabled={actionLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Ativar {PROVIDERS.find(p => p.value === provider)?.label}
              </button>
            )}

            {provider === 'evolution' && instance?.qr_code && (
              <button
                onClick={handleSaveProvider}
                disabled={actionLoading}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                Salvar configuração
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
