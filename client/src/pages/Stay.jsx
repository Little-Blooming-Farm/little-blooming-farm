import { Link } from 'react-router-dom';

import { getContentPage, getProperties } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import SmartImage from '../components/SmartImage.jsx';
import Reveal, { RevealGroup, RevealItem } from '../components/Reveal.jsx';
import BlockRenderer from '../components/BlockRenderer.jsx';
import { ErrorState, Eyebrow, LoadingState, PageHero, Paragraphs } from '../components/ui.jsx';
import { formatMoney } from '../lib/format.js';

function PropertyPanel({ property, index }) {
  const anchor = property.slug;
  const flipped = index % 2 === 1;

  return (
    <div id={anchor} className="scroll-mt-24">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className={flipped ? 'lg:order-2' : ''}>
          <SmartImage
            src={property.photos?.[0]?.url}
            alt={property.photos?.[0]?.alt ?? property.name}
            ratio="4 / 3"
            className="w-full"
          />
          {property.photos?.length > 1 && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {property.photos.slice(1, 4).map((photo) => (
                <SmartImage
                  key={photo.url}
                  src={photo.url}
                  alt={photo.alt ?? property.name}
                  ratio="1 / 1"
                  className="w-full"
                  showMark={false}
                />
              ))}
            </div>
          )}
        </Reveal>

        <Reveal className={flipped ? 'lg:order-1' : ''} delay={0.12}>
          <Eyebrow>{index === 0 ? 'The bigger one' : 'The quiet one'}</Eyebrow>
          <h2 className="mt-6 text-display-sm lg:text-4xl">{property.name}</h2>
          {property.tagline && (
            <p className="mt-4 font-display text-xl font-light italic text-moss-600">
              {property.tagline}
            </p>
          )}

          <Paragraphs text={property.description} className="mt-7" />

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-bloom-300 pt-8 sm:grid-cols-4">
            {[
              ['Sleeps', property.maxGuests],
              ['Bedrooms', property.bedrooms],
              ['Bathrooms', property.bathrooms],
              ['From', `${formatMoney(property.basePriceCents)} / night`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="eyebrow">{label}</dt>
                <dd className="mt-2 font-display text-2xl font-light text-moss-800">{value}</dd>
              </div>
            ))}
          </dl>

          {property.amenities?.length > 0 && (
            <ul className="mt-9 flex flex-wrap gap-x-3 gap-y-2">
              {property.amenities.slice(0, 10).map((amenity) => (
                <li
                  key={amenity}
                  className="border border-bloom-300 px-3 py-1.5 font-sans text-[12px] font-light text-ink-soft"
                >
                  {amenity}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-11 flex flex-wrap items-center gap-8">
            <Link to={`/book?property=${property.slug}`} className="btn-quiet text-moss-700">
              <span>Check dates</span>
            </Link>
            <span className="font-sans text-[13px] font-light text-ink-muted">
              {property.minNights}-night minimum · check-in {property.checkInTime}
            </span>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export default function Stay() {
  const page = useAsync((signal) => getContentPage('stay').catch(() => null), []);
  const properties = useAsync((signal) => getProperties(), []);

  if (properties.loading || page.loading) return <LoadingState label="Opening the doors" />;
  if (properties.error) return <ErrorState error={properties.error} onRetry={properties.refresh} />;

  const content = page.data?.page;
  const homes = properties.data?.properties ?? [];

  return (
    <>
      <PageHero
        eyebrow="The stay"
        title={content?.title ?? 'Stay'}
        subtitle={content?.subtitle ?? 'Two homes, one piece of land, and no front desk.'}
        image={content?.heroImage ?? '/media/stay/hero.jpg'}
      />

      {/* Anchor nav — the page is long and people arrive looking for one thing. */}
      <div className="sticky top-[68px] z-30 border-b border-bloom-300/70 bg-bloom-100/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-editorial gap-6 overflow-x-auto px-6 py-4 lg:px-12">
          {[
            { href: '#the-home', label: 'The Home' },
            { href: '#the-guest-house', label: 'The Guest House' },
            { href: '#bedrooms', label: 'Bedrooms' },
            { href: '#the-pool', label: 'Pool' },
            { href: '#the-spa', label: 'Spa' },
            { href: '#outdoor-spaces', label: 'Outdoor spaces' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="link-underline whitespace-nowrap font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {content?.sections?.[0]?.type === 'richText' && (
        <BlockRenderer sections={[content.sections[0]]} />
      )}

      <section className="bg-bloom-100">
        <div className="mx-auto max-w-editorial space-y-30 px-6 py-16 lg:px-12 lg:py-22 lg:space-y-38">
          {homes.map((property, index) => (
            <PropertyPanel key={property.id} property={property} index={index} />
          ))}
        </div>
      </section>

      {/* The remaining editable sections: bedrooms, pool, spa, outdoor, CTA. */}
      <div className="bg-bloom-50">
        <BlockRenderer sections={(content?.sections ?? []).slice(1)} />
      </div>

      {homes.length > 0 && (
        <section className="bg-bloom-100">
          <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
            <RevealGroup className="grid gap-10 lg:grid-cols-2">
              {homes.map((property) => (
                <RevealItem key={property.id} className="border-t border-bloom-300 pt-8">
                  <h3 className="font-display text-2xl font-light text-moss-800">
                    House rules — {property.name}
                  </h3>
                  <ul className="mt-6 space-y-3">
                    {(property.houseRules ?? []).map((rule) => (
                      <li
                        key={rule}
                        className="font-sans text-[15px] font-light leading-relaxed text-ink-soft"
                      >
                        {rule}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-7 font-sans text-[14px] font-light leading-relaxed text-ink-muted">
                    {property.cancellationPolicy}
                  </p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}
    </>
  );
}
