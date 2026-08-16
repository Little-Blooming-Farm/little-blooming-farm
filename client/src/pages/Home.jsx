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
    title: 'Meet the alpacas before breakfast',
    body: 'Six alpacas and four Nigerian dwarf goats call this place home. Mornings tend to begin with someone wandering outside to say hello, and somehow staying much longer than planned. The fire pit takes over when the sun goes down, and the gardens offer something different depending on the season.',
    image: '/media/home/experiences.jpg',
    alt: 'Alpacas standing in the shade at the edge of the paddock',
  },
  {
    to: '/animals',
    eyebrow: 'The residents',
    title: 'Cowboy will meet you at the gate',
    body: 'Cowboy keeps an eye on things closer to home. Beyond him, the valley has its own residents: hawks circling overhead, owls calling after dark, and doves moving through the trees. Some live here. Some are just passing through. None seem particularly concerned that you booked the place.',
    image: '/media/animals/cowboy.jpeg',
    alt: 'Cowboy, a blue heeler, lying in the grass with his ears up',
    // A tall portrait in a 3:2 slot: centre-cropping would cut his ears off, so
    // the crop is biased towards the top of the frame.
    objectPosition: 'object-[50%_28%]',
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
            <Eyebrow className="justify-center">Five acres, two homes</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-10 font-display text-3xl font-light leading-[1.35] text-moss-800 sm:text-4xl lg:text-[2.75rem]">
              The days are allowed to unfold here.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="prose-farm mx-auto mt-10 text-center">
              <p>
                Wake with the light. Wander outside barefoot. Stay at the table too long. Let the
                kids disappear into whatever they’ve discovered. Eat when you’re hungry. Watch the
                sun go down without needing to be anywhere next.
              </p>
              <p>After a while, you stop keeping track of the time.</p>
              <p className="font-display text-xl font-light italic text-moss-800">
                That’s usually when the good part begins.
              </p>
            </div>
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
                Two homes. Always blooming.
              </h2>
              <div className="prose-farm mt-8">
                <p>
                  Vicky sleeps up to eight. The Barn sleeps up to six. Each is its own private
                  home, with its own space to settle in and make your own.
                </p>
                <p>
                  Outside, what’s blooming depends on when you arrive. The gardens shift with the
                  seasons, changing color, texture, scent, and shape throughout the year. No two
                  stays look quite the same.
                </p>
                <p>Stay in one home or bring everyone and make both yours.</p>
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
                  alt="The covered porch running the length of Vicky, the Victorian house"
                  className="col-span-4 row-span-5 h-full w-full"
                  ratio="4 / 5"
                />
                <SmartImage
                  src="/media/home/stay-secondary.jpg"
                  alt="The kitchen and long table, laid for a slow morning"
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
                      imgClassName={`transition-transform duration-[2000ms] ease-gentle group-hover:scale-[1.04] ${teaser.objectPosition ?? ''}`}
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
      {/*
        The photograph stays full-bleed, but the copy sits in the dark band
        below it rather than on top. Five paragraphs overlaid on a picture is
        unreadable on a phone — the previous single paragraph already filled
        the frame there — and the gradient carries the image into the band so
        the two still read as one unit.
      */}
      <section className="bg-moss-900 text-bloom-100">
        <div className="relative">
          <SmartImage
            src="/media/home/land.jpg"
            alt="Children playing under the old oak in late afternoon light"
            className="h-[46vh] min-h-[300px] w-full lg:h-[62vh]"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-moss-900 to-transparent" />
        </div>

        <div className="mx-auto max-w-editorial px-6 pb-22 pt-10 lg:px-12 lg:pb-30 lg:pt-14">
          <Reveal className="max-w-2xl">
            <Eyebrow className="text-bloom-100/70">The land</Eyebrow>
            <h2 className="mt-6 max-w-[18ch] text-display-sm text-bloom-50 lg:text-display-md">
              Five acres along an old road through the valley
            </h2>
            <div className="mt-8 space-y-6 font-sans text-lg font-light leading-relaxed text-bloom-100/85">
              <p>
                Refugio has been a passage between the coast and the Santa Ynez Valley for
                generations. The land around it has changed many times, from open range and early
                agriculture to orchards, gardens and vineyards.
              </p>
              <p>The Little Blooming Farm sits on five acres along that old route.</p>
              <p>
                Today, the land is always becoming something new. Gardens are planted and
                replanted. Flowers arrive with the seasons. Six alpacas and four Nigerian dwarf
                goats wander the property. Two homes, including a century-old barn, have been
                thoughtfully brought into their next chapter.
              </p>
              <p>
                We call it The Little Blooming Farm because nothing here stays exactly the same for
                long.
              </p>
              <p className="font-display text-2xl font-light italic text-bloom-50 lg:text-3xl">
                Something is always blooming.
              </p>
            </div>
            <Link to="/the-land" className="btn-quiet on-dark mt-11 text-bloom-50">
              <span>The whole story</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------------- Gallery */}
      <section className="bg-bloom-50">
        <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <Reveal>
              <Eyebrow>Gallery</Eyebrow>
              <h2 className="mt-6 max-w-[16ch] text-display-sm lg:text-display-md">
                Photographs from an ordinary week here
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
              { src: '/media/gallery/05.jpg', alt: 'A hen picking her way across the yard', ratio: '1 / 1' },
              { src: '/media/gallery/08.jpg', alt: 'Children playing under the old oak', ratio: '1 / 1' },
              { src: '/media/gallery/07.jpg', alt: 'A hammock strung up in the shade', ratio: '1 / 1' },
              { src: '/media/gallery/12.jpg', alt: 'Morning light coming through the window', ratio: '1 / 1' },
              { src: '/media/gallery/04.jpg', alt: 'Alpacas gathered at the fence', ratio: '1 / 1' },
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
            <div className="mx-auto mt-8 max-w-[52ch] space-y-6 font-sans text-[17px] font-light leading-[1.9] text-bloom-100/80">
              <p>
                Erin had an instinct for beauty that shaped this place in countless ways. She
                noticed the details most people passed over: the way a room felt, the balance of
                texture and light, the warmth of a material, the quiet difference between something
                that simply looked good and something that felt alive.
              </p>
              <p>
                Her aesthetic was never about perfection. It was about creating spaces that felt
                soulful, natural, welcoming, and deeply considered. The Little Blooming Farm carries
                that sensibility throughout, in the choices, the atmosphere, and the feeling of
                being here.
              </p>
              <p>
                The Garden of Erin is a continuation of that eye for beauty and the care she
                brought to the spaces around her.
              </p>
            </div>
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
              Come stay awhile.
            </h2>
            <div className="prose-farm mx-auto mt-7 text-center">
              <p>
                Wake up without an agenda. Wander outside. Meet the animals. See what’s blooming.
                Sit around the fire longer than you meant to.
              </p>
              <p>There’s plenty to do here. None of it needs to be done.</p>
            </div>
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
