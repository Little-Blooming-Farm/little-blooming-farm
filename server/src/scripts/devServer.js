/**
 * Run the whole API against a throwaway in-memory MongoDB, seeded with the
 * shipped content.
 *
 *   npm run dev:demo
 *
 * Nothing is persisted — the database disappears when the process exits. This
 * exists so the site can be run end to end before Atlas and Stripe are set up.
 * Payments hit a local Stripe double, so "Continue to payment" will not charge
 * anything and will not produce a real Checkout page.
 */
import http from 'node:http';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const DEMO_ADMIN = { email: 'owner@littlebloomingfarm.test', password: 'blooming-farm-demo' };

// --- Local Stripe double ----------------------------------------------------
/**
 * Stands in for Stripe Checkout, including the page itself.
 *
 * The first version of this returned the confirmation URL directly, which meant
 * "Continue to payment" silently skipped the entire payment step and landed on a
 * page waiting for a webhook that never came. That is not a useful demo — it
 * looks broken, and it hides the most important part of the flow.
 *
 * So this serves a real (fake) checkout page, and "Pay" delivers a properly
 * signed webhook to our own endpoint exactly as Stripe would. Everything
 * downstream — confirmation, portal link, emails — is then the genuine code
 * path, not a shortcut around it.
 */
import Stripe from 'stripe';

const sessions = new Map();
let sessionCounter = 0;

const money = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const checkoutPage = (session) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo checkout — The Little Blooming Farm</title>
<style>
  body{margin:0;background:#f6f9fc;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1f36}
  .wrap{max-width:460px;margin:0 auto;padding:48px 24px}
  .banner{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:14px 16px;border-radius:8px;font-size:14px;margin-bottom:28px}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.07);padding:28px}
  h1{font-size:19px;margin:0 0 4px}
  .muted{color:#697386;font-size:14px;margin:0 0 22px}
  .row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid #e6e6e6;font-size:15px}
  .row:last-of-type{border:0;font-weight:600;font-size:17px}
  .wallet{width:100%;background:#000;color:#fff;border:0;border-radius:8px;padding:14px;font-size:16px;font-weight:600;margin:22px 0 10px;cursor:pointer}
  .pay{width:100%;background:#635bff;color:#fff;border:0;border-radius:8px;padding:14px;font-size:16px;font-weight:600;cursor:pointer}
  .cancel{display:block;text-align:center;margin-top:16px;color:#697386;font-size:14px}
  .rule{display:flex;align-items:center;gap:12px;color:#8792a2;font-size:13px;margin:18px 0}
  .rule::before,.rule::after{content:"";flex:1;height:1px;background:#e6e6e6}
</style></head>
<body><div class="wrap">
  <div class="banner">
    <strong>Demo checkout.</strong> This page stands in for Stripe so you can walk the
    whole flow locally. No card is taken and nothing is charged. With real Stripe keys
    you would see checkout.stripe.com here, with Apple&nbsp;Pay at the top.
  </div>
  <div class="card">
    <h1>The Little Blooming Farm</h1>
    <p class="muted">${session.description}</p>
    ${session.lines.map((l) => `<div class="row"><span>${l.name}</span><span>${money(l.amount)}</span></div>`).join('')}
    <div class="row"><span>Total due today</span><span>${money(session.amountTotal)}</span></div>
    <button class="wallet" onclick="location.href='/checkout/${session.id}/pay'">&#63743;&nbsp; Pay</button>
    <div class="rule">Or pay with card</div>
    <button class="pay" onclick="location.href='/checkout/${session.id}/pay'">Pay ${money(session.amountTotal)}</button>
    <a class="cancel" href="/checkout/${session.id}/cancel">&larr; Back to the farm</a>
  </div>
</div></body></html>`;

const stripeMock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  // ---- The fake Checkout page --------------------------------------------
  const page = url.pathname.match(/^\/checkout\/([^/]+)$/);
  if (req.method === 'GET' && page) {
    const session = sessions.get(page[1]);
    if (!session) {
      res.statusCode = 404;
      return res.end('Unknown session');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(checkoutPage(session));
  }

  // ---- "Paying": deliver a genuinely signed webhook, then redirect --------
  const pay = url.pathname.match(/^\/checkout\/([^/]+)\/pay$/);
  if (req.method === 'GET' && pay) {
    const session = sessions.get(pay[1]);
    if (!session) {
      res.statusCode = 404;
      return res.end('Unknown session');
    }

    const payload = JSON.stringify({
      id: `evt_demo_${Date.now()}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: session.id,
          object: 'checkout.session',
          payment_status: 'paid',
          payment_intent: `pi_demo_${Date.now()}`,
          client_reference_id: session.bookingId,
          metadata: { bookingId: session.bookingId, paymentId: session.paymentId },
        },
      },
    });

    const signature = new Stripe('sk_test_demo', {
      apiVersion: '2024-12-18.acacia',
    }).webhooks.generateTestHeaderString({ payload, secret: 'whsec_demo' });

    try {
      await fetch(`http://127.0.0.1:${process.env.PORT}/api/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
        body: payload,
      });
    } catch {
      /* the redirect below still shows the guest what happened */
    }

    res.statusCode = 302;
    res.setHeader('Location', session.successUrl.replace('{CHECKOUT_SESSION_ID}', session.id));
    return res.end();
  }

  const cancel = url.pathname.match(/^\/checkout\/([^/]+)\/cancel$/);
  if (req.method === 'GET' && cancel) {
    const session = sessions.get(cancel[1]);
    res.statusCode = 302;
    res.setHeader('Location', session?.cancelUrl ?? process.env.CLIENT_URL);
    return res.end();
  }

  // ---- Stripe REST surface ------------------------------------------------
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      sessionCounter += 1;
      const id = `cs_test_demo${String(sessionCounter).padStart(6, '0')}`;
      const params = new URLSearchParams(body);

      // Rebuild the line items so the fake page can show a real breakdown.
      const lines = [];
      let index = 0;
      while (params.has(`line_items[${index}][price_data][unit_amount]`)) {
        lines.push({
          name: params.get(`line_items[${index}][price_data][product_data][name]`) ?? 'Stay',
          amount: Number(params.get(`line_items[${index}][price_data][unit_amount]`)),
        });
        index += 1;
      }

      const session = {
        id,
        bookingId: params.get('client_reference_id'),
        paymentId: params.get('metadata[paymentId]'),
        successUrl: params.get('success_url'),
        cancelUrl: params.get('cancel_url'),
        description: params.get('payment_intent_data[description]') ?? '',
        lines,
        amountTotal: lines.reduce((sum, l) => sum + l.amount, 0),
      };
      sessions.set(id, session);

      return res.end(
        JSON.stringify({
          id,
          object: 'checkout.session',
          url: `http://127.0.0.1:${stripeMock.address().port}/checkout/${id}`,
          payment_status: 'unpaid',
          client_reference_id: session.bookingId,
        })
      );
    }

    if (req.method === 'GET' && /^\/v1\/checkout\/sessions\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/').pop();
      const session = sessions.get(id);
      return res.end(
        JSON.stringify({
          id,
          object: 'checkout.session',
          status: 'open',
          url: session ? `http://127.0.0.1:${stripeMock.address().port}/checkout/${id}` : null,
        })
      );
    }

    if (req.method === 'POST' && /\/expire$/.test(url.pathname)) {
      return res.end(JSON.stringify({ status: 'expired' }));
    }
    if (req.method === 'POST' && url.pathname === '/v1/refunds') {
      return res.end(JSON.stringify({ id: 're_test_demo', status: 'succeeded' }));
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: { message: 'not implemented in the demo Stripe double' } }));
  });
});

await new Promise((resolve) => stripeMock.listen(0, '127.0.0.1', resolve));

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.PORT = process.env.PORT ?? '4000';
process.env.CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';
process.env.SERVER_URL = process.env.SERVER_URL ?? `http://localhost:${process.env.PORT}`;
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:5173';
process.env.MONGODB_URI = replSet.getUri('little_blooming_farm_demo');
process.env.JWT_SECRET = 'demo-only-secret-not-for-production-0000000000';
process.env.STRIPE_SECRET_KEY = 'sk_test_demo';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_demo';
process.env.STRIPE_API_BASE = `http://127.0.0.1:${stripeMock.address().port}`;
process.env.ICAL_SYNC_ENABLED = 'false';

const { connectDatabase } = await import('../config/db.js');
const { createApp } = await import('../app.js');
const { Property } = await import('../models/Property.js');
const { Animal } = await import('../models/Animal.js');
const { Experience } = await import('../models/Experience.js');
const { ContentPage } = await import('../models/ContentPage.js');
const { Media } = await import('../models/Media.js');
const { Admin } = await import('../models/Admin.js');
const { Booking } = await import('../models/Booking.js');
const seed = await import('./seedData.js');

await connectDatabase();

await Property.create(seed.properties);
await Animal.create(seed.animals);
await Experience.create(seed.experiences);
await ContentPage.create(seed.contentPages);
await Media.create(
  seed.gallery.map((item) => ({
    url: item.url,
    thumbnailUrl: item.url,
    type: 'image',
    alt: item.alt,
    caption: item.alt,
    collectionName: 'gallery',
    order: item.order,
    provider: 'local',
  }))
);
await Admin.create({
  email: DEMO_ADMIN.email,
  passwordHash: await Admin.hashPassword(DEMO_ADMIN.password),
  role: 'owner',
});

/**
 * A confirmed demo booking with an outstanding balance, so the guest portal is
 * reachable immediately. It is created through the same service the public API
 * uses and settled through the real webhook path, so what you see is the actual
 * flow rather than a fixture shaped to look like one.
 */
const { createPendingBooking, settlePaidSession } = await import('../services/bookingService.js');
const { hashToken } = await import('../lib/tokens.js');

const demoDate = (offset) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const theHome = await Property.findOne({ slug: 'the-home' });
const { booking: demoBooking } = await createPendingBooking({
  propertyId: theHome._id,
  guestName: 'Ada Lovelace',
  guestEmail: 'ada@example.com',
  guestPhone: '+1 805 555 0100',
  guests: 4,
  message: 'Two children and a hopeful dog.',
  checkIn: demoDate(120),
  checkOut: demoDate(125),
});

await settlePaidSession({
  id: demoBooking.payments[0].stripeSessionId,
  payment_status: 'paid',
  payment_intent: 'pi_demo_deposit',
  client_reference_id: demoBooking._id.toString(),
  metadata: {
    bookingId: demoBooking._id.toString(),
    paymentId: demoBooking.payments[0]._id.toString(),
  },
});

const DEMO_TOKEN = `demo${'0'.repeat(36)}`;
await Booking.updateOne(
  { _id: demoBooking._id },
  { $set: { cancellationToken: hashToken(DEMO_TOKEN) } }
);
const settled = await Booking.findById(demoBooking._id);

const app = createApp();
app.listen(Number(process.env.PORT), () => {
  console.log(`
  ────────────────────────────────────────────────────────────
   The Little Blooming Farm — DEMO MODE
  ────────────────────────────────────────────────────────────
   API          http://localhost:${process.env.PORT}
   Site         ${process.env.CLIENT_URL}   (run: npm --prefix client run dev)

   Admin login  ${DEMO_ADMIN.email}
                ${DEMO_ADMIN.password}

   Guest portal (confirmed booking, balance outstanding)
   ${process.env.CLIENT_URL}/booking/manage/${DEMO_TOKEN}
   deposit paid $${(settled.amountPaidCents() / 100).toFixed(2)} · balance $${(settled.balanceDueCents() / 100).toFixed(2)}

   The database is in memory and is wiped on exit.
   Stripe is a local double — no real payment page, no charges.
  ────────────────────────────────────────────────────────────
`);
});

const shutdown = async () => {
  stripeMock.close();
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
