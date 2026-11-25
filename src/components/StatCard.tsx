type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <div className="surface p-4">
      <div className="text-[13px] font-medium text-[var(--prila-muted)]">{label}</div>
      <div className="mt-1.5 text-[26px] font-semibold leading-8 tracking-tight text-[var(--prila-ink)] tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}
