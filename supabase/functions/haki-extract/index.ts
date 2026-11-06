// Edge Function: baca dokumen HKI dengan OpenRouter (port Pipeline app_haki).
// Secret: OPENROUTER_API_KEY (supabase secrets set). Jangan pernah ditaruh di variabel VITE_.
// Alur: cache SHA-256 -> anggaran -> klasifikasi -> ekstraksi (+fallback) -> eskalasi -> postprocess -> simpan.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  CLASSIFY_SCHEMA_NAME,
  CLASSIFY_SYSTEM,
  ESCALATE_IF_LOW_SHARE,
  EXTRACT_SYSTEM,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  SPECIFIC_FIELDS,
  classifySchema,
  classifyUser,
  extractUser,
  extractionSchema,
  lowConfidenceShare,
  meanCoreConfidence,
  normalizeJenisCiptaan,
  scoreExtraction,
  type FieldResult,
  type PersonResult,
} from '../_shared/hakiExtraction.ts';
import { matchPersons, toCandidates, type DirectoryEntry } from '../_shared/personMatch.ts';

const BUCKET = 'haki-files';
const BASE_URL = Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';
// id generasi dari server tiruan (scripts/mock-openrouter.mjs); hasilnya tidak boleh di-cache
const MOCK_GENERATION_PREFIX = 'gen-mock-';
// Edge Function dihentikan ~150 dtk (paket gratis); sisakan waktu untuk menyimpan status gagal
const DEADLINE_MS = 120_000;
const CALL_TIMEOUT_MS = 40_000;
const MIN_CALL_MS = 8_000;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class Failure extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type Settings = {
  model_classify: string;
  model_extract: string;
  model_fallback: string;
  model_escalate: string;
  monthly_budget_usd: number;
};

type LlmResult = {
  data: Record<string, unknown>;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  cost: number | null;
  latency: number;
  mock: boolean;
};

type Job = { record_id: string; file_id: string; sha256: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function codeForStatus(status: number): string {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 401 || status === 403) return 'AUTH_FAILED';
  if (status === 402) return 'CREDIT_EXHAUSTED';
  if (status >= 500) return 'UPSTREAM_ERROR';
  return 'REQUEST_FAILED';
}

// kebijakan privasi wajib: ZDR, tanpa pengumpulan data, hanya penyedia dengan structured outputs
async function completeJson(
  apiKey: string,
  deadline: number,
  models: string[],
  system: string,
  userText: string,
  images: string[],
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<LlmResult> {
  const content: unknown[] = [{ type: 'text', text: userText }];
  for (const img of images) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } });
  const body = {
    model: models[0],
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    models: models.filter(Boolean),
    provider: { zdr: true, data_collection: 'deny', require_parameters: true },
    usage: { include: true },
  };

  const started = Date.now();
  let resp: Response | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) throw new Failure('TIMEOUT', 'Batas waktu pembacaan AI habis');
    try {
      resp = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Arsip HAKI' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, remaining)),
      });
    } catch (e) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      const timeout = e instanceof DOMException && e.name === 'TimeoutError';
      throw new Failure(timeout ? 'TIMEOUT' : 'REQUEST_FAILED', String(e));
    }
    if (resp.ok) break;
    if (attempt < 2 && ([408, 409, 429].includes(resp.status) || resp.status >= 500)) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    const err = await resp.json().catch(() => ({}));
    throw new Failure(codeForStatus(resp.status), err?.error?.message ?? resp.statusText);
  }

  const payload = await resp!.json().catch(() => null);
  if (!payload || typeof payload !== 'object') throw new Failure('REQUEST_FAILED', 'Respons bukan JSON');
  if (payload.error && !payload.choices?.length) {
    throw new Failure(codeForStatus(Number(payload.error.code ?? 0)), payload.error.message ?? 'galat dari OpenRouter');
  }
  const text = String(payload.choices?.[0]?.message?.content ?? '');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Failure('INVALID_JSON', text.slice(0, 200));
  }
  if (!data || typeof data !== 'object') throw new Failure('INVALID_JSON', text.slice(0, 200));
  const usage = payload.usage ?? {};
  return {
    data: data as Record<string, unknown>,
    model: payload.model ?? null,
    tokensIn: usage.prompt_tokens ?? null,
    tokensOut: usage.completion_tokens ?? null,
    cost: usage.cost ?? null,
    latency: Date.now() - started,
    mock: String(payload.id ?? '').startsWith(MOCK_GENERATION_PREFIX),
  };
}

async function logJob(
  admin: SupabaseClient,
  job: Job,
  tahap: 'classify' | 'extract' | 'escalate' | 'cache',
  model: string | null,
  result: LlmResult | null,
  error: Failure | null,
  raw?: unknown,
) {
  const { data } = await admin
    .from('hki_extraction_jobs')
    .insert({
      record_id: job.record_id,
      file_id: job.file_id,
      sha256: job.sha256,
      tahap,
      model: result?.model ?? model,
      status: error ? 'gagal' : 'ok',
      kode_error: error?.code ?? null,
      token_in: result?.tokensIn ?? null,
      token_out: result?.tokensOut ?? null,
      biaya: result?.cost ?? 0,
      durasi_ms: result?.latency ?? null,
      prompt_version: PROMPT_VERSION,
      schema_version: SCHEMA_VERSION,
      keluaran_mentah: raw ?? result?.data ?? null,
      mock: result?.mock ?? false,
    })
    .select('id')
    .single();
  return data?.id as number | undefined;
}

// satu percobaan perbaikan bila JSON tidak valid; galat lain langsung dilempar
async function callWithRepair(
  admin: SupabaseClient,
  apiKey: string,
  deadline: number,
  job: Job,
  tahap: 'classify' | 'extract' | 'escalate',
  models: string[],
  req: { system: string; user: string; images: string[]; schemaName: string; schema: Record<string, unknown> },
): Promise<{ result: LlmResult; jobId?: number }> {
  let last: Failure | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await completeJson(apiKey, deadline, models, req.system, req.user, req.images, req.schemaName, req.schema);
      const jobId = await logJob(admin, job, tahap, models[0], result, null);
      return { result, jobId };
    } catch (e) {
      const err = e instanceof Failure ? e : new Failure('REQUEST_FAILED', String(e));
      await logJob(admin, job, tahap, models[0], null, err);
      last = err;
      if (err.code !== 'INVALID_JSON') break;
    }
  }
  throw last!;
}

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin.from('hki_settings').select('key, value');
  const raw = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    model_classify: String(raw['ai.model_classify'] ?? 'google/gemini-3.1-flash-lite'),
    model_extract: String(raw['ai.model_extract'] ?? 'google/gemini-3.1-flash-lite'),
    model_fallback: String(raw['ai.model_fallback'] ?? ''),
    model_escalate: String(raw['ai.model_escalate'] ?? ''),
    monthly_budget_usd: Number(raw['ai.monthly_budget_usd'] ?? 0),
  };
}

// hasil sukses untuk berkas identik (prompt+skema sama, rekaman lain belum dihapus)
async function cachedExtraction(admin: SupabaseClient, job: Job) {
  const { data } = await admin
    .from('hki_extraction_jobs')
    .select('keluaran_mentah, record_id, hki_records!inner(deleted_at)')
    .eq('sha256', job.sha256)
    .eq('tahap', 'extract')
    .eq('status', 'ok')
    .eq('mock', false)
    .eq('prompt_version', PROMPT_VERSION)
    .eq('schema_version', SCHEMA_VERSION)
    .neq('record_id', job.record_id)
    .is('hki_records.deleted_at', null)
    .not('keluaran_mentah', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  for (const row of data ?? []) {
    const raw = row.keluaran_mentah as { jenis_hki?: string; extraction?: Record<string, unknown> } | null;
    if (raw?.jenis_hki && raw.extraction) return { jenis: raw.jenis_hki, data: raw.extraction };
  }
  return null;
}

async function run(admin: SupabaseClient, recordId: string, deadline: number) {
  const { data: record } = await admin.from('hki_records').select('*').eq('id', recordId).single();
  if (!record || record.workflow_status !== 'EXTRACTING') throw new Failure('NOT_EXTRACTING', 'Rekaman tidak dalam status EXTRACTING');
  const { data: file } = await admin.from('hki_files').select('*').eq('record_id', recordId).eq('jenis', 'utama').single();
  if (!file) throw new Failure('NO_MAIN_FILE', 'Berkas utama tidak ada');
  const job: Job = { record_id: recordId, file_id: file.id, sha256: file.sha256 };
  const settings = await loadSettings(admin);
  const warnings: string[] = [];

  // halaman dari manifes persiapan klien
  const pageNumbers: number[] = [];
  const images: string[] = [];
  const pageTexts: Record<number, string> = {};
  const manifestPath = file.prep?.manifest as string | undefined;
  if (manifestPath) {
    const { data: blob } = await admin.storage.from(BUCKET).download(manifestPath);
    const manifest = blob ? JSON.parse(await blob.text()) : null;
    for (const p of manifest?.pages ?? []) {
      const { data: img } = await admin.storage.from(BUCKET).download(p.path);
      if (!img) continue;
      pageNumbers.push(p.page);
      images.push(toBase64(new Uint8Array(await img.arrayBuffer())));
      if (p.text && String(p.text).trim()) pageTexts[p.page] = String(p.text);
    }
  } else if (String(file.mime).startsWith('image/') && file.mime !== 'image/heic') {
    const { data: img } = await admin.storage.from(BUCKET).download(file.storage_path);
    if (img) {
      pageNumbers.push(1);
      images.push(toBase64(new Uint8Array(await img.arrayBuffer())));
    }
  }
  if (images.length === 0) throw new Failure('UNSUPPORTED_FILE', 'Tidak ada gambar halaman untuk dibaca');

  let jenis: string;
  let fields: FieldResult[];
  let persons: PersonResult[];

  // baca ulang (reread_count > 0) selalu bertanya ke model
  const cached = record.reread_count === 0 ? await cachedExtraction(admin, job) : null;
  if (cached) {
    jenis = cached.jenis;
    [fields, persons] = scoreExtraction(cached.data, jenis, pageTexts);
    await logJob(admin, job, 'cache', null, null, null, { jenis_hki: jenis, extraction: cached.data });
  } else {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) throw new Failure('NO_API_KEY', 'OPENROUTER_API_KEY belum diatur');
    if (settings.monthly_budget_usd > 0) {
      const { data: cost } = await admin.rpc('hki_ai_month_cost');
      if (Number(cost ?? 0) >= settings.monthly_budget_usd) throw new Failure('BUDGET_EXCEEDED', 'Batas biaya AI bulan ini tercapai');
    }

    const cls = await callWithRepair(admin, apiKey, deadline, job, 'classify', [settings.model_classify], {
      system: CLASSIFY_SYSTEM,
      user: classifyUser(pageNumbers, pageTexts),
      images,
      schemaName: CLASSIFY_SCHEMA_NAME,
      schema: classifySchema(),
    });
    const j = cls.result.data.jenis_hki;
    if (typeof j !== 'string' || !SPECIFIC_FIELDS[j]) throw new Failure('JENIS_TIDAK_DIKENALI', 'AI tidak dapat menentukan jenis HKI');
    jenis = j;
    if (Number(cls.result.data.jumlah_sertifikat ?? 1) > 1) {
      warnings.push('Berkas ini tampaknya berisi lebih dari satu sertifikat; hanya yang pertama dibaca.');
    }
    if (cls.result.data.kualitas_gambar === 'buruk') warnings.push('Kualitas gambar buruk; periksa semua field dengan teliti.');

    const [schemaName, schema] = extractionSchema(jenis);
    const req = { system: EXTRACT_SYSTEM, user: extractUser(jenis, pageNumbers, pageTexts), images, schemaName, schema };
    const ext = await callWithRepair(admin, apiKey, deadline, job, 'extract', [settings.model_extract, settings.model_fallback], req);
    [fields, persons] = scoreExtraction(ext.result.data, jenis, pageTexts);
    let chosen = ext.result.data;

    const escalate = settings.model_escalate && lowConfidenceShare(fields) > ESCALATE_IF_LOW_SHARE;
    if (escalate && deadline - Date.now() < CALL_TIMEOUT_MS) {
      warnings.push('Waktu tidak cukup untuk eskalasi ke model lebih kuat; memakai hasil model utama.');
    } else if (escalate) {
      try {
        const esc = await callWithRepair(admin, apiKey, deadline, job, 'escalate', [settings.model_escalate], req);
        const [escFields, escPersons] = scoreExtraction(esc.result.data, jenis, pageTexts);
        if (meanCoreConfidence(escFields) > meanCoreConfidence(fields)) {
          [fields, persons, chosen] = [escFields, escPersons, esc.result.data];
        }
      } catch {
        warnings.push('Eskalasi ke model lebih kuat gagal; memakai hasil model utama.');
      }
    }
    // keluaran terpilih disimpan di job ekstraksi agar bisa dipakai ulang cache
    if (ext.jobId) {
      await admin.from('hki_extraction_jobs').update({ keluaran_mentah: { jenis_hki: jenis, extraction: chosen } }).eq('id', ext.jobId);
    }
  }

  const { data: master } = await admin.from('hki_master_items').select('nilai, label').eq('kategori', 'jenis_ciptaan');
  const fieldMap: Record<string, unknown> = {};
  for (const f of fields) {
    const value = f.key === 'jenis_ciptaan' ? normalizeJenisCiptaan(f.value, master ?? []) : f.value;
    fieldMap[f.key] = { value, confidence: f.confidence, page: f.page, evidence: f.evidence?.slice(0, 200) ?? null };
  }

  // pencocokan pencipta ↔ dosen (status akhir ditetapkan server)
  const [{ data: dosen }, { data: aliases }, { data: owner }] = await Promise.all([
    admin.from('dosen').select('id, nama, unit_id'),
    admin.from('hki_aliases').select('dosen_id, alias'),
    admin.from('dosen').select('unit_id').eq('id', record.owner_dosen_id).single(),
  ]);
  const directory: DirectoryEntry[] = (dosen ?? []).map((d) => ({
    id: d.id,
    nama: d.nama,
    unit_id: d.unit_id,
    aliases: (aliases ?? []).filter((a) => a.dosen_id === d.id).map((a) => a.alias),
  }));
  const matched = matchPersons(persons, toCandidates(directory), record.owner_dosen_id, owner?.unit_id ?? null);

  const { error } = await admin.rpc('hki_apply_extraction', {
    p_record: recordId,
    p_jenis: jenis,
    p_fields: fieldMap,
    p_persons: matched,
    p_warnings: warnings,
  });
  if (error) throw new Failure('SAVE_FAILED', error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const { record_id: recordId } = await req.json().catch(() => ({}));
  if (typeof recordId !== 'string' || !/^[0-9a-f-]{36}$/i.test(recordId)) return json({ error: 'record_id tidak valid' }, 400);

  // pemanggil harus berhak melihat rekaman (RLS dengan JWT pengguna)
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: canView } = await userClient.rpc('hki_can_view', { p_record: recordId });
  if (canView !== true) return json({ error: 'Dokumen tidak ditemukan' }, 404);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const deadline = Date.now() + DEADLINE_MS;
  const task = (async () => {
    try {
      await run(admin, recordId, deadline);
      return { status: 'NEEDS_VERIFICATION' };
    } catch (e) {
      const err = e instanceof Failure ? e : new Failure('INTERNAL', String(e));
      console.error(`haki-extract ${recordId} ${err.code}: ${err.message}`);
      if (err.code !== 'NOT_EXTRACTING') {
        await admin.rpc('hki_extraction_failed', { p_record: recordId, p_code: err.code });
      }
      return { status: 'EXTRACTION_FAILED', code: err.code };
    }
  })();

  // klien memantau status rekaman; jangan tahan koneksi selama pembacaan
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(task);
    return json({ status: 'EXTRACTING' }, 202);
  }
  return json(await task);
});
