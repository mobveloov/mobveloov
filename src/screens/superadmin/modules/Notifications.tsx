import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Check, BellOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SuperadminNotification } from '@/types';

export type NotificationDestination = 'dashboard' | 'companies' | 'totems' | 'billing';

const TYPE_ICONS: Record<string, string> = {
  new_pending_company: 'bg-amber-500/10 text-amber-400',
  totem_offline: 'bg-red-500/10 text-red-400',
  invoice_overdue: 'bg-red-500/10 text-red-400',
  company_created: 'bg-emerald-500/10 text-emerald-400',
  general: 'bg-slate-500/10 text-slate-400',
};

const TYPE_LABELS: Record<string, string> = {
  new_pending_company: 'Empresa Pendente',
  totem_offline: 'Totem Offline',
  invoice_overdue: 'Fatura Vencida',
  company_created: 'Nova Empresa',
  general: 'Geral',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function NotificationBell({ onNavigate }: { onNavigate?: (destination: NotificationDestination) => void }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<SuperadminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('superadmin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as SuperadminNotification[]);
    setUnreadCount((data ?? []).filter((n) => !n.is_read).length);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel('superadmin_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'superadmin_notifications' }, () => {
        loadNotifications();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'superadmin_notifications' }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getDestination = (type: string): NotificationDestination => {
    if (type === 'new_pending_company' || type === 'company_created') return 'companies';
    if (type === 'totem_offline') return 'totems';
    if (type === 'invoice_overdue') return 'billing';
    return 'dashboard';
  };

  const markAsRead = async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    const { error } = await supabase
      .from('superadmin_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) return;
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((prev) => notification && !notification.is_read ? Math.max(0, prev - 1) : prev);
  };

  const openNotification = async (notification: SuperadminNotification) => {
    if (!notification.is_read) await markAsRead(notification.id);
    setOpen(false);
    onNavigate?.(getDestination(notification.type));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('superadmin_notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
        className="relative p-1.5 text-slate-400 hover:text-white transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#D4AF37] rounded-full flex items-center justify-center">
            <span className="text-[8px] font-black text-slate-950">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-xs font-black text-white">Notificações</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="flex items-center gap-1 text-[10px] font-bold text-[#D4AF37] hover:text-[#b8962e] transition-colors">
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <BellOff className="h-8 w-8 text-slate-600" />
                <p className="text-xs text-slate-500">Nenhuma notificação no momento</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={`flex gap-3 p-3 hover:bg-slate-800/30 transition-colors cursor-pointer ${!n.is_read ? 'bg-slate-800/20' : ''}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${TYPE_ICONS[n.type] ?? TYPE_ICONS.general}`}>
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{TYPE_LABELS[n.type] ?? 'Geral'}</p>
                        {!n.is_read && <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs font-bold text-white mt-0.5">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        className="flex-shrink-0 text-slate-500 hover:text-[#D4AF37] transition-colors self-start mt-1"
                        aria-label="Marcar como lida"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
