import { Link } from 'react-router-dom';

import { getAnimals } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import SmartImage from '../components/SmartImage.jsx';
import { RevealGroup, RevealItem } from '../components/Reveal.jsx';
import { ErrorState, Eyebrow, LoadingState, PageHero } from '../components/ui.jsx';

export default function Animals() {
  const { data, loading, error, refresh } = useAsync(() => getAnimals(), []);

  if (loading) return <LoadingState label="Rounding everyone up" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const animals = data?.animals ?? [];

  return (
    <>
      <PageHero
        eyebrow="The residents"
        title="Meet the Animals"
        subtitle="A dog who takes his job seriously, four alpacas who do not, and three peacocks nobody invited."
        image="/media/animals/hero.jpg"
      />

      <section className="bg-bloom-100">
        <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
          <RevealGroup className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {animals.map((animal) => (
              <RevealItem key={animal.id}>
                <Link to={`/animals/${animal.slug}`} className="group block">
                  <div className="overflow-hidden">
                    <SmartImage
                      src={animal.photo?.url}
                      alt={animal.photo?.alt ?? animal.name}
                      ratio="4 / 5"
                      className="w-full"
                      imgClassName="transition-transform duration-[2000ms] ease-gentle group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="mt-6">
                    {animal.title && <Eyebrow>{animal.title}</Eyebrow>}
                    <h2 className="mt-3 font-display text-3xl font-light text-moss-800">
                      {animal.name}
                    </h2>
                    {animal.species && (
                      <p className="mt-1 font-sans text-[13px] font-light italic text-ink-muted">
                        {animal.species}
                      </p>
                    )}
                    <p className="mt-4 line-clamp-3 font-sans text-[15px] font-light leading-relaxed text-ink-soft">
                      {(animal.bio ?? '').split(/\n{2,}/)[0]}
                    </p>
                    <span className="link-underline mt-5 inline-block font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
                      Meet {animal.name}
                    </span>
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>

          {animals.length === 0 && (
            <p className="prose-farm mx-auto text-center">
              The profiles are being written. Everyone is well, and outside.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
