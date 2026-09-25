import { useState, useEffect, useCallback } from 'react';
import { Bot, QrCode, Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, Plus, AlertCircle, Phone, Wifi, WifiOff, MapPin, MessageSquare, Settings, ChevronDown, ChevronRight, Edit3, Save, Mic, Check, Building2, RefreshCcwDot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { slugify } from '@/lib/utils';
import { CityAutocomplete, type CityLocation } from '@/components/CityAutocomplete';
import { fetchMachineCategories, type MachineCategory } from '@/lib/machineApi';
import { PageHeader, Card, Input, Button, LoadingState } from '@/components/admin/ui';
import type { BotWhatsappConexao } from '@/types';

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
  const { data, error } = await supabase.functions.invoke('bot-whatsapp-manage', { body: { action, ...payload } });

  if (error) {
    const response = error.context as Response | undefined;
    const details = response ? await response.json().catch(() => ({})) as { error?: string } : {};
    return { ok: false, error: details.error ?? error.message };
  }

  return { ok: true, data };
}

interface AddressSuggestion {
  id: string;
  nickname: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
}

const MESSAGE_KEYS = [
  { key: 'welcome', label: 'Boas-vindas (pergunta se quer corrida)' },
  { key: 'ask_address', label: 'Pedido de endereço' },
  { key: 'confirm_address', label: 'Confirmação de endereço' },
  { key: 'ride_success', label: 'Corrida solicitada com sucesso' },
  { key: 'ride_error', label: 'Erro ao solicitar corrida' },
  { key: 'decline', label: 'Passageiro recusou' },
  { key: 'address_not_found', label: 'Endereço não encontrado' },
  { key: 'address_retry', label: 'Reenviar endereço' },
  { key: 'address_correction', label: 'Corrigir endereço' },
  { key: 'confirm_retry', label: 'Repetir confirmação' },
  { key: 'welcome_back', label: 'Nova corrida (retorno)' },
  { key: 'welcome_repeat', label: 'Repetir boas-vindas' },
];

export function BotPanel() {
  const { company } = useAuth();
  const [connections, setConnections] = useState<BotWhatsappConexao[]>([]);
  const [planLimit, setPlanLimit] = useState(0);
  const [planName, setPlanName] = useState('');
  const [usingVeloovShared, setUsingVeloovShared] = useState(false);
  const [machineConfigured, setMachineConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qrRefreshId, setQrRefreshId] = useState<string | null>(null);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const [expandedConn, setExpandedConn] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const result = await callBotApi('list', { companyId: company.id });
    if (result.ok && result.data) {
      const d = result.data as { connections: BotWhatsappConexao[]; planLimit: number; planName: string; usingVeloovShared: boolean; machineConfigured: boolean };
      setConnections(d.connections ?? []);
      setPlanLimit(d.planLimit ?? 0);
      setPlanName(d.planName ?? '');
      setUsingVeloovShared(d.usingVeloovShared ?? false);
      setMachineConfigured(d.machineConfigured ?? false);
    } else {
      setError(result.error ?? 'Erro ao carregar');
    }
    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (connId: string) => {
    if (!company) return;
    const result = await callBotApi('delete', { companyId: company.id, connectionId: connId });
    if (result.ok) { setSuccess('Conexão removida'); setTimeout(() => setSuccess(null), 3000); load(); }
    else setError(result.error ?? 'Erro ao remover');
  };

  const handleRefreshQr = async (connId: string) => {
    if (!company) return;
    setQrRefreshId(connId);
    const result = await callBotApi('refresh_qr', { companyId: company.id, connectionId: connId });
    setQrRefreshId(null);
    if (result.ok) load();
    else setError(result.error ?? 'Erro ao gerar QR');
  };

  const handleReconnect = async (connId: string) => {
    if (!company) return;
    setReconnectId(connId);
    const result = await callBotApi('reconnect', { companyId: company.id, connectionId: connId });
    setReconnectId(null);
    if (result.ok && result.data) {
      const d = result.data as { webhookConfigured: boolean; connectionStatus: string; qrCode: string | null };
      if (d.webhookConfigured) {
        setSuccess('Webhook reconfigurado e status atualizado!');
      } else {
        setError('Instância atualizada, mas houve erro ao reconfigurar o webhook. Tente novamente.');
      }
      setTimeout(() => { setSuccess(null); setError(null); }, 4000);
      load();
    } else {
      setError(result.error ?? 'Erro ao reconectar');
    }
  };

  if (loading) return <LoadingState />;

  const atLimit = connections.length >= planLimit;

  return (
    <div className="animate-slide-up space-y-5">
      <PageHeader icon={Bot} title="Bot de Corridas" subtitle={`Conexões WhatsApp do bot — Plano ${planName}`} />

      {/* Plan usage summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="h-4 w-4 text-gold-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Conexões</h3>
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {connections.length}<span className="text-slate-500 text-base font-normal">/{planLimit}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">números de WhatsApp conectados</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-gold-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Mensagens</h3>
          </div>
          <p className="text-2xl font-bold text-success-400">Ilimitado</p>
          <p className="text-xs text-slate-500 mt-0.5">plano sem limite de mensagens</p>
        </div>
      </div>

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
              <ConnectionCard
                key={conn.id}
                conn={conn}
                companyId={company!.id}
                companySlug={company!.slug}
                expanded={expandedConn === conn.id}
                onToggle={() => setExpandedConn(expandedConn === conn.id ? null : conn.id)}
                onRefreshQr={handleRefreshQr}
                onReconnect={handleReconnect}
                onDelete={handleDelete}
                qrRefreshId={qrRefreshId}
                reconnectId={reconnectId}
                onUpdate={() => load()}
                onError={setError}
                onSuccess={setSuccess}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <TranscriptionConfigSection companyId={company!.id} onError={setError} onSuccess={setSuccess} />
      </Card>

      {showCreate && (
        <CreateConnectionModal
          companyId={company!.id}
          defaultInstanceName={slugify(company!.slug) + '-bot-' + Math.random().toString(36).slice(2, 6)}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setSuccess('Conexão criada! Escaneie o QR Code para conectar.'); setTimeout(() => setSuccess(null), 3000); load(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function ConnectionCard({ conn, companyId, companySlug, expanded, onToggle, onRefreshQr, onReconnect, onDelete, qrRefreshId, reconnectId, onUpdate, onError, onSuccess }: {
  conn: BotWhatsappConexao;
  companyId: string;
  companySlug: string;
  expanded: boolean;
  onToggle: () => void;
  onRefreshQr: (id: string) => void;
  onReconnect: (id: string) => void;
  onDelete: (id: string) => void;
  qrRefreshId: string | null;
  reconnectId: string | null;
  onUpdate: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <button onClick={onToggle} className="p-1 rounded hover:bg-slate-800 text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${conn.connection_status === 'connected' ? 'bg-success-500/15 text-success-400' : 'bg-slate-700/40 text-slate-400'}`}>
          {conn.connection_status === 'connected' ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-200 truncate">{conn.instance_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {conn.phone_number && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" />{conn.phone_number}</span>}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conn.connection_status === 'connected' ? 'bg-success-500/15 text-success-400' : 'bg-slate-700/30 text-slate-500'}`}>
              {conn.connection_status === 'connected' ? 'ONLINE' : 'OFFLINE'}
            </span>
            {conn.company_locations?.city && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 flex items-center gap-1">
                <Building2 className="h-2.5 w-2.5" />{conn.company_locations.city}
              </span>
            )}
          </div>
        </div>
        {conn.connection_status !== 'connected' && conn.qr_code && (
          <img src={normalizeQrCode(conn.qr_code) ?? ''} alt="QR Code" className="h-24 w-24 rounded-lg border border-slate-700" />
        )}
        <div className="flex gap-2">
          {conn.provider === 'evolution' && (
            <button onClick={() => onReconnect(conn.id)} disabled={reconnectId === conn.id} className="p-2 rounded-lg bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 transition-colors" title="Reconectar e reconfigurar webhook">
              {reconnectId === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcwDot className="h-4 w-4" />}
            </button>
          )}
          {conn.connection_status !== 'connected' && (
            <button onClick={() => onRefreshQr(conn.id)} disabled={qrRefreshId === conn.id} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" title="Gerar QR Code">
              {qrRefreshId === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          )}
          <button onClick={() => onDelete(conn.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Remover conexão">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-950/30">
          <CategorySelectorSection conn={conn} companyId={companyId} companySlug={companySlug} onError={onError} onSuccess={onSuccess} onUpdate={onUpdate} />
          <FlowSettingsSection conn={conn} companyId={companyId} onError={onError} onSuccess={onSuccess} onUpdate={onUpdate} />
          <AddressSuggestionsSection connId={conn.id} companyId={companyId} onError={onError} onSuccess={onSuccess} />
          <CustomMessagesSection conn={conn} companyId={companyId} onError={onError} onSuccess={onSuccess} />
        </div>
      )}
    </div>
  );
}

function AddressSuggestionsSection({ connId, companyId, onError, onSuccess }: { connId: string; companyId: string; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nick, setNick] = useState('');
  const [addr, setAddr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await callBotApi('list_suggestions', { companyId, connectionId: connId });
    if (result.ok && result.data) {
      setSuggestions((result.data as { suggestions: AddressSuggestion[] }).suggestions ?? []);
    }
    setLoading(false);
  }, [companyId, connId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nick.trim() || !addr.trim()) { onError('Preencha apelido e endereço'); return; }
    const result = await callBotApi('add_suggestion', { companyId, connectionId: connId, nickname: nick.trim(), addressText: addr.trim() });
    if (result.ok) { setNick(''); setAddr(''); setShowAdd(false); load(); onSuccess('Sugestão adicionada'); setTimeout(() => onSuccess(''), 2000); }
    else onError(result.error ?? 'Erro ao adicionar');
  };

  const handleDelete = async (sugId: string) => {
    const result = await callBotApi('delete_suggestion', { companyId, connectionId: connId, suggestionId: sugId });
    if (result.ok) load();
    else onError(result.error ?? 'Erro ao remover');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gold-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Sugestões de Endereço</h4>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="text-xs text-gold-400 hover:text-gold-300 font-bold flex items-center gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">O passageiro pode digitar o apelido e o bot usa o endereço real automaticamente</p>

      {showAdd && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-3">
          <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Apelido (ex: Amarelinha)" className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500" />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Endereço real" className="flex-[2] px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500" />
          <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-gold-500 text-slate-900 font-bold hover:bg-gold-400">OK</button>
        </form>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 py-2">Carregando...</div>
      ) : suggestions.length === 0 ? (
        <div className="text-xs text-slate-600 py-2">Nenhuma sugestão cadastrada</div>
      ) : (
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs bg-slate-800/50 rounded-lg px-3 py-2">
              <span className="font-bold text-gold-400 min-w-0 truncate">{s.nickname}</span>
              <span className="text-slate-500">→</span>
              <span className="text-slate-300 truncate flex-1">{s.address_text}</span>
              <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 shrink-0"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomMessagesSection({ conn, companyId, onError, onSuccess }: { conn: BotWhatsappConexao; companyId: string; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (conn.bot_custom_messages) {
      setMessages(conn.bot_custom_messages as Record<string, string>);
    }
  }, [conn]);

  const handleSave = async () => {
    setSaving(true);
    const result = await callBotApi('update_messages', { companyId, connectionId: conn.id, customMessages: messages });
    setSaving(false);
    if (result.ok) { setEditing(false); onSuccess('Mensagens salvas'); setTimeout(() => onSuccess(''), 2000); }
    else onError(result.error ?? 'Erro ao salvar');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gold-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Mensagens do Bot</h4>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setMessages((conn.bot_custom_messages as Record<string, string>) ?? {}); }} className="text-xs text-slate-400 hover:text-slate-300">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="text-xs text-gold-400 hover:text-gold-300 font-bold flex items-center gap-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-gold-400 hover:text-gold-300 font-bold flex items-center gap-1">
            <Edit3 className="h-3 w-3" /> Editar
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mb-2">Personalize as mensagens do bot. Deixe em branco para usar o texto padrão.</p>

      <div className="space-y-2">
        {MESSAGE_KEYS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] text-slate-500 block mb-0.5">{label}</label>
            {editing ? (
              <textarea
                value={messages[key] ?? ''}
                onChange={(e) => setMessages((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="Use o texto padrão..."
                rows={2}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 resize-none"
              />
            ) : (
              <p className={`text-xs px-3 py-1.5 rounded-lg bg-slate-800/50 ${messages[key] ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                {messages[key] || 'Texto padrão'}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowSettingsSection({ conn, companyId, onError, onSuccess, onUpdate }: { conn: BotWhatsappConexao; companyId: string; onError: (m: string) => void; onSuccess: (m: string) => void; onUpdate: () => void }) {
  const defaults = { show_welcome_menu: true, ask_destination: true, ask_payment: true, ask_category: true, confirm_address: true };
  const [settings, setSettings] = useState(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (conn.bot_flow_settings) {
      setSettings({ ...defaults, ...conn.bot_flow_settings });
    }
  }, [conn]);

  const toggles: { key: keyof typeof defaults; label: string; description: string }[] = [
    { key: "show_welcome_menu", label: "Menu de boas-vindas", description: "Mostra o menu inicial (1 - Corrida / 2 - Suporte). Se desativado, vai direto para o endereço." },
    { key: "ask_destination", label: "Pedir destino", description: "Pergunta o endereco de destino apos o embarque. Se desativado, despacha sem destino." },
    { key: "confirm_address", label: "Confirmar enderecos", description: "Pede confirmacao SIM/NAO antes de despachar. Se desativado, avanca direto." },
    { key: "ask_category", label: "Pedir categoria", description: "Pergunta qual categoria o passageiro deseja. Se desativado, usa a primeira disponivel." },
    { key: "ask_payment", label: "Pedir forma de pagamento", description: "Pergunta Dinheiro/Pix/Cartao. Se desativado, despacha sem informar pagamento." },
  ];

  const handleSave = async () => {
    setSaving(true);
    const result = await callBotApi("update_flow_settings", { companyId, connectionId: conn.id, flowSettings: settings });
    setSaving(false);
    if (result.ok) { onSuccess("Configuracoes do fluxo salvas"); setTimeout(() => onSuccess(""), 2000); onUpdate(); }
    else onError(result.error ?? "Erro ao salvar configuracoes");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gold-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Etapas do Fluxo</h4>
        </div>
        <button onClick={handleSave} disabled={saving} className="text-xs text-gold-400 hover:text-gold-300 font-bold flex items-center gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">Controle quais etapas o bot executa. Desativar etapas reduz o numero de mensagens enviadas e economiza custos da Meta.</p>

      <div className="space-y-2">
        {toggles.map(({ key, label, description }) => (
          <div key={key} className="flex items-start gap-3 bg-slate-800/40 rounded-lg px-3 py-2.5">
            <button
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
              className={`mt-0.5 relative h-5 w-9 rounded-full transition-colors shrink-0 ${settings[key] ? "bg-gold-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings[key] ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
        ))}
      </div>
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
  const [provider, setProvider] = useState<'evolution' | 'zapi' | 'zpro' | 'meta_cloud'>('evolution');
  const [apiUrl, setApiUrl] = useState('');
  const [globalToken, setGlobalToken] = useState('');
  const [instanceName, setInstanceName] = useState(defaultInstanceName);
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const PROVIDERS = [
    { value: 'evolution', label: 'Evolution API', needsUrl: true, needsToken: true, needsInstance: true, qr: true },
    { value: 'zapi', label: 'Z-API', needsUrl: true, needsToken: true, needsInstance: false, qr: false },
    { value: 'zpro', label: 'Z-Pro', needsUrl: true, needsToken: true, needsInstance: false, qr: false },
    { value: 'meta_cloud', label: 'Meta Cloud API', needsUrl: false, needsToken: true, needsInstance: false, qr: false, needsPhoneId: true, needsWabaId: true },
  ] as const;
  const current = PROVIDERS.find((p) => p.value === provider)!;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (current.needsUrl && !apiUrl) { onError('Preencha a URL da API'); return; }
    if (current.needsToken && !globalToken) { onError('Preencha o token'); return; }
    if (current.needsInstance && !instanceName) { onError('Preencha o nome da instância'); return; }
    setSaving(true);
    setQrCode(null);
    const result = await callBotApi('create', { companyId, apiUrl: apiUrl || undefined, globalToken, instanceName: instanceName || undefined, provider, metaPhoneId: metaPhoneId || undefined, metaWabaId: metaWabaId || undefined });
    setSaving(false);
    if (result.ok && result.data) {
      const conn = (result.data as { connection: BotWhatsappConexao }).connection;
      if (conn?.qr_code) setQrCode(normalizeQrCode(conn.qr_code));
      setCreated(true);
      onCreated();
    } else {
      onError(result.error ?? 'Erro ao criar conexão');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={created ? onClose : undefined}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-gold-400" />
          <h3 className="text-sm font-bold text-slate-100">Conectar Novo Número do Bot</h3>
        </div>
        {created && qrCode ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-3">
              <img src={qrCode} alt="QR Code" className="h-56 w-56 rounded-lg border border-slate-700" />
              <p className="text-xs text-slate-400 text-center">Escaneie o QR Code no WhatsApp para conectar.<br />O QR Code também fica disponível na lista de conexões para atualizar.</p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gold-500 text-slate-900 font-bold text-sm hover:bg-gold-400">Concluído</button>
            </div>
          </div>
        ) : created && !qrCode ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-success-400 bg-success-500/10 rounded-lg px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Conexão criada! Este provedor não usa QR Code — a conexão é via token.
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gold-500 text-slate-900 font-bold text-sm hover:bg-gold-400">Concluído</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Provedor</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)} className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {current.needsUrl && (
              <Input label="URL da API" value={apiUrl} onChange={setApiUrl} placeholder="https://api.exemplo.com" />
            )}
            {current.needsToken && (
              <Input label="Token / Chave de API" value={globalToken} onChange={setGlobalToken} placeholder="Token de acesso" type="password" />
            )}
            {current.needsInstance && (
              <Input label="Nome da Instância" value={instanceName} onChange={setInstanceName} placeholder="empresa-bot" />
            )}
            {provider === 'meta_cloud' && (
              <>
                <Input label="Phone Number ID" value={metaPhoneId} onChange={setMetaPhoneId} placeholder="123456789012" />
                <Input label="WhatsApp Business Account ID" value={metaWabaId} onChange={setMetaWabaId} placeholder="987654321098" />
                <p className="text-[10px] text-slate-500">Encontre esses valores no Meta Business Manager em WhatsApp &gt; Configurações da API. O Token acima e o token de acesso permanente do app.</p>
              </>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-sm font-medium">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gold-500 text-slate-900 font-bold text-sm hover:bg-gold-400 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar Conexão
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface CompanyLocationInfo {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
}

function CategorySelectorSection({ conn, companyId, companySlug, onError, onSuccess, onUpdate }: { conn: BotWhatsappConexao; companyId: string; companySlug: string; onError: (m: string) => void; onSuccess: (m: string) => void; onUpdate: () => void }) {
  const [locations, setLocations] = useState<CompanyLocationInfo[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(conn.location_id ?? '');
  const [machineCats, setMachineCats] = useState<MachineCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(conn.bot_category_ids ?? []);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [loadingMachineCats, setLoadingMachineCats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocation, setNewLocation] = useState<CityLocation>({ city: '', state: '', lat: '', lng: '' });
  const [creatingLocation, setCreatingLocation] = useState(false);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  const loadLocations = useCallback(async () => {
    setLoadingLocs(true);
    const result = await callBotApi('list_locations', { companyId, connectionId: conn.id });
    if (result.ok && result.data) {
      setLocations((result.data as { locations: CompanyLocationInfo[] }).locations ?? []);
    }
    setLoadingLocs(false);
  }, [companyId]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  const handleLocationChange = (id: string) => {
    setSelectedLocationId(id);
    setSelectedIds([]);
    setMachineCats([]);
    setCatError(null);
  };

  const handleDeleteLocation = async (locId: string, locName: string) => {
    if (!confirm(`Excluir a localização "${locName}"? Esta ação não pode ser desfeita.`)) return;
    const result = await callBotApi('delete_location', { companyId, connectionId: conn.id, locationId: locId });
    if (!result.ok) {
      onError(result.error ?? 'Erro ao excluir localização');
      return;
    }
    setLocations((current) => current.filter((l) => l.id !== locId));
    if (selectedLocationId === locId) {
      setSelectedLocationId('');
      setSelectedIds([]);
      setMachineCats([]);
    }
    onSuccess(`Localização "${locName}" excluída`);
    setTimeout(() => onSuccess(''), 3000);
    onUpdate();
  };

  const handleCreateLocation = async () => {
    if (!newLocation.city) {
      onError('Selecione a cidade da localização');
      return;
    }

    setCreatingLocation(true);
    const result = await callBotApi('create_location', {
      companyId,
      connectionId: conn.id,
      name: newLocationName.trim() || newLocation.city,
      city: newLocation.city,
      state: newLocation.state,
      lat: newLocation.lat ? Number(newLocation.lat) : undefined,
      lng: newLocation.lng ? Number(newLocation.lng) : undefined,
    });
    setCreatingLocation(false);

    if (!result.ok || !result.data) {
      onError(result.error ?? 'Erro ao cadastrar localização');
      return;
    }

    const created = (result.data as { location: CompanyLocationInfo }).location;
    setLocations((current) => [...current, created]);
    setSelectedLocationId(created.id);
    setSelectedIds([]);
    setMachineCats([]);
    setNewLocationName('');
    setNewLocation({ city: '', state: '', lat: '', lng: '' });
    setShowNewLocation(false);
    onSuccess(`Localização ${created.city ?? created.name} cadastrada`);
  };

  const handleLoadMachineCategories = async () => {
    if (!selectedLocation) {
      setCatError('Selecione uma localização primeiro');
      return;
    }

    setLoadingMachineCats(true);
    setCatError(null);
    setMachineCats([]);

    const result = await fetchMachineCategories(companySlug, {
      city: selectedLocation.city ?? undefined,
      state: selectedLocation.state ?? undefined,
      lat: selectedLocation.lat ?? undefined,
      lng: selectedLocation.lng ?? undefined,
    }, companyId);

    if (result.success && result.data) {
      setMachineCats(result.data);
      if (result.data.length === 0) {
        setCatError('Nenhuma categoria encontrada para esta cidade na Machine API.');
      }
    } else {
      setCatError(result.error ?? 'Erro ao buscar categorias da Machine API. Verifique a integração no painel de Integração.');
    }

    setLoadingMachineCats(false);
  };

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await callBotApi('update_connection_location', { companyId, connectionId: conn.id, locationId: selectedLocationId || undefined });
    if (!result.ok) { setSaving(false); onError(result.error ?? 'Erro ao salvar cidade'); return; }
    const result2 = await callBotApi('update_categories', { companyId, connectionId: conn.id, categoryIds: selectedIds });
    setSaving(false);
    if (result2.ok) { onSuccess('Categorias e cidade salvas'); setTimeout(() => onSuccess(''), 2000); onUpdate(); }
    else onError(result2.error ?? 'Erro ao salvar categorias');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gold-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Categorias do WhatsApp</h4>
        </div>
        <button onClick={handleSave} disabled={saving} className="text-xs text-gold-400 hover:text-gold-300 font-bold flex items-center gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">Selecione a localização desta instância, clique em <strong className="text-gold-400">Carregar categorias</strong> para buscar as categorias da Machine API daquela cidade, e marque quais ficarão ativas.</p>

      {/* Location selector */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-slate-500">Localização desta instância</label>
          <button
            type="button"
            onClick={() => setShowNewLocation((value) => !value)}
            className="text-[10px] font-bold text-gold-400 hover:text-gold-300 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> {showNewLocation ? 'Fechar' : 'Cadastrar localização'}
          </button>
        </div>

        {showNewLocation && (
          <div className="mb-3 rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 space-y-3">
            <p className="text-[11px] text-slate-400">Cadastre aqui a cidade da instância. Exemplo: Leme/SP.</p>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Nome da localização</label>
              <input
                value={newLocationName}
                onChange={(event) => setNewLocationName(event.target.value)}
                placeholder="Ex.: Totem Leme ou Base Leme"
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600"
              />
            </div>
            <CityAutocomplete value={newLocation} onChange={setNewLocation} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewLocation(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancelar</button>
              <button type="button" onClick={handleCreateLocation} disabled={creatingLocation || !newLocation.city} className="px-3 py-1.5 text-xs rounded-lg bg-gold-500 text-slate-900 font-bold disabled:opacity-50 flex items-center gap-1">
                {creatingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Cadastrar e usar
              </button>
            </div>
          </div>
        )}

        {loadingLocs ? (
          <div className="text-xs text-slate-500">Carregando localizações...</div>
        ) : locations.length === 0 ? (
          <div className="text-xs text-slate-600">Nenhuma localização cadastrada. Clique em "Cadastrar localização" acima para adicionar Leme ou outra cidade.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className={`inline-flex items-center gap-1 rounded-lg transition-all ${
                  selectedLocationId === loc.id
                    ? 'bg-gold-500 text-slate-900'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleLocationChange(loc.id)}
                  className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  <span>{loc.name}</span>
                  {loc.city && <span className="text-[10px] opacity-70">{loc.city}{loc.state ? `/${loc.state}` : ''}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLocation(loc.id, loc.name)}
                  className="px-1.5 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-r-lg"
                  title={`Excluir ${loc.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected location info + Carregar categorias button */}
      {selectedLocation && (
        <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">{selectedLocation.name}</p>
              <p className="text-[10px] text-slate-500">
                {selectedLocation.city ? `${selectedLocation.city}${selectedLocation.state ? `/${selectedLocation.state}` : ''}` : 'Sem cidade definida'}
                {selectedLocation.lat != null && selectedLocation.lng != null ? ` • ${selectedLocation.lat}, ${selectedLocation.lng}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadMachineCategories}
              disabled={loadingMachineCats}
              className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              {loadingMachineCats ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {loadingMachineCats ? 'Carregando...' : 'Carregar categorias'}
            </button>
          </div>
        </div>
      )}

      {/* Category chips from Machine API */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1.5">Categorias da Machine API ativas neste número</label>
        {catError && (
          <div className="text-[10px] text-amber-400 mb-2 px-2 py-1 rounded bg-amber-500/10">{catError}</div>
        )}
        {loadingMachineCats ? (
          <div className="text-xs text-slate-500 py-2">Buscando categorias na Machine API...</div>
        ) : machineCats.length === 0 ? (
          <div className="text-xs text-slate-600 py-2">
            {selectedLocation
              ? 'Clique em "Carregar categorias" acima para buscar as categorias da Machine API para esta cidade.'
              : 'Selecione uma localização primeiro.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {machineCats.map((cat) => {
              const selected = selectedIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${selected ? 'bg-gold-500/20 border-gold-500/50 text-gold-300' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                >
                  {selected && <Check className="h-3 w-3 inline mr-1" />}
                  {cat.nome}
                </button>
              );
            })}
          </div>
        )}
        {machineCats.length > 0 && (
          <p className="text-[10px] text-slate-600 mt-2">{selectedIds.length} categoria(s) selecionada(s). Se nenhuma for marcada, o bot usa a primeira categoria ativa da cidade.</p>
        )}
      </div>
    </div>
  );
}

function TranscriptionConfigSection({ companyId, onError, onSuccess }: { companyId: string; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [provider, setProvider] = useState<'groq' | 'openai' | 'deepgram' | 'assemblyai' | 'google' | 'azure'>('groq');
  const [apiKey, setApiKey] = useState('');
  const [additionalConfig, setAdditionalConfig] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const PROVIDERS = [
    { value: 'groq', label: 'Groq (Whisper)', placeholder: 'gsk_...', needsProject: false, needsRegion: false },
    { value: 'openai', label: 'OpenAI (Whisper)', placeholder: 'sk-...', needsProject: false, needsRegion: false },
    { value: 'deepgram', label: 'Deepgram', placeholder: 'API Key...', needsProject: false, needsRegion: false },
    { value: 'assemblyai', label: 'AssemblyAI', placeholder: 'API Key...', needsProject: false, needsRegion: false },
    { value: 'google', label: 'Google Cloud Speech-to-Text', placeholder: 'OAuth Access Token...', needsProject: true, needsRegion: false },
    { value: 'azure', label: 'Azure Speech', placeholder: 'Subscription Key...', needsProject: false, needsRegion: true },
  ] as const;

  const currentProvider = PROVIDERS.find((p) => p.value === provider)!;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await callBotApi('get_transcription_config', { companyId });
    if (result.ok && result.data) {
      const config = (result.data as { config: { provider: string; api_key: string; is_valid: boolean; last_test_result: string | null; additional_config?: Record<string, string> } | null }).config;
      if (config) {
        const validProviders = ['groq', 'openai', 'deepgram', 'assemblyai', 'google', 'azure'] as const;
        setProvider(validProviders.includes(config.provider as typeof validProviders[number]) ? config.provider as typeof validProviders[number] : 'groq');
        setApiKey(config.api_key);
        setIsValid(config.is_valid);
        setLastResult(config.last_test_result);
        setAdditionalConfig(config.additional_config ?? {});
      }
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!apiKey.trim()) { onError('Digite a chave de API'); return; }
    if (currentProvider.needsProject && !additionalConfig.projectId?.trim()) { onError('Digite o ID do projeto Google'); return; }
    if (currentProvider.needsRegion && !additionalConfig.region?.trim()) { onError('Digite a regiao do Azure'); return; }
    const result = await callBotApi('update_transcription_config', { companyId, provider, apiKey: apiKey.trim(), additionalConfig });
    if (result.ok) { onSuccess('Configuracao salva. Clique em Testar para validar.'); setTimeout(() => onSuccess(''), 3000); }
    else onError(result.error ?? 'Erro ao salvar');
  };

  const handleTest = async () => {
    if (!apiKey.trim()) { onError('Digite a chave de API antes de testar'); return; }
    setTesting(true);
    const result = await callBotApi('test_transcription', { companyId, provider, apiKey: apiKey.trim(), additionalConfig });
    setTesting(false);
    if (result.ok && result.data) {
      const d = result.data as { valid: boolean; message: string };
      setIsValid(d.valid);
      setLastResult(d.message);
      if (d.valid) { onSuccess('Integracao funcionando!'); setTimeout(() => onSuccess(''), 3000); }
      else onError(d.message);
    } else {
      onError(result.error ?? 'Erro ao testar');
    }
  };

  if (loading) return <div className="text-xs text-slate-500 py-4">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Mic className="h-4 w-4 text-gold-400" />
        <h3 className="text-sm font-bold text-slate-200">Transcricao de Audio</h3>
        {isValid && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-500/15 text-success-400 flex items-center gap-1">
            <Check className="h-3 w-3" /> Valido
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">Cadastre sua propria chave de API de transcricao. O bot usa essa chave para transcrever audios enviados pelos passageiros. Sem chave valida, o bot pede que o passageiro digite o endereco.</p>

      <div className="mb-3">
        <label className="text-[10px] text-slate-500 block mb-1">Provedor</label>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value as typeof provider); setAdditionalConfig({}); setIsValid(false); setLastResult(null); }}
          className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="text-[10px] text-slate-500 block mb-1">Chave de API</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={currentProvider.placeholder}
          className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600"
        />
      </div>

      {currentProvider.needsProject && (
        <div className="mb-3">
          <label className="text-[10px] text-slate-500 block mb-1">ID do projeto Google Cloud</label>
          <input
            type="text"
            value={additionalConfig.projectId ?? ''}
            onChange={(e) => setAdditionalConfig({ ...additionalConfig, projectId: e.target.value })}
            placeholder="my-project-123456"
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600"
          />
        </div>
      )}

      {currentProvider.needsRegion && (
        <div className="mb-3">
          <label className="text-[10px] text-slate-500 block mb-1">Regiao do Azure</label>
          <input
            type="text"
            value={additionalConfig.region ?? ''}
            onChange={(e) => setAdditionalConfig({ ...additionalConfig, region: e.target.value })}
            placeholder="eastus"
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600"
          />
        </div>
      )}

      {lastResult && (
        <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${isValid ? 'bg-success-500/10 text-success-400' : 'bg-error-500/10 text-error-400'}`}>
          {lastResult}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium">
          Salvar
        </button>
        <button onClick={handleTest} disabled={testing} className="px-4 py-2 text-xs rounded-lg bg-gold-500 text-slate-900 font-bold hover:bg-gold-400 disabled:opacity-50 flex items-center gap-2">
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
          Testar Conexao
        </button>
      </div>
    </div>
  );
}
