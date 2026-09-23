import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, QrCode, Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, Plus, AlertCircle, Phone, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { slugify } from '@/lib/utils';
import { PageHeader, Card, Input, Button, LoadingState } from '@/components/admin/ui';
import type { BotWhatsappConexao } from '@/types';

const QR_CODE_TTL_SECONDS = 60;

function normalizeQrCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const qr = value.trim();
  if (!qr) return null;
  if (qr.startsWith('data:image/')) return qr;
  if (qr.startsWith('http://') || qr.startsWith('https://')) return qr;
  if (qr.length < 40) return null;
  return `data:image/png;base64,${qr.replace(/\s/g, '')}`;
}

async function callBotApi(action: string, payload: Record<string, unknown> = {}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-whatsapp-manage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, error: data?.error ?? `HTTP ${resp.status}` };
  return { ok: true, data };
}

export function BotPanel() {
  const { company } = useAuth();
  const [connections, setConnections] = useState<BotWhatsappConexao[]>([]);
  const [planLimit, setPlanLimit] = useState(0);
  const [planName, setPlanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qrRefreshId, setQrRefreshId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const result = await callBotApi('list', { companyId: company.id });
    if (result.ok && result.data) {
      const d = result.data as { connections: BotWhatsappConexao[]; planLimit: number; planName: string };
      setConnections(d.connections ?? []);
      setPlanLimit(d.planLimit ?? 0);
      setPlanName(d.planName ?? '');
    } else {
      setError(result.error ?? 'Erro ao carregar');
    }
    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleDelete = async (connId: string) => {
    if (!company) return;
    const result = await callBotApi('delete', { companyId: company.id, connectionId: connId });
    if (result.ok) {
      setSuccess('Conexão removida');
      setTimeout(() => setSuccess(null), 3000);
      load();
    } else {
      setError(result.error ?? 'Erro ao remover');
    }
  };

  const handleRefreshQr = async (connId: string) => {
    if (!company) return;
    setQrRefreshId(connId);
    const result = await callBotApi('refresh_qr', { companyId: company.id, connectionId: connId });
    setQrRefreshId(null);
    if (result.ok) {
      load();
    } else {
      setError(result.error ?? 'Erro ao gerar QR');
    }
  };

  const atLimit = connections.length >= planLimit;

  if (loading) return <LoadingState />;

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader icon={Bot} title="Bot de Corridas" subtitle={`Conexões WhatsApp do bot — Plano ${planName} (${connections.length}/${planLimit})`} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-error-400 bg-error-500/10 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-error-300 hover:text-error-200"><XCircle className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-success-500 bg-success-500/10 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Conexões do Bot</h3>
            <p className="text-xs text-slate-500 mt-1">Cada conexão é um número de WhatsApp exclusivo para o bot atender passageiros</p>
          </div>
          <Button onClick={() => setShowCreate(true)} disabled={atLimit}>
            <Plus className="h-4 w-4" /> Conectar Novo Número
          </Button>
        </div>

        {atLimit && (
          <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3 mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Limite de conexões do plano atingido ({connections.length}/{planLimit}). Faça upgrade para o plano Diamante para conectar mais números.
          </div>
        )}

        {connections.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma conexão do bot cadastrada</p>
            <p className="text-xs mt-1">Conecte um número de WhatsApp para o bot começar a atender passageiros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${conn.connection_status === 'connected' ? 'bg-success-500/15 text-success-400' : 'bg-slate-700/40 text-slate-400'}`}>
                  {conn.connection_status === 'connected' ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{conn.instance_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {conn.phone_number && (
                      <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" />{conn.phone_number}</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conn.connection_status === 'connected' ? 'bg-success-500/15 text-success-400' : 'bg-slate-700/30 text-slate-500'}`}>
                      {conn.connection_status === 'connected' ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
                {conn.connection_status !== 'connected' && conn.qr_code && (
                  <div className="relative">
                    <img src={normalizeQrCode(conn.qr_code) ?? ''} alt="QR Code" className="h-24 w-24 rounded-lg border border-slate-700" />
                  </div>
                )}
                <div className="flex gap-2">
                  {conn.connection_status !== 'connected' && (
                    <button
                      onClick={() => handleRefreshQr(conn.id)}
                      disabled={qrRefreshId === conn.id}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Gerar QR Code"
                    >
                      {qrRefreshId === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remover conexão"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showCreate && (
        <CreateConnectionModal
          companyId={company!.id}
          defaultInstanceName={slugify(company!.slug) + '-bot'}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setSuccess('Conexão criada! Escaneie o QR Code para conectar.'); setTimeout(() => setSuccess(null), 3000); load(); }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

function CreateConnectionModal({ companyId, defaultInstanceName, onClose, onCreated, onError }: {
  companyId: string;
  defaultInstanceName: string;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [apiUrl, setApiUrl] = useState('');
  const [globalToken, setGlobalToken] = useState('');
  const [instanceName, setInstanceName] = useState(defaultInstanceName);
  const [saving, setSaving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl || !globalToken || !instanceName) {
      onError('Preencha todos os campos');
      return;
    }
    setSaving(true);
    const result = await callBotApi('create', { companyId, apiUrl, globalToken, instanceName });
    setSaving(false);
    if (result.ok && result.data) {
      const conn = (result.data as { connection: BotWhatsappConexao }).connection;
      if (conn?.qr_code) setQrCode(normalizeQrCode(conn.qr_code));
      onCreated();
    } else {
      onError(result.error ?? 'Erro ao criar conexão');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-gold-400" />
          <h3 className="text-sm font-bold text-slate-100">Conectar Novo Número do Bot</h3>
        </div>
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="URL da Evolution API" value={apiUrl} onChange={setApiUrl} placeholder="https://api.evolution.com" />
          <Input label="Token Global" value={globalToken} onChange={setGlobalToken} placeholder="Token da Evolution API" type="password" />
          <Input label="Nome da Instância" value={instanceName} onChange={setInstanceName} placeholder="empresa-bot" />
          {qrCode && (
            <div className="flex flex-col items-center gap-2 py-3">
              <img src={qrCode} alt="QR Code" className="h-48 w-48 rounded-lg border border-slate-700" />
              <p className="text-xs text-slate-400">Escaneie o QR Code no WhatsApp para conectar</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gold-500 text-slate-900 font-bold text-sm hover:bg-gold-400 disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar e Gerar QR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
