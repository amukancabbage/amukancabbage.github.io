import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readPage } from '../lib/pagination';
import { errorText, rpc } from './api';
import { MINE_TABS } from './constants';
import { buildQuery, readFilters, writeFilters, type ListFilters } from './listQuery';
import type { HkiListRow } from './types';
import { useFilterOptions } from './useFilterOptions';

export function useRecordList(mode: 'mine' | 'queue' | 'archive', pageSize: number, allStatuses = false) {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const page = readPage(params);
  const options = useFilterOptions();
  const { settings, units } = options;
  const [rows, setRows] = useState<HkiListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  function query(count = true) {
    if (!settings) return null;
    const baseStatuses = mode === 'queue' ? ['SUBMITTED']
      : mode === 'mine' ? (MINE_TABS.find((tab) => tab.key === filters.status)?.statuses ?? undefined)
        : allStatuses && filters.status ? undefined : ['ARCHIVED'];
    const defaultSort = mode === 'queue' ? 'lama_antre' : mode === 'mine' ? 'baru' : 'tgl_permohonan';
    return buildQuery(mode === 'mine' ? { ...filters, status: '' } : filters,
      { units, high: settings.high, low: settings.low, baseStatuses, defaultSort }, count);
  }

  useEffect(() => {
    const request = query();
    if (!request) return;
    let alive = true;
    setLoading(true);
    setError('');
    async function read() {
      if (mode === 'mine') await rpc('hki_sweep_stale').catch(() => undefined);
      const { data, count, error } = await request!.range((page - 1) * pageSize, page * pageSize - 1);
      if (!alive) return;
      if (page > 1 && (error?.code === 'PGRST103' || (!error && !data?.length))) {
        const next = new URLSearchParams(params);
        next.delete('page');
        setParams(next, { replace: true });
        return;
      }
      if (error) throw error;
      setRows((data as HkiListRow[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    }
    void read().catch((reason) => {
      if (!alive) return;
      setError(errorText(reason.message ?? reason));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [params, mode, pageSize, allStatuses, settings, units, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'mine' || error || !rows.some((row) => row.workflow_status === 'EXTRACTING')) return;
    const timer = window.setTimeout(() => setReload((n) => n + 1), 10_000);
    return () => window.clearTimeout(timer);
  }, [mode, error, rows]);

  return {
    ...options,
    filters,
    rows,
    total,
    loading,
    error: options.error || error,
    query,
    updateFilters: (next: ListFilters) => setParams(writeFilters(next)),
    retry: options.error ? options.retry : () => setReload((n) => n + 1),
  };
}
