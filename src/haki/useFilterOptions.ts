import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadMaster, loadSettings, type HakiSettings } from './api';
import type { MasterItem } from './types';
import type { Unit } from '../types';

type FilterOptions = { units: Unit[]; master: MasterItem[]; settings: HakiSettings };
const emptyUnits: Unit[] = [];
const emptyMaster: MasterItem[] = [];

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    void Promise.all([supabase.from('units').select('*').order('nama'), loadMaster(), loadSettings()])
      .then(([units, master, settings]) => {
        if (units.error) throw units.error;
        if (alive) setOptions({ units: (units.data as Unit[]) ?? [], master, settings });
      })
      .catch(() => { if (alive) setError('Pilihan filter gagal dimuat.'); });
    return () => { alive = false; };
  }, [reload]);

  return {
    units: options?.units ?? emptyUnits,
    master: options?.master ?? emptyMaster,
    settings: options?.settings ?? null,
    error,
    retry: () => setReload((n) => n + 1),
  };
}
