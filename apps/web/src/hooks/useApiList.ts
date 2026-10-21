import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseApiListOptions {
  /** Base path without query string, e.g. '/students'. */
  path: string;
  /** Extra filter params (sectionId, status, staffType, …). */
  params?: Record<string, string | number | undefined>;
  limit?: number;
}

interface UseApiListResult<T> {
  rows: T[];
  meta: ListMeta | null;
  loading: boolean;
  error: string | null;
  query: string;
  page: number;
  setQuery: (q: string) => void;
  setPage: (p: number) => void;
  refetch: () => void;
}

/**
 * Generic searchable + paginated list fetcher (envelope { data, meta }).
 * Debounces the search term by 300ms and resets to page 1 on query/filter change.
 * Modelled on the original StudentsList fetch logic.
 */
export function useApiList<T>({
  path,
  params = {},
  limit = 20,
}: UseApiListOptions): UseApiListResult<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0); // bumped by refetch()

  // Serialize filter params so the effect dependency is stable.
  const paramsKey = JSON.stringify(params);

  const setQuery = useCallback((q: string) => {
    setPage(1);
    setQueryState(q);
  }, []);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  // Debounce the raw query into debouncedQuery (300ms).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset to page 1 when filters change.
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    setPage(1);
  }, [paramsKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (debouncedQuery) qs.set('q', debouncedQuery);
        qs.set('page', String(page));
        qs.set('limit', String(limit));
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== '') qs.set(k, String(v));
        }
        const res = await api.get<T[]>(`${path}?${qs.toString()}`);
        if (cancelled) return;
        setRows(res.data ?? []);
        setMeta((res.meta as ListMeta) ?? null);
      } catch {
        if (!cancelled) setError('Could not load data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, debouncedQuery, page, limit, paramsKey, nonce]);

  return { rows, meta, loading, error, query, page, setQuery, setPage, refetch };
}
