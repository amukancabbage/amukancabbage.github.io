import { useState } from 'react';
import { errorText, rpc } from '../../haki/api';
import { COCOK_LABEL, PERAN_LABEL } from '../../haki/constants';
import { matchPersons, normalizeName, toCandidates, type DirectoryEntry } from '../../haki/personMatch';
import type { HkiPerson, HkiRecord, Peran } from '../../haki/types';

type Draft = {
  id?: number;
  nama: string;
  peran: Peran;
  alamat: string;
  kewarganegaraan: string;
  dosen_id: number | null;
  link_manual: boolean;
  confidence?: number | null;
  page?: number | null;
  evidence?: string | null;
};

type Lecturer = { id: number; nama: string; unit: string | null; nidn: string | null };

type Props = {
  record: HkiRecord;
  persons: HkiPerson[];
  editable: boolean;
  onSaved: () => void;
  onConflict: (message: string) => void;
};

const tone: Record<string, string> = {
  dikonfirmasi: 'ok',
  disarankan: 'info',
  ambigu: 'warn',
  ditolak: 'bad',
  eksternal: 'neutral',
};

function toDraft(p: HkiPerson): Draft {
  return {
    id: p.id,
    nama: p.nama,
    peran: p.peran,
    alamat: p.alamat ?? '',
    kewarganegaraan: p.kewarganegaraan ?? '',
    dosen_id: p.dosen_id,
    link_manual: p.link_manual,
    confidence: p.confidence,
    page: p.page,
    evidence: p.evidence,
  };
}

export default function PersonsEditor({ record, persons, editable, onSaved, onConflict }: Props) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Lecturer[]>([]);

  async function directory() {
    const dir = await rpc<DirectoryEntry[]>('hki_match_directory');
    return toCandidates(dir);
  }

  function startEdit() {
    setDrafts(persons.map(toDraft));
    setEditing(true);
    setError(null);
  }

  function patch(i: number, value: Partial<Draft>) {
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...value } : x)));
  }

  async function handle(e: unknown) {
    const msg = errorText(e);
    if (msg.includes('diubah')) onConflict(msg);
    else setError(msg);
  }

  // simpan daftar: nama yang berubah dicocokkan ulang, tautan manual dibiarkan
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const candidates = await directory();
      const original = new Map(persons.map((p) => [p.id, p]));
      const same = drafts.map((d) => {
        const prev = d.id ? original.get(d.id) : undefined;
        return !!prev && normalizeName(prev.nama) === normalizeName(d.nama);
      });
      const base = drafts.map((d, i) => (same[i] ? d : { ...d, dosen_id: null, link_manual: false }));
      const matched = matchPersons(base, candidates, record.owner_dosen_id, record.unit_id).map((m, i) =>
        same[i] ? { ...m, dosen_id: drafts[i].dosen_id, link_manual: drafts[i].link_manual } : m,
      );
      await rpc('hki_put_persons', { p_record: record.id, p_versi: record.versi, p_persons: matched });
      setEditing(false);
      onSaved();
    } catch (e) {
      await handle(e);
    } finally {
      setBusy(false);
    }
  }

  async function rematch() {
    setBusy(true);
    setError(null);
    try {
      const candidates = await directory();
      const rows = persons.map(toDraft);
      const matched = matchPersons(rows, candidates, record.owner_dosen_id, record.unit_id);
      await rpc('hki_put_persons', { p_record: record.id, p_versi: record.versi, p_persons: matched });
      onSaved();
    } catch (e) {
      await handle(e);
    } finally {
      setBusy(false);
    }
  }

  async function search(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await rpc<Lecturer[]>('hki_lecturer_search', { p_q: value }).catch(() => []));
  }

  async function link(personId: number, dosenId: number | null) {
    setBusy(true);
    setError(null);
    try {
      await rpc('hki_link_person', { p_record: record.id, p_versi: record.versi, p_person: personId, p_dosen: dosenId });
      setLinkFor(null);
      setQ('');
      setResults([]);
      onSaved();
    } catch (e) {
      await handle(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Pencipta, Pemegang &amp; Kuasa</h2>
        {editable && !editing && (
          <div className="actions">
            <button className="secondary" onClick={rematch} disabled={busy || persons.length === 0}>
              Cocokkan ulang
            </button>
            <button onClick={startEdit} disabled={busy}>
              Ubah daftar
            </button>
          </div>
        )}
      </div>
      {error && <p className="error pad">{error}</p>}

      {!editing ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama tertulis</th>
                <th>Peran</th>
                <th>Dosen tertaut</th>
                <th>Status</th>
                {editable && <th></th>}
              </tr>
            </thead>
            <tbody>
              {persons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Belum ada orang. Minimal satu pencipta dan satu pemegang hak.
                  </td>
                </tr>
              ) : (
                persons.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.nama}
                      {p.alamat && <div className="muted small">{p.alamat}</div>}
                    </td>
                    <td>{PERAN_LABEL[p.peran]}</td>
                    <td>
                      {p.dosen?.nama ?? '-'}
                      {p.link_manual && <span className="muted small"> (manual)</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${tone[p.status_cocok]}`}>{COCOK_LABEL[p.status_cocok]}</span>
                    </td>
                    {editable && (
                      <td className="actions">
                        {linkFor === p.id ? (
                          <div className="link-search">
                            <input autoFocus placeholder="Cari nama dosen..." value={q} onChange={(e) => search(e.target.value)} />
                            {results.map((r) => (
                              <button key={r.id} className="secondary" onClick={() => link(p.id, r.id)} disabled={busy}>
                                {r.nama}
                                {r.unit ? ` · ${r.unit}` : ''}
                                {r.nidn ? ` · ${r.nidn}` : ''}
                              </button>
                            ))}
                            <button className="link-button" onClick={() => setLinkFor(null)}>
                              Batal
                            </button>
                          </div>
                        ) : (
                          <>
                            <button className="secondary" onClick={() => setLinkFor(p.id)} disabled={busy}>
                              Tautkan
                            </button>
                            {p.dosen_id && (
                              <button className="danger" onClick={() => link(p.id, null)} disabled={busy}>
                                Lepas
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="form persons-form">
          {drafts.map((d, i) => (
            <div key={i} className="person-row wide">
              <input placeholder="Nama sesuai dokumen" value={d.nama} onChange={(e) => patch(i, { nama: e.target.value })} />
              <select value={d.peran} onChange={(e) => patch(i, { peran: e.target.value as Peran })}>
                {Object.entries(PERAN_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <input placeholder="Alamat" value={d.alamat} onChange={(e) => patch(i, { alamat: e.target.value })} />
              <input
                placeholder="Kewarganegaraan"
                value={d.kewarganegaraan}
                onChange={(e) => patch(i, { kewarganegaraan: e.target.value })}
              />
              <button className="danger" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}>
                Hapus
              </button>
            </div>
          ))}
          <div className="form-actions">
            <button
              className="secondary"
              onClick={() =>
                setDrafts((x) => [...x, { nama: '', peran: 'pencipta', alamat: '', kewarganegaraan: '', dosen_id: null, link_manual: false }])
              }
            >
              Tambah orang
            </button>
            <button onClick={() => save()} disabled={busy}>
              {busy ? 'Menyimpan...' : 'Simpan daftar'}
            </button>
            <button className="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Batal
            </button>
          </div>
          <p className="muted small wide">
            Nama dicocokkan otomatis dengan data dosen. Nama pendek harus sama persis; jika ada beberapa kandidat
            setara, status menjadi “Ambigu” dan perlu ditautkan manual. Dosen lain baru dapat melihat dokumen setelah
            mengonfirmasi.
          </p>
        </div>
      )}
    </div>
  );
}
