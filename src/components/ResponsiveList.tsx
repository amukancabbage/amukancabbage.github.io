import { rowPaginationFeature, rowSortingFeature, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo, type ReactNode } from 'react';
import type { ListParams } from '../lib/pagination';
import ListPagination from './ListPagination';

export type ListColumn<T> = {
  id?: string;
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

const features = tableFeatures({ rowPaginationFeature, rowSortingFeature });

export default function ResponsiveList<T extends { id: string | number }>({
  rows, columns, caption, actions, detailActions, select, list, total, order, pending, failed,
}: {
  rows: T[];
  columns: ListColumn<T>[];
  caption: string;
  actions?: (row: T) => ReactNode;
  detailActions?: (row: T) => ReactNode;
  select?: (row: T) => ReactNode;
  list: ListParams;
  total: number;
  order?: { column: string; ascending?: boolean };
  pending?: boolean;
  failed?: boolean;
}) {
  const pagination = useMemo(() => ({ pageIndex: list.page - 1, pageSize: list.pageSize }), [list.page, list.pageSize]);
  const sorting = useMemo(() => order ? [{ id: order.column, desc: order.ascending === false }] : [], [order?.column, order?.ascending]);
  const definitions = useMemo(() => columns.map((column) => ({ id: column.id ?? column.label, header: column.label })), [columns]);
  const table = useTable({
    features, data: rows, columns: definitions, getRowId: (row) => String(row.id),
    manualPagination: true, rowCount: total, manualSorting: true,
    state: { pagination, sorting },
    onPaginationChange: (change) => {
      const next = typeof change === 'function' ? change(pagination) : change;
      if (next.pageSize !== pagination.pageSize) list.setSize(next.pageSize);
      else list.setPage(next.pageIndex + 1);
    },
  }, (state) => state.pagination);
  const visibleRows = table.getRowModel().rows;
  const [primary, ...secondary] = columns;
  const desktop = secondary.filter((column) => column.visibility !== 'detail');
  const desktopDetails = secondary.filter((column) => column.visibility === 'detail');
  const mobile = secondary.filter((column) => !column.visibility || column.visibility === 'summary');
  const mobileDetails = secondary.filter((column) => column.visibility === 'desktop' || column.visibility === 'detail');

  function sortFor(column: ListColumn<T>) {
    const sort = table.getColumn(column.id ?? column.label)?.getIsSorted();
    return sort ? sort === 'asc' ? 'ascending' : 'descending' : undefined;
  }

  return (
    <>
      {!pending && !failed && visibleRows.length > 0 && primary && <>
      <div className="card table-wrap desktop-list responsive-table">
        <table aria-label={caption}>
          <thead>
            <tr>
              {select && <th className="list-check" scope="col" aria-label="Pilihan" />}
              <th className="list-primary" scope="col" aria-sort={sortFor(primary)}>{primary.label}</th>
              {desktop.map((column) => <th key={column.label} scope="col" aria-sort={sortFor(column)}>{column.label}</th>)}
              {actions && <th className="list-actions" scope="col">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ original: row, id }) => (
              <tr key={id}>
                {select && <td className="list-check">{select(row)}</td>}
                <td>
                  <div className="list-cell tw:flex tw:flex-wrap tw:items-center tw:gap-x-3">
                    <div className="list-title tw:min-w-0 tw:flex-1">{primary.render(row)}</div>
                    <RowDetails row={row} columns={desktopDetails} actions={detailActions?.(row)} />
                  </div>
                </td>
                {desktop.map((column) => <td key={column.label}>{column.render(row)}</td>)}
                {actions && <td className="actions">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-list tw:gap-2.5">
        {visibleRows.map(({ original: row, id }) => {
          const rowActions = actions?.(row);
          return (
            <article className="card row-summary" key={id}>
              <div className="row-summary-head tw:flex tw:items-center tw:gap-2">
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
      </>}
      <ListPagination page={list.page} size={list.pageSize} sizes={list.choices} total={total}
        pages={Math.max(1, table.getPageCount())} pending={pending} failed={failed}
        onPage={(page) => table.setPageIndex(page - 1)} onSize={(size) => table.setPageSize(size)} />
    </>
  );
}
