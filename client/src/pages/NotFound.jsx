import { Link } from 'react-router-dom';

import Reveal from '../components/Reveal.jsx';
import { Eyebrow } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <section className="flex min-h-[78vh] items-center bg-bloom-100">
      <div className="mx-auto max-w-2xl px-6 py-30 text-center">
        <Reveal>
          <Eyebrow className="justify-center">Nothing here</Eyebrow>
          <h1 className="mt-8 text-display-sm lg:text-display-md">
            This gate opens onto an empty field
          </h1>
          <p className="prose-farm mx-auto mt-7 text-center">
            Which is pleasant enough, but probably not what you were looking for.
          </p>
          <div className="mt-11 flex flex-wrap items-center justify-center gap-8">
            <Link to="/" className="btn-quiet text-moss-700">
              <span>Back to the farm</span>
            </Link>
            <Link
              to="/book"
              className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
            >
              See availability
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
