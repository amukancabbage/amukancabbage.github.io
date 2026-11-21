import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function readPage(params: URLSearchParams) {
  const raw = params.get('page') ?? '';
  const page = Number(raw);
  return /^\d+$/.test(raw) && page > 0 && page <= Math.floor(Number.MAX_SAFE_INTEGER / 50) ? page : 1;
}

export function pageSizes(defaultSize: number) {
  return [...new Set([10, 25, 50, defaultSize])].sort((a, b) => a - b);
}

export function useListParams(defaultSize: number) {
  const [params, setParams] = useSearchParams();
  const choices = pageSizes(defaultSize);
  const size = Number(params.get('size'));
  const pageSize = choices.includes(size) ? size : defaultSize;

  const update = useCallback((changes: Record<string, string | number | null>, {
    resetPage = true, replace = false,
  }: { resetPage?: boolean; replace?: boolean } = {}) => {
    const next = new URLSearchParams(params);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    if (next.toString() !== params.toString()) setParams(next, { replace });
  }, [params, setParams]);

  return {
    params, page: readPage(params), pageSize, choices, update,
    setPage: (page: number, replace = false) => update({ page: page > 1 ? page : null }, { resetPage: false, replace }),
    setSize: (size: number) => update({ size: size === defaultSize ? null : size }),
  };
}

export type ListParams = ReturnType<typeof useListParams>;
export type ListSorts = Record<string, { column: string; label: string; ascending: boolean; chronological?: boolean }>;

export function readListSort(params: URLSearchParams, choices: ListSorts) {
  const key = params.get('sort') ?? '';
  if (!Object.hasOwn(choices, key)) return undefined;
  const choice = choices[key];
  const dir = params.get('dir');
  const ascending = dir === 'asc' || (dir !== 'desc' && choice.ascending);
  return { ...choice, key, ascending };
}

type ReadError = { message: string; code?: string };
type ReadCount = { count: number | null; error: ReadError | null };

export async function readListPage<T>(
  page: number, size: number,
  read: (from: number, to: number) => PromiseLike<ReadCount & { data: T[] | null }>,
  readCount: () => PromiseLike<ReadCount>,
) {
  const from = (page - 1) * size;
  const { data, error, count } = await read(from, from + size - 1);
  const outOfRange = page > 1 && error?.code === 'PGRST103';
  if (error && !outOfRange) throw error;
  let total = count;
  if (total === null && (outOfRange || (page > 1 && !data?.length))) {
    const response = await readCount();
    if (response.error) throw response.error;
    total = response.count ?? 0;
  }
  total ??= from + (data?.length ?? 0);
  return { rows: data ?? [], total, page: Math.min(page, Math.max(1, Math.ceil(total / size))) };
}
