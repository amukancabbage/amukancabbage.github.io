import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProfile } from '../../auth';
import RecordFilters from '../../components/haki/RecordFilters';
import StatusBadge from '../../components/haki/StatusBadge';
import { errorText, loadMaster, loadSettings, masterLabel, type HakiSettings } from '../../haki/api';
import { EXPORT_MAX_ROWS, EXPORT_MAX_ZIP, JENIS_LABEL } from '../../haki/constants';
import { csv, fetchAll, logExport, saveBlob, toRows, xlsx, zipFiles } from '../../haki/export';
import { fmtDate } from '../../haki/format';
import { buildQuery, readFilters, writeFilters } from '../../haki/listQuery';
import type { HkiListRow, MasterItem } from '../../haki/types';
import { supabase } from '../../lib/supabase';
import type { Unit } from '../../types';

const PAGE = 25;

export default function HakiArchivePage() {
  const profile = useProfile();
  const [sp, setSp] = useSearchParams();
  const filters = readFilters(sp);
  const page = Number(sp.get('page') ?? 1);
  const [rows, setRows] = useState<HkiListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [units, setUnits] = useState<Unit[]>([]);
  const [master, setMaster] = useState<MasterItem[]>([]);
  const [settings, setSettings] = useState<HakiSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // validator/operator dapat melihat semua status dalam cakupan; selainnya hanya arsip
  const allStatuses = profile.role === 'validator' || profile.role === 'operator';
  const base = allStatuses && filters.status ? undefined : ['ARCHIVED'];

  useEffect(() => {
    supabase.from('units').select('*').order('nama').then(({ data }) => setUnits((data as Unit[]) ?? []));
    loadMaster().then(setMaster);
    loadSettings().then(setSettings);
  }, []);

  const opts = settings ? { units, high: settings.high, low: settings.low, baseStatuses: base, defaultSort: 'tgl_permohonan' } : null;

  useEffect(() => {
    if (!opts) return;
    let alive = true;
    buildQuery(filters, opts)
      .range((page - 1) * PAGE, page * PAGE - 1)
      .then(({ data, count, error: err }) => {
        if (!alive) return;
        if (err) setError(err.message);
        setRows((data as HkiListRow[]) ?? []);
        setTotal(count ?? 0);
      });
    return () => {
      alive = false;
    };
  }, [sp.toString(), settings, units.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function exportAs(kind: 'csv' | 'xlsx' | 'zip') {
    if (!opts) return;
    setBusy(kind);
    setError(null);
    try {
      const all = await fetchAll((from, to) => buildQuery(filters, opts, false).range(from, to));
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') saveBlob(csv(toRows(all, master)), `arsip-hki-${stamp}.csv`);
      if (kind === 'xlsx') saveBlob(xlsx(toRows(all, master)), `arsip-hki-${stamp}.xlsx`);
      if (kind === 'zip') saveBlob(await zipFiles(all, master, (d, t) => setBusy(`zip ${d}/${t}`)), `arsip-hki-${stamp}.zip`);
      await logExport(kind, all.length);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Arsip HKI</h1>
          <p className="muted">Hanya menampilkan dokumen dalam cakupan akses Anda. Tahun = tahun tanggal permohonan.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => exportAs('csv')} disabled={!!busy || total === 0}>
            CSV
          </button>
          <button className="secondary" onClick={() => exportAs('xlsx')} disabled={!!busy || total === 0}>
            XLSX
          </button>
          <button
            className="secondary"
            onClick={() => exportAs('zip')}
            disabled={!!busy || total === 0 || total > EXPORT_MAX_ZIP}
            title={total > EXPORT_MAX_ZIP ? `ZIP maksimal ${EXPORT_MAX_ZIP} dokumen` : undefined}
          >
            ZIP berkas
          </button>
        </div>
      </div>
      {busy && <p className="notice">Menyiapkan ekspor ({busy})...</p>}
      {total > EXPORT_MAX_ROWS && <p className="muted small">Ekspor dibatasi {EXPORT_MAX_ROWS} baris pertama.</p>}
      <RecordFilters value={filters} units={units} master={master} showStatus={allStatuses} onChange={(f) => setSp(writeFilters(f))} />
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Judul</th>
              <th>Jenis</th>
              <th>No. Sertifikat</th>
              <th>Tgl. Permohonan</th>
              <th>Pencipta</th>
              <th>Unit</th>
              <th>Sumber Dana</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Tidak ada dokumen.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/haki/dokumen/${r.id}`}>{r.judul || '(tanpa judul)'}</Link>
                  </td>
                  <td>{r.jenis ? JENIS_LABEL[r.jenis] : '-'}</td>
                  <td>{r.no_sertifikat ?? '-'}</td>
                  <td>{fmtDate(r.tgl_permohonan)}</td>
                  <td>{r.pencipta ?? '-'}</td>
                  <td>{r.unit_nama ?? '-'}</td>
                  <td>{masterLabel(master, 'sumber_dana', r.sumber_dana) || '-'}</td>
                  <td>
                    <StatusBadge status={r.workflow_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>{total} dokumen</span>
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
