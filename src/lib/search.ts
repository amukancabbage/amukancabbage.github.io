import { supabase } from './supabase';

export function contains(value: string) {
  return '%' + value.replace(/[\\%_]/g, '\\$&') + '%';
}

export function textCondition(column: string, value: string) {
  return column + '.ilike.' + JSON.stringify(contains(value));
}

export type Choice = { value: string; label: string; detail?: string };
export type ChoiceSource = {
  table: string;
  select: string;
  order: string;
  label: (row: any) => string;
  detail?: (row: any) => string | undefined;
};

export const lecturerSource: ChoiceSource = {
  table: 'dosen', select: 'id,nama,unit:units(nama)', order: 'nama',
  label: (row) => row.nama, detail: (row) => row.unit?.nama,
};

export const unitSource: ChoiceSource = {
  table: 'units', select: 'id,nama', order: 'nama', label: (row) => row.nama,
};

export const programSource: ChoiceSource = {
  table: 'prodi', select: 'id,prodi', order: 'prodi', label: (row) => row.prodi,
};

function asChoices(rows: unknown[], source: ChoiceSource): Choice[] {
  return rows.map((row: any) => ({ value: String(row.id), label: source.label(row), detail: source.detail?.(row) }));
}

export async function searchChoices(source: ChoiceSource, term: string, signal: AbortSignal, unitIds?: number[]) {
  if (unitIds?.length === 0) return [];
  let query = supabase.from(source.table).select(source.select)
    .ilike(source.order, contains(term)).order(source.order).order('id').limit(20);
  if (unitIds) query = query.in('unit_id', unitIds);
  const { data, error } = await query.abortSignal(signal);
  if (error) throw error;
  return asChoices(data ?? [], source);
}

export async function loadChoiceLabels(source: ChoiceSource, ids: string[], signal: AbortSignal) {
  const choices: Choice[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from(source.table).select(source.select)
      .in('id', ids.slice(offset, offset + 200)).abortSignal(signal);
    if (error) throw error;
    choices.push(...asChoices(data ?? [], source));
  }
  return choices;
}
