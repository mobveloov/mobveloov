import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, QrCode, Loader2, CheckCircle2, XCircle, RefreshCw, Power, AlertCircle, Server, Cloud, Zap, Building2, Bell, Clock, MapPin, TrendingUp, RefreshCcwDot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { slugify } from '@/lib/utils';
import type { WhatsAppInstance, WhatsAppStatus, WhatsAppProvider } from '@/types';

const QR_CODE_TTL_SECONDS = 60;

function normalizeQrCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const qr = value.trim();
  if (!qr) return null;
  if (qr.startsWith('data:image/')) return qr;
  if (qr.startsWith('http://') || qr.startsWith('https://')) return qr;
  if (qr.length < 40) return null;
  return `data:image/png;base64,${qr.replace(/\\s/g, '')}`;
}

function extractQrCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return normalizeQrCode(payload);
  const value = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    value.base64,
    value.qr,
    value.qrcode,
    value.code,
    value.data,
    value.response,
  ];
  for (const candidate of candidates) {
    const qr = extractQrCode(candidate);
    if (qr) return qr;
  }
  return null;
}

function getEvolutionState(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = payload as Record<string, unknown>;
  const nested = value.instance && typeof value.instance === 'object'
    ? value.instance as Record<string, unknown>
    : null;
  return String(
    nested?.state ?? nested?.status ?? value.state ?? value.status ?? value.connectionStatus ?? '',
  ).toUpperCase();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem do QR Code.'));
    reader.readAsDataURL(blob);
  });
}

const PROVIDERS: {
  value: WhatsAppProvider;
  label: string;
  description: string;
  icon: typeof Server;
}[] = [
  { value: 'evolution', label: 'Evolution API', description: 'Auto-hospedada ou cloud. QR code para conectar.', icon: Server },
  { value: 'zapi', label: 'Z-API', description: 'API simples via token. Sem QR code.', icon: Zap },
  { value: 'zpro', label: 'Z-Pro', description: 'API Z-Pro via token. Sem QR code.', icon: Zap },
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
  const [planFeatures, setPlanFeatures] = useState<{ plan_name: string; send_driver_info: boolean; send_eta: boolean; distance_update_interval_min: number } | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrImageError, setQrImageError] = useState(false);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef({ apiUrl: '', globalToken: '', instanceName: '' });
  const qrRefreshRef = useRef(false);

  const loadInstance = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('company_id', company.id)
      .maybeSingle();

    if (data) {
      const wi = data as WhatsAppInstance;
      const storedInstanceName = wi.instance_name || slugify(company.slug);
      const storedApiUrl = (wi.evolution_api_url || wi.provider_api_url || '').replace(/\/+$/, '');
      const storedToken = wi.evolution_global_token || '';
      const isStoredConnected = wi.connection_status === 'connected';
      const safeInstance = isStoredConnected ? { ...wi, qr_code: null } : { ...wi, qr_code: normalizeQrCode(wi.qr_code) };
      setInstance(safeInstance);
      setProvider(wi.whatsapp_provider ?? 'evolution');
      setApiUrl(storedApiUrl);
      setGlobalToken(storedToken);
      setInstanceName(storedInstanceName);
      setProviderToken(wi.provider_token || '');
      setProviderPhoneId(wi.provider_phone_id || '');
      setProviderWabaId(wi.provider_waba_id || '');
      configRef.current = { apiUrl: storedApiUrl, globalToken: storedToken, instanceName: storedInstanceName };
      if (isStoredConnected && wi.qr_code) {
        await supabase.from('whatsapp_instances').update({ qr_code: null }).eq('id', wi.id);
      }
    } else {
      const defaultInstanceName = slugify(company.slug);
      setInstanceName(defaultInstanceName);
      configRef.current = { apiUrl: '', globalToken: '', instanceName: defaultInstanceName };
    }
    setLoading(false);

    // Load plan notification features + message count
    if (company.plan_id) {
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('name')
        .eq('id', company.plan_id)
        .maybeSingle();

      const { data: features } = await supabase
        .from('plan_notification_features')
        .select('send_driver_info, send_eta, distance_update_interval_min')
        .eq('plan_id', company.plan_id)
        .maybeSingle();

      if (plan && features) {
        setPlanFeatures({
          plan_name: plan.name,
          send_driver_info: features.send_driver_info,
          send_eta: features.send_eta,
          distance_update_interval_min: features.distance_update_interval_min,
        });
      } else if (plan) {
        setPlanFeatures({
          plan_name: plan.name,
          send_driver_info: true,
          send_eta: false,
          distance_update_interval_min: 0,
        });
      }
    }

    // Current month message count
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { count } = await supabase
      .from('whatsapp_message_log')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('billing_month', currentMonth);
    setMessageCount(count ?? 0);
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

  useEffect(() => {
    if (!qrExpiresAt) {
      setQrSecondsRemaining(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((qrExpiresAt - Date.now()) / 1000));
      setQrSecondsRemaining(remaining);
      if (remaining === 0) {
        setQrExpiresAt(null);
        setQrError('Este QR Code expirou. Gerando um novo código...');
        if (!qrRefreshRef.current) void handleFetchQR();
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [qrExpiresAt]);

  const upsertInstance = async (extra?: Partial<WhatsAppInstance>) => {
    if (!company) return;
    const cleanApiUrl = apiUrl.trim().replace(/\/+$/, '');
    const payload = {
      company_id: company.id,
      whatsapp_provider: provider,
      evolution_api_url: provider === 'evolution' ? cleanApiUrl : null,
      evolution_global_token: provider === 'evolution' ? (globalToken || null) : null,
      instance_name: instanceName,
      provider_api_url: provider === 'zapi' || provider === 'zpro' ? cleanApiUrl : null,
      provider_token: provider === 'zapi' || provider === 'zpro' || provider === 'meta_cloud' ? (providerToken || null) : null,
      provider_phone_id: provider === 'meta_cloud' ? (providerPhoneId || null) : null,
      provider_waba_id: provider === 'zapi' || provider === 'zpro' || provider === 'meta_cloud' ? (providerWabaId || null) : null,
      ...extra,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase
      .from('whatsapp_instances')
      .upsert(payload, { onConflict: 'company_id' });
    if (err) throw err;
    configRef.current = { apiUrl: cleanApiUrl, globalToken, instanceName };
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
          setError('Preencha a URL da Z-API e o token da instância.');
          setActionLoading(false);
          return;
        }
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setSuccess('Z-API configurada com sucesso!');
      } else if (provider === 'zpro') {
        if (!apiUrl || !providerToken) {
          setError('Preencha a URL da Z-Pro e o token da instância.');
          setActionLoading(false);
          return;
        }
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setSuccess('Z-Pro configurada com sucesso!');
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
    const config = { apiUrl: apiUrl.trim().replace(/\/+$/, ''), globalToken: globalToken.trim(), instanceName: instanceName.trim() };
    if (!company || !config.apiUrl || !config.globalToken || !config.instanceName) {
      setError('Preencha a URL da Evolution API, o token global e o nome da instância.');
      return;
    }
    configRef.current = config;
    setActionLoading(true);
    setError(null);
    setQrError(null);
    setSuccess(null);

    try {
      const res = await fetchWithTimeout(`${config.apiUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.globalToken },
        body: JSON.stringify({ instanceName: config.instanceName, token: config.globalToken, qrcode: true }),
      });
      if (!res.ok) throw new Error(`Servidor Evolution API respondeu ${res.status}.`);
      const data: unknown = await res.json();
      const state = getEvolutionState(data);
      const qr = extractQrCode(data);

      // Auto-configure webhook on Evolution API so events flow without manual setup
      if (company) {
        try {
          await supabase.functions.invoke('configure-whatsapp-webhook', {
            body: { apiUrl: config.apiUrl, globalToken: config.globalToken, instanceName: config.instanceName, companyId: company.id, isBot: false },
          });
        } catch { /* best-effort */ }
      }

      if (state === 'OPEN' || state === 'CONNECTED') {
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setQrExpiresAt(null);
        setSuccess('WhatsApp já está conectado. Webhook configurado automaticamente.');
        clearPolling();
      } else if (qr) {
        await upsertInstance({ connection_status: 'connecting', qr_code: qr });
        setInstance(previous => previous ? { ...previous, connection_status: 'connecting', qr_code: qr } : previous);
        setQrExpiresAt(Date.now() + QR_CODE_TTL_SECONDS * 1000);
        setSuccess('Instância criada. Escaneie o QR Code antes que ele expire.');
        startPolling();
      } else {
        throw new Error('A Evolution API criou a instância, mas não retornou um QR Code válido.');
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'Tempo limite excedido ao conectar com a Evolution API.'
        : err instanceof Error ? err.message : 'Não foi possível gerar o QR Code.';
      setError(`${message} Verifique a URL e o Global Master Token.`);
      setQrError('Não foi possível gerar o QR Code. Verifique a conexão com o servidor Evolution API.');
      await upsertInstance({ connection_status: 'error', qr_code: null }).catch(() => {});
    } finally {
      setActionLoading(false);
    }
  };

  const handleFetchQR = async () => {
    const config = configRef.current;
    if (!config.apiUrl || !config.globalToken || !config.instanceName || qrRefreshRef.current) {
      if (!config.apiUrl || !config.globalToken || !config.instanceName) {
        setQrError('Preencha a URL, o Global Master Token e o nome da instância.');
      }
      return;
    }
    qrRefreshRef.current = true;
    setActionLoading(true);
    setError(null);
    setQrError(null);

    try {
      const headers = { apikey: config.globalToken, Accept: 'application/json, image/png, image/jpeg' };
      let res = await fetchWithTimeout(`${config.apiUrl}/instance/connect/${encodeURIComponent(config.instanceName)}`, { headers });
      if (res.status === 404 || res.status === 405) {
        res = await fetchWithTimeout(`${config.apiUrl}/instance/qrcode/${encodeURIComponent(config.instanceName)}`, { headers });
      }
      if (!res.ok) throw new Error(`Servidor Evolution API respondeu ${res.status}.`);

      const contentType = res.headers.get('content-type') || '';
      let qr: string | null = null;
      let state = '';
      if (contentType.startsWith('image/')) {
        const blob = await res.blob();
        qr = await blobToDataUrl(blob);
      } else if (contentType.includes('json')) {
        const data: unknown = await res.json();
        state = getEvolutionState(data);
        qr = extractQrCode(data);
      } else {
        qr = extractQrCode(await res.text());
      }

      if (state === 'OPEN' || state === 'CONNECTED') {
        await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
        setQrExpiresAt(null);
        setSuccess('WhatsApp conectado!');
        clearPolling();
      } else if (qr) {
        await upsertInstance({ connection_status: 'connecting', qr_code: qr });
        setInstance(previous => previous ? { ...previous, connection_status: 'connecting', qr_code: qr } : previous);
        setQrExpiresAt(Date.now() + QR_CODE_TTL_SECONDS * 1000);
        setQrImageError(false);
        setQrError(null);
        startPolling();
      } else {
        throw new Error('A resposta não contém base64 nem imagem de QR Code.');
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'Tempo limite excedido ao conectar com a Evolution API.'
        : err instanceof Error ? err.message : 'Erro desconhecido ao buscar o QR Code.';
      setQrError('Não foi possível gerar o QR Code. Verifique a conexão com o servidor Evolution API.');
      setError(`${message} Verifique a URL e o Global Master Token.`);
    } finally {
      qrRefreshRef.current = false;
      setActionLoading(false);
    }
  };

  const startPolling = () => {
    clearPolling();
    pollRef.current = setInterval(async () => {
      const config = configRef.current;
      if (!config.apiUrl || !config.globalToken || !config.instanceName) return;
      try {
        const res = await fetchWithTimeout(`${config.apiUrl}/instance/connectionState/${encodeURIComponent(config.instanceName)}`, {
          headers: { apikey: config.globalToken, Accept: 'application/json' },
        }, 10000);
        if (!res.ok) return;
        const data: unknown = await res.json();
        const state = getEvolutionState(data);
        if (state === 'OPEN' || state === 'CONNECTED') {
          await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
          setQrExpiresAt(null);
          setSuccess('WhatsApp conectado!');
          clearPolling();
        }
      } catch {
        // A transient polling failure should not replace the QR code with a broken image.
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

  const handleReconnect = async () => {
    if (!company || !apiUrl || !globalToken || !instanceName) {
      setError('Preencha a URL, token e nome da instância antes de reconectar.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Reconfigure webhook on the Evolution API instance
      const { error: cfgError } = await supabase.functions.invoke('configure-whatsapp-webhook', {
        body: { apiUrl: apiUrl.trim().replace(/\/+$/, ''), globalToken: globalToken.trim(), instanceName: instanceName.trim(), companyId: company.id, isBot: false },
      });
      if (cfgError) throw new Error('Não foi possível reconfigurar o webhook.');

      // Check live status and fetch QR if needed
      const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
      try {
        const res = await fetchWithTimeout(`${cleanUrl}/instance/connect/${encodeURIComponent(instanceName.trim())}`, {
          headers: { apikey: globalToken.trim(), Accept: 'application/json' },
        });
        if (res.ok) {
          const data: unknown = await res.json();
          const state = getEvolutionState(data);
          const qr = extractQrCode(data);
          if (state === 'OPEN' || state === 'CONNECTED') {
            await upsertInstance({ connection_status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() });
            setSuccess('Instância reconectada e webhook reconfigurado com sucesso!');
            clearPolling();
          } else if (qr) {
            await upsertInstance({ connection_status: 'connecting', qr_code: qr });
            setInstance(previous => previous ? { ...previous, connection_status: 'connecting', qr_code: qr } : previous);
            setQrExpiresAt(Date.now() + QR_CODE_TTL_SECONDS * 1000);
            setSuccess('Webhook reconfigurado. Escaneie o QR Code para conectar.');
            startPolling();
          } else {
            setSuccess('Webhook reconfigurado. A instância precisa ser reconectada via QR Code — clique em "Criar instância e gerar QR".');
          }
        } else {
          setSuccess('Webhook reconfigurado. A instância precisa ser reconectada via QR Code — clique em "Criar instância e gerar QR".');
        }
      } catch {
        setSuccess('Webhook reconfigurado. A instância precisa ser reconectada via QR Code — clique em "Criar instância e gerar QR".');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reconectar');
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
        <div className="flex items-center gap-3">
          {provider === 'evolution' && (
            <button
              onClick={handleReconnect}
              disabled={actionLoading}
              className="flex items-center gap-1.5 text-sm text-gold-600 dark:text-gold-400 hover:text-gold-700 dark:hover:text-gold-300"
              title="Reconfigurar webhook e reconectar a instância"
            >
              <RefreshCcwDot className="h-4 w-4" />
              Reconectar
            </button>
          )}
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
      </div>

      {/* Plan Notification Rules */}
      {planFeatures && (
        <div className="card p-5 mb-4 border-gold-500/20 bg-gold-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-gold-600 dark:text-gold-400" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Regras de Notificação do seu Plano
            </h3>
            <span className="ml-auto text-xs font-semibold text-gold-600 dark:text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded-full">
              {planFeatures.plan_name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${planFeatures.send_driver_info ? 'bg-success-500/15 text-success-600' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Dados do Motorista</p>
                <p className="text-xs text-neutral-500">{planFeatures.send_driver_info ? 'Nome, carro e placa' : 'Não incluído'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${planFeatures.send_eta ? 'bg-success-500/15 text-success-600' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Tempo Estimado</p>
                <p className="text-xs text-neutral-500">{planFeatures.send_eta ? 'Incluído na mensagem' : 'Não incluído'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${planFeatures.distance_update_interval_min > 0 ? 'bg-success-500/15 text-success-600' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Atualização de Distância</p>
                <p className="text-xs text-neutral-500">
                  {planFeatures.distance_update_interval_min > 0
                    ? `A cada ${planFeatures.distance_update_interval_min} min`
                    : 'Não incluído'}
                </p>
              </div>
            </div>
          </div>

          {/* Upgrade incentive */}
          {planFeatures.distance_update_interval_min === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-gold-500/10 px-3 py-2 mt-2">
              <TrendingUp className="h-4 w-4 text-gold-600 dark:text-gold-400 shrink-0" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {planFeatures.send_eta
                  ? 'Seu plano não envia atualizações de distância durante a corrida. Faça upgrade para o plano Ouro e receba atualizações a cada 5 minutos.'
                  : 'Seu plano envia apenas os dados básicos do motorista. Faça upgrade para o plano Prata para incluir tempo estimado de chegada, ou para Ouro/Black para receber atualizações de distância em tempo real.'}
              </p>
            </div>
          )}
          {planFeatures.distance_update_interval_min === 5 && (
            <div className="flex items-center gap-2 rounded-lg bg-gold-500/10 px-3 py-2 mt-2">
              <TrendingUp className="h-4 w-4 text-gold-600 dark:text-gold-400 shrink-0" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Seu plano Ouro envia atualizações a cada 5 minutos. Faça upgrade para o plano Black e receba atualizações a cada 2 minutos.
              </p>
            </div>
          )}

          {/* Monthly message counter */}
          <div className="mt-3 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-3">
            <span className="text-xs text-neutral-500">Mensagens enviadas este mês</span>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{messageCount}</span>
          </div>
        </div>
      )}

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
          {provider === 'evolution' && status === 'connecting' && (
            <div className="card p-6 mb-4 text-center">
              <h3 className="mb-3 text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5 text-gold-500" />
                Escaneie o QR Code
              </h3>

              {qrError ? (
                <div className="mx-auto max-w-[260px] space-y-3">
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-error-500/30 bg-error-500/5 p-6">
                    <AlertCircle className="h-10 w-10 text-error-500" />
                    <p className="text-sm text-error-600 dark:text-error-400">{qrError}</p>
                  </div>
                  <button
                    onClick={handleFetchQR}
                    disabled={actionLoading}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Tentar novamente
                  </button>
                </div>
              ) : instance?.qr_code && !qrImageError ? (
                <div className="relative mx-auto inline-block">
                  <img
                    src={instance.qr_code.startsWith('data:') || instance.qr_code.startsWith('blob:') ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                    alt="WhatsApp QR Code"
                    onError={() => setQrImageError(true)}
                    className="mx-auto rounded-xl border border-neutral-200 dark:border-neutral-700 max-w-[260px]"
                  />
                  {qrSecondsRemaining > 0 && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Expira em {qrSecondsRemaining}s</span>
                    </div>
                  )}
                  {qrSecondsRemaining === 0 && qrExpiresAt === null && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Gerando novo QR Code...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mx-auto max-w-[260px] space-y-3">
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                    <QrCode className="h-10 w-10 text-neutral-400" />
                    <p className="text-sm text-neutral-500">
                      {qrImageError ? 'Não foi possível exibir a imagem do QR Code.' : 'Aguardando geração do QR Code...'}
                    </p>
                  </div>
                  <button
                    onClick={handleFetchQR}
                    disabled={actionLoading}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Gerar QR Code
                  </button>
                </div>
              )}

              {!qrError && instance?.qr_code && !qrImageError && (
                <>
                  <p className="mt-3 text-xs text-neutral-400">
                    Abra o WhatsApp {'>'} Configurações {'>'} Aparelhos conectados {'>'} Conectar aparelho
                  </p>
                  <button
                    onClick={handleFetchQR}
                    disabled={actionLoading}
                    className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-gold-600 dark:text-gold-400 hover:text-gold-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Gerar novo QR Code
                  </button>
                </>
              )}
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

            {(provider === 'zapi' || provider === 'zpro') && (
              <>
                <div>
                  <label className={labelCls}>{provider === 'zapi' ? 'URL da API Z-API' : 'URL da API Z-Pro'}</label>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder={provider === 'zapi' ? 'https://api.z-api.com/instances/SEU-ID' : 'https://api.zpro.com/instances/SEU-ID'}
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    Use a URL completa da instância (ex: https://api.z-api.com/instances/SEU-ID)
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Token da instância</label>
                  <input
                    type="password"
                    value={providerToken}
                    onChange={(e) => setProviderToken(e.target.value)}
                    placeholder="Token da instância"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className={labelCls}>Client-Token (opcional)</label>
                  <input
                    type="password"
                    value={providerWabaId}
                    onChange={(e) => setProviderWabaId(e.target.value)}
                    placeholder="Client-Token do painel Z-API/Z-Pro"
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    Encontrado no painel da Z-API/Z-Pro. Necessário para algumas contas.
                  </p>
                </div>
                <p className="text-xs text-neutral-400">
                  {provider === 'zapi' ? 'A Z-API' : 'A Z-Pro'} não usa QR code. O número é conectado diretamente no painel.
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

            {provider === 'evolution' && status !== 'connected' && status !== 'connecting' && (
              <button
                onClick={handleCreateInstance}
                disabled={actionLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Power className="h-5 w-5" />}
                Criar instância e gerar QR
              </button>
            )}

            {provider === 'veloov' && status !== 'connected' && (
              <button
                onClick={handleSaveProvider}
                disabled={actionLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Ativar API Veloov
              </button>
            )}

            {provider !== 'evolution' && provider !== 'veloov' && (
              <button
                onClick={handleSaveProvider}
                disabled={actionLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Ativar {PROVIDERS.find(p => p.value === provider)?.label}
              </button>
            )}

            {provider === 'evolution' && status === 'connecting' && (
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
