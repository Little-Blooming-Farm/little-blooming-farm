import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import Hero from '../components/Hero.jsx';
import SmartImage from '../components/SmartImage.jsx';
import Reveal, { RevealGroup, RevealItem } from '../components/Reveal.jsx';
import { Eyebrow } from '../components/ui.jsx';
import { useHeroSettings } from '../lib/motion.js';

const TEASERS = [
  {
    to: '/experiences',
    eyebrow: 'Experiences',
    title: 'Feed the alpacas before breakfast',
    body: 'The goats start complaining at seven. There are eggs in the nest boxes by nine, a pizza oven that takes two hours to come up to heat, and a fire pit that has never once been lit for less than three hours.',
    image: '/media/home/experiences.jpg',
    alt: 'A child holding out a flat palm to an alpaca',
  },
  {
    to: '/animals',
    eyebrow: 'The residents',
    title: 'Cowboy will meet you at the gate',
    body: 'Four alpacas, a herd of very small goats, sixteen hens, a committee of ducks, and three peacocks who arrived nine years ago and never explained themselves.',
    image: '/media/home/animals.jpg',
    alt: 'Cowboy the Australian Shepherd waiting on the drive',
  },
];

export default function Home() {
  const { container, item } = useHeroSettings();
  const reducedMotion = useReducedMotion();

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <Hero videoSrc="/media/hero.mp4" posterSrc="/media/home/hero-poster.jpg">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-editorial px-6 pb-20 lg:px-12 lg:pb-28"
        >
          <motion.div variants={item}>
            <Eyebrow className="text-bloom-100/70">Santa Ynez Valley, California</Eyebrow>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-8 max-w-[13ch] text-display-md text-bloom-50 text-shadow-soft lg:text-display-xl"
          >
            The Little Blooming Farm
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-8 max-w-[34ch] font-display text-2xl font-light italic leading-snug text-bloom-100/90 text-shadow-soft lg:max-w-[40ch] lg:text-3xl"
          >
            Where children reconnect with nature and parents remember how to breathe.
          </motion.p>

          <motion.div variants={item} className="mt-12">
            <Link to="/book" className="btn-quiet on-dark text-bloom-50">
              <span>Book your stay</span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll cue — a hairline that breathes rather than a bouncing chevron. */}
        {!reducedMotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.6, duration: 1.6 }}
            className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex"
          >
            <span className="eyebrow text-bloom-100/50">Scroll</span>
            <span className="relative block h-14 w-px overflow-hidden bg-bloom-100/20">
              <motion.span
                className="absolute inset-x-0 top-0 block h-5 bg-bloom-100/70"
                animate={{ y: [-20, 56] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: [0.6, 0, 0.4, 1] }}
              />
            </span>
          </motion.div>
        )}
      </Hero>

      {/* ------------------------------------------------------------ Statement */}
      <section className="bg-bloom-100">
        <div className="mx-auto max-w-4xl px-6 py-30 text-center lg:py-38">
          <Reveal>
            <Eyebrow className="justify-center">Eleven acres, two homes</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-10 font-display text-3xl font-light leading-[1.35] text-moss-800 sm:text-4xl lg:text-[2.75rem]">
              There is nothing to achieve here. No itinerary, no activities desk, no schedule
              anyone will hold you to. Children work this out within about two hours. Adults take
              until the second morning.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="prose-farm mx-auto mt-10 text-center">
              Then something goes out of your shoulders and stays out.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------------- Stay */}
      <section className="bg-bloom-50">
        <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
            <Reveal className="order-2 lg:order-1">
              <Eyebrow>The stay</Eyebrow>
              <h2 className="mt-6 max-w-[14ch] text-display-sm lg:text-display-md">
                Two homes at the top of a valley
              </h2>
              <div className="prose-farm mt-8">
                <p>
                  The Home sleeps ten around one long table. The Guest House sleeps four and has
                  its own front door, its own patio, and a kitchen garden two steps away.
                </p>
                <p>
                  They share everything outside their walls — the orchard, the pool, the fire pit,
                  the animals, and about forty minutes of gold light every evening.
                </p>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-8">
                <Link to="/stay" className="btn-quiet text-moss-700">
                  <span>See both homes</span>
                </Link>
                <Link
                  to="/book"
                  className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
                >
                  Check availability
                </Link>
              </div>
            </Reveal>

            <Reveal className="order-1 lg:order-2" delay={0.15}>
              <div className="grid grid-cols-5 grid-rows-6 gap-4 lg:gap-5">
                <SmartImage
                  src="/media/home/stay-primary.jpg"
                  alt="The Home with its doors open to the orchard"
                  className="col-span-4 row-span-5 h-full w-full"
                  ratio="4 / 5"
                />
                <SmartImage
                  src="/media/home/stay-secondary.jpg"
                  alt="The Guest House patio in the morning"
                  className="col-span-3 col-start-3 row-span-3 row-start-4 h-full w-full shadow-lift"
                  ratio="1 / 1"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Teaser pair */}
      <section className="bg-bloom-100">
        <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
          <RevealGroup className="grid gap-16 lg:grid-cols-2 lg:gap-14">
            {TEASERS.map((teaser) => (
              <RevealItem key={teaser.to}>
                <Link to={teaser.to} className="group block">
                  <div className="overflow-hidden">
                    <SmartImage
                      src={teaser.image}
                      alt={teaser.alt}
                      ratio="3 / 2"
                      className="w-full"
                      imgClassName="transition-transform duration-[2000ms] ease-gentle group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="mt-8">
                    <Eyebrow>{teaser.eyebrow}</Eyebrow>
                    <h3 className="mt-5 max-w-[18ch] font-display text-3xl font-light leading-tight text-moss-800 lg:text-4xl">
                      {teaser.title}
                    </h3>
                    <p className="prose-farm mt-5">{teaser.body}</p>
                    <span className="link-underline mt-7 inline-block font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
                      Read on
                    </span>
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ------------------------------------------------------------- The Land */}
      <section className="relative">
        <SmartImage
          src="/media/home/land.jpg"
          alt="The old walnut orchard in late afternoon light"
          className="h-[75vh] min-h-[520px] w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-moss-900/85 via-moss-900/40 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-editorial px-6 pb-16 lg:px-12 lg:pb-22">
            <Reveal className="max-w-xl text-bloom-50">
              <Eyebrow className="text-bloom-100/70">The land</Eyebrow>
              <h2 className="mt-6 text-display-sm text-bloom-50 lg:text-display-md">
                A walnut orchard that stopped paying in 1978
              </h2>
              <p className="mt-6 font-sans text-lg font-light leading-relaxed text-bloom-100/85">
                Half of it went back to grass. The rest is old, gnarled, and still producing more
                walnuts than any household can reasonably use. We have been slowly bringing the
                whole thing back ever since.
              </p>
              <Link to="/the-land" className="btn-quiet on-dark mt-9 text-bloom-50">
                <span>The whole story</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Gallery */}
      <section className="bg-bloom-50">
        <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <Reveal>
              <Eyebrow>Gallery</Eyebrow>
              <h2 className="mt-6 max-w-[16ch] text-display-sm lg:text-display-md">
                Photographs, and one drone that got carried away
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <Link to="/gallery" className="btn-quiet text-moss-700">
                <span>Look around</span>
              </Link>
            </Reveal>
          </div>

          <RevealGroup className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            {[
              { src: '/media/gallery/02.jpg', alt: 'The long table set for dinner outdoors', span: 'lg:row-span-2', ratio: '3 / 4' },
              { src: '/media/gallery/05.jpg', alt: 'Hens in the orchard grass', ratio: '1 / 1' },
              { src: '/media/gallery/08.jpg', alt: 'Aerial view of the property and the valley', ratio: '1 / 1' },
              { src: '/media/gallery/07.jpg', alt: 'The fire pit after dark', ratio: '1 / 1' },
              { src: '/media/gallery/12.jpg', alt: 'The valley at golden hour', ratio: '1 / 1' },
              { src: '/media/gallery/04.jpg', alt: 'The pool surrounded by lavender', ratio: '1 / 1' },
            ].map((image) => (
              <RevealItem key={image.src} className={image.span ?? ''}>
                <SmartImage
                  src={image.src}
                  alt={image.alt}
                  ratio={image.ratio}
                  className="h-full w-full"
                />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ------------------------------------------------------ Garden of Erin */}
      <section className="bg-moss-800 text-bloom-100">
        <div className="mx-auto max-w-3xl px-6 py-30 text-center lg:py-38">
          <Reveal>
            <Eyebrow className="justify-center text-bloom-200/60">Why we are here</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-9 font-display text-4xl font-light leading-tight text-bloom-50 lg:text-5xl">
              The Garden of Erin
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-8 max-w-[52ch] font-sans text-[17px] font-light leading-[1.9] text-bloom-100/80">
              She was the one who kept pulling off the highway to look at properties we could not
              afford. She was the one who stood in the long grass of a dead walnut orchard and said
              a person could be happy here. She was right, and she did not get very long to be
              right in.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Link to="/garden-of-erin" className="btn-quiet on-dark mt-11 text-bloom-100">
              <span>Her garden</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- Closing */}
      <section className="bg-bloom-100">
        <div className="mx-auto max-w-editorial px-6 py-30 lg:px-12 lg:py-38">
          <Reveal className="text-center">
            <h2 className="mx-auto max-w-[16ch] text-display-sm lg:text-display-md">
              Come and be slightly bored with us
            </h2>
            <p className="prose-farm mx-auto mt-7 text-center">
              Two-night minimum. Booking here rather than through a listing site keeps more of it
              on the land, and means you are talking to us directly the whole way through.
            </p>
            <div className="mt-12">
              <Link to="/book" className="btn-quiet text-moss-700">
                <span>See the calendar</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
