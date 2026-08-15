import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAdminAuth } from './AdminAuth.jsx';
import { Button } from './components.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/calendar', label: 'Calendar & blocks' },
  { to: '/admin/properties', label: 'Properties' },
  { to: '/admin/content', label: 'Content pages' },
  { to: '/admin/animals', label: 'Animal profiles' },
  { to: '/admin/media', label: 'Gallery & media' },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bloom-100">
      <header className="border-b border-bloom-300 bg-bloom-50">
        <div className="mx-auto flex max-w-[110rem] items-center justify-between gap-6 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-5">
            <Link to="/admin" className="font-display text-xl text-moss-800">
              The Little Blooming Farm
            </Link>
            <span className="hidden font-sans text-[10px] uppercase tracking-label text-ink-faint sm:block">
              Owner
            </span>
          </div>

          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="hidden font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted hover:text-ink sm:block"
            >
              View site
            </Link>
            <span className="hidden font-sans text-[13px] font-light text-ink-muted lg:block">
              {admin?.email}
            </span>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted lg:hidden"
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[110rem] gap-10 px-6 py-9 lg:px-10">
        <nav
          className={`${menuOpen ? 'block' : 'hidden'} w-full shrink-0 lg:block lg:w-56`}
        >
          <ul className="space-y-1 lg:sticky lg:top-9">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block border-l-2 py-2.5 pl-4 font-sans text-[14px] font-light transition-colors duration-300 ${
                      isActive
                        ? 'border-moss-600 bg-bloom-50 text-moss-800'
                        : 'border-transparent text-ink-soft hover:border-bloom-300 hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className={`${menuOpen ? 'hidden' : 'block'} min-w-0 flex-1 lg:block`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
