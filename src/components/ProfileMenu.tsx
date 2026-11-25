import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { clearSession, displayNameFromEmail, getEmail } from '../lib/session';
import { navigate, type RouteId } from '../lib/pathRouter';

/**
 * Top-right account menu. Opens on hover (after a short intent delay), click/Enter, or focus + arrow keys.
 * Closes on Esc, outside click, or when the pointer leaves.
 */
export function ProfileMenu() {
  const email = getEmail();
  const name = displayNameFromEmail(email);
  const initial = (name || email || '?').charAt(0).toUpperCase();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const clearTimer = () => window.clearTimeout(timer.current);
  const openSoon = () => {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(true), 120);
  };
  const closeSoon = () => {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function items(): HTMLElement[] {
    return Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    }
  }

  function go(route: RouteId) {
    setOpen(false);
    navigate(route);
  }

  function logout() {
    setOpen(false);
    clearSession();
    navigate('login');
  }

  const itemCls =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:bg-slate-100';

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={(e) => {
        if (e.nativeEvent instanceof MouseEvent) openSoon();
      }}
      onMouseLeave={closeSoon}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => {
          clearTimer();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            window.setTimeout(() => items()[0]?.focus(), 0);
          }
        }}
        className={`flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2.5 hover:border-slate-300 ${
          open ? 'border-slate-300 shadow-[var(--prila-shadow-soft)]' : 'border-[var(--prila-border)]'
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--prila-ink)] text-xs font-semibold text-white"
        >
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate text-[13px] font-medium text-slate-700 sm:block" translate="no">
          {name}
        </span>
        <ChevronDown
          size={14}
          aria-hidden={true}
          className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="prila-menu absolute right-0 top-full z-40 mt-2 w-64 origin-top-right rounded-xl border border-[var(--prila-border)] bg-white p-1.5 shadow-[var(--prila-shadow-pop)]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--prila-ink)] text-sm font-semibold text-white"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--prila-ink)]" translate="no">
                {name}
              </div>
              <div className="truncate text-xs text-slate-500" translate="no" title={email ?? ''}>
                {email ?? 'Not signed in'}
              </div>
            </div>
          </div>
          <div className="my-1 h-px bg-[var(--prila-border-soft)]" role="separator" />
          <button type="button" role="menuitem" className={itemCls} onClick={() => go('profile')}>
            <User size={16} strokeWidth={1.85} aria-hidden={true} className="text-slate-500" />
            Profile
          </button>
          <button type="button" role="menuitem" className={itemCls} onClick={() => go('settings')}>
            <Settings size={16} strokeWidth={1.85} aria-hidden={true} className="text-slate-500" />
            Settings
          </button>
          <div className="my-1 h-px bg-[var(--prila-border-soft)]" role="separator" />
          <button
            type="button"
            role="menuitem"
            className={`${itemCls} !text-rose-600 hover:!bg-rose-50 focus-visible:!bg-rose-50`}
            onClick={logout}
          >
            <LogOut size={16} strokeWidth={1.85} aria-hidden={true} />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
