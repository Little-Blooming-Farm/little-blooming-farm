import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '../lib/motion.js';

const LINKS = [
  { to: '/stay', label: 'Stay' },
  { to: '/experiences', label: 'Experiences' },
  { to: '/the-land', label: 'The Land' },
  { to: '/animals', label: 'The Animals' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/local-guide', label: 'Local Guide' },
  { to: '/garden-of-erin', label: 'Garden of Erin' },
];

export default function Nav() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // The homepage nav starts transparent over the video and only gains a
  // background once you have scrolled past the hero.
  const overHero = location.pathname === '/' && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-moss-800 focus:px-4 focus:py-2 focus:text-bloom-50"
      >
        Skip to content
      </a>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-1000 ease-gentle ${
          overHero
            ? 'bg-transparent text-bloom-50'
            : 'border-b border-bloom-300/60 bg-bloom-100/90 text-ink backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex max-w-editorial items-center justify-between px-6 py-5 lg:px-12">
          <Link
            to="/"
            className="font-display text-xl leading-none tracking-wide lg:text-2xl"
            style={{ color: 'inherit' }}
          >
            The Little Blooming Farm
          </Link>

          <nav className="hidden items-center gap-8 xl:flex">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `link-underline font-sans text-[11px] uppercase tracking-eyebrow transition-opacity duration-500 ease-gentle ${
                    isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              to="/book"
              className={`btn-quiet ${overHero ? 'on-dark' : ''} !px-6 !py-2.5`}
            >
              <span>Book</span>
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-3 font-sans text-[11px] uppercase tracking-eyebrow xl:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            Menu
            <span className="flex h-3 w-5 flex-col justify-between">
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
            </span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[55] bg-moss-900 text-bloom-100 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="flex h-full flex-col px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl">The Little Blooming Farm</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="font-sans text-[11px] uppercase tracking-eyebrow"
                  aria-label="Close menu"
                >
                  Close
                </button>
              </div>

              <nav className="flex flex-1 flex-col justify-center gap-1">
                {LINKS.map((link, index) => (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + index * 0.05, duration: 0.8, ease: EASE }}
                  >
                    <Link
                      to={link.to}
                      className="block py-2 font-display text-4xl text-bloom-100 sm:text-5xl"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
                  className="mt-8"
                >
                  <Link to="/book" className="btn-quiet on-dark">
                    <span>Book your stay</span>
                  </Link>
                </motion.div>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
