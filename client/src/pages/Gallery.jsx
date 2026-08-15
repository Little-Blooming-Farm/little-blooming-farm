import { useState } from 'react';
import { motion } from 'framer-motion';

import { getGallery } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import SmartImage from '../components/SmartImage.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { ErrorState, LoadingState, PageHero } from '../components/ui.jsx';
import { useMotionSettings } from '../lib/motion.js';

export default function Gallery() {
  const { data, loading, error, refresh } = useAsync(() => getGallery('gallery'), []);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const { fadeUp, viewport } = useMotionSettings();

  if (loading) return <LoadingState label="Loading the photographs" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const items = data?.media ?? [];

  return (
    <>
      <PageHero
        eyebrow="Look around"
        title="Gallery"
        subtitle="Photographs from across the year, and one drone that got slightly carried away."
        image={items[0]?.url ?? '/media/gallery/hero.jpg'}
        height="short"
      />

      <section className="bg-bloom-100">
        <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
          {items.length === 0 ? (
            <p className="prose-farm mx-auto text-center">
              The photographs are being chosen. Come back shortly.
            </p>
          ) : (
            /*
             * CSS columns give a true masonry flow without a layout library and
             * without JavaScript measuring anything — images keep their own
             * aspect ratios and the column count adapts at each breakpoint.
             */
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 lg:gap-6">
              {items.map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group mb-4 block w-full break-inside-avoid lg:mb-6"
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ ...viewport, amount: 0.15 }}
                  aria-label={`Open ${item.alt || 'photograph'}`}
                >
                  <div className="relative overflow-hidden">
                    <SmartImage
                      src={item.thumbnailUrl || item.url}
                      alt={item.alt ?? ''}
                      ratio={index % 5 === 0 ? '3 / 4' : index % 3 === 0 ? '1 / 1' : '4 / 3'}
                      className="w-full"
                      imgClassName="transition-transform duration-[2000ms] ease-gentle group-hover:scale-[1.05]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-moss-900/0 transition-colors duration-700 ease-gentle group-hover:bg-moss-900/12" />
                    {item.type === 'video' && (
                      <span className="pointer-events-none absolute bottom-4 left-4 font-sans text-[10px] uppercase tracking-eyebrow text-bloom-50">
                        Video
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      <Lightbox
        items={items}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
