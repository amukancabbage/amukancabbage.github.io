import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../public.css';

export default function PublicShell({ title, action, children }: {
  title: string;
  action: { to: string; label: string };
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="public-shell tw:flex tw:min-h-svh tw:flex-col">
      <header className="public-header">
        <div className="public-container tw:flex tw:min-h-[4.25rem] tw:items-center tw:justify-between tw:gap-3">
          <span className="public-brand tw:inline-flex tw:items-center tw:gap-2.5">
            <img src={import.meta.env.BASE_URL + 'favicon.svg'} width={32} height={32} alt="" />
            SISIDOS
          </span>
          <nav aria-label="Navigasi publik">
            <Link to={action.to} className="public-nav-link tw:inline-flex tw:min-h-11 tw:items-center">
              {action.label}
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
