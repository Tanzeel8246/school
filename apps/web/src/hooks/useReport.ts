import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ListMeta } from '@/hooks/useApiList';

/**
 * The backend reports endpoint returns an envelope:
 *   { data: TRow[], meta?: ListMeta, summary: TSummary }
 * The outer api.get Envelope wraps this as { data: <above> }.
 */
interface ReportBody<TRow, TSummary> {
  data: TRow[];
  meta?: ListMeta;
  summary: TSummary;
}

interface UseReportResult<TRow, TSummary> {
  rows: TRow[];
  meta: ListMeta | null;
  summary: TSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  page: number;
  setPage: (n: number) => void;
}

/**
 * Generic report fetcher.
 * - Debounces text-style param changes by 400ms.
 * - Resets page to 1 when non-page params change.
 * - Exposes refetch() to manually re-trigger.
 */
export function useReport<TRow, TSummary>(
  type: string,
  params: Record<string, string | number | undefined>,
): UseReportResult<TRow, TSummary> {
  const [rows, setRows] = useState<TRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [summary, setSummary] = useState<TSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [nonce, setNonce] = useState(0);

  // Debounced copy of params (text inputs are slow; selects/dates update immediately).
  const [debouncedParams, setDebouncedParams] = useState<typeof params>(params);
  const latestParams = useRef(params);
  latestParams.current = params;

  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const setPage = useCallback((n: number) => setPageState(n), []);

  // Debounce param changes by 400ms.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedParams(latestParams.current);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  // Reset page to 1 when debounced params change (skip initial mount).
  const isFirstRun = useRef(true);
  const prevKey = useRef(JSON.stringify(debouncedParams));
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const key = JSON.stringify(debouncedParams);
    if (key !== prevKey.current) {
      prevKey.current = key;
      setPageState(1);
    }
  }, [debouncedParams]);

  // Main fetch effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        for (const [k, v] of Object.entries(debouncedParams)) {
          if (v !== undefined && v !== '') qs.set(k, String(v));
        }
        // api.get returns Envelope<ReportBody<TRow, TSummary>>.
        // The outer envelope is { data: ReportBody, meta?: ListMeta }.
        // ReportBody is { data: TRow[], meta?: ListMeta, summary: TSummary }.
        const res = await api.get<ReportBody<TRow, TSummary>>(
          `/reports/${type}?${qs.toString()}`,
        );
        if (cancelled) return;
        // Handle both flat ({ data: rows[], meta, summary at top level }) and
        // nested ({ data: { data: rows[], meta, summary } }) shapes.
        const body = res.data as unknown as ReportBody<TRow, TSummary> & TRow[];
        const innerRows: TRow[] = Array.isArray(body)
          ? body
          : (body as ReportBody<TRow, TSummary>).data ?? [];
        const innerMeta: ListMeta | undefined = Array.isArray(body)
          ? (res.meta as ListMeta | undefined)
          : (body as ReportBody<TRow, TSummary>).meta ?? (res.meta as ListMeta | undefined);
        const innerSummary: TSummary | null = Array.isArray(body)
          ? null
          : (body as ReportBody<TRow, TSummary>).summary ?? null;
        setRows(innerRows);
        setMeta(innerMeta ?? null);
        setSummary(innerSummary);
      } catch {
        if (!cancelled) setError('Could not load report. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(debouncedParams), page, nonce]);

  return { rows, meta, summary, loading, error, refetch, page, setPage };
}
