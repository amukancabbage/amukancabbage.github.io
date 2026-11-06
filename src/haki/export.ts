import { supabase } from '../lib/supabase';
import { downloadBlob, masterLabel, rpc } from './api';
import { EXPORT_MAX_ROWS, EXPORT_MAX_ZIP, JENIS_LABEL, STATUS_HKI_LABEL, WORKFLOW_LABEL } from './constants';
import type { HkiListRow, MasterItem } from './types';
import { zip } from './zip';

export const EXPORT_COLUMNS = [
  'No',
  'Jenis HKI',
  'Judul',
  'Nomor Permohonan',
  'Tanggal Permohonan',
  'Nomor Sertifikat',
  'Status HKI',
  'Berlaku Mulai',
  'Berlaku Sampai',
  'Pencipta / Inventor',
  'Pemegang Hak',
  'Unit',
  'Sumber Dana',
  'Kegiatan Terkait',
  'Tautan PDKI',
  'Status Dokumen',
  'Tanggal Diarsipkan',
];

export function toRows(rows: HkiListRow[], master: MasterItem[]): string[][] {
  return rows.map((r, i) => [
    String(i + 1),
    r.jenis ? JENIS_LABEL[r.jenis] : '',
    r.judul ?? '',
    r.no_permohonan ?? '',
    r.tgl_permohonan ?? '',
    r.no_sertifikat ?? '',
    r.status_hki ? STATUS_HKI_LABEL[r.status_hki] : '',
    r.berlaku_mulai ?? '',
    r.berlaku_akhir ?? '',
    r.pencipta ?? '',
    r.pemegang ?? '',
    r.unit_nama ?? '',
    masterLabel(master, 'sumber_dana', r.sumber_dana),
    r.kegiatan_terkait ?? '',
    r.pdki_url ?? '',
    WORKFLOW_LABEL[r.workflow_status],
    r.validated_at ? r.validated_at.slice(0, 10) : '',
  ]);
}

// sel diawali = + - @ tab CR dianggap rumus oleh spreadsheet
function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function csv(rows: string[][]): Blob {
  const esc = (v: string) => {
    const s = safeCell(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [EXPORT_COLUMNS, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  return new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8' });
}

const xmlEsc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// XLSX minimal: satu sheet, string inline
export function xlsx(rows: string[][]): Blob {
  const all = [EXPORT_COLUMNS, ...rows];
  const sheetRows = all
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((v, ci) => `<c r="${colName(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(safeCell(v))}</t></is></c>`)
          .join('')}</row>`,
    )
    .join('');
  return new Blob(
    [
      zip([
        {
          name: '[Content_Types].xml',
          data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        },
        {
          name: '_rels/.rels',
          data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        },
        {
          name: 'xl/workbook.xml',
          data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Arsip HKI" sheetId="1" r:id="rId1"/></sheets></workbook>',
        },
        {
          name: 'xl/_rels/workbook.xml.rels',
          data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        },
        {
          name: 'xl/worksheets/sheet1.xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
        },
      ]),
    ],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 80).trim() || 'dokumen';

// ZIP berkas + manifest.csv; dibatasi 300 rekaman
export async function zipFiles(rows: HkiListRow[], master: MasterItem[], onProgress: (done: number, total: number) => void): Promise<Blob> {
  if (rows.length > EXPORT_MAX_ZIP) throw new Error(`ZIP maksimal ${EXPORT_MAX_ZIP} dokumen; persempit filter.`);
  const entries: { name: string; data: Uint8Array | string }[] = [];
  const ids = rows.map((r) => r.id);
  const files: { record_id: string; storage_path: string; nama_asli: string; jenis: string }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from('hki_files')
      .select('record_id, storage_path, nama_asli, jenis')
      .in('record_id', ids.slice(i, i + 100));
    files.push(...(data ?? []));
  }
  let done = 0;
  for (const [i, r] of rows.entries()) {
    const folder = `${String(i + 1).padStart(3, '0')}_${safeName(r.judul ?? 'tanpa judul')}`;
    for (const f of files.filter((x) => x.record_id === r.id)) {
      const blob = await downloadBlob(f.storage_path);
      entries.push({ name: `${folder}/${f.jenis}_${safeName(f.nama_asli)}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    onProgress(++done, rows.length);
  }
  entries.push({ name: 'manifest.csv', data: new Uint8Array(await csv(toRows(rows, master)).arrayBuffer()) });
  return zip(entries);
}

// ambil semua baris sesuai filter (per 1000) sampai batas ekspor
export async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<HkiListRow[]> {
  const out: HkiListRow[] = [];
  for (let from = 0; from < EXPORT_MAX_ROWS; from += 1000) {
    const { data } = await build(from, Math.min(from + 999, EXPORT_MAX_ROWS - 1));
    const rows = (data as HkiListRow[]) ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function logExport(kind: 'csv' | 'xlsx' | 'zip', count: number) {
  await rpc('hki_log', { p_aksi: `export.${kind}`, p_record: null, p_detail: { rows: count } }).catch(() => undefined);
}
