import type { ReactNode } from 'react';
import { Pager } from './Pager';
import { EmptyState } from './ui';

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
          <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--prila-muted)]">{description}</p> : null}
        </div>
        {filters}
      </div>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="surface space-y-3 p-4" aria-busy="true">
          <div className="prila-skel h-10 w-full" />
          <div className="prila-skel h-10 w-11/12" />
          <div className="prila-skel h-10 w-10/12" />
          <div className="prila-skel h-10 w-9/12" />
        </div>
      ) : !error && total === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          hint="No records match the current filters. Adjust or clear them, or check back after activity picks up."
        />
      ) : (
        children
      )}
      {total > 0 ? <Pager page={page} limit={limit} total={total} onPage={onPage} /> : null}
    </div>
  );
}
