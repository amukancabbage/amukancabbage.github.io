import type { ReactNode } from 'react';

export type ListColumn<T> = { label: string; render: (row: T) => ReactNode };

export default function ResponsiveList<T extends { id: string | number }>({ rows, columns, caption, actions, select, selectAll }: {
  rows: T[];
  columns: ListColumn<T>[];
  caption: string;
  actions?: (row: T) => ReactNode;
  select?: (row: T) => ReactNode;
  selectAll?: ReactNode;
}) {
  const [primary, ...details] = columns;
  if (!rows.length || !primary) return null;
  return (
    <>
      <div className="card table-wrap desktop-list">
        <table aria-label={caption}>
          <thead>
            <tr>
              {select && <th scope="col">{selectAll}</th>}
              {columns.map((column) => <th key={column.label} scope="col">{column.label}</th>)}
              {actions && <th scope="col">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {select && <td>{select(row)}</td>}
                {columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}
                {actions && <td className="actions">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-list">
        {rows.map((row) => (
          <article className="card row-summary" key={row.id}>
            <div className="row-summary-head">
              {select?.(row)}
              <h2>{primary.render(row)}</h2>
            </div>
            {!!details.length && (
              <dl>
                {details.map((column) => <div key={column.label}><dt>{column.label}</dt><dd>{column.render(row)}</dd></div>)}
              </dl>
            )}
            {actions && <div className="actions">{actions(row)}</div>}
          </article>
        ))}
      </div>
    </>
  );
}
