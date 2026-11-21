import { Plus, RefreshCw, Save, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconLabel } from '../AppIcon';
import { useUnsavedDraft } from '../DraftGuard';
import SearchSelect from '../SearchSelect';
import { HakiError, errorText, rpc } from '../../haki/api';
import { COCOK_LABEL, PERAN_LABEL } from '../../haki/constants';
import { matchPersons, normalizeName, toCandidates, type DirectoryEntry } from '../../haki/personMatch';
import type { HkiPerson, HkiRecord, Peran } from '../../haki/types';
import { supabase } from '../../lib/supabase';

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
  locked?: boolean;
  onPendingChange: (pending: boolean) => void;
  onSaved: (version: number) => void;
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

export default function PersonsEditor({ record, persons, editable, locked = false, onPendingChange, onSaved, onConflict }: Props) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<number | null>(null);
  const initial = useRef('');
  const editVersion = useRef(record.versi);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const dirty = editing && initial.current !== JSON.stringify(drafts);
  const canEdit = editable && !locked;
  useEffect(() => { onPendingChange(dirty || busy); }, [onPendingChange, dirty, busy]);

  useUnsavedDraft({
    dirty,
    saving: busy,
    save: canEdit && editing ? save : undefined,
    discard: () => setEditing(false),
  });

  async function directory() {
    const dir = await rpc<DirectoryEntry[]>('hki_match_directory');
    return toCandidates(dir);
  }

  function startEdit() {
    const initialDrafts = persons.map(toDraft);
    initial.current = JSON.stringify(initialDrafts);
    editVersion.current = record.versi;
    setDrafts(initialDrafts);
    setEditing(true);
    setError(null);
  }

  function patch(i: number, value: Partial<Draft>) {
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...value } : x)));
  }

  async function handle(e: unknown) {
    const msg = errorText(e);
    if (e instanceof HakiError && e.code === 'VERSION_CONFLICT') onConflict(msg);
    else setError(msg);
  }

  // simpan daftar: nama yang berubah dicocokkan ulang, tautan manual dibiarkan
  function save() {
    if (inFlight.current) return inFlight.current;
    if (!canEdit || !editing) return Promise.resolve(false);
    inFlight.current = saveDraft().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }

  async function saveDraft() {
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
      const version = await rpc<number>('hki_put_persons', { p_record: record.id, p_versi: editVersion.current, p_persons: matched });
      setEditing(false);
      onSaved(version);
      return true;
    } catch (e) {
      await handle(e);
      return false;
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
      const version = await rpc<number>('hki_put_persons', { p_record: record.id, p_versi: record.versi, p_persons: matched });
      onSaved(version);
    } catch (e) {
      await handle(e);
    } finally {
      setBusy(false);
    }
  }

  async function search(value: string, signal: AbortSignal) {
    const { data, error } = await supabase.rpc('hki_lecturer_search', { p_q: value }).abortSignal(signal);
    if (error) throw error;
    return ((data ?? []) as Lecturer[]).map((row) => ({
      value: String(row.id), label: row.nama, detail: [row.unit, row.nidn ? 'NIDN ' + row.nidn : null].filter(Boolean).join(', '),
    }));
  }

  async function link(personId: number, dosenId: number | null) {
    setBusy(true);
    setError(null);
    try {
      const version = await rpc<number>('hki_link_person', { p_record: record.id, p_versi: record.versi, p_person: personId, p_dosen: dosenId });
      setLinkFor(null);
      onSaved(version);
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
        {canEdit && !editing && (
          <div className="actions">
            <button className="secondary" onClick={rematch} disabled={busy || persons.length === 0}>
              <IconLabel icon={RefreshCw}>Cocokkan ulang</IconLabel>
            </button>
            <button onClick={startEdit} disabled={busy}>
              <IconLabel icon={SquarePen}>Ubah daftar</IconLabel>
            </button>
          </div>
        )}
      </div>
      {error && <p className="error pad" role="alert">{error}</p>}

      {!editing ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama tertulis</th>
                <th>Peran</th>
                <th>Dosen tertaut</th>
                <th>Status</th>
                {canEdit && <th></th>}
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
                    {canEdit && (
                      <td className="actions">
                        {linkFor === p.id ? (
                          <div className="link-search">
                            <SearchSelect label="Cari nama dosen" placeholder="Ketik nama dosen" autoFocus
                              lookup={search} disabled={busy} onPick={(item) => { if (item) void link(p.id, Number(item.value)); }} />
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
              <input aria-label={'Nama orang ' + (i + 1)} disabled={busy || locked} placeholder="Nama sesuai dokumen" value={d.nama} onChange={(e) => patch(i, { nama: e.target.value })} />
              <select aria-label={'Peran orang ' + (i + 1)} disabled={busy || locked} value={d.peran} onChange={(e) => patch(i, { peran: e.target.value as Peran })}>
                {Object.entries(PERAN_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <input aria-label={'Alamat orang ' + (i + 1)} disabled={busy || locked} placeholder="Alamat" value={d.alamat} onChange={(e) => patch(i, { alamat: e.target.value })} />
              <input
                aria-label={'Kewarganegaraan orang ' + (i + 1)} disabled={busy || locked} placeholder="Kewarganegaraan"
                value={d.kewarganegaraan}
                onChange={(e) => patch(i, { kewarganegaraan: e.target.value })}
              />
              <button className="danger" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}>
                <IconLabel icon={Trash2}>Hapus</IconLabel>
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
              <IconLabel icon={Plus}>Tambah orang</IconLabel>
            </button>
            <button onClick={() => void save()} disabled={busy || locked}>
              <IconLabel icon={Save}>{busy ? 'Menyimpan...' : 'Simpan daftar'}</IconLabel>
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
