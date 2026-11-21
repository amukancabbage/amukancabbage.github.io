import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';

export default function ListPagination({ page, size, total, pages, sizes, pending, failed, onPage, onSize }: {
  page: number;
  size: number;
  total: number;
  pages: number;
  sizes: number[];
  pending?: boolean;
  failed?: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const [jump, setJump] = useState(String(page));
  useEffect(() => { setJump(String(page)); }, [page]);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  const blocked = pending || failed;
  const go = (next: number) => {
    if (!blocked && next >= 1 && next <= pages && next !== page) onPage(next);
  };
  const format = (value: number) => value.toLocaleString('id-ID');

  return (
    <nav className="pagination list-pagination" aria-label="Paginasi" aria-busy={pending}>
      <div className="page-size-control">
        <label htmlFor="list-page-size">Baris per halaman</label>
        <select id="list-page-size" value={size} onChange={(event) => onSize(Number(event.target.value))}>
          {sizes.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <span className="pagination-range" aria-live="polite" aria-atomic="true">
        {blocked ? '' : total
          ? `Menampilkan ${format((page - 1) * size + 1)} sampai ${format(Math.min(page * size, total))} dari ${format(total)}`
          : '0 hasil'}
      </span>
      {pages > 1 && (
        <>
          <div className="pagination-buttons">
            <button type="button" className="secondary page-wide" aria-label="Halaman pertama"
              aria-disabled={blocked || page <= 1} onClick={() => go(1)}><AppIcon icon={ChevronsLeft} /></button>
            <button type="button" className="secondary" aria-label="Halaman sebelumnya"
              aria-disabled={blocked || page <= 1} onClick={() => go(page - 1)}><AppIcon icon={ChevronLeft} /></button>
            <span className="page-compact">Halaman {page} dari {pages}</span>
            {numbers.map((number) => (
              <button type="button" className={'page-wide' + (page === number ? '' : ' secondary')} key={number}
                aria-label={'Halaman ' + number} aria-current={page === number ? 'page' : undefined}
                aria-disabled={blocked || page === number} onClick={() => go(number)}>{number}</button>
            ))}
            <button type="button" className="secondary" aria-label="Halaman berikutnya"
              aria-disabled={blocked || page >= pages} onClick={() => go(page + 1)}><AppIcon icon={ChevronRight} /></button>
            <button type="button" className="secondary page-wide" aria-label="Halaman terakhir"
              aria-disabled={blocked || page >= pages} onClick={() => go(pages)}><AppIcon icon={ChevronsRight} /></button>
          </div>
          <form className="page-jump page-compact" onSubmit={(event) => { event.preventDefault(); go(Number(jump)); }}>
            <label htmlFor="list-page-jump">Ke halaman</label>
            <input id="list-page-jump" type="number" inputMode="numeric" min={1} max={pages} step={1}
              value={jump} onChange={(event) => setJump(event.target.value)} required />
            <button type="submit" className="secondary" aria-disabled={blocked}>Buka</button>
          </form>
        </>
      )}
    </nav>
  );
}
