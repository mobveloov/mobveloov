import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Loader2, Search, ArrowLeft, Send, CheckCheck, Phone, UserCog, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { WhatsAppChat, WhatsAppMessage, BotConversation } from '@/types';

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length >= 12) {
    const ddd = d.slice(2, 4);
    const part1 = d.slice(4, d.length - 4);
    const part2 = d.slice(-4);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return phone;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ChatsModule() {
  const { company } = useAuth();
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [botConv, setBotConv] = useState<BotConversation | null>(null);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from('whatsapp_chats')
      .select('*')
      .eq('company_id', company.id)
      .order('last_message_at', { ascending: false });
    setChats((data ?? []) as WhatsAppChat[]);
    setLoading(false);
  }, [company]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats();
      if (selectedChat) {
        loadMessages(selectedChat.id);
        loadBotConv(selectedChat.phone);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadChats, selectedChat]);

  const loadMessages = useCallback(async (chatId: string) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('sent_at', { ascending: true });
    setMessages((data ?? []) as WhatsAppMessage[]);
    setMsgLoading(false);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const loadBotConv = useCallback(async (phone: string) => {
    if (!company) return;
    const { data } = await supabase
      .from('bot_conversas')
      .select('*')
      .eq('company_id', company.id)
      .eq('phone', phone)
      .maybeSingle();
    setBotConv(data as BotConversation | null);
  }, [company]);

  const handleSelectChat = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setBotConv(null);
    await loadMessages(chat.id);
    await loadBotConv(chat.phone);
    if (chat.unread_count > 0) {
      await supabase
        .from('whatsapp_chats')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', chat.id);
      loadChats();
    }
  };

  const handleTakeover = async () => {
    if (!selectedChat || !company) return;
    setTakeoverLoading(true);
    try {
      const now = new Date().toISOString();
      if (botConv) {
        await supabase
          .from('bot_conversas')
          .update({ human_takeover: true, taken_over_at: now, taken_over_by: 'admin', updated_at: now })
          .eq('id', botConv.id);
      } else {
        await supabase
          .from('bot_conversas')
          .insert({
            company_id: company.id,
            phone: selectedChat.phone,
            state: 'menu_inicial',
            human_takeover: true,
            taken_over_at: now,
            taken_over_by: 'admin',
          });
      }
      await loadBotConv(selectedChat.phone);
    } catch {
      // best-effort
    } finally {
      setTakeoverLoading(false);
    }
  };

  const handleReturnToBot = async () => {
    if (!selectedChat || !botConv) return;
    setTakeoverLoading(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from('bot_conversas')
        .update({ human_takeover: false, taken_over_at: null, taken_over_by: null, updated_at: now })
        .eq('id', botConv.id);
      await loadBotConv(selectedChat.phone);
    } catch {
      // best-effort
    } finally {
      setTakeoverLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedChat || !replyText.trim() || !company) return;
    setSending(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-chat-message`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          companyId: company.id,
          phone: selectedChat.phone,
          message: replyText.trim(),
        }),
      });

      // Auto-enable takeover when admin replies, so the bot doesn't interfere
      if (botConv && !botConv.human_takeover) {
        const now = new Date().toISOString();
        await supabase
          .from('bot_conversas')
          .update({ human_takeover: true, taken_over_at: now, taken_over_by: 'admin', updated_at: now })
          .eq('id', botConv.id);
        await loadBotConv(selectedChat.phone);
      } else if (!botConv) {
        const now = new Date().toISOString();
        await supabase
          .from('bot_conversas')
          .insert({
            company_id: company.id,
            phone: selectedChat.phone,
            state: 'menu_inicial',
            human_takeover: true,
            taken_over_at: now,
            taken_over_by: 'admin',
          });
        await loadBotConv(selectedChat.phone);
      }

      setReplyText('');
      await loadMessages(selectedChat.id);
      await loadChats();
    } catch {
      // best-effort
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.phone.includes(q) || (c.contact_name?.toLowerCase().includes(q) ?? false);
  });

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
          <MessageCircle className="h-5 w-5 text-gold-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Conversas</h2>
          <p className="text-sm text-slate-500">Atendimento humano e intervenção no bot</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
        {/* Chat list */}
        <div className={`${selectedChat ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 shrink-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden`}>
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa..."
                className="w-full rounded-lg bg-slate-800/60 pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-gold-500/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageCircle className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-sm text-slate-500">Nenhuma conversa ainda</p>
                <p className="text-xs text-slate-600 mt-1">As mensagens dos passageiros aparecerão aqui</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors border-b border-slate-800/50 ${
                    selectedChat?.id === chat.id
                      ? 'bg-gold-500/10'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-200">
                        {chat.contact_name ?? formatPhone(chat.phone)}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="truncate text-xs text-slate-500">
                        {chat.last_message_preview ?? ''}
                      </p>
                      {chat.unread_count > 0 && (
                        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-slate-900">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message view */}
        <div className={`${selectedChat ? 'flex' : 'hidden lg:flex'} flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden`}>
          {selectedChat ? (
            <>
              {/* Chat header with takeover controls */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
                <button
                  onClick={() => setSelectedChat(null)}
                  className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-slate-100">
                    {selectedChat.contact_name ?? formatPhone(selectedChat.phone)}
                  </p>
                  <p className="text-xs text-slate-500">{formatPhone(selectedChat.phone)}</p>
                </div>

                {/* Takeover badge + button */}
                {botConv?.human_takeover ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                      <UserCog className="h-3 w-3" />
                      Humano
                    </span>
                    <button
                      onClick={handleReturnToBot}
                      disabled={takeoverLoading}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      {takeoverLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                      Devolver para o Bot
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleTakeover}
                    disabled={takeoverLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {takeoverLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}
                    Assumir Atendimento
                  </button>
                )}
              </div>

              {/* Takeover notice banner */}
              {botConv?.human_takeover && (
                <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
                  <UserCog className="h-4 w-4 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">
                    O bot esta pausado para este passageiro. Suas mensagens serao enviadas manualmente. Clique em "Devolver para o Bot" para que o bot volte a responder.
                  </p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {msgLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageCircle className="h-10 w-10 text-slate-700 mb-2" />
                    <p className="text-sm text-slate-500">Nenhuma mensagem nesta conversa</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isOutgoing = msg.direction === 'outgoing';
                      const showDate = idx === 0 || formatDate(messages[idx - 1].sent_at) !== formatDate(msg.sent_at);
                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center my-3">
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] text-slate-500">
                                {formatDate(msg.sent_at)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                                isOutgoing
                                  ? 'bg-gold-500/20 text-slate-100 rounded-br-sm'
                                  : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.body ?? ''}</p>
                              <div className={`flex items-center gap-1 mt-1 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] text-slate-500">{formatTime(msg.sent_at)}</span>
                                {isOutgoing && <CheckCheck className="h-3 w-3 text-slate-500" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Reply input */}
              <div className="border-t border-slate-800 p-3 bg-slate-900/80">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSendReply(); }}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 rounded-xl bg-slate-800/60 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-gold-500/40"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-slate-900 transition-opacity disabled:opacity-40 hover:opacity-90"
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-12 w-12 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">Selecione uma conversa para ver as mensagens</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
