import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

import SmartImage from './SmartImage.jsx';

/**
 * The cinematic homepage hero.
 *
 * Three fallbacks stack, quietly:
 *   1. the video plays,
 *   2. the poster shows if the video is missing, slow to arrive, or the
 *      connection is metered / save-data is on,
 *   3. a tonal panel shows if the poster is missing too.
 *
 * With `prefers-reduced-motion` the video is never even requested — that
 * setting exists for people who get motion sick, and downloading 8MB to then
 * hold it still would be the wrong reading of it.
 */
export default function Hero({ videoSrc, posterSrc, children }) {
  const reducedMotion = useReducedMotion();
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const containerRef = useRef(null);

  const [allowVideo, setAllowVideo] = useState(false);

  useEffect(() => {
    if (reducedMotion || !videoSrc) return;

    // Respect Save-Data and slow connections where the browser reports them.
    const connection = navigator.connection;
    const saveData = connection?.saveData === true;
    const slow = /2g/.test(connection?.effectiveType ?? '');
    // Phones get the poster: autoplay is unreliable and the data cost is real.
    const smallScreen = window.matchMedia('(max-width: 767px)').matches;

    if (saveData || slow || smallScreen) return;
    setAllowVideo(true);
  }, [reducedMotion, videoSrc]);

  // A very slow parallax drift on the hero as you scroll away from it.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', reducedMotion ? '0%' : '14%']);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [1, reducedMotion ? 1 : 1.35]);

  const showVideo = allowVideo && !videoFailed;

  return (
    <section
      ref={containerRef}
      className="relative flex h-[100svh] min-h-[600px] items-end overflow-hidden bg-moss-900"
    >
      <motion.div style={{ y }} className="absolute inset-0 h-[116%]">
        {/* Poster layer — always present, gently drifting in scale. */}
        <SmartImage
          src={posterSrc}
          alt="The Little Blooming Farm at golden hour"
          priority
          showMark={false}
          className={`absolute inset-0 h-full w-full transition-opacity duration-[2000ms] ease-gentle ${
            showVideo && videoReady ? 'opacity-0' : 'opacity-100'
          }`}
          imgClassName={reducedMotion ? '' : 'animate-slow-zoom'}
        />

        {showVideo && (
          <video
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[2000ms] ease-gentle ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          />
        )}
      </motion.div>

      {/* Warm scrim: dark enough for legible type, light enough to keep the light. */}
      <motion.div
        style={{ opacity: overlayOpacity }}
        className="absolute inset-0 bg-gradient-to-b from-moss-900/45 via-moss-900/20 to-moss-900/85"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-moss-900/45 via-transparent to-transparent" />

      <div className="relative w-full">{children}</div>
    </section>
  );
}
