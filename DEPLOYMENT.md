# Deploying The Little Blooming Farm

Two deployables:

| Piece | Lives in | Goes to | Address |
| --- | --- | --- | --- |
| React site | `/client` | Netlify (or Vercel) | `www.thelittlebloomingfarm.com` |
| Express API | `/server` | Render (or Railway) | `api.thelittlebloomingfarm.com` |
| Database | — | MongoDB Atlas | — |
| Images & video | — | Cloudinary | — |

> **Put the API on a subdomain of the site's own domain.** The admin session is
> an httpOnly cookie. If the site is on `thelittlebloomingfarm.com` and the API
> is on `lbf-api.onrender.com`, that cookie is third-party — the browser will
> not send it, and admin login will appear to succeed and then immediately drop
> you back to the login screen. The API refuses to boot in production if this is
> misconfigured, and tells you exactly what to change.
>
> If you genuinely cannot use a subdomain, set `COOKIE_SAMESITE=none` and accept
> that some browsers block third-party cookies outright.

---

## 0. Prerequisites

```bash
node --version   # 20–24; the repo pins 24 via .node-version
npm --version
```

Node is pinned to the 24 LTS line in `.node-version` and `engines`. Without a
pin, hosts pick the newest release available — Render reached for Node 26,
which is ahead of anything this has been verified against.

Accounts needed: GitHub, MongoDB Atlas, Stripe, Render, Netlify, Cloudinary, and
an SMTP provider (Resend, Postmark, SendGrid, Mailgun — any of them).

---

## 1. Get it running locally

```bash
git clone <your-repo-url> little-blooming-farm
cd little-blooming-farm
npm run install:all
```

### Try it before configuring anything

There is a demo mode that runs the whole site against a throwaway in-memory
database and a local Stripe stand-in — no Atlas, no Stripe keys:

```bash
npm --prefix server run dev:demo
```

In a second terminal:

```bash
npm --prefix client run dev
```

Open http://localhost:5173. Admin is at `/admin` with the credentials the demo
prints. Nothing persists and no card is ever charged.

### Real local setup

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Generate a JWT secret and paste it into `server/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then seed the content and create your admin account:

```bash
npm --prefix server run seed
npm --prefix server run create-admin -- --email you@example.com
```

`create-admin` prints a generated password **once**. Save it in a password
manager. Run both processes with `npm run dev` from the repo root.

---

## 2. MongoDB Atlas

1. **Create a cluster.** atlas.mongodb.com → Build a Database → M0 is fine to
   start. Choose a region near your API region (Oregon pairs with Render's
   Oregon).
2. **Create a least-privilege user.** Database Access → Add New Database User.
   - Authentication: Password
   - Database User Privileges → **Specific Privileges**
   - Role `readWrite`, Database `little_blooming_farm`

   Do **not** grant `atlasAdmin` or `readWriteAnyDatabase`. The app only ever
   touches its own database, and a leaked connection string should not be able
   to reach anything else.
3. **Network access.** Network Access → Add IP Address.
   - Render: add Render's outbound static IPs (Render dashboard → your service →
     Connect → Outbound). Adding `0.0.0.0/0` works but means the only thing
     protecting your data is the password — prefer the static IPs.
4. **Connection string.** Connect → Drivers → copy, then substitute the password
   and add the database name:

   ```
   mongodb+srv://lbf_app:<password>@cluster0.xxxxx.mongodb.net/little_blooming_farm?retryWrites=true&w=majority
   ```

   Any Atlas cluster is a replica set, which is what lets the booking path run
   its availability check and its insert inside a real transaction.

---

## 3. Stripe

### During development

1. Dashboard → **Test mode** on.
2. Developers → API keys → copy the **secret** key (`sk_test_…`) into
   `STRIPE_SECRET_KEY`. The publishable key is not needed — this app uses
   Stripe-hosted Checkout, so no card details ever touch our code.
3. Forward webhooks to your machine:

   ```bash
   stripe login
   stripe listen --forward-to localhost:4000/api/webhooks/stripe
   ```

   That prints a `whsec_…` — put it in `STRIPE_WEBHOOK_SECRET`.

   Leave `stripe listen` running. **Without it, bookings stay `pending`
   forever**, because confirmation only ever happens via the webhook. That is
   deliberate: the browser redirect after payment is not treated as proof.

4. Test cards: `4242 4242 4242 4242`, any future expiry, any CVC.

### Before launch

1. Developers → Webhooks → **Add endpoint**
   - URL: `https://api.thelittlebloomingfarm.com/api/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `charge.refunded`
2. Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on Render.
   **The live-mode secret is different from the test-mode one.**
3. Switch the dashboard to live mode, copy the live `sk_live_…` into
   `STRIPE_SECRET_KEY`.

   The API refuses to start in production with a test key, so a half-finished
   switch fails loudly at deploy rather than quietly taking fake payments.

---

## 4. Email

> **Use the HTTP API, not SMTP.** Many hosts block outbound SMTP ports: Render's
> free tier blocks 25, 465 **and** 587, and port 25 is blocked on every Render
> plan. The symptom is not an error but a hang — the connection sits open until
> it times out:
>
> ```
> Email transport check failed … {"error":"timed out after 15s"}
> ```
>
> Setting `RESEND_API_KEY` sends over HTTPS instead, which no host blocks.

1. resend.com → **Domains** → add your domain and add the DKIM/SPF records it
   gives you at SiteGround. Unverified senders get rejected or spam-filed.
2. **API Keys** → create one with send permission.
3. Set:

   ```
   RESEND_API_KEY=<your key>
   MAIL_FROM="The Little Blooming Farm <stay@thelittlebloomingfarm.com>"
   OWNER_NOTIFICATION_EMAIL=you@example.com
   ```

   `MAIL_FROM` must be on the domain you verified.

### If you would rather use SMTP

Leave `RESEND_API_KEY` blank and set the SMTP block instead. On Render this
requires a **paid** instance, and `SMTP_SECURE` must match the port — `true`
for 465, `false` for 587.

   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend          # the literal word, not your email
   SMTP_PASS=<your API key>
   ```

`MAIL_FROM` must be on a domain you have verified, or the mail will be rejected
or land in spam. The server verifies the SMTP connection at boot and logs the
result, so a bad password shows up in the deploy log rather than silently
swallowing every confirmation email.

---

## 5. Cloudinary (images & video)

1. cloudinary.com → Dashboard → copy **Cloud name**, **API Key**, **API Secret**.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

These are required in production — the server will not boot without them.
Render's disk is ephemeral, so local-disk uploads would silently vanish on the
next deploy. In local development they can be left blank and uploads fall back
to `server/uploads/`.

---

## 6. Deploy the API to Render

### Using the blueprint (recommended)

1. Push the repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml`.
3. Edit the non-secret values in `render.yaml` first — `CLIENT_URL`,
   `SERVER_URL`, `CORS_ORIGINS`, `COOKIE_DOMAIN` — to your real domain.
4. Render prompts for every secret (`sync: false`). Paste them in.
5. Deploy.

### Manually instead

> **The one setting people miss: Root Directory.** A hand-made Web Service
> defaults to building the repo *root* with `npm install; npm run build`. This
> is a two-app repo, so that installs only the root's own tooling and then dies
> with:
>
> ```
> sh: 1: vite: not found
> ==> Build failed 😞   (exit status 127)
> ```
>
> 127 means "command not found" — vite was never installed, because the root
> install never touched `client/`. Set Root Directory and it goes away.

Render → New → Web Service → connect the repo, then:

| Setting | Value |
| --- | --- |
| **Root Directory** | **`server`** |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Add every variable from `server/.env.example` under Environment.

### Hosting the front end on Render too

Optional — Vercel and Netlify are both fine. If you would rather keep
everything on Render, the blueprint already defines it: Render → New → Static
Site, or let the Blueprint create `lbf-site`.

| Setting | Value |
| --- | --- |
| **Root Directory** | **`client`** |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Rewrite rule | `/*` → `/index.html` (needed, or deep links 404 on refresh) |

Set `VITE_API_BASE_URL` to your API's URL. Static sites are free on Render.

### Railway instead of Render

Railway → New Project → Deploy from GitHub. Set **Root Directory** `server`,
build `npm ci`, start `npm start`, and add the same variables. Railway assigns
`PORT` automatically.

### After the first deploy

Seed the content and create the owner account using Render's **Shell** tab
(Starter plan and above):

```bash
npm run seed
npm run create-admin -- --email you@example.com
```

No shell available (free tier)? Run them from your machine against the
production database instead — temporarily point `MONGODB_URI` in your local
`server/.env` at Atlas, run the two commands, then put it back.

---

## 7. Deploy the site to Netlify

1. Netlify → **Add new site → Import an existing project** → pick the repo.
2. Netlify reads **`netlify.toml` at the repository root**, which already sets
   everything:

   | Setting | Value | Set by |
   | --- | --- | --- |
   | Base directory | `client` | `netlify.toml` |
   | Build command | `npm ci && npm run build` | `netlify.toml` |
   | Publish directory | `client/dist` | `netlify.toml` |
   | Node version | 24 | `netlify.toml` + `client/.node-version` |

   > The config file must stay at the **repo root**. Netlify does not read a
   > `netlify.toml` inside the base directory — a copy in `client/` is silently
   > ignored, and you lose the SPA redirect and every security header with it.

3. **Site configuration → Environment variables**:

   ```
   VITE_API_BASE_URL   = https://api.thelittlebloomingfarm.com
   VITE_CONTACT_EMAIL  = stay@thelittlebloomingfarm.com
   VITE_WHATSAPP_NUMBER = 18055550100
   ```

   Anything prefixed `VITE_` is compiled into the JavaScript bundle and is
   **public**. Never put a secret key there.

4. Deploy. Every push to `main` rebuilds automatically.

Deep links survive a refresh through two independent mechanisms: the redirect
rule in `netlify.toml`, and `client/public/_redirects`, which ships inside the
build output. Either alone is enough; both is deliberate, because a guest's
`/booking/manage/<token>` link 404-ing is the worst failure this site has.

### ⚠️ The `netlify.app` subdomain will break admin login

Until you attach your own domain, the site is on `something.netlify.app` and the
API on `something.onrender.com`. Those are **different registrable domains**, so
the admin session cookie is third-party — the browser refuses to send it, and
`/admin` login appears to succeed then bounces you straight back.

The API refuses to boot in that configuration rather than misbehave, and tells
you which variable to change. Two ways forward:

- **Recommended:** attach `www.thelittlebloomingfarm.com` to Netlify and
  `api.thelittlebloomingfarm.com` to Render. Same registrable domain, so
  `COOKIE_SAMESITE=lax` works and the cookie stays first-party.
- **Interim, for testing on the free subdomains:** set `COOKIE_SAMESITE=none` on
  Render. Works today, but some browsers block third-party cookies outright, so
  it is not a launch configuration.

Either way, `CORS_ORIGINS` on Render must list the exact origin the site is
served from — including `https://` and any `www.`. A missing entry shows up as
a CORS error in the browser console and an empty page.

### Vercel instead

`client/vercel.json` is still in the repo and configures the same thing. Import
the project, **set Root Directory to `client`**, and add the same `VITE_`
variables. The two config files do not conflict; each host reads only its own.

---

## 8. Domain and SSL

Assuming the domain is `thelittlebloomingfarm.com`:

### Front end

Vercel → Project → Settings → Domains → add `www.thelittlebloomingfarm.com` and
`thelittlebloomingfarm.com`. Vercel shows the exact records; typically:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

### API

Render → your service → Settings → Custom Domain → add
`api.thelittlebloomingfarm.com`, then at your DNS host:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `api` | `lbf-api.onrender.com` |

### SSL

Both platforms issue and renew Let's Encrypt certificates automatically once DNS
resolves — usually a few minutes, occasionally up to an hour.

### Then update these, or nothing will work

- Render: `CLIENT_URL`, `SERVER_URL`, `CORS_ORIGINS`, `COOKIE_DOMAIN`
- Vercel: `VITE_API_BASE_URL`
- Stripe: the webhook endpoint URL
- Airbnb / VRBO: the outbound feed URL (see below)

Redeploy both after changing environment variables — neither platform picks them
up without one.

---

## 9. Connect the OTA calendars

For each property, in `/admin → Properties → Edit settings`:

**Import from them.** Paste the export URLs:
- Airbnb: Listing → Availability → Sync calendars → Export calendar
- VRBO: Calendar → Import/Export → Export

**Export to them.** The page shows this property's feed URL:

```
https://api.thelittlebloomingfarm.com/api/properties/<id>/calendar.ics
```

Give that to Airbnb ("Import calendar") and VRBO so they block nights booked
here. The feed contains dates only — no guest names, no amounts.

Syncing runs every 30 minutes (`ICAL_SYNC_CRON`). "Sync calendars now" runs it
on demand. Imported blocks reconcile by their calendar UID, so re-syncing
updates in place and never touches blocks you created by hand.

> OTA calendars are polled, not pushed — every platform in this market has a
> sync window of tens of minutes. Overlap during that window is prevented for
> *direct* bookings by the locking described in the README, but a guest booking
> on Airbnb at the same moment as a guest booking here can still collide. Keep
> the sync interval short and check the dashboard.

---

## 10. Post-deploy smoke test

Work through this in order on the real, live site.

### Reachability
- [ ] `https://api.thelittlebloomingfarm.com/api/health` returns `{"status":"ok"}`
- [ ] `https://www.thelittlebloomingfarm.com` loads with the hero
- [ ] `https://api.thelittlebloomingfarm.com/api/properties` returns both homes
- [ ] Browser console is clean — no CORS errors (if you see them, `CORS_ORIGINS`
      is missing that exact origin, including `www.`)

### A real booking, with a real charge
Do this once, with real keys, and refund it afterwards. Temporarily set the
nightly rate to $1 in `/admin → Properties` so the test costs cents.

- [ ] `/book` shows both homes with independent calendars
- [ ] Already-booked nights are struck through and unclickable
- [ ] Selecting dates updates the total (nights × rate + cleaning fee)
- [ ] "Continue to payment" opens Stripe Checkout on `checkout.stripe.com`
- [ ] Pay with a real card
- [ ] You land on `/booking/confirmed` and it settles to "Your stay is booked"
      within a few seconds
- [ ] Stripe → Developers → Webhooks shows `checkout.session.completed`
      delivered with a **200**
- [ ] Confirmation email arrives (check spam once, then fix SPF/DKIM if needed)
- [ ] `/admin → Bookings` shows it as **confirmed** with the payment recorded
- [ ] Those dates are now blocked on `/book`
- [ ] `/api/properties/<id>/calendar.ics` includes the new dates and **no guest name**

### Webhook failure mode
- [ ] Stripe → Webhooks → your endpoint → **Send test webhook** → a 200 comes back
- [ ] Start a booking, then close the Stripe page without paying. The booking
      should not appear as confirmed, and the dates should free up within
      `BOOKING_HOLD_MINUTES`

### The guest portal
- [ ] Open the manage link from the confirmation email
- [ ] It shows the reservation, the payment schedule, the rental agreement and
      a locked arrival-details section
- [ ] Sign the agreement by typing the booking name — a wrong name is refused
- [ ] `/admin → Bookings → (the booking)` shows the signature, its version and
      the IP it came from

### Deposits and balances
Guests choose 25 / 50 / 75% or pay in full. Edit the offered options under
`/admin → Properties → Payment schedule`; leave the list blank to remove the
choice entirely.
- [ ] A stay booked further ahead than the balance window shows the chooser with
      four priced options
- [ ] Picking a different option re-prices "pay X today, the rest by <date>"
- [ ] The stay total is identical whichever option is picked
- [ ] Checkout charges only the deposit
- [ ] The portal shows the balance outstanding and a **Pay now** button
- [ ] Paying the balance settles it; Stripe shows two separate PaymentIntents
- [ ] Arrival details stay locked until the balance is paid **and** check-in is
      within `arrivalInfoReleaseDays`

### Apple Pay
- [ ] Open `/book` on an iPhone or a Mac with Safari — the Apple Pay mark
      appears above the payment button
- [ ] Stripe Checkout shows the Apple Pay button full-width, above the card form
- [ ] Complete one real booking with Apple Pay and refund it

      If the wallet button does not appear on Checkout: Stripe Dashboard →
      Settings → Payment methods → make sure Apple Pay and Google Pay are
      enabled for the **live** account. No Apple domain registration is needed
      for hosted Checkout.

### Cancellation
- [ ] Open the manage link from the confirmation email
- [ ] It shows the booking and the refund you would receive today
- [ ] Cancel it
- [ ] Stripe shows the refund; the cancellation email arrives; the dates are
      bookable again
- [ ] Reload the manage link — cancelling twice is refused

### Admin
- [ ] `/admin` redirects to the login form
- [ ] Wrong password is refused; eight wrong attempts locks the account 15 minutes
- [ ] Correct password signs you in and the dashboard shows real numbers
- [ ] Sign out, then reload `/admin` — you are signed out (session cookie cleared)
- [ ] Block dates manually → they grey out on the public calendar
- [ ] Edit a content page → the change is live on refresh, no redeploy
- [ ] Upload a photo in Gallery & media → it appears on `/gallery`

### Airbnb / VRBO sync
- [ ] Paste the real Airbnb export URL → "Sync calendars now" reports events found
- [ ] Those dates appear in terracotta on `/admin → Calendar & blocks`
- [ ] They are blocked on the public `/book` calendar
- [ ] Try to book one of those nights directly — it must be refused
- [ ] Sync again — no duplicates, and your manual blocks are untouched
- [ ] Give Airbnb your outbound feed URL, book a night here, then check it
      appears as blocked on Airbnb after their next import

> **Know the limit.** Airbnb offers iCal export only — there is no push or
> webhook outside their partner API. A night booked on Airbnb is blocked here
> within one `ICAL_SYNC_CRON` interval, not instantly. That interval is your
> exposure window for a cross-platform clash; this site's own bookings are never
> double-booked regardless.

### Finally
- [ ] Refund the test charge in Stripe
- [ ] Put the real nightly rate back
- [ ] Delete the test booking, or leave it cancelled

### Before you advertise the site

- [ ] **Replace the placeholder photography.** The images in
      `client/public/media/` are licensed stock from Wikimedia Commons showing
      other people's properties and animals. Selling stays using them is
      misleading, regardless of the licence. See
      `client/public/media/ATTRIBUTION.md`.
- [ ] While any remain, keep `ATTRIBUTION.md` published or linked — CC BY and
      CC BY-SA files require credit wherever they appear.
- [ ] Delete `ATTRIBUTION.md` and `CREDITS.json` once every placeholder is gone.

---

## 11. Running it

**Logs.** Render → Logs. Structured JSON in production; secrets and tokens are
redacted before anything is written.

**Backups.** Atlas → Backup. On M0 there are no automated backups — either move
to M10+ or schedule `mongodump` somewhere. Do this before you take real money.

**Uptime.** Point any monitor at `/api/health`. On Render's free tier the
service sleeps, which delays Stripe webhooks and can time out the confirmation
page; use Starter or above for anything real.

**Rotating a password.** `npm run create-admin -- --email you@example.com --reset`
invalidates every existing session as well as changing the password.

**Stuck pending bookings.** They release themselves after
`BOOKING_HOLD_MINUTES`. To clear them immediately, POST
`/api/admin/maintenance/release-holds` while signed in.
