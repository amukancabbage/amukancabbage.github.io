// Fungsi bersama untuk script import (CSV hasil "Save As" dari Excel)

// Excel berbahasa Indonesia menyimpan CSV dengan pemisah ";" sehingga pemisah dideteksi otomatis
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'));
  const sep = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);

  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// NIDN 10 digit; angka 0 di depan sering hilang jika kolom Excel berformat Number
export function normalizeNidn(nidn) {
  const clean = nidn.replace(/\s/g, '');
  return /^\d{1,9}$/.test(clean) ? clean.padStart(10, '0') : clean;
}

export function toCsv(rows) {
  const keys = Object.keys(rows[0]);
  const esc = (v) => (/[",;\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(String(r[k] ?? ''))).join(','))].join('\n');
}
