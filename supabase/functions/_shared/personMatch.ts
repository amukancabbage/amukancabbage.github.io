// Port PersonMatcher/Names/Similarity dari app_haki. Modul murni tanpa impor:
// dipakai oleh frontend (Vite) dan Edge Function (Deno).
// Prinsip: salah orang lebih buruk daripada tidak cocok.

const TITLE_TOKENS = new Set([
  'prof', 'dr', 'drs', 'dra', 'ir', 'h', 'hj', 'kh', 'drg', 'apt', 'ns', 's', 'm', 'sh', 'se', 'st', 'mt',
  'msi', 'mm', 'mh', 'mkom', 'skom', 'sp', 'spd', 'spt', 'sked', 'spsi', 'ssi', 'sst', 'skm', 'sfarm', 'sik',
  'skep', 'sip', 'ssos', 'sag', 'shi', 'mpd', 'mag', 'mhum', 'mkes', 'mscs', 'msc', 'mba', 'mpar', 'mpsi',
  'mstat', 'mkm', 'phd', 'ph', 'd', 'cma', 'ca', 'cpa', 'cfp', 'ssn', 'smb', 'mbiotech', 'mbiomed', 'mim',
  'sr', 'jr', 'mp',
]);

export const FUZZY = 0.9;
export const EXACT_MAX_CHARS = 12;
export const CLOSE_MARGIN = 0.03;
export const OPTION_FLOOR = 0.85;
const EPS = 1e-9;

// buang gelar, ascii, huruf kecil
export function normalizeName(name: string): string {
  const lowered = (name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const tokens = lowered.split(/[\s,;:/()[\]]+/).filter(Boolean);
  const clean = (t: string) => t.replace(/[^a-z0-9]+/g, ' ').trim();
  let kept = tokens.filter((t) => {
    const compact = t.replace(/[^a-z0-9]+/g, '');
    return compact !== '' && !TITLE_TOKENS.has(compact);
  });
  if (kept.length === 0) kept = tokens;
  return kept.map(clean).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function lcs(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Indel ratio: 2*LCS/(la+lb)
export function ratio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  return (2 * lcs(a, b)) / (a.length + b.length);
}

export function tokenSortRatio(a: string, b: string): number {
  const sort = (s: string) => s.split(/\s+/).filter(Boolean).sort().join(' ');
  return ratio(sort(a), sort(b));
}

// nama pendek (1 token atau ≤12 huruf) wajib skor 1,0
export function minScore(normalized: string): number {
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length <= 1 || normalized.length <= EXACT_MAX_CHARS ? 1 : FUZZY;
}

export type Candidate = { key: number; names: string[]; unit: number | null };
export type Scored = { candidate: Candidate; score: number };
export type MatchResult =
  | { status: 'match'; key: number; score: number }
  | { status: 'ambiguous'; candidates: Scored[] }
  | { status: 'none' };

function score(normalized: string, c: Candidate): number {
  let best = 0;
  for (const n of c.names) {
    const s = tokenSortRatio(normalized, normalizeName(n));
    if (s > best) best = s;
  }
  return best;
}

export function resolve(
  name: string,
  candidates: Candidate[],
  ownerKey: number | null,
  ownerUnit: number | null,
): MatchResult {
  const normalized = normalizeName(name);
  if (!normalized) return { status: 'none' };
  const need = minScore(normalized);
  const scored = candidates
    .map((candidate) => ({ candidate, score: score(normalized, candidate) }))
    .filter((s) => s.score >= need - EPS)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { status: 'none' };

  const top = scored[0].score;
  const margin = top >= 1 - EPS ? EPS : CLOSE_MARGIN;
  const close = scored.filter((s) => s.score >= top - margin);
  if (close.length === 1) return { status: 'match', key: close[0].candidate.key, score: close[0].score };

  // kandidat seri: utamakan pemilik dokumen, lalu satu-satunya di unit pemilik
  const owner = close.find((s) => s.candidate.key === ownerKey);
  if (owner) return { status: 'match', key: owner.candidate.key, score: owner.score };
  if (ownerUnit != null) {
    const sameUnit = close.filter((s) => s.candidate.unit === ownerUnit);
    if (sameUnit.length === 1) return { status: 'match', key: sameUnit[0].candidate.key, score: sameUnit[0].score };
  }
  return { status: 'ambiguous', candidates: close };
}

// pilihan untuk tautan manual
export function options(name: string, candidates: Candidate[]): Scored[] {
  const normalized = normalizeName(name);
  if (!normalized) return [];
  return candidates
    .map((candidate) => ({ candidate, score: score(normalized, candidate) }))
    .filter((s) => s.score >= OPTION_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export type DirectoryEntry = { id: number; nama: string; unit_id: number | null; aliases: string[] };

export function toCandidates(directory: DirectoryEntry[]): Candidate[] {
  return directory.map((d) => ({ key: d.id, names: [d.nama, ...(d.aliases ?? [])], unit: d.unit_id }));
}

export type PersonInput = {
  nama: string;
  peran?: string;
  dosen_id?: number | null;
  link_manual?: boolean;
  [key: string]: unknown;
};

// usulan awal; status akhir ditetapkan server (hki_replace_persons_internal)
export function matchPersons<T extends PersonInput>(
  persons: T[],
  candidates: Candidate[],
  ownerKey: number | null,
  ownerUnit: number | null,
): (T & { nama_normal: string; dosen_id: number | null; status_cocok: string })[] {
  return persons.map((p) => {
    const nama_normal = normalizeName(p.nama);
    if (p.link_manual) {
      return { ...p, nama_normal, dosen_id: p.dosen_id ?? null, status_cocok: p.dosen_id ? 'disarankan' : 'eksternal' };
    }
    const r = resolve(p.nama, candidates, ownerKey, ownerUnit);
    if (r.status === 'match') return { ...p, nama_normal, dosen_id: r.key, status_cocok: 'disarankan' };
    if (r.status === 'ambiguous') return { ...p, nama_normal, dosen_id: null, status_cocok: 'ambigu' };
    return { ...p, nama_normal, dosen_id: null, status_cocok: 'eksternal' };
  });
}
