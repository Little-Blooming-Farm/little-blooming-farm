import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { getContentPage, getExperiences } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import SmartImage from '../components/SmartImage.jsx';
import Reveal, { RevealGroup, RevealItem } from '../components/Reveal.jsx';
import { ErrorState, Eyebrow, LoadingState, PageHero, Paragraphs } from '../components/ui.jsx';
import { EASE } from '../lib/motion.js';

const CATEGORIES = [
  { value: 'all', label: 'Everything' },
  { value: 'animals', label: 'The animals' },
  { value: 'kids', label: 'For children' },
  { value: 'garden', label: 'The garden' },
  { value: 'gathering', label: 'Gathering' },
  { value: 'quiet', label: 'Quiet' },
  { value: 'seasonal', label: 'Seasonal' },
];

function ExperienceCard({ experience, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(experience)}
      className="group block w-full text-left"
    >
      <div className="overflow-hidden">
        <SmartImage
          src={experience.image?.url}
          alt={experience.image?.alt ?? experience.title}
          ratio="4 / 3"
          className="w-full"
          imgClassName="transition-transform duration-[1800ms] ease-gentle group-hover:scale-[1.05]"
        />
      </div>
      <div className="mt-6">
        <p className="eyebrow">{experience.season}</p>
        <h3 className="mt-3 font-display text-2xl font-light leading-snug text-moss-800">
          {experience.title}
        </h3>
        <p className="mt-3 font-sans text-[15px] font-light leading-relaxed text-ink-soft">
          {experience.shortDescription}
        </p>
        <span className="link-underline mt-5 inline-block font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
          More
        </span>
      </div>
    </button>
  );
}

function ExperienceDetail({ experience, onClose }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-moss-900/70 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={experience.title}
    >
      <motion.div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto bg-bloom-50"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.985 }}
        transition={{ duration: 0.65, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <SmartImage
          src={experience.image?.url}
          alt={experience.image?.alt ?? experience.title}
          ratio="16 / 9"
          className="w-full"
        />
        <div className="p-8 lg:p-12">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Eyebrow>{experience.season}</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-light text-moss-800 lg:text-4xl">
                {experience.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted hover:text-ink"
            >
              Close
            </button>
          </div>

          {experience.duration && (
            <p className="mt-4 font-sans text-[13px] font-light text-ink-muted">
              {experience.duration}
            </p>
          )}

          <Paragraphs text={experience.description} className="mt-7" />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Experiences() {
  const experiences = useAsync(() => getExperiences(), []);
  const page = useAsync(() => getContentPage('experiences').catch(() => null), []);
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  if (experiences.loading) return <LoadingState />;
  if (experiences.error) {
    return <ErrorState error={experiences.error} onRetry={experiences.refresh} />;
  }

  const all = experiences.data?.experiences ?? [];
  const visible = category === 'all' ? all : all.filter((e) => e.category === category);
  const content = page.data?.page;

  return (
    <>
      <PageHero
        eyebrow="No schedule"
        title={content?.title ?? 'Experiences'}
        subtitle={content?.subtitle ?? 'None of it is scheduled. All of it is there when you want it.'}
        image={content?.heroImage ?? '/media/experiences/hero.jpg'}
      />

      {content?.sections?.[0]?.content?.body && (
        <section className="bg-bloom-100">
          <div className="mx-auto max-w-editorial px-6 pt-22 lg:px-12 lg:pt-30">
            <Reveal className="mx-auto max-w-prose">
              <Paragraphs text={content.sections[0].content.body} />
            </Reveal>
          </div>
        </section>
      )}

      <section className="bg-bloom-100">
        <div className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22">
          <Reveal className="flex flex-wrap gap-x-7 gap-y-3 border-b border-bloom-300 pb-6">
            {CATEGORIES.map((option) => {
              const active = category === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`font-sans text-[11px] uppercase tracking-eyebrow transition-opacity duration-500 ease-gentle ${
                    active ? 'text-moss-700 opacity-100' : 'text-ink-muted opacity-60 hover:opacity-100'
                  }`}
                >
                  {option.label}
                  {active && (
                    <motion.span
                      layoutId="experience-filter"
                      className="mt-2 block h-px bg-moss-600"
                    />
                  )}
                </button>
              );
            })}
          </Reveal>

          <RevealGroup
            key={category}
            className="mt-16 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((experience) => (
              <RevealItem key={experience.id}>
                <ExperienceCard experience={experience} onOpen={setSelected} />
              </RevealItem>
            ))}
          </RevealGroup>

          {visible.length === 0 && (
            <p className="prose-farm mt-16">Nothing in this season yet. Try another.</p>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selected && (
          <ExperienceDetail experience={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
