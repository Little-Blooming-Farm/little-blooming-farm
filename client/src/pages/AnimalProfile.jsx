import { Link, useParams } from 'react-router-dom';

import { getAnimal } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import SmartImage from '../components/SmartImage.jsx';
import Reveal, { RevealGroup, RevealItem } from '../components/Reveal.jsx';
import { ErrorState, Eyebrow, LoadingState, Paragraphs } from '../components/ui.jsx';

export default function AnimalProfile() {
  const { slug } = useParams();
  const { data, loading, error, refresh } = useAsync(() => getAnimal(slug), [slug]);

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={error.status === 404 ? undefined : refresh}
        title={error.status === 404 ? 'We could not find them' : 'That did not load'}
      />
    );
  }

  const animal = data.animal;

  return (
    <article className="bg-bloom-100">
      <div className="mx-auto max-w-editorial px-6 pt-32 lg:px-12 lg:pt-38">
        <Reveal>
          <Link
            to="/animals"
            className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
          >
            All the animals
          </Link>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <Reveal>
            <SmartImage
              src={animal.photo?.url}
              alt={animal.photo?.alt ?? animal.name}
              ratio="4 / 5"
              className="w-full"
              priority
            />
          </Reveal>

          <Reveal delay={0.12} className="lg:pt-8">
            {animal.title && <Eyebrow>{animal.title}</Eyebrow>}
            <h1 className="mt-6 text-display-sm lg:text-display-md">{animal.name}</h1>
            {animal.species && (
              <p className="mt-3 font-display text-xl font-light italic text-moss-600">
                {animal.species}
              </p>
            )}

            <Paragraphs text={animal.bio} className="mt-9" />

            {animal.funFacts?.length > 0 && (
              <div className="mt-12 border-t border-bloom-300 pt-8">
                <Eyebrow>Worth knowing</Eyebrow>
                <ul className="mt-6 space-y-4">
                  {animal.funFacts.map((fact) => (
                    <li
                      key={fact}
                      className="flex gap-4 font-sans text-[15px] font-light leading-relaxed text-ink-soft"
                    >
                      <span className="mt-2.5 block h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>
        </div>

        {animal.gallery?.length > 0 && (
          <RevealGroup className="mt-22 grid grid-cols-2 gap-4 lg:mt-30 lg:grid-cols-4 lg:gap-6">
            {animal.gallery.map((photo) => (
              <RevealItem key={photo.url}>
                <SmartImage
                  src={photo.url}
                  alt={photo.alt ?? animal.name}
                  ratio="1 / 1"
                  className="w-full"
                />
              </RevealItem>
            ))}
          </RevealGroup>
        )}

        <Reveal className="mt-22 border-t border-bloom-300 py-16 text-center lg:mt-30">
          <p className="font-display text-2xl font-light italic text-moss-700">
            They are all considerably more interesting in person.
          </p>
          <Link to="/book" className="btn-quiet mt-9 text-moss-700">
            <span>Come and meet them</span>
          </Link>
        </Reveal>
      </div>
    </article>
  );
}
