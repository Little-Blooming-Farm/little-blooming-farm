import { motion } from 'framer-motion';
import SmartImage from './SmartImage.jsx';
import Reveal from './Reveal.jsx';
import { useHeroSettings } from '../lib/motion.js';

/** Small uppercase label with a hairline, used above section headings. */
export function Eyebrow({ children, className = '', withRule = true }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {withRule && <span className="h-px w-8 bg-current opacity-30" />}
      <span className="eyebrow text-current">{children}</span>
    </div>
  );
}

/** Standard interior page header: full-bleed image, title, standfirst. */
export function PageHero({ eyebrow, title, subtitle, image, height = 'tall' }) {
  const { container, item } = useHeroSettings();

  const heights = {
    short: 'min-h-[46vh] lg:min-h-[54vh]',
    tall: 'min-h-[62vh] lg:min-h-[72vh]',
  };

  return (
    <section className={`relative flex items-end ${heights[height]}`}>
      <SmartImage src={image} alt={title} priority className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-moss-900/85 via-moss-900/35 to-moss-900/15" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative mx-auto w-full max-w-editorial px-6 pb-16 pt-32 text-bloom-50 lg:px-12 lg:pb-22"
      >
        {eyebrow && (
          <motion.div variants={item}>
            <Eyebrow className="text-bloom-200/80">{eyebrow}</Eyebrow>
          </motion.div>
        )}
        <motion.h1
          variants={item}
          className="mt-6 max-w-[16ch] text-display-sm text-bloom-50 lg:text-display-lg"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            variants={item}
            className="mt-6 max-w-[46ch] font-sans text-lg font-light leading-relaxed text-bloom-100/85"
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}

/** Consistent vertical rhythm and max width for every content block. */
export function Section({ children, className = '', width = 'editorial', tone = 'paper', id }) {
  const widths = {
    editorial: 'max-w-editorial',
    narrow: 'max-w-3xl',
    prose: 'max-w-prose',
  };
  const tones = {
    paper: 'bg-bloom-100 text-ink',
    cream: 'bg-bloom-50 text-ink',
    moss: 'bg-moss-800 text-bloom-100',
    clay: 'bg-clay-100 text-ink',
    none: '',
  };

  return (
    <section id={id} className={`${tones[tone]} ${className}`}>
      <div className={`mx-auto ${widths[width]} px-6 py-22 lg:px-12 lg:py-30`}>{children}</div>
    </section>
  );
}

/** Section heading with optional eyebrow and standfirst, revealed on scroll. */
export function SectionHeading({ eyebrow, title, intro, align = 'left', className = '' }) {
  return (
    <Reveal className={`${align === 'center' ? 'mx-auto text-center' : ''} ${className}`}>
      {eyebrow && (
        <Eyebrow className={align === 'center' ? 'justify-center' : ''}>{eyebrow}</Eyebrow>
      )}
      <h2
        className={`mt-6 text-display-sm lg:text-display-md ${
          align === 'center' ? 'mx-auto max-w-[20ch]' : 'max-w-[18ch]'
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={`prose-farm mt-6 ${align === 'center' ? 'mx-auto' : ''}`}
        >
          {intro}
        </p>
      )}
    </Reveal>
  );
}

/** Renders a multi-paragraph string as paragraphs, preserving blank-line breaks. */
export function Paragraphs({ text, className = '' }) {
  if (!text) return null;
  return (
    <div className={`prose-farm ${className}`}>
      {String(text)
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i}>{paragraph}</p>
        ))}
    </div>
  );
}

export function LoadingState({ label = 'One moment' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <motion.span
        className="block h-1.5 w-1.5 rounded-full bg-moss-500"
        animate={{ opacity: [0.25, 1, 0.25] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'That did not load' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-display-sm">{title}</h2>
      <p className="prose-farm max-w-[42ch]">
        {error?.message ?? 'Something went wrong on our end. Please try again.'}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-quiet mt-2 text-moss-700">
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}

/** A soft notice used for policies, holds, and inline warnings. */
export function Note({ children, tone = 'moss', className = '' }) {
  const tones = {
    moss: 'border-moss-200 bg-moss-50 text-moss-700',
    clay: 'border-clay-200 bg-clay-100 text-clay-600',
    gold: 'border-gold-200 bg-[#FBF4E2] text-gold-600',
  };
  return (
    <div
      className={`border px-5 py-4 font-sans text-[14px] font-light leading-relaxed ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
