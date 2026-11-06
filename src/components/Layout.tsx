import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, useProfile } from '../auth';
import { useUnreadCount } from '../haki/notifications';
import { sidebarFor } from '../menu';
import { roleLabel } from '../types';
import NotificationBell from './haki/NotificationBell';

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const profile = useProfile();
  const unread = useUnreadCount();

  return (
    <div className="layout">
      <header className="topbar">
        <button className="menu-toggle" aria-label="Buka menu" onClick={() => setOpen(true)}>
          ☰
        </button>
        <strong>SISIDOS</strong>
        <NotificationBell count={unread} />
      </header>

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          SISIDOS
          <NotificationBell count={unread} />
        </div>
        <nav>
          {sidebarFor(profile.role).map((group) => (
            <div key={group.title} className="menu-group">
              <div className="menu-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink key={item.path} to={item.path} end onClick={() => setOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="user-box">
          <div className="user-name">{profile.dosen?.nama ?? profile.email}</div>
          <div className="user-role">
            {roleLabel[profile.role]}
            {profile.unit?.nama ? ` · ${profile.unit.nama}` : ''}
          </div>
          <button className="secondary" onClick={signOut}>
            Keluar
          </button>
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <main className="content">{children}</main>
    </div>
  );
}
