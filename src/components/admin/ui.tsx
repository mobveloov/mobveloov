import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function PageHeader({ icon: Icon, title, subtitle, action }: {
  icon: typeof Loader2;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 ring-1 ring-gold-500/25">
          <Icon className="h-5 w-5 text-gold-400" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-100">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Loader2;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-3xl font-extrabold text-slate-100">{value}</p>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/50 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'gold';
}) {
  const variants = {
    default: 'bg-slate-800 text-slate-400 border-slate-700',
    success: 'bg-success-500/15 text-success-500 border-success-500/30',
    warning: 'bg-warning-500/15 text-warning-500 border-warning-500/30',
    error: 'bg-error-500/15 text-error-500 border-error-500/30',
    gold: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, className = '' }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: 'bg-gold-500 text-neutral-900 hover:bg-gold-400 shadow-lg shadow-gold-500/20',
    secondary: 'bg-slate-800 text-slate-300 hover:bg-slate-700',
    danger: 'bg-error-500/15 text-error-400 hover:bg-error-500/25 border border-error-500/30',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-400">{label}{required && <span className="text-error-400"> *</span>}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold-500/40 focus:outline-none focus:ring-2 focus:ring-gold-500/30 transition-all"
      />
    </div>
  );
}

export function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 focus:border-gold-500/40 focus:outline-none focus:ring-2 focus:ring-gold-500/30 transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function EmptyState({ icon: Icon, message }: { icon: typeof Loader2; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/60">
        <Icon className="h-7 w-7 text-slate-600" />
      </div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-gold-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </label>
  );
}
