// Import data hibah penelitian & pengabdian sekaligus dari file CSV (hasil "Save As" dari Excel).
//
// Kolom wajib : jenis (Penelitian/Pengabdian), tahun, judul, ketua
// Kolom opsional: skema, biaya, anggota, anggota mahasiswa
// Kolom lain (mis. prodi, peran dosen fti) diabaikan.
//
// Format dosen di kolom ketua/anggota: "NAMA (NIDN)", beberapa orang dipisah titik koma.
// Dosen dicocokkan lewat NIDN:
//   - ketua yang ada di daftar dosen -> dosen_id, jika tidak -> ketua_luar (nama saja)
//   - anggota yang ada di daftar dosen -> tabel <jenis>_anggota, jika tidak -> anggota_luar
// Baris dengan jenis, tahun, dan judul yang sama dengan data yang sudah ada dilewati,
// sehingga script aman dijalankan ulang.
//
// Cara pakai (lihat README bagian "Import Data Hibah dari Excel"):
//   npm run import:kegiatan -- data/kegiatan.csv --dry-run   # cek dulu tanpa menyimpan
//   npm run import:kegiatan -- data/kegiatan.csv             # jalankan sungguhan

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeNidn, parseCsv, toCsv } from './csv.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!file) exit('Tulis lokasi file CSV, contoh: npm run import:kegiatan -- data/kegiatan.csv');
if (!url || !secretKey) {
  exit('VITE_SUPABASE_URL dan SUPABASE_SECRET_KEY harus diisi di file .env');
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function exit(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// "AGUS (1117128901); NIDN 1129119101" -> [{ nama: 'AGUS', nidn: '1117128901' }, { nama: '', nidn: ... }]
function parseOrang(text) {
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*\(?(?:NIDN\s*)?(\d{8,10})\)?$/i);
      return m ? { nama: m[1].trim(), nidn: normalizeNidn(m[2]) } : { nama: s, nidn: null };
    });
}

const namaLuar = (o) => o.nama || `NIDN ${o.nidn}`;

const key = (jenis, tahun, judul) => `${jenis}|${tahun}|${judul.trim().toLowerCase()}`;

// ---------- Data yang sudah ada ----------

async function loadAll() {
  const [dosen, penelitian, pengabdian] = await Promise.all([
    supabase.from('dosen').select('id, nidn'),
    supabase.from('penelitian').select('tahun, judul:judul_penelitian'),
    supabase.from('pengabdian').select('tahun, judul:judul_pengabdian'),
  ]);
  for (const [name, res] of Object.entries({ dosen, penelitian, pengabdian })) {
    if (res.error) exit(`Gagal membaca tabel ${name}: ${res.error.message}`);
  }
  // kolom baru dari supabase/hibah.sql
  const check = await supabase.from('penelitian').select('skema, biaya, anggota_luar').limit(1);
  if (check.error) {
    const msg = 'Kolom hibah belum ada. Jalankan supabase/hibah.sql dulu sebelum import sungguhan.';
    if (!dryRun) exit(`${msg} (${check.error.message})`);
    console.log(`⚠ ${msg}\n`);
  }

  return {
    dosenByNidn: new Map(dosen.data.map((d) => [d.nidn, d.id])),
    existing: new Set([
      ...penelitian.data.map((k) => key('penelitian', k.tahun, k.judul)),
      ...pengabdian.data.map((k) => key('pengabdian', k.tahun, k.judul)),
    ]),
  };
}

// ---------- Proses ----------

const rows = parseCsv(readFileSync(file, 'utf8'));
if (rows.length === 0) exit('File CSV kosong.');
const missing = ['jenis', 'tahun', 'judul', 'ketua'].filter((k) => !(k in rows[0]));
if (missing.length) {
  exit(`Kolom ${missing.join(', ')} tidak ditemukan. Kolom yang terbaca: ${Object.keys(rows[0]).join(', ')}`);
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Memproses ${rows.length} baris dari ${file}\n`);
const { dosenByNidn, existing } = await loadAll();
const results = [];
const count = { ok: 0, skip: 0, failed: 0 };

for (const [index, row] of rows.entries()) {
  const line = index + 2; // +1 header, +1 karena Excel mulai dari baris 1
  const jenis = row.jenis.toLowerCase();
  const tahun = Number(row.tahun);
  const judul = row.judul.replace(/\s+/g, ' ').trim();
  const result = { baris: line, jenis, tahun: row.tahun, judul, status: '' };
  results.push(result);

  const fail = (msg) => {
    result.status = `GAGAL: ${msg}`;
    count.failed++;
    console.log(`✖ baris ${line}: ${msg}`);
  };

  if (jenis !== 'penelitian' && jenis !== 'pengabdian') {
    fail(`jenis "${row.jenis}" harus Penelitian atau Pengabdian`);
    continue;
  }
  if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) {
    fail(`tahun "${row.tahun}" tidak valid`);
    continue;
  }
  if (!judul) {
    fail('judul kosong');
    continue;
  }
  const [ketua, ...ketuaLain] = parseOrang(row.ketua);
  if (!ketua || ketuaLain.length) {
    fail('kolom ketua harus berisi tepat satu orang');
    continue;
  }
  const biaya = row.biaya ? Number(row.biaya.replace(/[^\d]/g, '')) : null;
  if (row.biaya && !biaya && biaya !== 0) {
    fail(`biaya "${row.biaya}" tidak valid`);
    continue;
  }

  const k = key(jenis, tahun, judul);
  if (existing.has(k)) {
    result.status = 'DILEWATI: sudah ada';
    count.skip++;
    console.log(`– baris ${line}: sudah ada, dilewati`);
    continue;
  }
  existing.add(k);

  const notes = [];
  const ketuaId = ketua.nidn ? (dosenByNidn.get(ketua.nidn) ?? null) : null;
  if (ketuaId == null) notes.push(`ketua luar: ${namaLuar(ketua)}`);

  const anggotaIds = new Set();
  const anggotaLuar = [];
  for (const o of parseOrang(row.anggota ?? '')) {
    const id = o.nidn ? dosenByNidn.get(o.nidn) : undefined;
    if (id == null) anggotaLuar.push(namaLuar(o));
    else if (id !== ketuaId) anggotaIds.add(id);
  }
  if (anggotaLuar.length) notes.push(`anggota luar: ${anggotaLuar.join(', ')}`);

  const mahasiswa = (row['anggota mahasiswa'] ?? '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!dryRun) {
    const { data, error } = await supabase
      .from(jenis)
      .insert({
        [`judul_${jenis}`]: judul,
        tahun,
        dosen_id: ketuaId,
        ketua_luar: ketuaId == null ? namaLuar(ketua) : null,
        skema: row.skema || null,
        biaya,
        anggota_luar: anggotaLuar.join('; ') || null,
        anggota_mahasiswa: mahasiswa.join('; ') || null,
      })
      .select('id')
      .single();
    if (error) {
      fail(`gagal menyimpan: ${error.message}`);
      continue;
    }
    if (anggotaIds.size) {
      const { error: errAnggota } = await supabase
        .from(`${jenis}_anggota`)
        .insert([...anggotaIds].map((dosen_id) => ({ [`${jenis}_id`]: data.id, dosen_id })));
      if (errAnggota) {
        fail(`${jenis} tersimpan (id ${data.id}) tetapi anggota gagal: ${errAnggota.message}`);
        continue;
      }
    }
  }

  result.status = `OK (${anggotaIds.size} anggota dosen${notes.length ? `; ${notes.join('; ')}` : ''})`;
  count.ok++;
  console.log(`✔ baris ${line} ${jenis} ${tahun}: ${result.status}`);
}

const outFile = join(dirname(file), dryRun ? 'hasil-import-kegiatan-dry-run.csv' : 'hasil-import-kegiatan.csv');
writeFileSync(outFile, toCsv(results));

console.log(`\nSelesai: ${count.ok} berhasil, ${count.skip} dilewati, ${count.failed} gagal.`);
console.log(`Rincian disimpan di ${outFile}`);
if (dryRun) console.log('Ini DRY RUN: belum ada data yang disimpan. Jalankan tanpa --dry-run untuk menyimpan.');
console.log('');
