import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import Nav from './Nav.jsx';
import Footer from './Footer.jsx';
import { useMotionSettings } from '../lib/motion.js';

/** Restores the top of the page on navigation, but leaves in-page anchors alone. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return null;
}

export default function Layout() {
  const { pageTransition } = useMotionSettings();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-bloom-100">
      <ScrollToTop />
      <Nav />

      {/*
        Route changes cross-fade rather than cutting. The key is the pathname,
        so the fade runs on navigation but not on in-page state changes.
      */}
      <motion.main
        id="main"
        key={location.pathname}
        className="flex-1"
        initial={pageTransition.initial}
        animate={pageTransition.animate}
        transition={pageTransition.transition}
      >
        <Outlet />
      </motion.main>

      <Footer />
    </div>
  );
}
