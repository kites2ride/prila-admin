import { useEffect, useId, useState } from 'react';

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** High-impact actions: the user must type this exact phrase before Confirm is enabled. */
  requireText?: string;
  /** Visual emphasis for destructive / user-blocking actions. */
  danger?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  requireText,
  danger,
}: Props) {
  const [typed, setTyped] = useState('');
  const inputId = useId();

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onCancel]);

  if (!open) return null;
  const locked = Boolean(requireText) && typed.trim() !== requireText;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 max-h-[50vh] overflow-y-auto text-sm text-slate-600 whitespace-pre-wrap">{body}</p>
        {requireText ? (
          <div className="mt-4">
            <label htmlFor={inputId} className="text-xs text-slate-600">
              Type <span className="font-mono font-semibold text-slate-900">{requireText}</span> to confirm
            </label>
            <input
              id={inputId}
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            disabled={locked}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${
              danger ? 'bg-red-600' : 'bg-violet-600'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
