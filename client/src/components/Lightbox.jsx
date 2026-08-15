import { useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { EASE } from '../lib/motion.js';
import SmartImage from './SmartImage.jsx';

/**
 * Full-screen viewer. Opens with a scale+fade, closes the same way, and is
 * driveable entirely from the keyboard (←/→ to move, Esc to close).
 */
export default function Lightbox({ items, index, onClose, onNavigate }) {
  const open = index != null && index >= 0 && index < items.length;
  const item = open ? items[index] : null;

  const next = useCallback(() => {
    if (!open) return;
    onNavigate((index + 1) % items.length);
  }, [index, items.length, onNavigate, open]);

  const previous = useCallback(() => {
    if (!open) return;
    onNavigate((index - 1 + items.length) % items.length);
  }, [index, items.length, onNavigate, open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') previous();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, next, previous]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-moss-900/95 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label={item.alt || 'Photograph'}
        >
          <div className="flex items-center justify-between px-6 py-5 text-bloom-100 lg:px-10">
            <span className="font-sans text-[11px] uppercase tracking-eyebrow text-bloom-200/60">
              {index + 1} / {items.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-sans text-[11px] uppercase tracking-eyebrow text-bloom-100 hover:text-bloom-50"
            >
              Close
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6 lg:px-16">
            <button
              type="button"
              onClick={previous}
              aria-label="Previous photograph"
              className="absolute left-2 z-10 flex h-14 w-14 items-center justify-center text-bloom-100/60 transition-colors duration-500 hover:text-bloom-50 lg:left-6"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={item.id ?? item.url ?? index}
                className="flex h-full max-h-full w-full max-w-6xl items-center justify-center"
                initial={{ opacity: 0, scale: 0.965 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    className="max-h-full max-w-full object-contain"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <SmartImage
                    src={item.url}
                    alt={item.alt ?? ''}
                    className="h-full w-full bg-transparent"
                    imgClassName="!object-contain"
                    showMark={false}
                    priority
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <button
              type="button"
              onClick={next}
              aria-label="Next photograph"
              className="absolute right-2 z-10 flex h-14 w-14 items-center justify-center text-bloom-100/60 transition-colors duration-500 hover:text-bloom-50 lg:right-6"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {(item.caption || item.alt) && (
            <p className="px-6 pb-8 text-center font-sans text-[13px] font-light text-bloom-200/70 lg:px-10">
              {item.caption || item.alt}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
