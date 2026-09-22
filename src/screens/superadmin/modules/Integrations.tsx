import { useState, useEffect, useCallback } from 'react';
import { Settings2, Save, QrCode, RefreshCw, Loader2, AlertCircle, CheckCircle2, Link2, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { inputCls, labelCls, btnGold } from '../shared';
import type { ModuleProps } from '../Layout';

type Provider = 'evolution' | 'zapi' | 'zpro' | 'meta_cloud' | 'custom_webhook';

interface WhatsAppConfig {
  provider: Provider;
  fields: Record<string, string>;
}

const PROVIDERS: { value: Provider; label: string; description: string }[] = [
  { value: 'evolution', label: 'Evolution API', description: 'Servidor self-hosted, instância única' },
  { value: 'zapi', label: 'Z-API', description: 'Plataforma Z-API (z-api.com)' },
  { value: 'zpro', label: 'Z-PRO', description: 'Plataforma Z-PRO' },
  { value: 'meta_cloud', label: 'Meta Cloud API', description: 'WhatsApp Business oficial (Meta)' },
  { value: 'custom_webhook', label: 'Webhook Customizado', description: 'Qualquer endpoint que receba JSON' },
];

export function IntegrationsModule({ success, error: toastError }: ModuleProps) {
  const [config, setConfig] = useState<WhatsAppConfig>({ provider: 'evolution', fields: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_settings')
      .select('key_value')
      .eq('key_name', 'GLOBAL_WHATSAPP_CONFIG')
      .maybeSingle();

    if (error) {
      setSaveError('Erro ao carregar configuração: ' + error.message);
    } else if (data?.key_value) {
      try {
        const parsed = JSON.parse(data.key_value) as WhatsAppConfig;
        setConfig({
          provider: parsed.provider ?? 'evolution',
          fields: parsed.fields ?? {},
        });
      } catch {
        setConfig({ provider: 'evolution', fields: {} });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateField = (key: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const payload = JSON.stringify({
      provider: config.provider,
      fields: config.fields,
    });

    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .eq('key_name', 'GLOBAL_WHATSAPP_CONFIG')
      .maybeSingle();

    let dbError;
    if (existing) {
      const res = await supabase
        .from('system_settings')
        .update({ key_value: payload, updated_at: new Date().toISOString() })
        .eq('key_name', 'GLOBAL_WHATSAPP_CONFIG');
      dbError = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert({ key_name: 'GLOBAL_WHATSAPP_CONFIG', key_value: payload });
      dbError = res.error;
    }

    setSaving(false);

    if (dbError) {
      setSaveError('Erro ao salvar: ' + dbError.message);
      toastError?.('Erro ao salvar configuração');
    } else {
      success('Configuração de integração salva com sucesso!');
    }
  };

  const generateQR = async () => {
    setQrLoading(true);
    setQrError(null);
    setQrData(null);
    setConnected(false);

    if (config.provider === 'evolution') {
      const url = config.fields.evo_url ?? '';
      const token = config.fields.evo_token ?? '';
      if (!url || !token) {
        setQrError('Configure a URL e o token da Evolution API antes de gerar o QR Code.');
        setQrLoading(false);
        return;
      }

      const instance = config.fields.evo_instance || 'veloov';
      try {
        const resp = await fetch(`${url}/instance/connect/${instance}`, {
          method: 'GET',
          headers: { apikey: token },
        });

        if (!resp.ok) {
          const body = await resp.text();
          setQrError(`Falha ao conectar (${resp.status}): ${body.slice(0, 200)}`);
          setQrLoading(false);
          return;
        }

        const data = await resp.json();
        const qr = data?.base64?.replace(/^data:image\/[a-z]+;base64,/, '')
          ?? data?.qrcode?.base64
          ?? data?.code
          ?? null;

        if (qr && qr.length > 100) {
          setQrData(qr);
        } else if (data?.status === 'CONNECTED' || data?.instance?.state === 'open') {
          setConnected(true);
        } else {
          setQrError('Resposta da Evolution não contém QR Code. Verifique se a instância existe.');
        }
      } catch (err) {
        setQrError('Erro de conexão: ' + (err instanceof Error ? err.message : 'desconhecido'));
      }
      setQrLoading(false);
    } else if (config.provider === 'zapi' || config.provider === 'zpro') {
      const url = config.fields[`${config.provider === 'zapi' ? 'zapi' : 'zpro'}_url`] ?? '';
      const instanceId = config.fields[`${config.provider === 'zapi' ? 'zapi' : 'zpro'}_instance_id`] ?? '';
      const instanceToken = config.fields[`${config.provider === 'zapi' ? 'zapi' : 'zpro'}_instance_token`] ?? '';
      if (!url || !instanceId || !instanceToken) {
        setQrError('Configure URL, Instance ID e Instance Token antes de gerar o QR Code.');
        setQrLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${url}/instances/${instanceId}/token/${instanceToken}/qr-code`, {
          method: 'GET',
        });
        if (!resp.ok) {
          setQrError(`Falha ao obter QR (${resp.status})`);
          setQrLoading(false);
          return;
        }
        const data = await resp.json();
        const qr = data?.qrcode?.base64 ?? data?.base64 ?? data?.qr ?? null;
        if (qr && qr.length > 100) {
          setQrData(qr.replace(/^data:image\/[a-z]+;base64,/, ''));
        } else {
          setQrError('Resposta não contém QR Code válido.');
        }
      } catch (err) {
        setQrError('Erro de conexão: ' + (err instanceof Error ? err.message : 'desconhecido'));
      }
      setQrLoading(false);
    } else {
      setQrError('QR Code não disponível para este provedor. Conecte manualmente conforme a documentação.');
      setQrLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  const p = config.provider;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-[#D4AF37]">
          <Settings2 className="w-4 h-4" /> Roteamento Global do Gateway de Mensagens
        </h3>
        <p className="text-[11px] text-slate-500">
          Esta configuração é global e se aplica a todas as empresas. O motor de dispatch usa estes dados para enviar notificações por WhatsApp aos passageiros e motoristas.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelCls}>Provedor Ativo</label>
            <select
              value={p}
              onChange={(e) => setConfig((prev) => ({ ...prev, provider: e.target.value as Provider }))}
              className={inputCls}
            >
              {PROVIDERS.map((prov) => (
                <option key={prov.value} value={prov.value}>{prov.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              {PROVIDERS.find((pr) => pr.value === p)?.description}
            </p>
          </div>

          {p === 'evolution' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Evolution Base URL</label>
                <input className={inputCls} value={config.fields.evo_url ?? ''} onChange={(e) => updateField('evo_url', e.target.value)} placeholder="https://suaevolution.com" />
              </div>
              <div>
                <label className={labelCls}>Global Master Token</label>
                <input type="password" className={inputCls} value={config.fields.evo_token ?? ''} onChange={(e) => updateField('evo_token', e.target.value)} placeholder="Token de acesso global" />
              </div>
              <div>
                <label className={labelCls}>Nome da Instância</label>
                <input className={inputCls} value={config.fields.evo_instance ?? ''} onChange={(e) => updateField('evo_instance', e.target.value)} placeholder="veloov" />
              </div>
            </div>
          )}

          {p === 'zapi' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Z-API Base URL</label>
                <input className={inputCls} value={config.fields.zapi_url ?? ''} onChange={(e) => updateField('zapi_url', e.target.value)} placeholder="https://api.z-api.com" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Instance ID</label>
                  <input className={inputCls} value={config.fields.zapi_instance_id ?? ''} onChange={(e) => updateField('zapi_instance_id', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Instance Token</label>
                  <input type="password" className={inputCls} value={config.fields.zapi_instance_token ?? ''} onChange={(e) => updateField('zapi_instance_token', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Client Token (opcional)</label>
                <input type="password" className={inputCls} value={config.fields.zapi_client_token ?? ''} onChange={(e) => updateField('zapi_client_token', e.target.value)} />
              </div>
            </div>
          )}

          {p === 'zpro' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Z-PRO Base URL</label>
                <input className={inputCls} value={config.fields.zpro_url ?? ''} onChange={(e) => updateField('zpro_url', e.target.value)} placeholder="https://api.zpro.com" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Instance ID</label>
                  <input className={inputCls} value={config.fields.zpro_instance_id ?? ''} onChange={(e) => updateField('zpro_instance_id', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Instance Token</label>
                  <input type="password" className={inputCls} value={config.fields.zpro_instance_token ?? ''} onChange={(e) => updateField('zpro_instance_token', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Client Token (opcional)</label>
                <input type="password" className={inputCls} value={config.fields.zpro_client_token ?? ''} onChange={(e) => updateField('zpro_client_token', e.target.value)} />
              </div>
            </div>
          )}

          {p === 'meta_cloud' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Phone Number ID</label>
                <input className={inputCls} value={config.fields.meta_phone_id ?? ''} onChange={(e) => updateField('meta_phone_id', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Permanent Access Token</label>
                <input type="password" className={inputCls} value={config.fields.meta_token ?? ''} onChange={(e) => updateField('meta_token', e.target.value)} />
              </div>
              <p className="text-[10px] text-slate-500">
                Configure o número e o token no Meta Business Manager. O QR Code não é necessário — a conexão é feita via API oficial.
              </p>
            </div>
          )}

          {p === 'custom_webhook' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>URL do Webhook</label>
                <input className={inputCls} value={config.fields.custom_url ?? ''} onChange={(e) => updateField('custom_url', e.target.value)} placeholder="https://seu-endpoint.com/whatsapp" />
              </div>
              <div>
                <label className={labelCls}>Token (Bearer)</label>
                <input type="password" className={inputCls} value={config.fields.custom_token ?? ''} onChange={(e) => updateField('custom_token', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Headers extras (JSON)</label>
                <textarea
                  className={inputCls + ' font-mono'}
                  rows={3}
                  value={config.fields.custom_headers ?? '{}'}
                  onChange={(e) => updateField('custom_headers', e.target.value)}
                  placeholder='{"X-Tenant": "veloov"}'
                />
              </div>
            </div>
          )}

          {/* QR Code section */}
          {(p === 'evolution' || p === 'zapi' || p === 'zpro') && (
            <div className="pt-2">
              {!qrData && !connected ? (
                <button
                  type="button"
                  onClick={generateQR}
                  disabled={qrLoading}
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5 text-[#D4AF37]" />}
                  {qrLoading ? 'Gerando...' : 'Gerar QR Code de Conexão'}
                </button>
              ) : connected ? (
                <div className="bg-slate-950 border border-emerald-700/40 rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px] gap-3 animate-fade-in">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400">Instância já conectada!</p>
                  <button type="button" onClick={() => { setConnected(false); generateQR(); }} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Gerar novo QR Code
                  </button>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[250px] gap-3 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Aguardando leitura
                  </div>
                  <img src={`data:image/png;base64,${qrData}`} alt="QR Code WhatsApp" className="w-48 h-48 rounded-lg border border-slate-800" />
                  <p className="text-[10px] text-slate-500 animate-pulse">Escaneie com o WhatsApp para conectar...</p>
                  <button type="button" onClick={() => setQrData(null)} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Gerar novo QR Code
                  </button>
                </div>
              )}
              {qrError && (
                <div className="mt-2 flex items-start gap-2 text-[11px] text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{qrError}</span>
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {saveError}
            </div>
          )}

          <button type="submit" disabled={saving} className={btnGold + ' w-full justify-center'}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Provedor de Mensagens Global
          </button>
        </form>
      </div>

      {/* Status indicator */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Status do Gateway
        </h3>
        <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
          <div className={`w-2.5 h-2.5 rounded-full ${config.fields && Object.keys(config.fields).length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <div className="flex-1">
            <p className="text-xs text-slate-300 font-semibold">
              {PROVIDERS.find((pr) => pr.value === p)?.label}
            </p>
            <p className="text-[10px] text-slate-500">
              {config.fields && Object.keys(config.fields).length > 0
                ? 'Configurado — notificações serão enviadas via este provedor'
                : 'Não configurado — preencha os campos e salve'}
            </p>
          </div>
          {config.fields && Object.keys(config.fields).length > 0 && (
            <Link2 className="h-4 w-4 text-emerald-400" />
          )}
        </div>
      </div>
    </div>
  );
}
