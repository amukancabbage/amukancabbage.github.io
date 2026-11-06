import { supabase } from '../lib/supabase';
import { ERROR_MESSAGES } from './constants';
import type { MasterItem, Problem } from './types';

export const BUCKET = 'haki-files';

// galat RPC berbentuk 'KODE: pesan' (lihat migrasi haki_workflow)
export class HakiError extends Error {
  code: string;
  problems: Problem[];

  constructor(code: string, message: string, problems: Problem[] = []) {
    super(message);
    this.code = code;
    this.problems = problems;
  }
}

export function toHakiError(error: { message?: string; details?: string | null; code?: string }): HakiError {
  const raw = error.message ?? 'Terjadi kesalahan';
  const m = raw.match(/^([A-Z_]+): (.*)$/s);
  let problems: Problem[] = [];
  if (error.details) {
    try {
      const parsed = JSON.parse(error.details);
      if (Array.isArray(parsed)) problems = parsed;
    } catch {
      // detail bukan JSON
    }
  }
  if (m) return new HakiError(m[1], ERROR_MESSAGES[m[1]] ?? m[2], problems);
  if (error.code === '42501') return new HakiError('FORBIDDEN', 'Anda tidak punya hak akses untuk aksi ini.');
  if (error.code === '23505') return new HakiError('DUPLICATE', 'Data sudah ada (duplikat).');
  return new HakiError('ERROR', raw);
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toHakiError(error);
  return data as T;
}

export function errorText(e: unknown): string {
  if (e instanceof HakiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

export type HakiSettings = {
  aiEnabled: boolean;
  high: number;
  low: number;
  maxRereads: number;
  maxPages: number;
  raw: Record<string, unknown>;
};

export async function loadSettings(): Promise<HakiSettings> {
  const { data } = await supabase.from('hki_settings').select('key, value');
  const raw = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    aiEnabled: raw['ai.enabled'] === true,
    high: Number(raw['ai.confidence_high'] ?? 0.85),
    low: Number(raw['ai.confidence_low'] ?? 0.5),
    maxRereads: Number(raw['ai.max_rereads'] ?? 3),
    maxPages: Number(raw['ai.max_pages'] ?? 6),
    raw,
  };
}

export async function loadMaster(): Promise<MasterItem[]> {
  const { data } = await supabase.from('hki_master_items').select('*').order('kategori').order('urutan');
  return (data as MasterItem[]) ?? [];
}

export function masterLabel(items: MasterItem[], kategori: string, nilai: string | null | undefined): string {
  if (!nilai) return '';
  return items.find((m) => m.kategori === kategori && m.nilai === nilai)?.label ?? nilai;
}

export async function downloadBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new HakiError('NOT_FOUND', 'Berkas tidak dapat dibuka.');
  return data;
}

export async function uploadObject(path: string, body: Blob, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw new HakiError('UPLOAD_FAILED', `Gagal mengunggah berkas: ${error.message}`);
}

// minta Edge Function membaca dokumen; status sudah EXTRACTING lewat hki_start_extraction
export async function runExtraction(recordId: string) {
  await rpc('hki_start_extraction', { p_record: recordId });
  // tidak ditunggu: hasil datang lewat notifikasi/polling, sapu stale menangani yang macet
  supabase.functions.invoke('haki-extract', { body: { record_id: recordId } }).catch(() => undefined);
}

export function notifyChanged() {
  window.dispatchEvent(new Event('haki:notifications'));
}
