// konteks Sebelumnya/Berikutnya antrean validator (sessionStorage)
const KEY = 'haki.queue';

type QueueContext = { ids: string[]; back: string };

export function saveQueue(ids: string[], back: string) {
  sessionStorage.setItem(KEY, JSON.stringify({ ids, back } satisfies QueueContext));
}

export function readQueue(): QueueContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueueContext) : null;
  } catch {
    return null;
  }
}

export function neighbours(id: string): { prev: string | null; next: string | null; index: number; total: number; back: string } | null {
  const q = readQueue();
  if (!q) return null;
  const index = q.ids.indexOf(id);
  if (index < 0) return null;
  return {
    prev: index > 0 ? q.ids[index - 1] : null,
    next: index < q.ids.length - 1 ? q.ids[index + 1] : null,
    index,
    total: q.ids.length,
    back: q.back,
  };
}

// hanya tautan internal relatif yang aman (?next=)
export function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}
