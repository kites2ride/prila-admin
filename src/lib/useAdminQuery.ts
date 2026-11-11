import { useEffect, useState } from 'react';
import { adminFetch, AdminApiError } from './adminFetch';

type State<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

export function useAdminQuery<T>(path: string | null): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    adminFetch<T>(path, { signal: ac.signal })
      .then((d) => {
        if (!ac.signal.aborted) setData(d);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        if (err instanceof AdminApiError) setError(err.message);
        else if (err instanceof Error) setError(err.message);
        else setError('Request failed');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [path, tick]);

  return {
    data,
    error,
    loading,
    reload: () => setTick((t) => t + 1),
  };
}
