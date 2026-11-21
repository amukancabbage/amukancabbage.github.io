import { useEffect, useEffectEvent, useState } from 'react';

export function useRemoteData<T>(load: () => Promise<T>, key: string | number = '') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const read = useEffectEvent(load);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    void read().then((value) => {
      if (alive) setData(value);
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : 'Data gagal dimuat.');
    });
    return () => { alive = false; };
  }, [key, attempt]);

  return { data, error, loading: data === null && !error, retry: () => setAttempt((n) => n + 1) };
}
