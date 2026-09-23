import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RideMessage } from '@/types';

interface RideChatProps {
  rideId: string;
  rideStatus: string;
  passengerName: string;
  passengerPhone: string;
}

export function RideChat({ rideId, rideStatus, passengerName, passengerPhone }: RideChatProps) {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isRideActive = rideStatus !== 'completed' && rideStatus !== 'canceled';

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('ride_messages')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as RideMessage[]);
    setLoading(false);
  }, [rideId]);

  useEffect(() => {
    loadMessages();

    channelRef.current = supabase
      .channel(`ride-messages-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as RideMessage;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as RideMessage).id ? (payload.new as RideMessage) : m)),
          );
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [rideId, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !isRideActive || sending) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        ride_id: rideId,
        company_id: '',
        sender: 'motorista',
        content: trimmed,
        status: 'enviada',
        whatsapp_delivered: false,
        created_at: new Date().toISOString(),
      },
    ]);
    setInput('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-chat-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ rideId, message: trimmed }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert(err.error ?? 'Erro ao enviar mensagem');
      } else {
        const data = await resp.json();
        if (data.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...m, id: data.messageId, whatsapp_delivered: data.delivered, status: data.delivered ? 'entregue' : 'enviada' }
                : m,
            ),
          );
        }
        await loadMessages();
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('Erro de conexão ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Chat com passageiro
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary-500" />
          <div>
            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              Chat — {passengerName}
            </p>
            <p className="text-[10px] text-neutral-400">{passengerPhone}</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-48 overflow-y-auto p-3 space-y-2 bg-white dark:bg-neutral-900"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-neutral-400">
              {isRideActive
                ? 'Nenhuma mensagem ainda. Envie a primeira mensagem para o passageiro.'
                : 'Esta corrida foi finalizada. O chat está encerrado.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'motorista' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-1.5 ${
                  msg.sender === 'motorista'
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                }`}
              >
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[9px] ${msg.sender === 'motorista' ? 'text-primary-100' : 'text-neutral-400'}`}>
                    {formatTime(msg.created_at)}
                  </span>
                  {msg.sender === 'motorista' && (
                    <span className={`text-[9px] ${msg.whatsapp_delivered ? 'text-primary-100' : 'text-primary-200/60'}`}>
                      {msg.whatsapp_delivered ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      {isRideActive ? (
        <div className="flex items-center gap-2 p-2 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Digite uma mensagem..."
            className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-white disabled:opacity-40 hover:bg-primary-600 transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <p className="text-xs text-center text-neutral-400">
            Corrida {rideStatus === 'completed' ? 'concluída' : 'cancelada'}. Chat encerrado.
          </p>
        </div>
      )}
    </div>
  );
}
