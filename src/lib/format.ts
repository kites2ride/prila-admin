/**
 * One place for every number, money and date shown in the panel.
 * Operations run on Indian time, so dates always render in IST regardless of the viewer's laptop.
 */
const LOCALE = 'en-IN';
const TZ = 'Asia/Kolkata';

const inrWhole = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat(LOCALE);
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TZ,
});
const dateOnly = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
const timeOnly = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });

/** Money arrives as integer paise. Whole rupees by default; pass exact for fare breakdowns. */
export function formatInr(paise: number | null | undefined, opts?: { exact?: boolean }): string {
  if (paise == null || Number.isNaN(paise)) return '—';
  const rupees = paise / 100;
  return (opts?.exact || paise % 100 !== 0 ? inrExact : inrWhole).format(rupees);
}

export function formatNumber(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? '—' : num.format(n);
}

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "25 Nov 2026, 2:38 pm" (IST). */
export function formatDateTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? dateTime.format(d).replace(/\bam\b/i, 'am').replace(/\bpm\b/i, 'pm') : '—';
}

export function formatDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? dateOnly.format(d) : '—';
}

export function formatTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? timeOnly.format(d).replace(/\bam\b/i, 'am').replace(/\bpm\b/i, 'pm') : '—';
}

/** "YYYY-MM-DD" (an IST day) to "1 Nov 2026". */
export function formatYmd(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? ymd : dateOnly.format(d);
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.round(sec)}s`;
}

/** "5 min ago", falling back to the absolute date once it is more than a day old. */
export function formatRelative(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return formatDateTime(d);
}
