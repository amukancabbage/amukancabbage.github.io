import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import type { Choice } from '../lib/search';
import AppIcon from './AppIcon';

export default function SearchSelect({
  id, label, selected = null, items = [], lookup, omit = [], onPick, disabled,
  required, clearable, describedBy, placeholder, autoFocus,
}: {
  id?: string;
  label: string;
  selected?: Choice | null;
  items?: readonly Choice[];
  lookup?: (term: string, signal: AbortSignal) => Promise<Choice[]>;
  omit?: readonly string[];
  onPick: (item: Choice | null) => void;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  describedBy?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const generatedId = useId();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ term: string; attempt: number; items: Choice[]; failed?: boolean } | null>(null);
  const term = query.trim();
  const remote = lookup != null;
  const search = useEffectEvent((value: string, signal: AbortSignal) => lookup!(value, signal));

  useEffect(() => {
    if (!remote || disabled || term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void search(term, controller.signal).then((items) => {
        if (!controller.signal.aborted) setResult({ term, attempt, items });
      }, () => {
        if (!controller.signal.aborted) setResult({ term, attempt, items: [], failed: true });
      });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, attempt, remote, disabled]);

  const current = result?.term === term && result.attempt === attempt ? result : null;
  const matches = remote ? (current?.items ?? []) : items.filter((item) =>
    [item.label, item.detail].some((text) => text?.toLocaleLowerCase('id').includes(term.toLocaleLowerCase('id'))));
  const choices = matches.filter((item) => !omit.includes(item.value));
  const failed = result?.failed && (!term || (current === result));
  const message = remote && term.length < 2 ? 'Ketik minimal dua karakter.'
    : remote && !current ? 'Mencari pilihan…'
    : !choices.length && !current?.failed ? 'Tidak ada pilihan yang cocok.' : '';

  function closeSearch() {
    setQuery('');
    setResult((previous) => previous?.failed ? previous : null);
  }

  function retry() {
    if (!result) return;
    requestAnimationFrame(() => {
      if (!input.current) return;
      // Klik di luar daftar dapat menutup combobox sebelum tombol Coba lagi diproses.
      if (input.current.getAttribute('aria-expanded') !== 'true') trigger.current?.click();
      input.current.focus();
      input.current.value = result.term;
      setQuery(result.term);
      setAttempt((value) => value + 1);
    });
  }

  return (
    <div className="lookup">
      <Combobox value={selected} by="value" disabled={disabled} immediate
        onClose={closeSearch} onChange={(item) => { if (item) onPick(item); setQuery(''); }}>
        {({ open }) => <>
          <div className="lookup-controls">
            <ComboboxInput ref={input} id={id ?? generatedId} aria-label={label} aria-describedby={describedBy}
              aria-required={required} autoFocus={autoFocus} autoComplete="off"
              placeholder={placeholder ?? 'Cari pilihan'} displayValue={(item: Choice | null) => item?.label ?? ''}
              onKeyDownCapture={(event) => {
                // Biarkan Tab memindahkan fokus tanpa memilih opsi yang disorot.
                if (open && event.key === 'Tab') event.stopPropagation();
              }}
              onChange={(event) => {
                const next = event.target.value;
                if (next.trim() !== term) setResult(null);
                setQuery(next);
              }} />
            {clearable && selected && (
              <button type="button" className="secondary lookup-icon" aria-label={'Kosongkan ' + label}
                disabled={disabled} onClick={() => { setQuery(''); setResult(null); onPick(null); input.current?.focus(); }}>
                <AppIcon icon={X} />
              </button>
            )}
            <ComboboxButton ref={trigger} type="button" className="secondary lookup-icon" aria-label={'Tampilkan pilihan ' + label}>
              <AppIcon icon={ChevronDown} />
            </ComboboxButton>
          </div>
          {choices.length > 0 && (
            <ComboboxOptions modal={false} portal={false} className="lookup-options">
              {choices.map((item) => (
                <ComboboxOption key={item.value} value={item} className="lookup-option">
                  {({ selected }) => (
                    <>
                      <span>{item.label}{item.detail && <small>{item.detail}</small>}</span>
                      {selected && <AppIcon icon={Check} />}
                    </>
                  )}
                </ComboboxOption>
              ))}
            </ComboboxOptions>
          )}
          {open && message && <p className="lookup-message muted" role="status">{message}</p>}
        </>}
      </Combobox>
      {failed && (
        <div className="lookup-error" role="alert">
          <span>Pilihan gagal dimuat.</span>
          <button type="button" className="secondary" disabled={disabled}
            onMouseDown={(event) => event.preventDefault()} onClick={retry}>Coba lagi</button>
        </div>
      )}
    </div>
  );
}
