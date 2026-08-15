# The Little Blooming Farm

A direct-booking site for a two-home farm stay in the Santa Ynez Valley, built to
replace Airbnb/VRBO dependency. It is a story site first and a booking engine
second — the calendar is there when you want it, not shouting at you.

> Where children reconnect with nature and parents remember how to breathe.

---

## Quick start

```bash
npm run install:all
npm run demo
```

Open http://localhost:5173.

`demo` runs both apps against a throwaway in-memory MongoDB seeded with the real
content, plus a local Stripe stand-in — no Atlas account, no Stripe keys, no
charges, nothing to configure. It prints an admin login and a ready-made guest
portal link (a confirmed booking with a deposit paid and a balance outstanding).
Ctrl-C stops both.

For a real local setup (persistent database, real Stripe test mode), see
[DEPLOYMENT.md](DEPLOYMENT.md#1-get-it-running-locally).

---

## Layout

```
client/                 React + Vite + Tailwind + Framer Motion
  src/pages/            Story pages, booking flow
  src/admin/            Owner panel (lazy-loaded, never in a guest's bundle)
  src/components/       Layout, motion primitives, calendar, lightbox
  src/lib/              API client, date/money formatting, motion config
server/                 Node + Express + Mongoose
  src/models/           Property, Booking, BlockedDate, Animal, ContentPage, …
  src/routes/           Public API, Stripe webhook, /admin CRUD
  src/services/         Booking lifecycle, iCal import/export
  src/lib/              Availability, pricing, locking, email, uploads
  src/scripts/          seed, create-admin, verify, dev:demo, sync:ical
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Both apps, watching |
| `npm run demo` | **Both apps on a disposable in-memory DB — zero config** |
| `npm run verify` | 76-check integration suite (see below) |
| `npm --prefix server run seed` | Load/refresh the shipped content |
| `npm --prefix server run create-admin -- --email you@example.com` | Owner account |
| `npm --prefix server run sync:ical` | Pull Airbnb/VRBO calendars once |
| `npm run build` | Production build of the site |

---

## The parts worth explaining

### Double-booking is prevented in three layers

Two people paying for the same week is the one failure this system cannot have,
so it is defended three times over in `services/bookingService.js`:

1. **A per-property advisory lock** (`lib/lock.js`) serialises the whole
   check-then-write. Acquisition is one atomic `findOneAndUpdate` with `upsert`
   against a unique key — concurrent callers either take an expired lock or
   collide on the unique index. A TTL index means a crashed request cannot
   deadlock the calendar.
2. **A MongoDB transaction**, when the deployment supports one (every Atlas
   tier does), commits the availability check and the insert together under
   `snapshot` read concern and `majority` write concern.
3. **A post-insert uniqueness proof** re-runs the overlap query excluding the
   row just written. If anything at all slipped through, the loser deletes its
   own booking and returns a 409.

The overlap predicate itself lives in one place, `lib/availability.js`:

```
existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
```

Strict inequalities are what make same-day turnover work — a stay ending on the
7th does not conflict with one starting on the 7th.

`npm run verify` fires 16 simultaneous requests for identical dates and asserts
exactly one wins, then fires 16 staggered overlapping ranges and asserts the
database contains no overlap at all.

### The guest portal

After payment the guest gets a private, tokenless-login link to
`/booking/manage/<token>` holding everything about their stay: the reservation,
the rental agreement to sign, the payment schedule, any balance still to pay,
the arrival details, and cancellation.

The link is a bearer credential, so only a SHA-256 digest of it is stored — a
database leak cannot be replayed. A lost link is reissued, never recovered.

### Deposits and balances — the guest chooses

At checkout the guest picks how much to pay today: **25%, 50%, 75%, or in
full**. The options come from the property's `depositOptions` (editable in
/admin); paying in full is always offered. Whatever they pick, the stay total is
identical — only the timing moves.

The choice is validated server-side, twice: at quoting and again in the booking
service immediately before the schedule is written. A percentage the property
does not offer is **refused**, not quietly rounded, because charging something
other than what was asked for is worse than an error. The browser cannot dictate
the split.

The split is only offered when there is actually runway to collect a balance; a
last-minute stay is charged in full and the chooser does not appear at all.
Instalments are computed so they sum to the total exactly — the balance is the
remainder, not its own percentage, so no cent is lost or invented.

Each instalment carries its own Stripe session and settles independently, so a
replayed webhook cannot double-count. Refunds draw down instalments newest
first, because a deposit and a balance sit behind two different PaymentIntents
and Stripe can only refund each against its own.

### Arrival details are earned, not granted

Gate code, door code, wifi password, address and directions are released only
when **all** of: the booking is confirmed, nothing is outstanding, the agreement
is signed, and check-in is within `arrivalInfoReleaseDays`. The decision is made
on the server — the client is told *whether* they are available and why not, and
the values are simply absent from the payload until then. There is a test that
greps the whole response for the address and wifi name.

### Apple Pay

Stripe Checkout renders the wallet button full-width above the card form
wherever the device supports it, which is why `payment_method_types` is
deliberately left unset — naming it would pin Checkout to that list and suppress
everything else. Hosted Checkout needs no Apple domain registration because
Stripe owns `checkout.stripe.com`.

`WalletBadge` surfaces this *before* the guest commits, with real detection
(`window.ApplePaySession`) so the Apple mark only shows to people who can
actually use it.

### Payment is only ever confirmed by the webhook

`POST /api/bookings` creates a **pending** booking and a Stripe Checkout
Session. Nothing is confirmed until `checkout.session.completed` arrives with a
valid signature. The browser redirect to `/booking/confirmed` proves nothing —
anyone can navigate there — so that page polls our own API and reports whatever
the webhook has actually recorded. Handlers are idempotent, so Stripe's retries
are safe.

### Pending bookings expire

An unpaid booking holds its dates only until `holdExpiresAt`
(`BOOKING_HOLD_MINUTES`, default 35). Without that, one abandoned checkout would
block a week forever. Availability queries ignore lapsed holds immediately; a
cron job tidies the records afterwards.

### Manage links are stored hashed

The token emailed to a guest is a bearer credential in a URL. We store only its
SHA-256 digest, so a database leak cannot be replayed to cancel anyone's stay.
The consequence: a lost link cannot be recovered, only reissued — which is what
"Resend confirmation" in the admin panel does.

### Airbnb sync, and its honest limit

Airbnb offers **iCal export only** — polling, not push. There are no Airbnb
webhooks outside their partner API. So:

* a night reserved on Airbnb is blocked here within one sync interval
  (`ICAL_SYNC_CRON`, default 30 minutes), and cannot then be sold on this site;
* a night booked here appears in the outbound feed immediately, for Airbnb to
  import on *their* schedule;
* what no iCal integration can eliminate is the window between a booking on
  Airbnb and our next poll.

Direct bookings on this site are never double-booked — that is proven by test.
Cross-platform, shorten the interval and watch the dashboard.

`npm run verify` covers the whole loop against a real Airbnb-format feed:
import, block, refuse an overlapping booking, re-sync without duplicating,
extend a stay in place, prune a cancelled one, and leave manual blocks alone.

### iCal sync cannot eat your own blocks

Imported OTA blocks reconcile by their calendar UID within `(property, source)`.
Manual blocks have no UID and are excluded from the index entirely, so a sync
updates what changed, removes what disappeared upstream, and never touches
anything you created by hand.

### The site looks composed before the photography exists

`SmartImage` falls back to a deterministic tonal panel drawn from the brand
palette when a source is missing or fails to load — same image, same tone, every
time. Drop real files in and they simply load; nothing needs changing.

### Motion

One easing curve (`cubic-bezier(0.22, 1, 0.36, 1)`), long durations, and every
variant resolved through `lib/motion.js` so `prefers-reduced-motion` is a single
branch rather than a per-component decision someone eventually forgets. With
reduced motion on, the hero video is never even requested.

---

## Security

All of these are implemented; `npm run verify` exercises the ones that can be
tested from outside.

- Secrets only in `.env`, validated by zod at boot — a misconfigured server
  refuses to start rather than misbehaving at request time
- Production refuses to boot with a Stripe **test** key, a wildcard `CORS_ORIGINS`,
  a non-https `CLIENT_URL`, missing Cloudinary credentials, or a session-cookie
  policy that cannot work across the configured domains
- Helmet, restrictive CORS allowlist, HSTS, no `X-Powered-By`
- Rate limiting on quoting, booking, login, manage-links and uploads
- Every route parses input through a strict zod schema, so handlers only ever
  see declared fields; a request-level sanitizer strips `$`-prefixed and dotted
  keys before that
- bcrypt password hashing, per-account lockout, uniform failure responses and
  timing so account existence cannot be probed
- JWT in an httpOnly cookie (never localStorage), with a token version that
  retires every existing session on password change
- An Origin check on state-changing admin requests, as a CSRF backstop for
  split-domain deployments where SameSite cannot help
- Stripe webhook signature verification enforced; raw body preserved for it
- Uploads validated by magic bytes, not by declared type or file extension
- Admin-supplied iCal URLs are checked against private address space before the
  server fetches them (SSRF)
- Admin search input is regex-escaped
- No stack traces or driver errors reach the client in production; logs redact
  secrets and tokens
- `npm audit`: 0 vulnerabilities in both apps
- Guest portal tokens stored hashed; arrival details gated server-side and
  proven absent from the payload by test
- Rental agreement acceptance records the version signed, so editing the terms
  later cannot retroactively change what a guest agreed to

**Two things to do yourself:** create the Atlas user with `readWrite` scoped to
this database only (not `atlasAdmin`), and turn on database backups before you
take real money. Both are covered in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Content

Everything editable lives in MongoDB and is managed at `/admin` — no redeploy to
change a word:

- **Content pages** (`stay`, `experiences`, `the-land`, `local-guide`,
  `garden-of-erin`) are composed of typed blocks: text, image+text, full-width
  image, quote, card grid, image grid, list, call to action, spacer
- **Properties** — copy, pricing, photos, amenities, policies, iCal feeds
- **Animals** and **Experiences** — full CRUD
- **Gallery & media** — upload, describe, reorder

`npm run seed` is idempotent and restores the shipped copy without duplicating
anything or touching bookings.

## Photography

The site ships with **placeholder photography** in `client/public/media/`,
fetched from Wikimedia Commons and filtered to licences that permit commercial
use and derivative works.

> These photographs show other people's properties, animals and gardens. They
> are here so the site can be reviewed and demonstrated with real imagery.
> **Replace them before taking bookings.** Every file, its author and its
> licence are listed in `client/public/media/ATTRIBUTION.md`; files under CC BY
> or CC BY-SA require that attribution to be reproduced while they remain on
> the site.

```bash
node scripts/fetch-media.mjs              # fill anything missing
node scripts/fetch-media.mjs --force      # re-fetch everything
node scripts/fetch-media.mjs --only local # just one group
node scripts/contact-sheet.mjs            # review the whole set as one image
```

Search terms live in the `SLOTS` table at the top of `scripts/fetch-media.mjs`;
each slot has a specific query plus broader fallbacks, and images are
cover-cropped to exact dimensions with ffmpeg.

### Replacing them with the real thing

Overwrite the files in `client/public/media/` keeping the same names, or upload
through `/admin → Gallery & media` and paste the URLs in. Nothing in the code
needs to change. Shapes to match:

| Slot | Shape | Size |
| --- | --- | --- |
| Page heroes | 16:9 | 2400×1350 |
| Animal portraits | 4:5 | 1200×1500 |
| Experience / guide cards | 4:3 | 1400×1050 |
| Gallery | mixed | 1400–1600 wide |
| `og-cover.jpg` | 1.91:1 | 1200×630 |

### The hero video

`client/public/media/hero.mp4` is deliberately **not** included — no stock clip
would honestly represent this farm, and the still poster already carries a slow
cinematic zoom in CSS, so its absence is not a visible gap.

When you have footage: 1920×1080 H.264, under ~8 MB, **no audio track**, and a
poster frame at `home/hero-poster.jpg`. It is only requested on desktop, on a
connection that has not asked to save data, and never under reduced motion.

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** — Atlas, Stripe, Render, Vercel, DNS, and
a post-deploy smoke test to work through with a real card.

## Notes

- `bcryptjs` rather than `bcrypt`: identical algorithm, pure JS, no native build
  step to fail on a deploy host.
- Nodemailer over SMTP rather than a provider SDK, so switching between Resend,
  Postmark, SendGrid or Mailgun is four environment variables.
