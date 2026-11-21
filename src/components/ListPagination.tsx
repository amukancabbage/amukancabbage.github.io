import { useSearchParams } from 'react-router-dom';
import { readPage } from '../lib/pagination';

export default function ListPagination({ total, pageSize, unit = 'dokumen' }: { total: number; pageSize: number; unit?: string }) {
  const [params, setParams] = useSearchParams();
  const page = readPage(params);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function go(next: number) {
    setParams((current) => {
      const value = new URLSearchParams(current);
      if (next > 1) value.set('page', String(next));
      else value.delete('page');
      return value;
    });
  }

  return (
    <nav className="pagination" aria-label="Paginasi">
      <span>{total} {unit}</span>
      {pages > 1 && (
        <div className="pagination-buttons">
          <button type="button" className="secondary" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => go(page - 1)}>‹</button>
          <span className="page-info">{page} / {pages}</span>
          <button type="button" className="secondary" aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => go(page + 1)}>›</button>
        </div>
      )}
    </nav>
  );
}
