import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertCircle, X, Loader2, Search, Bell, Menu,
  ChevronLeft, ChevronRight, Inbox,
} from 'lucide-react';

export type ToastType = 'success' | 'error';
export interface ToastMsg { id: number; type: ToastType; text: string; }

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const show = useCallback((type: ToastType, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const success = useCallback((t: string) => show('success', t), [show]);
  const error = useCallback((t: string) => show('error', t), [show]);
  return { toasts, success, error };
}

export function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border animate-fade-in text-sm font-bold ${
            t.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {t.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          <span className="flex-1">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function ConfirmModal({
  open, title, message, confirmLabel, onConfirm, onCancel, danger,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-black text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#D4AF37] hover:bg-[#b8962e] text-slate-950'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none transition-colors"
      />
    </div>
  );
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs font-bold text-slate-400 px-2">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-600 mb-3">{icon ?? <Inbox className="h-10 w-10" />}</div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      <p className="text-xs text-slate-500">{label ?? 'Carregando...'}</p>
    </div>
  );
}

export function StatusBadge({ status, labels }: { status: string; labels: Record<string, { text: string; cls: string }> }) {
  const cfg = labels[status] ?? { text: status, cls: 'bg-slate-500/10 text-slate-400' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-block ${cfg.cls}`}>
      {cfg.text}
    </span>
  );
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function PageHeader({
  title, searchValue, onSearchChange, onMenuClick, rightSlot,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onMenuClick: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-6 px-6 py-4 flex items-center gap-4">
      <button onClick={onMenuClick} className="lg:hidden text-slate-400 hover:text-white" aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </button>
      <h2 className="text-sm font-black text-white">{title}</h2>
      <div className="ml-auto flex items-center gap-4">
        <div className="relative hidden sm:block w-56 lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Busca global..."
            className="w-full bg-transparent border-0 border-b border-slate-800 pl-10 pr-2 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>
        {rightSlot}
      </div>
    </header>
  );
}

export function Modal({
  open, onClose, title, children, maxWidth,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        style={{ maxWidth: maxWidth ?? '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none transition-colors';
export const labelCls = 'mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider';
export const btnGold = 'bg-[#D4AF37] hover:bg-[#b8962e] text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50';
export const btnGhost = 'text-slate-400 hover:text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors';
