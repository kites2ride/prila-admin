import type { ReactNode } from 'react';

export const inputCls = (bad?: boolean) => `field w-full placeholder:text-slate-400 ${bad ? 'field-bad' : ''}`;

export function Field({
  label,
  hint,
  error,
  counter,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {counter ? <span className="text-xs text-slate-400">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
        checked ? 'bg-[var(--prila-purple)]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-[#ffffff] shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
