import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, useProfile } from '../auth';
import { menuFor } from '../menu';

const roleLabel = { admin: 'Admin', dosen: 'Dosen', pemantau: 'Pemantau' };

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const profile = useProfile();

  return (
    <div className="layout">
      <header className="topbar">
        <button className="menu-toggle" aria-label="Buka menu" onClick={() => setOpen(true)}>
          ☰
        </button>
        <strong>SISIDOS</strong>
      </header>

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">SISIDOS</div>
        <nav>
          {menuFor(profile.role).map((group) => (
            <div key={group.title} className="menu-group">
              <div className="menu-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="user-box">
          <div className="user-name">{profile.dosen?.nama ?? profile.email}</div>
          <div className="user-role">{roleLabel[profile.role]}</div>
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
