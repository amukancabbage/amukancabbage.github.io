import { useState, type FormEvent } from 'react';
import { JENIS_LABEL, WORKFLOW_LABEL } from '../../haki/constants';
import { SORTS, type ListFilters } from '../../haki/listQuery';
import type { MasterItem } from '../../haki/types';
import type { Unit } from '../../types';

type Props = {
  value: ListFilters;
  units: Unit[];
  master: MasterItem[];
  showStatus?: boolean;
  showQueue?: boolean;
  onChange: (f: ListFilters) => void;
};

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(thisYear - i));

export default function RecordFilters({ value, units, master, showStatus, showQueue, onChange }: Props) {
  const [q, setQ] = useState(value.q);
  const set = (k: keyof ListFilters, v: string) => onChange({ ...value, [k]: v });

  function submit(e: FormEvent) {
    e.preventDefault();
    onChange({ ...value, q: q.trim() });
  }

  return (
    <form className="filters" onSubmit={submit}>
      <input className="search-input" placeholder="Cari judul, nomor, pencipta..." value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={value.jenis} onChange={(e) => set('jenis', e.target.value)} aria-label="Jenis">
        <option value="">Semua jenis</option>
        {Object.entries(JENIS_LABEL).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <select value={value.tahun} onChange={(e) => set('tahun', e.target.value)} aria-label="Tahun permohonan">
        <option value="">Semua tahun</option>
        {YEARS.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <select value={value.unit} onChange={(e) => set('unit', e.target.value)} aria-label="Unit">
        <option value="">Semua unit</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nama}
          </option>
        ))}
      </select>
      <select value={value.sumber} onChange={(e) => set('sumber', e.target.value)} aria-label="Sumber dana">
        <option value="">Semua sumber dana</option>
        {master
          .filter((m) => m.kategori === 'sumber_dana')
          .map((m) => (
            <option key={m.nilai} value={m.nilai}>
              {m.label}
            </option>
          ))}
      </select>
      {showStatus && (
        <select value={value.status} onChange={(e) => set('status', e.target.value)} aria-label="Status dokumen">
          <option value="">Semua status</option>
          {Object.entries(WORKFLOW_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      )}
      {showQueue && (
        <>
          <select value={value.conf} onChange={(e) => set('conf', e.target.value)} aria-label="Keyakinan AI">
            <option value="">Semua keyakinan</option>
            <option value="tinggi">Keyakinan tinggi</option>
            <option value="sedang">Keyakinan sedang</option>
            <option value="rendah">Keyakinan rendah</option>
          </select>
          <select value={value.umur} onChange={(e) => set('umur', e.target.value)} aria-label="Umur antrean">
            <option value="">Semua umur</option>
            <option value="3">Menunggu ≥ 3 hari</option>
            <option value="7">Menunggu ≥ 7 hari</option>
            <option value="14">Menunggu ≥ 14 hari</option>
          </select>
        </>
      )}
      <select value={value.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Urutkan">
        <option value="">Urutan bawaan</option>
        {Object.entries(SORTS).map(([k, s]) => (
          <option key={k} value={k}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="submit" className="secondary">
        Terapkan
      </button>
    </form>
  );
}
