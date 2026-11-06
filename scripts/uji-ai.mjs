// Uji pembacaan AI pada sertifikat contoh app_haki.
// Laporan ditulis ke data/hasil-uji-ai.csv (gitignored; sertifikat berisi data pribadi).
//
//   npm run uji:ai -- --probe          # cek model ZDR di OpenRouter (butuh kunci sungguhan)
//   npm run uji:ai -- --kunci          # unduh kunci jawaban dari MySQL haki_php_dev
//   npm run uji:ai                     # unggah & baca semua sampel (atau --limit N)
//
// Mode tiruan (OPENROUTER_API_KEY=mock) hanya untuk memastikan harness; angka akurasi
// tidak berarti karena server tiruan selalu mengembalikan contoh tetap.

import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'data');
const DEFAULT_SAMPLES = 'C:\\Users\\edyar\\Downloads\\app_haki\\storage\\app\\haki-files\\records';
const MYSQL = 'C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysql.exe';
const KUNCI_PATH = join(DATA, 'kunci-uji-ai.json');
const CSV_PATH = join(DATA, 'hasil-uji-ai.csv');
const MODELS = [
  'google/gemini-3.1-flash-lite',
  'openai/gpt-6-luna',
  'anthropic/claude-sonnet-5.5',
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const eq = t.indexOf('=');
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvFile(join(ROOT, '.env'));
loadEnvFile(join(ROOT, 'supabase', 'functions', '.env'));

function exit(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function listSamples(dir) {
  if (!existsSync(dir)) exit(`Folder sampel tidak ada: ${dir}`);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const folder = join(dir, d.name);
      const pages = readdirSync(folder)
        .filter((f) => /\.p\d+\.jpe?g$/i.test(f))
        .sort((a, b) => Number(a.match(/\.p(\d+)\./i)[1]) - Number(b.match(/\.p(\d+)\./i)[1]));
      const prep = readdirSync(folder).find((f) => f.endsWith('.prep.json'));
      return { id: d.name, folder, pages: pages.map((f) => join(folder, f)), prep: prep ? join(folder, prep) : null };
    })
    .filter((s) => s.pages.length > 0);
}

function mysqlJson(sql) {
  if (!existsSync(MYSQL)) return null;
  try {
    const out = execFileSync(
      MYSQL,
      ['-h', '127.0.0.1', '-uroot', 'haki_php_dev', '-N', '-B', '-e', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return out;
  } catch {
    return null;
  }
}

function loadKunci() {
  const fromFile = existsSync(KUNCI_PATH) ? JSON.parse(readFileSync(KUNCI_PATH, 'utf8')) : {};
  const raw = mysqlJson(
    "select id, jenis, judul, no_permohonan, tgl_permohonan, no_sertifikat, status_hki, extra from ip_records",
  );
  if (!raw) return fromFile;
  const kunci = { ...fromFile };
  for (const line of raw.trim().split(/\n/).filter(Boolean)) {
    const [id, jenis, judul, no_permohonan, tgl_permohonan, no_sertifikat, status_hki, extra] = line.split('\t');
    let parsed = {};
    try {
      parsed = extra && extra !== 'NULL' ? JSON.parse(extra) : {};
    } catch {
      parsed = {};
    }
    kunci[id] = {
      jenis,
      judul,
      no_permohonan,
      tgl_permohonan: tgl_permohonan === 'NULL' ? null : tgl_permohonan,
      no_sertifikat,
      status_hki,
      jenis_ciptaan: parsed.jenis_ciptaan ?? null,
      n_pencipta: 0,
    };
  }
  const persons = mysqlJson('select ip_record_id, count(*) from ip_persons where peran = "pencipta" group by ip_record_id');
  if (persons) {
    for (const line of persons.trim().split(/\n/).filter(Boolean)) {
      const [id, n] = line.split('\t');
      if (kunci[id]) kunci[id].n_pencipta = Number(n);
    }
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(KUNCI_PATH, JSON.stringify(kunci, null, 2));
  return kunci;
}

async function probeZdr() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'mock' || key.startsWith('tolak-') || key.startsWith('habis-') || key === 'json-rusak') {
    console.log('Lewati probe ZDR: OPENROUTER_API_KEY belum kunci OpenRouter sungguhan.');
    console.log('Pasang di supabase/functions/.env lalu jalankan: npm run uji:ai -- --probe');
    return false;
  }
  const results = [];
  for (const model of MODELS) {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Arsip HAKI uji' },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: 'user', content: 'Balas JSON {"ok":true} saja.' }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'probe',
            strict: true,
            schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
          },
        },
        provider: { zdr: true, data_collection: 'deny', require_parameters: true },
        usage: { include: true },
      }),
    });
    const body = await resp.json().catch(() => ({}));
    const err = body.error?.message ?? (resp.ok ? null : resp.statusText);
    results.push({ model, ok: resp.ok && !err, status: resp.status, error: err ?? null, id: body.id ?? null });
    console.log(`${resp.ok && !err ? 'OK' : 'GAGAL'} ${model} HTTP ${resp.status}${err ? ` — ${err}` : ''}`);
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, 'probe-zdr.json'), JSON.stringify(results, null, 2));
  return results.every((r) => r.ok);
}

async function client() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) exit('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum ada di .env');
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = opt('email', 'dosen@local.test');
  const password = opt('password', 'test123456');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) exit(`Login gagal (${email}): ${error.message}`);
  await sb.rpc('hki_accept_privacy');
  return sb;
}

async function uploadSample(sb, sample) {
  const { data: recordId, error: cErr } = await sb.rpc('hki_create_record', { p_on_behalf: null, p_manual: false });
  if (cErr) throw new Error(cErr.message);
  const base = `records/${recordId}/${randomUUID()}`;
  const mainBuf = readFileSync(sample.pages[0]);
  const mainPath = `${base}.jpg`;
  const up = async (path, body, type) => {
    const { error } = await sb.storage.from('haki-files').upload(path, body, { contentType: type, upsert: false });
    if (error) throw new Error(`unggah ${path}: ${error.message}`);
  };
  await up(mainPath, mainBuf, 'image/jpeg');
  const pagePaths = [];
  const pageEntries = [];
  let texts = {};
  if (sample.prep && existsSync(sample.prep)) {
    try {
      texts = JSON.parse(readFileSync(sample.prep, 'utf8')).texts ?? {};
    } catch {
      texts = {};
    }
  }
  for (const pageFile of sample.pages) {
    const n = Number(basename(pageFile).match(/\.p(\d+)\./i)[1]);
    const path = `${base}.p${n}.jpg`;
    await up(path, readFileSync(pageFile), 'image/jpeg');
    pagePaths.push(path);
    pageEntries.push({ page: n, path, text: texts[String(n)] ?? texts[n] ?? '' });
  }
  const manifestPath = `${base}.prep.json`;
  await up(
    manifestPath,
    Buffer.from(JSON.stringify({ pages: pageEntries, meta: { page_count: sample.pages.length, mime: 'image/jpeg', nama: `${sample.id}.jpg` } })),
    'application/json',
  );
  const { error: rErr } = await sb.rpc('hki_register_file', {
    p_record: recordId,
    p_path: mainPath,
    p_nama: `${sample.id}.jpg`,
    p_mime: 'image/jpeg',
    p_ukuran: mainBuf.length,
    p_sha256: sha256(mainBuf),
    p_halaman: sample.pages.length,
    p_prep: { pages: pagePaths, page_numbers: pageEntries.map((p) => p.page), manifest: manifestPath },
  });
  if (rErr) throw new Error(rErr.message);
  const { error: sErr } = await sb.rpc('hki_start_extraction', { p_record: recordId });
  if (sErr) throw new Error(sErr.message);
  const { error: fErr } = await sb.functions.invoke('haki-extract', { body: { record_id: recordId } });
  if (fErr) console.warn(`invoke ${sample.id}: ${fErr.message}`);
  return recordId;
}

async function waitDone(sb, id, ms = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const { data } = await sb.from('hki_records').select('workflow_status, extra, jenis, judul, no_permohonan, tgl_permohonan, no_sertifikat').eq('id', id).single();
    if (data && data.workflow_status !== 'EXTRACTING') return data;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { workflow_status: 'EXTRACTING', extra: { extraction_error: 'WAIT_TIMEOUT' } };
}

function match(got, want) {
  if (want == null || want === '' || want === 'NULL') return '';
  const a = String(got ?? '').trim().toLowerCase();
  const b = String(want).trim().toLowerCase();
  return a === b ? 'ya' : 'tidak';
}

async function main() {
  if (flag('probe')) {
    const ok = await probeZdr();
    process.exit(ok ? 0 : 2);
  }
  mkdirSync(DATA, { recursive: true });
  const kunci = loadKunci();
  if (flag('kunci')) {
    console.log(`Kunci jawaban: ${Object.keys(kunci).length} rekaman → ${KUNCI_PATH}`);
    return;
  }

  const samples = listSamples(opt('source', DEFAULT_SAMPLES)).slice(0, Number(opt('limit', '99')));
  if (!samples.length) exit('Tidak ada sampel berhalaman JPG.');
  const mock = !process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'mock';
  if (mock) console.log('MODE TIRUAN — hasil bukan akurasi model sungguhan.\n');

  const sb = await client();
  const header = [
    'sumber_id', 'record_id', 'status', 'kode_galat', 'jenis', 'judul', 'judul_ok',
    'no_permohonan', 'no_permohonan_ok', 'tgl_permohonan', 'tgl_ok', 'no_sertifikat', 'no_sertifikat_ok',
    'conf_judul', 'conf_no_permohonan', 'conf_tgl', 'conf_no_sertifikat',
    'n_pencipta', 'biaya', 'durasi_ms', 'mock',
  ];
  const out = createWriteStream(CSV_PATH);
  out.write(`${header.join(',')}\n`);

  let nOk = 0;
  let nStuck = 0;
  for (const sample of samples) {
    process.stdout.write(`${sample.id} ... `);
    let recordId = '';
    try {
      recordId = await uploadSample(sb, sample);
      const rec = await waitDone(sb, recordId);
      if (rec.workflow_status === 'EXTRACTING') nStuck += 1;
      const { data: fields } = await sb.from('hki_field_values').select('field, nilai_final, confidence').eq('record_id', recordId);
      const fmap = Object.fromEntries((fields ?? []).map((f) => [f.field, f]));
      const { data: persons } = await sb.from('hki_persons').select('id').eq('record_id', recordId).eq('peran', 'pencipta');
      const { data: jobs } = await sb.from('hki_extraction_jobs').select('biaya, durasi_ms, mock').eq('record_id', recordId);
      const want = kunci[sample.id] ?? {};
      const row = {
        sumber_id: sample.id,
        record_id: recordId,
        status: rec.workflow_status,
        kode_galat: rec.extra?.extraction_error ?? '',
        jenis: rec.jenis ?? '',
        judul: rec.judul ?? fmap.judul?.nilai_final ?? '',
        judul_ok: match(rec.judul, want.judul),
        no_permohonan: rec.no_permohonan ?? '',
        no_permohonan_ok: match(rec.no_permohonan, want.no_permohonan),
        tgl_permohonan: rec.tgl_permohonan ?? '',
        tgl_ok: match(rec.tgl_permohonan, want.tgl_permohonan),
        no_sertifikat: rec.no_sertifikat ?? '',
        no_sertifikat_ok: match(rec.no_sertifikat, want.no_sertifikat),
        conf_judul: fmap.judul?.confidence ?? '',
        conf_no_permohonan: fmap.no_permohonan?.confidence ?? '',
        conf_tgl: fmap.tgl_permohonan?.confidence ?? '',
        conf_no_sertifikat: fmap.no_sertifikat?.confidence ?? '',
        n_pencipta: persons?.length ?? 0,
        biaya: (jobs ?? []).reduce((s, j) => s + Number(j.biaya ?? 0), 0),
        durasi_ms: (jobs ?? []).reduce((s, j) => s + Number(j.durasi_ms ?? 0), 0),
        mock: (jobs ?? []).some((j) => j.mock) || mock,
      };
      out.write(`${header.map((h) => csvEscape(row[h])).join(',')}\n`);
      if (rec.workflow_status === 'NEEDS_VERIFICATION') nOk += 1;
      console.log(`${rec.workflow_status} jenis=${rec.jenis ?? '-'} judul=${(rec.judul ?? '').slice(0, 40)}`);
    } catch (e) {
      out.write(`${csvEscape(sample.id)},${csvEscape(recordId)},ERROR,${csvEscape(e.message)}\n`);
      console.log(`GAGAL ${e.message}`);
    }
  }
  out.end();
  console.log(`\nSelesai: ${nOk}/${samples.length} NEEDS_VERIFICATION, macet EXTRACTING: ${nStuck}`);
  console.log(`Laporan: ${CSV_PATH}`);
}

main().catch((e) => exit(String(e.stack ?? e)));
