import type { ReactNode } from 'react';
import { Pager } from './Pager';

type Props = {
  title: string;
  filters?: ReactNode;
  children: ReactNode;
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
  loading?: boolean;
  error?: string | null;
  description?: string;
};

export function ListPage({
  title,
  filters,
  children,
  page,
  limit,
  total,
  onPage,
  loading,
  error,
  description,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--prila-text)]">{title}</h1>
          {description ? <p className="mt-1 text-sm text-[var(--prila-muted)]">{description}</p> : null}
        </div>
        {filters}
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {loading ? (
        <div className="space-y-3 rounded-2xl border border-[var(--prila-border)] bg-white p-4">
          <div className="prila-skel h-10 w-full" />
          <div className="prila-skel h-10 w-11/12" />
          <div className="prila-skel h-10 w-10/12" />
          <div className="prila-skel h-10 w-9/12" />
        </div>
      ) : (
        children
      )}
      <Pager page={page} limit={limit} total={total} onPage={onPage} />
    </div>
  );
}
