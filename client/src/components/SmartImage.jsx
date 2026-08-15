import { useMemo, useState } from 'react';

/**
 * An image that degrades into something deliberate.
 *
 * The site ships before the photography does, and a grid of broken-image icons
 * would misrepresent the design badly. When a source is missing or fails to
 * load, this renders a tonal panel drawn from the brand palette instead —
 * deterministic per image, so the page looks composed rather than random, and
 * the same picture always gets the same tone.
 *
 * Replace nothing when the real photos arrive: they simply load.
 */

const PAIRS = [
  ['#2A3628', '#4A5D4A'],
  ['#4A5D4A', '#778D68'],
  ['#374733', '#9AAE8C'],
  ['#8B6A4F', '#C4A88C'],
  ['#6E523C', '#A98668'],
  ['#B08D3E', '#E4D6BE'],
  ['#5C7150', '#BFCCB4'],
];

function hash(value) {
  let h = 2166136261;
  const str = String(value ?? '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function Placeholder({ seed, className = '', showMark = true }) {
  const { from, to, angle, markX, markY } = useMemo(() => {
    const h = hash(seed);
    const [a, b] = PAIRS[h % PAIRS.length];
    return {
      from: a,
      to: b,
      angle: 120 + (h % 7) * 12,
      markX: 30 + (h % 40),
      markY: 30 + ((h >> 3) % 40),
    };
  }, [seed]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ background: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)` }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(60% 55% at ${markX}% ${markY}%, rgba(253,251,247,0.22) 0%, rgba(253,251,247,0) 70%)`,
        }}
      />
      <div className="paper-grain absolute inset-0 opacity-70" />
      {showMark && (
        <svg
          viewBox="0 0 40 40"
          className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-[0.18]"
          fill="none"
          stroke="#FDFBF7"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <path d="M20 34V16" />
          <path d="M20 18c0-5 3.4-8.6 7.8-8.6C27.8 14.4 24.4 18 20 18Z" />
          <path d="M20 24c0-5-3.4-8.6-7.8-8.6C12.2 20.4 15.6 24 20 24Z" />
        </svg>
      )}
    </div>
  );
}

export default function SmartImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  ratio,
  priority = false,
  showMark = true,
  children,
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const useFallback = !src || failed;

  return (
    <div
      className={`relative overflow-hidden bg-moss-800 ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {/* The panel sits underneath always, so a slow load fades in over tone
          rather than over a flash of empty background. */}
      <Placeholder seed={alt || src || 'lbf'} showMark={showMark && useFallback} />

      {!useFallback && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // Lowercase on purpose: React 18 does not map the camelCase form and
          // warns about it. As a plain attribute it still reaches the browser.
          fetchpriority={priority ? 'high' : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-gentle ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      )}

      {children}
    </div>
  );
}
