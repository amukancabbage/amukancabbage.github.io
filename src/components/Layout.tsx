import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useMatches } from 'react-router-dom';
import { useAuth, useProfile } from '../auth';
import { useUnreadCount } from '../haki/notifications';
import { sidebarFor, type MenuItem } from '../menu';
import { ThemeSelect } from '../theme';
import { roleLabel, type Role } from '../types';
import Dialog from './Dialog';
import { useDraftGuard } from './DraftGuard';
import NotificationBell from './haki/NotificationBell';

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">S</span>
      <span>SISIDOS</span>
    </span>
  );
}

const roleShortcut: Record<Role, string> = {
  dosen: '/haki/saya',
  operator: '/haki/unggah',
  validator: '/haki/antrean',
  pemantau: '/haki/arsip',
  admin: '/pengguna',
};

function SidebarNav({ section, onNavigate }: { section?: string; onNavigate?: () => void }) {
  const { role } = useProfile();
  const { pathname } = useLocation();
  const activeGroup = useRef<HTMLDetailsElement>(null);
  const groups = sidebarFor(role);
  const pinnedPaths = ['/beranda', roleShortcut[role]];
  const items = groups.flatMap((group) => group.items);

  useEffect(() => {
    if (activeGroup.current) activeGroup.current.open = true;
  }, [pathname, section]);

  function navLink(item: MenuItem) {
    return <NavLink key={item.path} to={item.path} end onClick={onNavigate}>{item.label}</NavLink>;
  }

  return (
    <nav aria-label="Navigasi utama">
      <div className="nav-pinned">
        {pinnedPaths.map((path) => items.find((item) => item.path === path)).map((item) => item && navLink(item))}
      </div>
      {groups.map((group) => {
        const children = group.items.filter((item) => !pinnedPaths.includes(item.path));
        if (!children.length) return null;
        const active = section === group.title;
        return (
          <details key={group.title} className="menu-group" ref={active ? activeGroup : undefined}>
            <summary>{group.title}</summary>
            <div className="menu-links">{children.map(navLink)}</div>
          </details>
        );
      })}
    </nav>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const main = useRef<HTMLElement>(null);
  const topbar = useRef<HTMLElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const { signOut } = useAuth();
  const { requestLeave } = useDraftGuard();
  const profile = useProfile();
  const unread = useUnreadCount();
  const { pathname } = useLocation();
  const route = useMatches().at(-1)?.handle as { title: string; section: string } | undefined;
  const title = route?.title ?? 'Beranda';
  const name = profile.dosen?.nama ?? profile.email ?? 'Akun';

  useEffect(() => { document.title = title + ' | SISIDOS'; }, [title]);
  useEffect(() => {
    const header = topbar.current!;
    const root = layout.current!;
    const size = new ResizeObserver(() => root.style.setProperty('--topbar-height', `${header.offsetHeight}px`));
    size.observe(header);
    return () => size.disconnect();
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
    if (account.current) account.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  function logout() {
    requestLeave(async () => {
      setError('');
      try { await signOut(); }
      catch { setError('Gagal keluar dari akun. Coba lagi.'); }
    });
  }

  return (
    <div className="layout" ref={layout}>
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>Lewati ke konten</a>
      <aside className="sidebar">
        <Link to="/beranda" className="brand-link" aria-label="Beranda SISIDOS"><Brand /></Link>
        <SidebarNav section={route?.section} />
      </aside>

      <header className="topbar" ref={topbar}>
        <button type="button" className="menu-toggle secondary" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="topbar-path">
          <span className="topbar-section">{route?.section ?? 'Utama'}</span>
          <strong>{title}</strong>
        </div>
        <div className="topbar-tools">
          <NotificationBell count={unread} />
          <details ref={account} className="account">
            <summary aria-label="Menu akun">
              <span className="avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
              <span className="account-role">{roleLabel[profile.role]}</span>
            </summary>
            <div className="account-panel">
              <strong className="user-name">{name}</strong>
              <p className="muted small">{roleLabel[profile.role]}{profile.unit?.nama ? ' · ' + profile.unit.nama : ''}</p>
              <ThemeSelect />
              <button type="button" className="secondary" onClick={logout}>Keluar</button>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          </details>
        </div>
      </header>

      {open && (
        <Dialog title="Navigasi SISIDOS" className="nav-dialog" onClose={() => setOpen(false)}>
          <button type="button" className="secondary drawer-close" data-initial-focus onClick={() => setOpen(false)}>Tutup menu</button>
          <SidebarNav section={route?.section} onNavigate={() => setOpen(false)} />
        </Dialog>
      )}

      <main ref={main} id="main-content" className="content" tabIndex={-1}>{children}</main>
    </div>
  );
}
