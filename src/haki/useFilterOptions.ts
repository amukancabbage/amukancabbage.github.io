import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadMaster, loadSettings, type HakiSettings } from './api';
import type { MasterItem } from './types';
import type { Unit } from '../types';

type FilterOptions = { units: Unit[]; master: MasterItem[]; settings: HakiSettings };
const emptyUnits: Unit[] = [];
const emptyMaster: MasterItem[] = [];

export async function loadUnits(signal: AbortSignal) {
  const rows: Unit[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase.from('units').select('id,nama,parent_id,tipe')
      .order('nama').order('id').range(offset, offset + size - 1).abortSignal(signal);
    if (error) throw error;
    rows.push(...(data as Unit[]));
    if (data.length < size) return rows;
  }
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void Promise.all([loadUnits(controller.signal), loadMaster(), loadSettings()])
      .then(([units, master, settings]) => {
        if (!controller.signal.aborted) setOptions({ units, master, settings });
      })
      .catch(() => { if (!controller.signal.aborted) setError('Pilihan filter gagal dimuat.'); });
    return () => controller.abort();
  }, [reload]);

  return {
    units: options?.units ?? emptyUnits,
    master: options?.master ?? emptyMaster,
    settings: options?.settings ?? null,
    error,
    retry: () => setReload((n) => n + 1),
  };
}
