import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { MAX_FILE_BYTES, MAX_PDF_PAGES } from './constants';

GlobalWorkerOptions.workerSrc = workerUrl;

export type PreparedPage = { page: number; image: Blob; text: string };

export type PreparedFile = {
  file: File;
  mime: string;
  ext: string;
  sha256: string;
  pageCount: number | null;
  pages: PreparedPage[];
  textLayer: boolean;
};

export class PrepError extends Error {}

const KEYWORDS = /sertifikat|pencatatan|ciptaan|paten|merek|desain|pemegang|pencipta|inventor|nomor/gi;
const RENDER_WIDTH = 1600;

// jenis berkas dari magic bytes, bukan ekstensi
export function detectMime(bytes: Uint8Array): { mime: string; ext: string } | null {
  const ascii = (from: number, len: number) => String.fromCharCode(...bytes.slice(from, from + len));
  if (ascii(0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (bytes[0] === 0x89 && ascii(1, 3) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (ascii(4, 4) === 'ftyp' && /heic|heix|hevc|mif1|msf1|heif/.test(ascii(8, 4))) return { mime: 'image/heic', ext: 'heic' };
  return null;
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new PrepError('Gagal merender halaman'))), 'image/jpeg', 0.82),
  );
}

// halaman pertama selalu; sisanya yang paling banyak kata kunci sertifikat
function pickPages(texts: string[], max: number): number[] {
  const scored = texts.map((t, i) => ({ i, score: (i === 0 ? 1000 : 0) + (t.match(KEYWORDS)?.length ?? 0) * 10 - i }));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.i)
    .sort((a, b) => a - b);
}

async function preparePdf(buffer: ArrayBuffer, maxPages: number): Promise<{ count: number; pages: PreparedPage[]; textLayer: boolean }> {
  const tail = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(Math.max(0, buffer.byteLength - 2048))));
  if (!tail.includes('%%EOF')) throw new PrepError('PDF rusak atau tidak lengkap (tanpa penanda akhir).');

  let pdf: PDFDocumentProxy;
  try {
    pdf = await getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  } catch (e) {
    if (e instanceof Error && e.name === 'PasswordException') throw new PrepError('PDF terenkripsi/berkata sandi tidak didukung.');
    throw new PrepError('PDF tidak dapat dibaca.');
  }
  if (pdf.numPages > MAX_PDF_PAGES) throw new PrepError(`PDF maksimal ${MAX_PDF_PAGES} halaman (berkas ini ${pdf.numPages}).`);

  const texts: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    texts.push(
      content.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }

  const pages: PreparedPage[] = [];
  for (const i of pickPages(texts, maxPages)) {
    const page = await pdf.getPage(i + 1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, RENDER_WIDTH / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    pages.push({ page: i + 1, image: await canvasToJpeg(canvas), text: texts[i] });
  }
  const count = pdf.numPages;
  await pdf.loadingTask.destroy();
  return { count, pages, textLayer: texts.some((t) => t.length > 20) };
}

async function prepareImage(file: File): Promise<PreparedPage[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PrepError('Gambar tidak dapat dibuka di peramban ini (HEIC sering tidak didukung). Ubah ke JPEG/PNG.');
  }
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return [{ page: 1, image: await canvasToJpeg(canvas), text: '' }];
}

export async function prepareFile(file: File, maxPages = 6): Promise<PreparedFile> {
  if (file.size === 0) throw new PrepError('Berkas kosong.');
  if (file.size > MAX_FILE_BYTES) throw new PrepError('Ukuran maksimal 20 MB.');
  const buffer = await file.arrayBuffer();
  const kind = detectMime(new Uint8Array(buffer.slice(0, 16)));
  if (!kind) throw new PrepError('Jenis berkas tidak didukung. Gunakan PDF, JPEG, PNG, atau HEIC.');

  const sha256 = await sha256Hex(buffer);
  if (kind.mime === 'application/pdf') {
    const r = await preparePdf(buffer, maxPages);
    return { file, ...kind, sha256, pageCount: r.count, pages: r.pages, textLayer: r.textLayer };
  }
  return { file, ...kind, sha256, pageCount: 1, pages: await prepareImage(file), textLayer: false };
}
