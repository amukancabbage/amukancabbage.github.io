import { supabase } from '../lib/supabase';
import { textCondition } from '../lib/search';
import type { ListSorts } from '../lib/pagination';
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
};

const KEYS: (keyof ListFilters)[] = ['q', 'jenis', 'tahun', 'unit', 'status', 'sumber', 'conf', 'umur'];

export function readFilters(sp: URLSearchParams): ListFilters {
  return Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ''])) as ListFilters;
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

export const SORTS: ListSorts = {
  baru: { column: 'updated_at', ascending: false, label: 'Pembaruan', chronological: true },
  lama_antre: { column: 'submitted_at', ascending: true, label: 'Pengajuan', chronological: true },
  tgl_permohonan: { column: 'tgl_permohonan', ascending: false, label: 'Tanggal permohonan', chronological: true },
  judul: { column: 'judul', ascending: true, label: 'Judul' },
};

type Options = {
  units: Pick<Unit, 'id' | 'parent_id'>[];
  high: number;
  low: number;
  baseStatuses?: string[];
  order: { column: string; ascending: boolean };
};

// filter dari URL ke query hki_record_list (RLS tetap membatasi baris)
export function buildQuery(f: ListFilters, opts: Options, count = true, head = false) {
  let query = supabase.from('hki_record_list').select(head ? 'id' : '*', count ? { count: 'exact', head } : undefined);
  if (opts.baseStatuses) query = query.in('workflow_status', opts.baseStatuses);
  if (f.status) query = query.eq('workflow_status', f.status);
  if (f.jenis) query = query.eq('jenis', f.jenis);
  if (/^\d{4}$/.test(f.tahun)) query = query.eq('tahun', Number(f.tahun));
  if (f.sumber) query = query.eq('sumber_dana', f.sumber);
  if (/^\d+$/.test(f.unit)) query = query.in('unit_id', descendants(opts.units, Number(f.unit)));
  if (f.conf === 'rendah') query = query.lt('min_confidence', opts.low);
  if (f.conf === 'sedang') query = query.gte('min_confidence', opts.low).lt('min_confidence', opts.high);
  if (f.conf === 'tinggi') query = query.gte('min_confidence', opts.high);
  if (['3', '7', '14'].includes(f.umur)) query = query.lte('submitted_at', new Date(Date.now() - Number(f.umur) * 86400000).toISOString());
  const q = f.q.trim();
  if (q) {
    query = query.or(
      ['judul', 'no_permohonan', 'no_sertifikat', 'pencipta', 'owner_nama'].map((column) => textCondition(column, q)).join(','),
    );
  }
  return query.order(opts.order.column, { ascending: opts.order.ascending, nullsFirst: false }).order('id');
}
