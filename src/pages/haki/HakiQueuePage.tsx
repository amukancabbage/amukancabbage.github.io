import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import RecordFilters from '../../components/haki/RecordFilters';
import { errorText, loadMaster, loadSettings, rpc, type HakiSettings } from '../../haki/api';
import { BULK_REASON, JENIS_LABEL } from '../../haki/constants';
import { daysBetween } from '../../haki/format';
import { buildQuery, readFilters, writeFilters } from '../../haki/listQuery';
import { saveQueue } from '../../haki/queueContext';
import type { HkiListRow, MasterItem } from '../../haki/types';
import { supabase } from '../../lib/supabase';
import type { Unit } from '../../types';

const PAGE = 50;

type BulkResult = { approved: string[]; skipped: { id: string; reason: string }[] };

export default function HakiQueuePage() {
  const [sp, setSp] = useSearchParams();
  const location = useLocation();
  const filters = readFilters(sp);
  const page = Number(sp.get('page') ?? 1);
  const [rows, setRows] = useState<HkiListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [units, setUnits] = useState<Unit[]>([]);
  const [master, setMaster] = useState<MasterItem[]>([]);
  const [settings, setSettings] = useState<HakiSettings | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    supabase.from('units').select('*').order('nama').then(({ data }) => setUnits((data as Unit[]) ?? []));
    loadMaster().then(setMaster);
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!settings) return;
    let alive = true;
    buildQuery(filters, { units, high: settings.high, low: settings.low, baseStatuses: ['SUBMITTED'], defaultSort: 'lama_antre' })
      .range((page - 1) * PAGE, page * PAGE - 1)
      .then(({ data, count, error: err }) => {
        if (!alive) return;
        if (err) setError(err.message);
        const list = (data as HkiListRow[]) ?? [];
        setRows(list);
        setTotal(count ?? 0);
        setSelected(new Set());
        // konteks Sebelumnya/Berikutnya untuk layar dokumen
        saveQueue(
          list.map((r) => r.id),
          `${location.pathname}${location.search}`,
        );
      });
    return () => {
      alive = false;
    };
  }, [sp.toString(), settings, units.length, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function bulk() {
    if (!confirm(`Setujui ${selected.size} dokumen? Server hanya menyetujui yang benar-benar memenuhi syarat.`)) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await rpc<BulkResult>('hki_bulk_approve', { p_ids: [...selected] }));
      setReload((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // UI "layak cepat" lebih longgar; keputusan akhir di server
  const quick = (r: HkiListRow) => settings != null && r.min_confidence != null && r.min_confidence >= settings.high;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="page">
      <h1>Antrean Validasi</h1>
      <p className="muted">Dokumen yang menunggu keputusan dalam cakupan unit Anda.</p>
      <RecordFilters
        value={filters}
        units={units}
        master={master}
        showQueue
        onChange={(f) => setSp(writeFilters(f))}
      />
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="notice">
          {result.approved.length} disetujui.
          {result.skipped.length > 0 && (
            <>
              {' '}
              {result.skipped.length} dilewati:
              <ul className="small">
                {result.skipped.map((s) => (
                  <li key={s.id}>
                    {rows.find((r) => r.id === s.id)?.judul ?? s.id.slice(0, 8)} — {BULK_REASON[s.reason] ?? s.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="table-toolbar">
        <button onClick={bulk} disabled={busy || selected.size === 0 || selected.size > 100}>
          Setujui terpilih ({selected.size})
        </button>
        <button
          className="secondary"
          onClick={() => setSelected(new Set(rows.filter(quick).map((r) => r.id).slice(0, 100)))}
          disabled={rows.length === 0}
        >
          Pilih yang layak cepat
        </button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Pilih semua"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              </th>
              <th>Judul</th>
              <th>Jenis</th>
              <th>Dosen</th>
              <th>Unit</th>
              <th>Menunggu</th>
              <th>Keyakinan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  Antrean kosong.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Pilih" />
                  </td>
                  <td>
                    <Link to={`/haki/dokumen/${r.id}`}>{r.judul || '(tanpa judul)'}</Link>
                    {quick(r) && <span className="badge badge-ok small-badge">layak cepat</span>}
                  </td>
                  <td>{r.jenis ? JENIS_LABEL[r.jenis] : '-'}</td>
                  <td>{r.owner_nama}</td>
                  <td>{r.unit_nama ?? '-'}</td>
                  <td>{r.submitted_at ? `${daysBetween(r.submitted_at)} hari` : '-'}</td>
                  <td>{r.min_confidence ? `${Math.round(r.min_confidence * 100)}%` : 'tanpa skor AI'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>{total} dokumen menunggu</span>
        <div className="pagination-buttons">
          <button className="secondary" disabled={page <= 1} onClick={() => setSp({ ...Object.fromEntries(sp), page: String(page - 1) })}>
            ‹
          </button>
          <span className="page-info">
            {page} / {pages}
          </span>
          <button className="secondary" disabled={page >= pages} onClick={() => setSp({ ...Object.fromEntries(sp), page: String(page + 1) })}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
