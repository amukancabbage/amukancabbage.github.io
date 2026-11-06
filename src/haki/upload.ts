import { rpc, runExtraction, uploadObject } from './api';
import type { PreparedFile } from './pdfPrep';

export type RegisterResult = {
  file_id: string;
  jenis: 'utama' | 'lampiran';
  workflow_status: string;
  ai_enabled: boolean;
  duplicate_file: boolean;
  duplicate_file_of: string | null;
};

// unggah berkas asli + gambar halaman + manifes .prep.json, lalu daftarkan ke rekaman
export async function attachFile(recordId: string, prep: PreparedFile): Promise<RegisterResult> {
  const base = `records/${recordId}/${crypto.randomUUID()}`;
  const mainPath = `${base}.${prep.ext}`;
  await uploadObject(mainPath, prep.file, prep.mime);

  const pagePaths: string[] = [];
  for (const p of prep.pages) {
    const path = `${base}.p${p.page}.jpg`;
    await uploadObject(path, p.image, 'image/jpeg');
    pagePaths.push(path);
  }
  const manifest = {
    pages: prep.pages.map((p, i) => ({ page: p.page, path: pagePaths[i], text: p.text })),
    meta: { page_count: prep.pageCount, text_layer: prep.textLayer, mime: prep.mime, nama: prep.file.name },
  };
  const manifestPath = `${base}.prep.json`;
  await uploadObject(manifestPath, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), 'application/json');

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

export async function uploadNewRecord(prep: PreparedFile, onBehalf: number | null) {
  const recordId = await rpc<string>('hki_create_record', { p_on_behalf: onBehalf, p_manual: false });
  const result = await attachFile(recordId, prep);
  if (result.ai_enabled && result.jenis === 'utama') {
    try {
      await runExtraction(recordId);
    } catch {
      // rekaman tetap DRAFT; pengguna bisa menekan "Baca dengan AI" di layar dokumen
    }
  }
  return { recordId, ...result };
}
