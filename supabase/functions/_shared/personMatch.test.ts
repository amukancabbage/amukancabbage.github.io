import { assertEquals } from 'jsr:@std/assert';
import {
  minScore,
  normalizeName,
  options,
  resolve,
  type Candidate,
} from './personMatch.ts';

function cands(rows: [number, string | string[], number | null][]): Candidate[] {
  return rows.map(([key, names, unit]) => ({
    key,
    names: Array.isArray(names) ? names : [names],
    unit,
  }));
}

Deno.test('normalizeName membuang gelar dan merapikan spasi/aksen', () => {
  const cases: [string, string][] = [
    ['Dr. Budi Santoso, S.Kom., M.Kom.', 'budi santoso'],
    ['Prof. Dr. Ir. Ahmad Fauzi, M.T.', 'ahmad fauzi'],
    ['Hj. Siti Aminah', 'siti aminah'],
    ['BUDI SANTOSO', 'budi santoso'],
    ['Budi  Santoso', 'budi santoso'],
    ['Dra. Hj. Ratna Sari, M.Pd.', 'ratna sari'],
    ['José Álvarez', 'jose alvarez'],
  ];
  for (const [raw, expected] of cases) assertEquals(normalizeName(raw), expected);
});

Deno.test('nama pendek wajib skor 1 (satu token atau ≤12 huruf)', () => {
  assertEquals(minScore('budi'), 1);
  assertEquals(minScore('budi santoso'), 1); // 12 huruf termasuk spasi
  assertEquals(minScore('siti nurhaliza putri') < 1, true);
});

Deno.test('resolve: persis, urutan kata, fuzzy nama panjang, tolak nama pendek yang hampir sama', () => {
  const c = cands([
    [1, 'Dr. Budi Santoso, S.Kom., M.T.', null],
    [2, ['Sari Wulandari', 'wulandari sari'], null],
    [3, 'Siti Nurhaliza Putri', null],
  ]);
  assertEquals(resolve('Budi Santoso', c, null, null).status, 'match');
  assertEquals(resolve('Santoso Budi', c, null, null).status, 'match');
  assertEquals((resolve('Siti Nurhaliza Putri', c, null, null) as { key: number }).key, 3);
  assertEquals((resolve('Siti Nurhalizah Putri', c, null, null) as { key: number }).key, 3);
  assertEquals(resolve('Budi Santosa', c, null, null).status, 'none');
  assertEquals(resolve('Ahmad Fauzi', c, null, null).status, 'none');
  assertEquals(resolve('Budi', c, null, null).status, 'none');
  assertEquals(resolve('', c, null, null).status, 'none');
});

Deno.test('resolve tidak menebak antara kandidat setara; pemilik/unit memecah seri', () => {
  const c = cands([
    [1, 'Siti Aminah', 10],
    [2, 'Siti Aminah, M.Pd.', 20],
    [3, 'Rina Marlina', null],
  ]);
  const amb = resolve('Siti Aminah', c, null, null);
  assertEquals(amb.status, 'ambiguous');
  if (amb.status === 'ambiguous') {
    assertEquals(amb.candidates.map((x) => x.candidate.key).sort(), [1, 2]);
  }

  assertEquals((resolve('Siti Aminah', c, 2, null) as { key: number }).key, 2);
  assertEquals((resolve('Siti Aminah', c, 99, 10) as { key: number }).key, 1);

  const sameUnit = cands([
    [1, 'Siti Aminah', 10],
    [2, 'Siti Aminah', 10],
  ]);
  assertEquals(resolve('Siti Aminah', sameUnit, 99, 10).status, 'ambiguous');
});

Deno.test('skor persis mengalahkan kandidat fuzzy yang lebih lemah', () => {
  const c = cands([
    [1, 'Muhammad Ridwan Hakim', null],
    [2, 'Muhammad Ridwan Hakimm', null],
  ]);
  assertEquals((resolve('Muhammad Ridwan Hakim', c, null, null) as { key: number }).key, 1);
});

Deno.test('options lebih longgar untuk pilihan tautan manual', () => {
  const c = cands([
    [1, 'Sutrisno', null],
    [2, 'Sutrisna', null],
    [3, 'Bambang', null],
  ]);
  assertEquals(resolve('Sutrisno Eko', cands([[2, 'Sutrisna', null]]), null, null).status, 'none');
  assertEquals(options('Sutrisno', c).map((s) => s.candidate.key), [1, 2]);
});
