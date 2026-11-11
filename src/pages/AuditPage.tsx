import { ListPage } from '../components/ListPage';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';

type AuditList = {
  items: Array<{
    id: string;
    actor: string;
    action: string;
    key?: string;
    at: string;
  }>;
  page: number;
  limit: number;
  total: number;
};

export function AuditPage() {
  const [page, setPage] = useStickyState('audit_page', 1);
  const limit = 20;
  const { data, error, loading } = useAdminQuery<AuditList>(`/admin/audit?page=${page}&limit=${limit}`);

  return (
    <ListPage
      title="Audit log"
      page={page}
      limit={limit}
      total={data?.total ?? 0}
      onPage={setPage}
      loading={loading}
      error={error}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Key</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{new Date(row.at).toLocaleString()}</td>
                <td className="px-4 py-3">{row.actor}</td>
                <td className="px-4 py-3">{row.action}</td>
                <td className="px-4 py-3 text-slate-500">{row.key ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPage>
  );
}
