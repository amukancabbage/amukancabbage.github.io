import { readListSort, type ListParams, type ListSorts } from '../lib/pagination';

export default function ListSort({ list, choices, compact = false }: { list: ListParams; choices: ListSorts; compact?: boolean }) {
  const selected = readListSort(list.params, choices);
  return (
    <label className="field list-sort">
      <span className={compact ? 'tw:sr-only' : undefined}>Urutkan</span>
      <select value={selected ? selected.key + ':' + (selected.ascending ? 'asc' : 'desc') : ''}
        onChange={(event) => {
          const [sort, dir] = event.target.value.split(':');
          list.update({ sort, dir: dir ?? null });
        }}>
        <option value="">{compact ? 'Urutkan' : 'Urutan bawaan'}</option>
        {Object.entries(choices).flatMap(([key, choice]) => [choice.ascending, !choice.ascending].map((asc) => (
          <option key={key + ':' + asc} value={key + ':' + (asc ? 'asc' : 'desc')}>
            {choice.label} {choice.chronological ? (asc ? 'terlama' : 'terbaru') : (asc ? 'A ke Z' : 'Z ke A')}
          </option>
        )))}
      </select>
    </label>
  );
}
