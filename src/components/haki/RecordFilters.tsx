import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { JENIS_LABEL, WORKFLOW_LABEL } from '../../haki/constants';
import { SORTS, type ListFilters } from '../../haki/listQuery';
import type { MasterItem } from '../../haki/types';
import type { Unit } from '../../types';

type Props = {
  value: ListFilters;
  units: Unit[];
  master: MasterItem[];
  showStatus?: boolean;
  statusChoices?: readonly { key: string; label: string }[];
  showQueue?: boolean;
  fixedStatus?: string;
  defaultStatusLabel?: string;
  onChange: (filters: ListFilters) => void;
};

const year = new Date().getFullYear();
const years = Array.from({ length: 30 }, (_, index) => String(year - index));
const statuses = Object.entries(WORKFLOW_LABEL).map(([key, label]) => ({ key, label }));

export default function RecordFilters({ value, units, master, showStatus, statusChoices, showQueue, fixedStatus, defaultStatusLabel = 'Semua status', onChange }: Props) {
  const [query, setQuery] = useState(value.q);
  useEffect(() => { setQuery(value.q); }, [value.q]);
  const extra = [value.jenis, value.tahun, value.unit, value.sumber, value.sort, value.conf, value.umur].filter(Boolean).length;
  const choices = statusChoices ?? statuses;

  function submit(event: FormEvent) {
    event.preventDefault();
    onChange({ ...value, q: query.trim() });
  }

  function field(key: keyof ListFilters, label: string, children: ReactNode) {
    return (
      <label className="field">
        <span>{label}</span>
        <select value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })}>
          {children}
        </select>
      </label>
    );
  }

  return (
    <section className="card filter-card" aria-label="Pencarian dan filter dokumen">
      <form className="filter-main" onSubmit={submit}>
        <label className="field filter-search">
          <span>Pencarian</span>
          <input type="search" placeholder="Judul, nomor, atau pencipta" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="submit" className="secondary">Cari</button>
        {showStatus && field('status', 'Status', <>
          <option value="">{defaultStatusLabel}</option>
          {choices.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </>)}
        {fixedStatus && <span className="badge badge-info">{fixedStatus}</span>}
      </form>
      <details className="filter-more">
        <summary>Filter lainnya{extra ? ' (' + extra + ')' : ''}</summary>
        <div className="filter-fields">
          {field('jenis', 'Jenis', <>
            <option value="">Semua jenis</option>
            {Object.entries(JENIS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </>)}
          {field('tahun', 'Tahun permohonan', <>
            <option value="">Semua tahun</option>
            {value.tahun && !years.includes(value.tahun) && <option>{value.tahun}</option>}
            {years.map((item) => <option key={item}>{item}</option>)}
          </>)}
          {field('unit', 'Unit', <>
            <option value="">Semua unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nama}</option>)}
          </>)}
          {field('sumber', 'Sumber dana', <>
            <option value="">Semua sumber dana</option>
            {master.filter((item) => item.kategori === 'sumber_dana').map((item) => <option key={item.nilai} value={item.nilai}>{item.label}</option>)}
          </>)}
          {showQueue && <>
            {field('conf', 'Keyakinan AI', <>
              <option value="">Semua keyakinan</option>
              <option value="tinggi">Tinggi</option>
              <option value="sedang">Sedang</option>
              <option value="rendah">Rendah</option>
            </>)}
            {field('umur', 'Umur antrean', <>
              <option value="">Semua umur</option>
              <option value="3">Menunggu ≥ 3 hari</option>
              <option value="7">Menunggu ≥ 7 hari</option>
              <option value="14">Menunggu ≥ 14 hari</option>
            </>)}
          </>}
          {field('sort', 'Urutkan', <>
            <option value="">Urutan bawaan</option>
            {Object.entries(SORTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </>)}
        </div>
      </details>
    </section>
  );
}
