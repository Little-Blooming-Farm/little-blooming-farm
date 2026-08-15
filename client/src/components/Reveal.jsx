import { motion } from 'framer-motion';
import { useMotionSettings } from '../lib/motion.js';

/**
 * The site-wide scroll reveal: a slow fade-up that fires once.
 * Every content section uses this rather than hand-rolling `whileInView`, so
 * the reduced-motion branch is guaranteed to be applied everywhere.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  as = 'div',
  amount,
}) {
  const { fadeUp, viewport } = useMotionSettings();
  const Component = motion[as] ?? motion.div;

  return (
    <Component
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={amount != null ? { ...viewport, amount } : viewport}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </Component>
  );
}

/** Parent that staggers its `RevealItem` children as the group enters view. */
export function RevealGroup({ children, className = '', as = 'div', amount }) {
  const { stagger, viewport } = useMotionSettings();
  const Component = motion[as] ?? motion.div;

  return (
    <Component
      className={className}
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={amount != null ? { ...viewport, amount } : viewport}
    >
      {children}
    </Component>
  );
}

export function RevealItem({ children, className = '', as = 'div' }) {
  const { fadeUp } = useMotionSettings();
  const Component = motion[as] ?? motion.div;

  return (
    <Component className={className} variants={fadeUp}>
      {children}
    </Component>
  );
}
