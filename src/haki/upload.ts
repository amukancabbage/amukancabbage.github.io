import { supabase } from '../lib/supabase';
import { BUCKET, rpc, runExtraction, toHakiError, uploadObject } from './api';
import type { PreparedFile } from './pdfPrep';

export type RegisterResult = {
  file_id: string;
  jenis: 'utama' | 'lampiran';
  workflow_status: string;
  ai_enabled: boolean;
  duplicate_file: boolean;
  duplicate_file_of: string | null;
};

type UploadAttempt = { key: string; resume: boolean };

// unggah berkas asli + gambar halaman + manifes .prep.json, lalu daftarkan ke rekaman
export async function attachFile(recordId: string, prep: PreparedFile, attempt?: UploadAttempt): Promise<RegisterResult | null> {
  const base = `records/${recordId}/${attempt?.key ?? crypto.randomUUID()}`;
  const mainPath = `${base}.${prep.ext}`;
  if (attempt?.resume) {
    const { data, error } = await supabase.from('hki_files').select('id').eq('storage_path', mainPath).maybeSingle();
    if (error) throw toHakiError(error);
    if (data) return null;
  }

  async function store(path: string, body: Blob, mime: string) {
    if (attempt?.resume) {
      const { data } = await supabase.storage.from(BUCKET).exists(path);
      if (data) return;
    }
    await uploadObject(path, body, mime);
  }

  await store(mainPath, prep.file, prep.mime);

  const pagePaths: string[] = [];
  for (const p of prep.pages) {
    const path = `${base}.p${p.page}.jpg`;
    await store(path, p.image, 'image/jpeg');
    pagePaths.push(path);
  }
  const manifest = {
    pages: prep.pages.map((p, i) => ({ page: p.page, path: pagePaths[i], text: p.text })),
    meta: { page_count: prep.pageCount, text_layer: prep.textLayer, mime: prep.mime, nama: prep.file.name },
  };
  const manifestPath = `${base}.prep.json`;
  await store(manifestPath, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), 'application/json');

  return rpc<RegisterResult>('hki_register_file', {
    p_record: recordId,
    p_path: mainPath,
    p_nama: prep.file.name,
    p_mime: prep.mime,
    p_ukuran: prep.file.size,
    p_sha256: prep.sha256,
    p_halaman: prep.pageCount,
    p_prep: { pages: pagePaths, page_numbers: prep.pages.map((p) => p.page), manifest: manifestPath },
  });
}

export async function registerCertificate(recordId: string, prep: PreparedFile, attempt: UploadAttempt) {
  const result = await attachFile(recordId, prep, attempt);
  if (result?.ai_enabled && result.jenis === 'utama') {
    try {
      await runExtraction(recordId);
    } catch {
      // rekaman tetap DRAFT; pengguna bisa menekan "Baca dengan AI" di layar dokumen
    }
  }
  return result;
}
