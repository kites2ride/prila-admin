import { useEffect, useMemo, useRef, useState } from 'react';
import { NAV_GROUPS } from '../lib/nav';
import { navigate } from '../lib/pathRouter';

const ALL = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

/** Ctrl/Cmd+K quick jump. Deliberately unanimated: it is used constantly. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? ALL.filter((i) => i.label.toLowerCase().includes(t) || i.group.toLowerCase().includes(t)) : ALL;
  }, [q]);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('prila:palette', toggle);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('prila:palette', toggle);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ('');
      setIdx(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  function go(i: number) {
    const item = results[i];
    if (!item) return;
    setOpen(false);
    navigate(item.id);
  }

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === ref.current) setOpen(false);
      }}
      aria-label="Jump to page"
      className="m-auto mt-[12vh] w-[min(32rem,calc(100vw-2rem))] overscroll-contain rounded-xl border border-[var(--prila-border)] bg-white p-0 shadow-[var(--prila-shadow-pop)] backdrop:bg-black/50"
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIdx((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            go(idx);
          }
        }}
        name="jump"
        autoComplete="off"
        spellCheck={false}
        placeholder="Jump to a page…"
        aria-label="Jump to a page"
        className="w-full rounded-t-2xl border-0 border-b border-[var(--prila-border)] px-4 py-3.5 text-[15px]"
      />
      <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
        {results.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">No matching page</li> : null}
        {results.map((r, i) => (
          <li key={r.id} role="option" aria-selected={i === idx}>
            <button
              type="button"
              onMouseMove={() => setIdx(i)}
              onClick={() => go(i)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm active:!scale-100 ${
                i === idx ? 'bg-[var(--prila-purple-soft)] text-[var(--prila-purple)]' : 'text-slate-700'
              }`}
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-slate-400">{r.group}</span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
