import { useEffect, useEffectEvent, useState } from 'react';
import { readListPage, readListSort, useListParams } from '../lib/pagination';
import { errorText, rpc } from './api';
import { MINE_TABS } from './constants';
import { buildQuery, readFilters, SORTS, type ListFilters } from './listQuery';
import type { HkiListRow } from './types';
import { useFilterOptions } from './useFilterOptions';

export function useRecordList(mode: 'mine' | 'queue' | 'archive', defaultSize: number, allStatuses = false) {
  const pager = useListParams(defaultSize);
  const filters = readFilters(pager.params);
  const { page, pageSize } = pager;
  const options = useFilterOptions();
  const { settings, units } = options;
  const [rows, setRows] = useState<HkiListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const defaultSort = mode === 'queue' ? 'lama_antre' : mode === 'mine' ? 'baru' : 'tgl_permohonan';
  const order = readListSort(pager.params, SORTS) ?? SORTS[defaultSort];
  const key = JSON.stringify([mode, allStatuses, pager.params.toString(), reload]);

  function query(count = true, head = false) {
    if (!settings) return null;
    const baseStatuses = mode === 'queue' ? ['SUBMITTED']
      : mode === 'mine' ? (MINE_TABS.find((tab) => tab.key === filters.status)?.statuses ?? undefined)
        : allStatuses && filters.status ? undefined : ['ARCHIVED'];
    return buildQuery(mode === 'mine' ? { ...filters, status: '' } : filters,
      { units, high: settings.high, low: settings.low, baseStatuses, order }, count, head);
  }

  const read = useEffectEvent(async (signal: AbortSignal) => {
    setError('');
    try {
      if (mode === 'mine') await rpc('hki_sweep_stale').catch(() => undefined);
      if (signal.aborted) return;
      const result = await readListPage<HkiListRow>(page, pageSize,
        (from, to) => query()!.range(from, to).abortSignal(signal),
        () => query(true, true)!.abortSignal(signal));
      if (signal.aborted) return;
      setTotal(result.total);
      if (result.page !== page) {
        pager.setPage(result.page, true);
        return;
      }
      setRows(result.rows);
      setLoaded(key);
    } catch (reason) {
      if (signal.aborted) return;
      setError(errorText(reason && typeof reason === 'object' && 'message' in reason ? reason.message : reason));
      setLoaded(key);
    }
  });

  useEffect(() => {
    if (!settings) return;
    const controller = new AbortController();
    void read(controller.signal);
    return () => controller.abort();
  }, [key, settings, units]);

  const loading = !settings || key !== loaded;
  useEffect(() => {
    if (mode !== 'mine' || loading || error || !rows.some((row) => row.workflow_status === 'EXTRACTING')) return;
    const timer = window.setTimeout(() => setReload((n) => n + 1), 10_000);
    return () => window.clearTimeout(timer);
  }, [mode, error, loading, rows]);

  return {
    ...options,
    filters,
    pager,
    order,
    rows,
    total,
    loading,
    error: options.error || (!loading ? error : ''),
    query,
    updateFilters: (next: Partial<ListFilters>) => pager.update(next),
    retry: options.error ? options.retry : () => setReload((n) => n + 1),
  };
}
