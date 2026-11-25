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
    <div
      className="prila-fade fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="prila-pop w-full max-w-md rounded-xl border border-[var(--prila-border)] bg-white p-6 shadow-[var(--prila-shadow-pop)]"
      >
        <h2 className="text-lg font-semibold text-[var(--prila-ink)]">{title}</h2>
        <p className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {body}
        </p>
        {requireText ? (
          <div className="mt-4">
            <label htmlFor={inputId} className="text-xs text-slate-600">
              Type <span className="font-mono font-semibold text-slate-900">{requireText}</span> to confirm
            </label>
            <input
              id={inputId}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="field mt-1 w-full"
            />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            disabled={locked}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
