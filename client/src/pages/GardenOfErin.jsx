import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { getContentPage } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import SmartImage from '../components/SmartImage.jsx';
import Reveal from '../components/Reveal.jsx';
import { ErrorState, LoadingState, Paragraphs } from '../components/ui.jsx';
import { useHeroSettings } from '../lib/motion.js';

/**
 * This page is deliberately not built from BlockRenderer.
 *
 * It is the emotional centre of the site and it needs a quieter hand than the
 * rest: one column, more air, smaller type, no buttons competing for the eye,
 * and reveals that take a beat longer than they do anywhere else. It reads
 * content from the same editable ContentPage, but composes it slowly.
 */
export default function GardenOfErin() {
  const { data, loading, error, refresh } = useAsync(() => getContentPage('garden-of-erin'), []);
  const { container, item } = useHeroSettings();

  if (loading) return <LoadingState />;
  if (error && error.status !== 404) return <ErrorState error={error} onRetry={refresh} />;

  const page = data?.page;
  const sections = page?.sections ?? [];

  const opening = sections.find((s) => s.type === 'richText' && !s.content?.heading);
  const image = sections.find((s) => s.type === 'fullBleedImage');
  const written = sections.filter((s) => s.type === 'richText' && s.content?.heading);
  const quote = sections.find((s) => s.type === 'quote');

  return (
    <article className="bg-bloom-50">
      {/* A soft, low hero — no scrim shouting over a photograph. */}
      <header className="relative flex min-h-[58vh] items-end overflow-hidden lg:min-h-[68vh]">
        <SmartImage
          src={page?.heroImage || '/media/erin/hero.jpg'}
          alt="Erin's garden at the top of the rise"
          priority
          showMark={false}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bloom-50 via-bloom-50/35 to-transparent" />

        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="relative mx-auto w-full max-w-3xl px-6 pb-16 pt-32 text-center lg:pb-22"
        >
          <motion.p variants={item} className="eyebrow text-ink-muted">
            Why this place exists
          </motion.p>
          <motion.h1
            variants={item}
            className="mt-8 font-display text-4xl font-light leading-[1.15] text-moss-800 sm:text-5xl lg:text-6xl"
          >
            The Garden of Erin
          </motion.h1>
        </motion.div>
      </header>

      {/* Opening passage — larger than body copy, quieter than a headline. */}
      {opening && (
        <section className="mx-auto max-w-2xl px-6 pb-8 pt-16 lg:pt-22">
          <Reveal>
            <div className="space-y-7 text-center font-display text-2xl font-light leading-[1.5] text-moss-700 lg:text-[1.75rem]">
              {String(opening.content.body ?? '')
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((paragraph) => (
                  <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                ))}
            </div>
          </Reveal>
        </section>
      )}

      {image && (
        <figure className="mx-auto mt-16 max-w-5xl px-6 lg:mt-22">
          <Reveal amount={0.15}>
            <SmartImage
              src={image.content?.image?.url ?? '/media/erin/garden.jpg'}
              alt={image.content?.image?.alt ?? "Erin's garden in full spring bloom"}
              ratio="16 / 10"
              className="w-full"
              showMark={false}
            />
            {image.content?.caption && (
              <figcaption className="mt-4 text-center font-sans text-[13px] font-light text-ink-muted">
                {image.content.caption}
              </figcaption>
            )}
          </Reveal>
        </figure>
      )}

      {/* The written sections, one column, wide margins, slow reveals. */}
      <div className="mx-auto max-w-2xl px-6 py-22 lg:py-30">
        {written.map((section, index) => (
          <Reveal key={section.id} className={index > 0 ? 'mt-20 lg:mt-24' : ''} amount={0.2}>
            <div className="flex items-center gap-4">
              <span className="h-px w-8 bg-gold-300" />
              <h2 className="font-display text-2xl font-light text-moss-800 lg:text-3xl">
                {section.content.heading}
              </h2>
            </div>
            <Paragraphs text={section.content.body} className="mt-7" />
          </Reveal>
        ))}
      </div>

      {quote && (
        <section className="border-t border-bloom-300">
          <div className="mx-auto max-w-2xl px-6 py-22 text-center lg:py-30">
            <Reveal amount={0.3}>
              <blockquote className="font-display text-2xl font-light italic leading-[1.5] text-moss-700 lg:text-3xl">
                “{quote.content.body}”
              </blockquote>
              {quote.content.attribution && (
                <p className="mt-8 font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
                  {quote.content.attribution}
                </p>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {/* One quiet link out. No button, no urgency. */}
      <section className="border-t border-bloom-300">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <Reveal>
            <p className="prose-farm mx-auto">
              If you would like to come and see it, the calendar is open.
            </p>
            <Link
              to="/book"
              className="link-underline mt-8 inline-block font-sans text-[11px] uppercase tracking-eyebrow text-moss-700"
            >
              Find your dates
            </Link>
          </Reveal>
        </div>
      </section>
    </article>
  );
}
