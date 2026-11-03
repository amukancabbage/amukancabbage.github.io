import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { menu } from '../menu';

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="layout">
      <header className="topbar">
        <button className="menu-toggle" aria-label="Buka menu" onClick={() => setOpen(true)}>
          ☰
        </button>
        <strong>Sistem Akademik</strong>
      </header>

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">Sistem Akademik</div>
        <nav>
          {menu.map((group) => (
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
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <main className="content">{children}</main>
    </div>
  );
}
