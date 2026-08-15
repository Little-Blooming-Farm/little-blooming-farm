import { useReducedMotion } from 'framer-motion';

/**
 * The house easing curve: a fast-ish start that decelerates for a long time.
 * Everything on this site uses it, which is most of why the site feels calm.
 */
export const EASE = [0.22, 1, 0.36, 1];

export const DURATION = {
  quick: 0.5,
  base: 0.9,
  slow: 1.3,
  cinematic: 1.9,
};

/**
 * Every animated component reads its variants from here, so honouring
 * `prefers-reduced-motion` is a single branch rather than a per-component
 * decision that somebody eventually forgets to make.
 */
export function useMotionSettings() {
  const reduced = useReducedMotion();

  if (reduced) {
    return {
      reduced: true,
      fadeUp: {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0, transition: { duration: 0 } },
      },
      fade: {
        hidden: { opacity: 1 },
        visible: { opacity: 1, transition: { duration: 0 } },
      },
      stagger: { hidden: {}, visible: { transition: { staggerChildren: 0 } } },
      viewport: { once: true, amount: 0 },
      pageTransition: {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      },
    };
  }

  return {
    reduced: false,
    fadeUp: {
      hidden: { opacity: 0, y: 28 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.slow, ease: EASE },
      },
    },
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE } },
    },
    stagger: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
    },
    // `once: true` so a section never re-animates when scrolled back past —
    // repeated reveals read as nervous.
    viewport: { once: true, amount: 0.25, margin: '0px 0px -12% 0px' },
    pageTransition: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: DURATION.quick, ease: EASE },
    },
  };
}

/** Slow staggered entrance for the hero — the first thing anyone sees. */
export function useHeroSettings() {
  const reduced = useReducedMotion();

  if (reduced) {
    return {
      reduced: true,
      container: { hidden: {}, visible: {} },
      item: { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } },
    };
  }

  return {
    reduced: false,
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.34, delayChildren: 0.5 } },
    },
    item: {
      hidden: { opacity: 0, y: 34 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.cinematic, ease: EASE },
      },
    },
  };
}
