import { assertAlmostEquals, assertEquals } from 'jsr:@std/assert';
import {
  classifySchema,
  CORE_FIELDS,
  extractionSchema,
  fieldKeysFor,
  lowConfidenceShare,
  normalizeJenisCiptaan,
  numberMatchesPattern,
  parseDate,
  SCHEMA_VERSION,
  scoreField,
  scorePerson,
  SPECIFIC_FIELDS,
} from './hakiExtraction.ts';

const TEXT = { 1: 'Judul Ciptaan: Sistem Informasi Arsip Digital  Nomor: EC00202312345  Tanggal 14 Maret 2023' };

const MASTER = [
  { nilai: 'program_komputer', label: 'Program komputer' },
  { nilai: 'buku', label: 'Buku' },
  { nilai: 'karya_tulis', label: 'Karya tulis / artikel / makalah' },
];

Deno.test('skema ekstraksi ketat, tanpa tgl_sertifikat', () => {
  for (const jenis of Object.keys(SPECIFIC_FIELDS)) {
    const [name, schema] = extractionSchema(jenis);
    assertEquals(name.startsWith(jenis), true);
    assertEquals(name.endsWith(SCHEMA_VERSION), true);
    const obj = schema as { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
    assertEquals(obj.additionalProperties, false);
    assertEquals([...obj.required].sort(), Object.keys(obj.properties).sort());
    assertEquals('tgl_sertifikat' in obj.properties, false);
    assertEquals(fieldKeysFor(jenis).includes('tgl_sertifikat'), false);
  }
  assertEquals(CORE_FIELDS.includes('tgl_sertifikat'), false);
  const enumJenis = (classifySchema().properties as { jenis_hki: { enum: unknown[] } }).jenis_hki.enum;
  for (const jenis of Object.keys(SPECIFIC_FIELDS)) assertEquals(enumJenis.includes(jenis), true);
  assertEquals(enumJenis.includes(null), true);
});

Deno.test('pola nomor: cocok, spasi diabaikan, mismatch, tanpa pola', () => {
  assertEquals(numberMatchesPattern('hak_cipta', 'no_permohonan', 'EC00202312345'), true);
  assertEquals(numberMatchesPattern('hak_cipta', 'no_permohonan', 'EC00 2023 12345'), true);
  assertEquals(numberMatchesPattern('hak_cipta', 'no_permohonan', 'XYZ'), false);
  assertEquals(numberMatchesPattern('paten', 'no_sertifikat', 'IDP000067890'), true);
  assertEquals(numberMatchesPattern('paten', 'no_sertifikat', '12345'), false);
  assertEquals(numberMatchesPattern('merek', 'no_permohonan', 'apapun'), null);
});

Deno.test('parseDate hanya menerima YYYY-MM-DD yang kalender-valid', () => {
  assertEquals(parseDate('2023-03-14'), '2023-03-14');
  for (const bad of ['14 Maret 2023', '2023-13-01', '2023-02-30', '', 'x']) {
    assertEquals(parseDate(bad), null);
  }
});

Deno.test('skor field: evidence, pola, tanggal, nilai kosong, clamp', () => {
  const ok = scoreField(
    'judul',
    { value: 'Sistem Informasi Arsip Digital', confidence: 0.9, page: 1, evidence: 'Sistem Informasi Arsip  Digital' },
    'hak_cipta',
    TEXT,
  );
  assertAlmostEquals(ok.confidence, 0.95);
  assertEquals(ok.flags.includes('EVIDENCE_OK'), true);

  const miss = scoreField(
    'judul',
    { value: 'Judul Karangan', confidence: 0.9, page: 1, evidence: 'Judul Karangan' },
    'hak_cipta',
    TEXT,
  );
  assertAlmostEquals(miss.confidence, 0.72);
  assertEquals(miss.flags.includes('EVIDENCE_NOT_FOUND'), true);

  const noText = scoreField('judul', { value: 'X', confidence: 0.9, page: 1, evidence: 'X' }, 'hak_cipta', {});
  assertAlmostEquals(noText.confidence, 0.9);
  assertEquals(noText.flags, []);

  const pat = scoreField(
    'no_permohonan',
    { value: 'ABC', confidence: 0.9, page: 1, evidence: 'ABC' },
    'hak_cipta',
    {},
  );
  assertAlmostEquals(pat.confidence, 0.63);
  assertEquals(pat.flags.includes('PATTERN_MISMATCH'), true);

  const d = scoreField(
    'tgl_permohonan',
    { value: '14 Maret 2023', confidence: 0.95, page: 1, evidence: 'x' },
    'hak_cipta',
    {},
  );
  assertEquals(d.confidence <= 0.3, true);
  assertEquals(d.flags.includes('INVALID_DATE'), true);

  const empty = scoreField('judul', { value: null, confidence: 0.99, page: null, evidence: null }, 'hak_cipta', {});
  assertEquals(empty.value, null);
  assertEquals(empty.confidence <= 0.3, true);

  const clamp = scoreField('judul', { value: 'A', confidence: 7, page: 1, evidence: 'A' }, 'hak_cipta', {});
  assertEquals(clamp.confidence >= 0 && clamp.confidence <= 1, true);
});

Deno.test('skor orang menolak nama kosong dan menurunkan bila evidence tidak ada', () => {
  assertEquals(scorePerson({ nama: '  ', confidence: 0.9 }, {}), null);
  const p = scorePerson(
    { nama: 'Budi Santoso', peran: 'pencipta', confidence: 0.9, page: 1, evidence: 'Budi Santoso' },
    { 1: 'Pencipta: Ahmad Fauzi' },
  );
  assertEquals(p?.confidence, 0.72);
});

Deno.test('normalisasi jenis ciptaan ke kode master', () => {
  assertEquals(normalizeJenisCiptaan('program_komputer', MASTER), 'program_komputer');
  assertEquals(normalizeJenisCiptaan('Program komputer', MASTER), 'program_komputer');
  assertEquals(normalizeJenisCiptaan('Program Komputer versi 2', MASTER), 'program_komputer');
  assertEquals(normalizeJenisCiptaan('karya tulis / artikel', MASTER), 'karya_tulis');
  assertEquals(normalizeJenisCiptaan('hal yang tidak ada', MASTER), null);
  assertEquals(normalizeJenisCiptaan(null, MASTER), null);
});

Deno.test('porsi field inti berkeyakinan rendah', () => {
  const fields = CORE_FIELDS.map((key, i) => ({
    key,
    value: 'x',
    confidence: i < 2 ? 0.2 : 0.9,
    modelConfidence: 0.9,
    page: 1,
    evidence: 'x',
    flags: [],
  }));
  assertEquals(lowConfidenceShare(fields, 0.5), 0.5);
});
