import { Link } from 'react-router-dom';

import SmartImage from './SmartImage.jsx';
import Reveal, { RevealGroup, RevealItem } from './Reveal.jsx';
import { Eyebrow, Paragraphs } from './ui.jsx';

/**
 * Renders the flexible `sections` array a ContentPage stores.
 *
 * Every block type here has a matching entry in BLOCK_TYPES on the server, so
 * the owner can restructure a page from /admin and this renders it without a
 * deploy. Unknown types are skipped silently rather than crashing the page —
 * a content mistake should never take a page down.
 */

/** Stable anchor ids so /stay#pool and friends work. */
export function anchorId(text) {
  if (!text) return undefined;
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function RichText({ content }) {
  return (
    <div className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22">
      <Reveal className="mx-auto max-w-prose">
        {content.heading && (
          <h2 className="mb-8 text-display-sm lg:text-4xl" id={anchorId(content.heading)}>
            {content.heading}
          </h2>
        )}
        <Paragraphs text={content.body} />
      </Reveal>
    </div>
  );
}

function ImageText({ content }) {
  const left = content.imagePosition === 'left';
  return (
    <div
      className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22"
      id={anchorId(content.heading)}
    >
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className={left ? 'lg:order-1' : 'lg:order-2'}>
          <SmartImage
            src={content.image?.url}
            alt={content.image?.alt ?? content.heading ?? ''}
            ratio="4 / 3"
            className="w-full"
          />
        </Reveal>
        <Reveal className={left ? 'lg:order-2' : 'lg:order-1'} delay={0.1}>
          {content.eyebrow && <Eyebrow className="mb-6">{content.eyebrow}</Eyebrow>}
          {content.heading && (
            <h2 className="mb-7 max-w-[16ch] text-display-sm lg:text-4xl">{content.heading}</h2>
          )}
          <Paragraphs text={content.body} />
          {content.buttonHref && (
            <Link to={content.buttonHref} className="btn-quiet mt-9 text-moss-700">
              <span>{content.buttonLabel ?? 'Read more'}</span>
            </Link>
          )}
        </Reveal>
      </div>
    </div>
  );
}

function FullBleedImage({ content }) {
  return (
    <figure className="my-10 lg:my-16">
      <Reveal>
        <SmartImage
          src={content.image?.url}
          alt={content.image?.alt ?? ''}
          className="h-[60vh] min-h-[380px] w-full lg:h-[80vh]"
        />
        {content.caption && (
          <figcaption className="mx-auto max-w-editorial px-6 pt-4 font-sans text-[13px] font-light text-ink-muted lg:px-12">
            {content.caption}
          </figcaption>
        )}
      </Reveal>
    </figure>
  );
}

function Quote({ content }) {
  return (
    <div className="mx-auto max-w-editorial px-6 py-20 lg:px-12 lg:py-30">
      <Reveal className="mx-auto max-w-3xl text-center">
        <blockquote className="font-display text-3xl font-light italic leading-[1.4] text-moss-700 lg:text-[2.5rem]">
          “{content.body}”
        </blockquote>
        {content.attribution && (
          <figcaption className="mt-8 font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
            {content.attribution}
          </figcaption>
        )}
      </Reveal>
    </div>
  );
}

function Grid({ content }) {
  const items = content.items ?? [];
  return (
    <div
      className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22"
      id={anchorId(content.heading)}
    >
      {(content.heading || content.intro) && (
        <Reveal className="mb-14 max-w-2xl">
          {content.heading && <h2 className="text-display-sm lg:text-4xl">{content.heading}</h2>}
          {content.intro && <p className="prose-farm mt-5">{content.intro}</p>}
        </Reveal>
      )}

      <RevealGroup className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <RevealItem key={`${item.title}-${index}`}>
            <SmartImage
              src={item.image?.url}
              alt={item.image?.alt ?? item.title ?? ''}
              ratio="4 / 3"
              className="w-full"
            />
            <h3 className="mt-6 font-display text-2xl font-light leading-snug text-moss-800">
              {item.title}
            </h3>
            <p className="mt-3 font-sans text-[15px] font-light leading-relaxed text-ink-soft">
              {item.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}

function GalleryBlock({ content }) {
  const images = content.images ?? [];
  return (
    <div className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22">
      {content.heading && (
        <Reveal className="mb-12">
          <h2 className="text-display-sm lg:text-4xl">{content.heading}</h2>
        </Reveal>
      )}
      <RevealGroup className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">
        {images.map((image, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <RevealItem key={`${image.url}-${index}`}>
            <SmartImage src={image.url} alt={image.alt ?? ''} ratio="1 / 1" className="w-full" />
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}

function ListBlock({ content }) {
  return (
    <div className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22">
      <Reveal className="mx-auto max-w-prose">
        {content.heading && <h2 className="mb-8 text-display-sm lg:text-4xl">{content.heading}</h2>}
        <ul className="divide-y divide-bloom-300">
          {(content.items ?? []).map((entry, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className="py-4 font-sans text-[16px] font-light text-ink-soft">
              {entry}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}

function Cta({ content }) {
  const external = /^https?:\/\//.test(content.buttonHref ?? '');
  return (
    <div className="bg-bloom-50">
      <div className="mx-auto max-w-editorial px-6 py-22 text-center lg:px-12 lg:py-30">
        <Reveal>
          {content.heading && (
            <h2 className="mx-auto max-w-[18ch] text-display-sm lg:text-display-md">
              {content.heading}
            </h2>
          )}
          {content.body && <p className="prose-farm mx-auto mt-6 text-center">{content.body}</p>}
          {content.buttonHref &&
            (external ? (
              <a
                href={content.buttonHref}
                className="btn-quiet mt-10 text-moss-700"
                target="_blank"
                rel="noreferrer noopener"
              >
                <span>{content.buttonLabel ?? 'Read more'}</span>
              </a>
            ) : (
              <Link to={content.buttonHref} className="btn-quiet mt-10 text-moss-700">
                <span>{content.buttonLabel ?? 'Read more'}</span>
              </Link>
            ))}
        </Reveal>
      </div>
    </div>
  );
}

const SPACER_SIZES = { sm: 'h-8', md: 'h-16', lg: 'h-24 lg:h-30', xl: 'h-30 lg:h-38' };

const RENDERERS = {
  richText: RichText,
  imageText: ImageText,
  fullBleedImage: FullBleedImage,
  quote: Quote,
  grid: Grid,
  gallery: GalleryBlock,
  list: ListBlock,
  cta: Cta,
  spacer: ({ content }) => <div className={SPACER_SIZES[content.size] ?? SPACER_SIZES.md} />,
  // `hero` is rendered by the page itself via PageHero, not inline.
  hero: () => null,
};

export default function BlockRenderer({ sections = [] }) {
  return (
    <>
      {sections.map((section) => {
        const Renderer = RENDERERS[section.type];
        if (!Renderer) return null;
        return <Renderer key={section.id ?? section._id} content={section.content ?? {}} />;
      })}
    </>
  );
}
