import type { KeyboardEvent } from 'react';

export default function Tabs<T extends string>({ id, label, tabs, value, onChange }: {
  id: string;
  label: string;
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + direction + tabs.length) % tabs.length;
    const key = tabs[next].key;
    onChange(key);
    document.getElementById(id + '-tab-' + key)?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          type="button"
          key={tab.key}
          id={id + '-tab-' + tab.key}
          role="tab"
          aria-selected={value === tab.key}
          aria-controls={id + '-panel-' + tab.key}
          tabIndex={value === tab.key ? 0 : -1}
          className={value === tab.key ? '' : 'secondary'}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => move(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
