import type { ReactNode } from 'react';

export type ListColumn<T> = {
  label: string;
  render: (row: T) => ReactNode;
  visibility?: 'summary' | 'desktop' | 'detail';
};

function RowValues<T>({ row, columns }: { row: T; columns: ListColumn<T>[] }) {
  return <dl className="row-values">
    {columns.map((column) => <div key={column.label}><dt>{column.label}</dt><dd>{column.render(row)}</dd></div>)}
  </dl>;
}

function RowDetails<T>({ row, columns, actions }: { row: T; columns: ListColumn<T>[]; actions?: ReactNode }) {
  if (!columns.length && !actions) return null;
  return (
    <details className="row-details">
      <summary>Rincian</summary>
      {columns.length > 0 && <RowValues row={row} columns={columns} />}
      {actions && <div className="actions">{actions}</div>}
    </details>
  );
}

export default function ResponsiveList<T extends { id: string | number }>({ rows, columns, caption, actions, detailActions, select }: {
  rows: T[];
  columns: ListColumn<T>[];
  caption: string;
  actions?: (row: T) => ReactNode;
  detailActions?: (row: T) => ReactNode;
  select?: (row: T) => ReactNode;
}) {
  const [primary, ...secondary] = columns;
  if (!rows.length || !primary) return null;
  const desktop = secondary.filter((column) => column.visibility !== 'detail');
  const desktopDetails = secondary.filter((column) => column.visibility === 'detail');
  const mobile = secondary.filter((column) => !column.visibility || column.visibility === 'summary');
  const mobileDetails = secondary.filter((column) => column.visibility === 'desktop' || column.visibility === 'detail');

  return (
    <>
      <div className="card table-wrap desktop-list responsive-table">
        <table aria-label={caption}>
          <thead>
            <tr>
              {select && <th className="list-check" scope="col" aria-label="Pilihan" />}
              <th className="list-primary" scope="col">{primary.label}</th>
              {desktop.map((column) => <th key={column.label} scope="col">{column.label}</th>)}
              {actions && <th className="list-actions" scope="col">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {select && <td className="list-check">{select(row)}</td>}
                <td>
                  <div className="list-title">{primary.render(row)}</div>
                  <RowDetails row={row} columns={desktopDetails} actions={detailActions?.(row)} />
                </td>
                {desktop.map((column) => <td key={column.label}>{column.render(row)}</td>)}
                {actions && <td className="actions">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-list">
        {rows.map((row) => {
          const rowActions = actions?.(row);
          return (
            <article className="card row-summary" key={row.id}>
              <div className="row-summary-head">
                {select?.(row)}
                <h2>{primary.render(row)}</h2>
              </div>
              {mobile.length > 0 && <RowValues row={row} columns={mobile} />}
              {rowActions && <div className="actions">{rowActions}</div>}
              <RowDetails row={row} columns={mobileDetails} actions={detailActions?.(row)} />
            </article>
          );
        })}
      </div>
    </>
  );
}
