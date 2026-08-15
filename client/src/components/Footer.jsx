import { Link } from 'react-router-dom';
import Reveal from './Reveal.jsx';

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'stay@thelittlebloomingfarm.com';
const WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '';

const COLUMNS = [
  {
    heading: 'The farm',
    links: [
      { to: '/stay', label: 'Stay' },
      { to: '/experiences', label: 'Experiences' },
      { to: '/the-land', label: 'The Land' },
      { to: '/animals', label: 'Meet the Animals' },
    ],
  },
  {
    heading: 'Look around',
    links: [
      { to: '/gallery', label: 'Gallery' },
      { to: '/local-guide', label: 'Local Guide' },
      { to: '/garden-of-erin', label: 'The Garden of Erin' },
      { to: '/book', label: 'Availability' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-moss-900 text-bloom-200">
      <div className="mx-auto max-w-editorial px-6 py-22 lg:px-12 lg:py-30">
        <Reveal>
          <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
            <div>
              <p className="font-display text-3xl leading-tight text-bloom-100">
                The Little Blooming Farm
              </p>
              <p className="mt-5 max-w-xs font-sans text-[15px] font-light leading-relaxed text-bloom-200/70">
                Where children reconnect with nature and parents remember how to breathe.
              </p>
              <p className="mt-8 font-sans text-[13px] uppercase tracking-label text-bloom-200/50">
                Santa Ynez Valley, California
              </p>
            </div>

            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="eyebrow text-bloom-200/50">{column.heading}</p>
                <ul className="mt-6 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="link-underline font-sans text-[15px] font-light text-bloom-200/85 hover:text-bloom-100"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <p className="eyebrow text-bloom-200/50">Write to us</p>
              <ul className="mt-6 space-y-3">
                <li>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="link-underline font-sans text-[15px] font-light text-bloom-200/85 hover:text-bloom-100"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </li>
                {WHATSAPP && (
                  <li>
                    <a
                      href={`https://wa.me/${WHATSAPP.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-underline font-sans text-[15px] font-light text-bloom-200/85 hover:text-bloom-100"
                    >
                      WhatsApp
                    </a>
                  </li>
                )}
              </ul>

              <p className="mt-8 max-w-[24ch] font-sans text-[13px] font-light leading-relaxed text-bloom-200/55">
                Booking here rather than through a listing site keeps more of it on the land.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-20 flex flex-col gap-4 border-t border-bloom-200/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-[12px] font-light text-bloom-200/45">
            © {new Date().getFullYear()} The Little Blooming Farm. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              to="/garden-of-erin"
              className="font-sans text-[12px] font-light text-bloom-200/45 hover:text-bloom-200"
            >
              For Erin
            </Link>
            <Link
              to="/admin"
              className="font-sans text-[12px] font-light text-bloom-200/30 hover:text-bloom-200/70"
            >
              Owner login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
