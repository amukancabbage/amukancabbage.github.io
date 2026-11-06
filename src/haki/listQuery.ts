import { supabase } from '../lib/supabase';
import type { Unit } from '../types';

export type ListFilters = {
  q: string;
  jenis: string;
  tahun: string;
  unit: string;
  status: string;
  sumber: string;
  conf: '' | 'rendah' | 'sedang' | 'tinggi';
  umur: string;
  sort: string;
};

const KEYS: (keyof ListFilters)[] = ['q', 'jenis', 'tahun', 'unit', 'status', 'sumber', 'conf', 'umur', 'sort'];

export function readFilters(sp: URLSearchParams): ListFilters {
  return Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ''])) as ListFilters;
}

export function writeFilters(f: Partial<ListFilters>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of KEYS) if (f[k]) sp.set(k, String(f[k]));
  return sp;
}

// unit beserta seluruh turunannya
export function descendants(units: Pick<Unit, 'id' | 'parent_id'>[], root: number): number[] {
  const out = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of units) {
      if (u.parent_id != null && out.has(u.parent_id) && !out.has(u.id)) {
        out.add(u.id);
        grew = true;
      }
    }
  }
  return [...out];
}

export const SORTS: Record<string, { column: string; ascending: boolean; label: string }> = {
  baru: { column: 'updated_at', ascending: false, label: 'Terbaru diperbarui' },
  lama_antre: { column: 'submitted_at', ascending: true, label: 'Paling lama menunggu' },
  tgl_permohonan: { column: 'tgl_permohonan', ascending: false, label: 'Tanggal permohonan' },
  judul: { column: 'judul', ascending: true, label: 'Judul A–Z' },
};

type Options = { units: Pick<Unit, 'id' | 'parent_id'>[]; high: number; low: number; baseStatuses?: string[]; defaultSort: string };

// filter dari URL ke query hki_record_list (RLS tetap membatasi baris)
export function buildQuery(f: ListFilters, opts: Options, count = true) {
  let query = supabase.from('hki_record_list').select('*', count ? { count: 'exact' } : undefined);
  if (opts.baseStatuses) query = query.in('workflow_status', opts.baseStatuses);
  if (f.status) query = query.eq('workflow_status', f.status);
  if (f.jenis) query = query.eq('jenis', f.jenis);
  if (f.tahun) query = query.eq('tahun', Number(f.tahun));
  if (f.sumber) query = query.eq('sumber_dana', f.sumber);
  if (f.unit) query = query.in('unit_id', descendants(opts.units, Number(f.unit)));
  if (f.conf === 'rendah') query = query.lt('min_confidence', opts.low);
  if (f.conf === 'sedang') query = query.gte('min_confidence', opts.low).lt('min_confidence', opts.high);
  if (f.conf === 'tinggi') query = query.gte('min_confidence', opts.high);
  if (f.umur) query = query.lte('submitted_at', new Date(Date.now() - Number(f.umur) * 86400000).toISOString());
  const q = f.q.replace(/[,()%*]/g, ' ').trim();
  if (q) {
    query = query.or(
      ['judul', 'no_permohonan', 'no_sertifikat', 'pencipta', 'owner_nama'].map((c) => `${c}.ilike.*${q}*`).join(','),
    );
  }
  const sort = SORTS[f.sort] ?? SORTS[opts.defaultSort];
  return query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order('id');
}
