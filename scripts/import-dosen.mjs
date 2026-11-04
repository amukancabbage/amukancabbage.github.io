// Import akun dosen sekaligus dari file CSV (hasil "Save As" dari Excel).
//
// Kolom wajib : nama, nidn, email
// Kolom opsional: password, prodi
//
// Untuk setiap baris, script ini:
//   1. memakai data dosen dengan NIDN yang sama, atau membuatnya jika belum ada
//   2. membuat akun login (Supabase Auth) jika email belum terdaftar
//   3. mengatur profil akun: role = dosen (admin tetap admin) dan terhubung ke data dosen tersebut
//
// Cara pakai (lihat README bagian "Import Akun Dosen dari Excel"):
//   npm run import:dosen -- data/dosen.csv --dry-run   # cek dulu tanpa menyimpan
//   npm run import:dosen -- data/dosen.csv             # jalankan sungguhan

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeNidn, parseCsv, toCsv } from './csv.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!file) exit('Tulis lokasi file CSV, contoh: npm run import:dosen -- data/dosen.csv');
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

function generatePassword() {
  return randomBytes(9).toString('base64url');
}

// ---------- Data yang sudah ada ----------

async function loadAll() {
  const [dosen, prodi, profiles] = await Promise.all([
    supabase.from('dosen').select('id, nidn'),
    supabase.from('prodi').select('id, prodi'),
    supabase.from('profiles').select('id, role'),
  ]);
  if (dosen.error) exit(`Gagal membaca tabel dosen: ${dosen.error.message}`);
  if (prodi.error) exit(`Gagal membaca tabel prodi: ${prodi.error.message}`);
  if (profiles.error) exit(`Gagal membaca tabel profiles (sudah jalankan auth.sql?): ${profiles.error.message}`);

  const users = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) exit(`Gagal membaca daftar user: ${error.message}`);
    for (const u of data.users) users.set(u.email?.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }

  return {
    dosenByNidn: new Map(dosen.data.map((d) => [d.nidn, d.id])),
    prodiByName: new Map(prodi.data.map((p) => [p.prodi.trim().toLowerCase(), p.id])),
    users,
    roleByUserId: new Map(profiles.data.map((p) => [p.id, p.role])),
  };
}

// ---------- Proses ----------

const rows = parseCsv(readFileSync(file, 'utf8'));
if (rows.length === 0) exit('File CSV kosong.');
const missing = ['nama', 'nidn', 'email'].filter((k) => !(k in rows[0]));
if (missing.length) {
  exit(`Kolom ${missing.join(', ')} tidak ditemukan. Kolom yang terbaca: ${Object.keys(rows[0]).join(', ')}`);
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Memproses ${rows.length} baris dari ${file}\n`);
const { dosenByNidn, prodiByName, users, roleByUserId } = await loadAll();
const results = [];
const seenNidn = new Set();
const seenEmail = new Set();
let failed = 0;

for (const [index, row] of rows.entries()) {
  const line = index + 2; // +1 header, +1 karena Excel mulai dari baris 1
  const email = row.email.toLowerCase();
  const nidn = normalizeNidn(row.nidn);
  const nama = row.nama;
  const result = { baris: line, nama, nidn, email, password: '', status: '' };
  results.push(result);

  const fail = (msg) => {
    result.status = `GAGAL: ${msg}`;
    failed++;
    console.log(`✖ baris ${line} ${email || '(tanpa email)'}: ${msg}`);
  };

  if (!nama || !nidn || !email) {
    fail('nama, nidn, atau email kosong');
    continue;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    fail('format email tidak valid');
    continue;
  }
  if (seenNidn.has(nidn) || seenEmail.has(email)) {
    fail('NIDN atau email sudah muncul di baris sebelumnya');
    continue;
  }
  seenNidn.add(nidn);
  seenEmail.add(email);

  let prodiId = null;
  if (row.prodi) {
    prodiId = prodiByName.get(row.prodi.toLowerCase()) ?? null;
    if (prodiId == null) {
      fail(`prodi "${row.prodi}" tidak ada di tabel prodi`);
      continue;
    }
  }

  const notes = [];

  // 1. Data dosen
  let dosenId = dosenByNidn.get(nidn);
  if (dosenId == null) {
    notes.push('dosen baru');
    if (!dryRun) {
      const { data, error } = await supabase
        .from('dosen')
        .insert({ nama, nidn, prodi_id: prodiId })
        .select('id')
        .single();
      if (error) {
        fail(`gagal menyimpan dosen: ${error.message}`);
        continue;
      }
      dosenId = data.id;
      dosenByNidn.set(nidn, dosenId);
    }
  }

  // 2. Akun login
  let userId = users.get(email);
  if (userId == null) {
    const password = row.password || generatePassword();
    result.password = password;
    notes.push('akun baru');
    if (!dryRun) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) {
        fail(`gagal membuat akun: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      users.set(email, userId);
    }
  } else {
    notes.push('akun sudah ada, password tidak diubah');
  }

  // 3. Profil: role dosen + hubungan ke data dosen
  //    akun yang sudah admin tetap admin (hanya dihubungkan ke data dosennya)
  const role = roleByUserId.get(userId) === 'admin' ? 'admin' : 'dosen';
  if (role === 'admin') notes.push('tetap admin');
  if (!dryRun) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, email, role, dosen_id: dosenId });
    if (error) {
      fail(
        error.code === '23505'
          ? `NIDN ${nidn} sudah terhubung ke akun lain`
          : `gagal mengatur profil: ${error.message}`,
      );
      continue;
    }
  }

  result.status = `OK (${notes.join(', ')})`;
  console.log(`✔ baris ${line} ${email}: ${result.status}`);
}

const outFile = join(dirname(file), dryRun ? 'hasil-import-dry-run.csv' : 'hasil-import.csv');
writeFileSync(outFile, toCsv(results));

console.log(`\nSelesai: ${rows.length - failed} berhasil, ${failed} gagal.`);
console.log(`Rincian (termasuk password akun baru) disimpan di ${outFile}`);
if (dryRun) console.log('Ini DRY RUN: belum ada data yang disimpan. Jalankan tanpa --dry-run untuk menyimpan.');
console.log('⚠ File hasil berisi password. Bagikan ke dosen dengan aman lalu hapus file tersebut.\n');
