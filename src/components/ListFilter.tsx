import { useEffect, useState } from 'react';
import { loadChoiceLabels, searchChoices, type Choice, type ChoiceSource } from '../lib/search';
import SearchSelect from './SearchSelect';

export type FilterField = { param: string; column: string; label: string } & (
  { kind: 'year' } |
  { kind: 'options'; options: Record<string, string> } |
  { kind: 'source'; source: ChoiceSource }
);

export function validFilter(field: FilterField, value: string) {
  switch (field.kind) {
    case 'year': return /^[1-9]\d{3}$/.test(value);
    case 'source': return /^\d+$/.test(value);
    case 'options': return Object.hasOwn(field.options, value);
  }
}

function SourceFilter({ field, value, onChange }: {
  field: Extract<FilterField, { kind: 'source' }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [item, setItem] = useState<Choice | null>(null);
  useEffect(() => {
    if (!value || item?.value === value) return;
    const controller = new AbortController();
    void loadChoiceLabels(field.source, [value], controller.signal)
      .then(([choice]) => { if (!controller.signal.aborted && choice) setItem(choice); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [field.source, value, item?.value]);
  return (
    <div className="field list-control">
      <label htmlFor={'filter-' + field.param}>{field.label}</label>
      <SearchSelect id={'filter-' + field.param} label={field.label} clearable
        placeholder={'Semua ' + field.label.toLocaleLowerCase('id')}
        selected={value ? item?.value === value ? item : { value, label: field.label + ' ' + value } : null}
        lookup={(term, signal) => searchChoices(field.source, term, signal)}
        onPick={(choice) => { setItem(choice); onChange(choice?.value ?? ''); }} />
    </div>
  );
}

export default function ListFilter({ field, value, onChange }: {
  field: FilterField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [year, setYear] = useState(value);
  useEffect(() => { setYear(value); }, [value]);
  if (field.kind === 'source') return <SourceFilter field={field} value={value} onChange={onChange} />;
  return (
    <label className="field list-control">
      <span>{field.label}</span>
      {field.kind === 'year' ? (
        <input type="text" inputMode="numeric" maxLength={4} placeholder="Semua tahun" value={year}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, 4);
            setYear(next);
            if (!next || validFilter(field, next)) onChange(next);
          }} />
      ) : (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Semua</option>
          {Object.entries(field.options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      )}
    </label>
  );
}
