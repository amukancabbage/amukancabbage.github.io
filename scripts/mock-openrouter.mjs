// Server TIRUAN untuk POST /v1/chat/completions milik OpenRouter (port dari app_haki/scripts/mock_openrouter.php).
// Hanya meniru bentuk API; jawabannya data contoh tetap, BUKAN hasil membaca dokumen.
// Dipakai untuk mencoba alur AI tanpa kunci dan tanpa biaya:
//
//   npm run mock:ai
//   supabase/functions/.env:
//     OPENROUTER_BASE_URL=http://host.docker.internal:9999/v1
//     OPENROUTER_API_KEY=mock
//
// Kunci khusus memicu galat untuk menguji pemetaan kode galat di Edge Function:
//   tolak-401 -> AUTH_FAILED, habis-402 -> CREDIT_EXHAUSTED, limit-429 -> RATE_LIMITED,
//   rusak-500 -> UPSTREAM_ERROR, json-rusak -> INVALID_JSON
// Atau tanpa restart functions serve: MOCK_ERROR=limit-429 npm run mock:ai (berlaku untuk semua permintaan).
import { createServer } from 'node:http';

// harus sama dengan MOCK_GENERATION_PREFIX di supabase/functions/haki-extract/index.ts
const MOCK_GENERATION_PREFIX = 'gen-mock-';
const PORT = Number(process.env.MOCK_PORT ?? 9999);
// 0.0.0.0 agar container Edge Runtime bisa menjangkau lewat host.docker.internal
const HOST = process.env.MOCK_HOST ?? '0.0.0.0';

const field = (value, confidence = 0.93, page = 1, evidence) => ({
  value,
  confidence,
  page,
  evidence: evidence === undefined ? value : evidence,
});

const person = (nama, peran, alamat, confidence, evidence) => ({
  nama,
  peran,
  alamat,
  kewarganegaraan: peran === 'pencipta' ? 'Indonesia' : null,
  confidence,
  page: 1,
  evidence,
});

// keyakinan sengaja bervariasi agar field hijau/kuning/merah terlihat di antarmuka
const sampleExtraction = () => ({
  judul: field('Sistem Informasi Arsip Digital Berbasis Kecerdasan Buatan'),
  no_permohonan: field('EC00202312345'),
  tgl_permohonan: field('2023-03-14', 0.9, 1, '14 Maret 2023'),
  no_sertifikat: field('000512345', 0.72),
  status_hki: field('terdaftar', 0.6, 1, 'dicatat'),
  jenis_ciptaan: field('program_komputer', 0.9, 1, 'Program Komputer'),
  tanggal_pengumuman: field('2023-01-10', 0.55, 1, '10 Januari 2023'),
  tempat_pengumuman: field(null, 0.1, null, null),
  orang: [
    person('Dr. Muhammad Edya Rosadi, S.Kom., M.Kom.', 'pencipta', 'Jl. Mawar No. 1, Banjarmasin', 0.95, 'Muhammad Edya Rosadi'),
    person('Mirza Yogy Kurniawan', 'pencipta', 'Jl. Melati No. 2, Banjarmasin', 0.9, 'Mirza Yogy Kurniawan'),
    person('Universitas Contoh', 'pemegang', 'Banjarmasin', 0.95, 'Universitas Contoh'),
  ],
});

const FORCED = { 'Bearer tolak-401': 401, 'Bearer habis-402': 402, 'Bearer limit-429': 429, 'Bearer rusak-500': 500 };

let counter = 0;
// override langsung tanpa restart: GET /__force?key=habis-402 (kosongkan dengan key=)
let liveKey = process.env.MOCK_ERROR ?? '';

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/__force') {
    liveKey = url.searchParams.get('key') ?? '';
    console.log(`mode galat: ${liveKey || '(normal)'}`);
    return send(res, 200, { key: liveKey || null });
  }
  if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
    return send(res, 404, { error: { message: 'tidak ada' } });
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  try {
    body = JSON.parse(raw);
  } catch {
    // tetap jawab seperti OpenRouter menerima body apa adanya
  }

  const auth = liveKey ? `Bearer ${liveKey}` : (req.headers.authorization ?? '');
  const forced = FORCED[auth];
  console.log(`${new Date().toISOString()} ${body?.response_format?.json_schema?.name ?? '?'} model=${body?.model ?? '?'} ${forced ?? 200}`);
  if (forced) return send(res, forced, { error: { code: forced, message: 'galat tiruan' } });

  const name = body?.response_format?.json_schema?.name ?? '';
  const data =
    name === 'klasifikasi_dokumen'
      ? { jenis_dokumen: 'sertifikat', jenis_hki: 'hak_cipta', kualitas_gambar: 'baik', jumlah_sertifikat: 1 }
      : sampleExtraction();
  const content = auth === 'Bearer json-rusak' ? '{"judul": ' : JSON.stringify(data);

  // jeda singkat agar status "Dibaca AI" sempat terlihat di antarmuka
  await new Promise((r) => setTimeout(r, 400));

  send(res, 200, {
    id: `${MOCK_GENERATION_PREFIX}${++counter}`,
    object: 'chat.completion',
    created: 0,
    model: body?.model ?? 'mock',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 1500, completion_tokens: 400, total_tokens: 1900, cost: 0.0042 },
  });
});

server.listen({ port: PORT, host: HOST, reuseAddress: true }, () => {
  console.log(`Mock OpenRouter di http://${HOST}:${PORT}/v1 (Ctrl+C untuk berhenti)`);
});
