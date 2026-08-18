/**
 * End-to-end verification against a real MongoDB replica set (in-memory) and a
 * local Stripe double.
 *
 *   npm run verify
 *
 * This is not a substitute for the post-deploy smoke test in DEPLOYMENT.md —
 * it is the check that the *logic* is sound: overlap maths, the race guard,
 * webhook-only confirmation, auth, and input validation.
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// --- Environment must be set before any app module is imported --------------
const stripeMock = await startStripeMock();
const icalMock = await startIcalMock();
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });

process.env.NODE_ENV = 'test';
process.env.PORT = '4999';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.SERVER_URL = 'http://localhost:4999';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.MONGODB_URI = replSet.getUri('little_blooming_farm_test');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-000000';
process.env.STRIPE_SECRET_KEY = 'sk_test_verify';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_verify_secret';
process.env.STRIPE_API_BASE = `http://127.0.0.1:${stripeMock.port}`;
process.env.BOOKING_HOLD_MINUTES = '35';
process.env.ICAL_SYNC_ENABLED = 'false';
process.env.ICAL_ALLOW_INSECURE_FEEDS = 'true';
process.env.SMTP_HOST = '';

const { connectDatabase, disconnectDatabase } = await import('../config/db.js');
const { createApp } = await import('../app.js');
const { Property } = await import('../models/Property.js');
const { Booking } = await import('../models/Booking.js');
const { Admin } = await import('../models/Admin.js');
const { hashToken } = await import('../lib/tokens.js');
const { stripe } = await import('../lib/stripe.js');
const { properties: seedProperties } = await import('./seedData.js');

// --- Tiny test harness ------------------------------------------------------
let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [32m✓[0m ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  [31m✗[0m ${name}`);
    console.log(`      ${err.message}`);
  }
}

function section(title) {
  console.log(`\n[1m${title}[0m`);
}

// --- Airbnb iCal double -----------------------------------------------------
/**
 * Serves a real Airbnb-format calendar. Airbnb exports whole-day VEVENTs with
 * `DTSTART;VALUE=DATE`, a `UID` ending @airbnb.com, and summaries of either
 * "Reserved" or "Airbnb (Not available)" — both of which must block.
 */
async function startIcalMock() {
  const state = { events: [] };

  const render = () =>
    [
      'BEGIN:VCALENDAR',
      'PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN',
      'CALSCALE:GREGORIAN',
      'VERSION:2.0',
      ...state.events.flatMap((e) => [
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${e.start.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${e.end.replace(/-/g, '')}`,
        `UID:${e.uid}`,
        `SUMMARY:${e.summary}`,
        'END:VEVENT',
      ]),
      'END:VCALENDAR',
      '',
    ].join('\r\n');

  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.end(render());
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, state, port: server.address().port };
}

// --- Stripe double ----------------------------------------------------------
async function startStripeMock() {
  let sessionCounter = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Request-Id', 'req_mock');

      if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
        sessionCounter += 1;
        const id = `cs_test_mock${String(sessionCounter).padStart(6, '0')}`;
        const params = new URLSearchParams(body);
        return res.end(
          JSON.stringify({
            id,
            object: 'checkout.session',
            url: `https://checkout.stripe.example/${id}`,
            payment_status: 'unpaid',
            client_reference_id: params.get('client_reference_id'),
            metadata: { bookingId: params.get('metadata[bookingId]') },
          })
        );
      }

      if (req.method === 'GET' && /^\/v1\/checkout\/sessions\/[^/?]+$/.test(req.url)) {
        const id = req.url.split('/').pop();
        return res.end(
          JSON.stringify({ id, object: 'checkout.session', status: 'open', url: `https://checkout.stripe.example/${id}` })
        );
      }

      if (req.method === 'POST' && /^\/v1\/checkout\/sessions\/[^/]+\/expire$/.test(req.url)) {
        return res.end(JSON.stringify({ id: 'cs_test', status: 'expired' }));
      }

      if (req.method === 'POST' && req.url === '/v1/refunds') {
        return res.end(JSON.stringify({ id: 're_test_mock', object: 'refund', status: 'succeeded' }));
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: `mock has no route for ${req.method} ${req.url}` } }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

// --- HTTP helper ------------------------------------------------------------
let baseUrl;
let cookieJar = '';

async function api(method, path, { body, headers = {}, raw = false } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(cookieJar ? { Cookie: cookieJar } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) {
    if (cookie.startsWith('lbf_admin_session=')) cookieJar = cookie.split(';')[0];
  }

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body: payload, headers: res.headers };
}

const iso = (daysFromToday) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

// --- Run --------------------------------------------------------------------
await connectDatabase();
const app = createApp();
const server = app.listen(4999);
await new Promise((resolve) => server.once('listening', resolve));
baseUrl = 'http://127.0.0.1:4999';

await Property.deleteMany({});
await Booking.deleteMany({});
await Admin.deleteMany({});
await Property.create(seedProperties);

const theHome = await Property.findOne({ slug: 'vicky' });

console.log('\n[1mThe Little Blooming Farm — verification[0m');

section('Public content');

await test('GET /api/health returns ok', async () => {
  const { status, body } = await api('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

await test('GET /api/properties lists both homes without private iCal URLs', async () => {
  const { status, body } = await api('GET', '/api/properties');
  assert.equal(status, 200);
  assert.equal(body.properties.length, 2);
  assert.ok(!('airbnbIcalUrl' in body.properties[0]), 'iCal URL must not be public');
});

await test('GET /api/properties/vicky resolves by slug', async () => {
  const { status, body } = await api('GET', '/api/properties/vicky');
  assert.equal(status, 200);
  assert.equal(body.property.slug, 'vicky');
});

await test('unknown property returns 404, not 500', async () => {
  const { status, body } = await api('GET', '/api/properties/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

section('Quoting & stay rules');

await test('valid quote prices nights × rate + cleaning fee', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: theHome._id.toString(), checkIn: iso(30), checkOut: iso(34), guests: 4 },
  });
  assert.equal(status, 200);
  assert.equal(body.available, true);
  assert.equal(body.quote.nights, 4);
  assert.equal(body.quote.accommodationCents, theHome.basePriceCents * 4);
  assert.equal(
    body.quote.totalPriceCents,
    theHome.basePriceCents * 4 + theHome.cleaningFeeCents
  );
});

await test('one night is rejected by the two-night minimum', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: theHome._id.toString(), checkIn: iso(30), checkOut: iso(31), guests: 2 },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'MIN_NIGHTS');
});

await test('past arrival dates are rejected', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: theHome._id.toString(), checkIn: iso(-3), checkOut: iso(3), guests: 2 },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'PAST_DATE');
});

await test('over-capacity party is rejected', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: theHome._id.toString(), checkIn: iso(30), checkOut: iso(33), guests: 25 },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'TOO_MANY_GUESTS');
});

await test('check-out before check-in is rejected', async () => {
  const { status } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: theHome._id.toString(), checkIn: iso(40), checkOut: iso(35), guests: 2 },
  });
  assert.equal(status, 400);
});

section('Input validation & injection');

await test('operator injection in propertyId is rejected', async () => {
  const { status } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: { $ne: null }, checkIn: iso(30), checkOut: iso(33), guests: 2 },
  });
  assert.equal(status, 400);
});

await test('unknown body fields are rejected outright', async () => {
  const { status } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(30),
      checkOut: iso(33),
      guests: 2,
      totalPriceCents: 1,
    },
  });
  assert.equal(status, 400);
});

await test('malformed date strings are rejected', async () => {
  const { status } = await api('POST', '/api/bookings/quote', {
    body: { propertyId: theHome._id.toString(), checkIn: '2026-02-31', checkOut: iso(33), guests: 2 },
  });
  assert.equal(status, 400);
});

section('Booking creation');

const bookingDates = { checkIn: iso(60), checkOut: iso(65) };
let firstBookingId;

await test('creating a booking returns a Stripe Checkout URL and stays pending', async () => {
  const { status, body } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      ...bookingDates,
      guests: 4,
      guestName: 'Ada Lovelace',
      guestEmail: 'ada@example.com',
      guestPhone: '+1 805 555 0100',
      message: 'Bringing two children and a dog-shaped hope.',
      acceptedTerms: true,
    },
  });
  assert.equal(status, 201);
  assert.match(body.checkoutUrl, /^https:\/\/checkout\.stripe\.example\//);
  firstBookingId = body.bookingId;

  const stored = await Booking.findById(firstBookingId).lean();
  assert.equal(stored.status, 'pending', 'a new booking must never start confirmed');
  assert.ok(stored.holdExpiresAt > new Date());
});

await test('terms must be accepted', async () => {
  const { status } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(200),
      checkOut: iso(203),
      guests: 2,
      guestName: 'Grace Hopper',
      guestEmail: 'grace@example.com',
      acceptedTerms: false,
    },
  });
  assert.equal(status, 400);
});

await test('overlapping dates are refused while the hold is live', async () => {
  const { status, body } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(62),
      checkOut: iso(67),
      guests: 2,
      guestName: 'Alan Turing',
      guestEmail: 'alan@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'DATES_UNAVAILABLE');
});

await test('same-day turnover is allowed (checkout day is not a booked night)', async () => {
  const { status } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(65),
      checkOut: iso(68),
      guests: 2,
      guestName: 'Katherine Johnson',
      guestEmail: 'katherine@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(status, 201, 'a stay starting on another stay’s checkout day must succeed');
});

await test('the other property is unaffected by the first one being booked', async () => {
  const guestHouse = await Property.findOne({ slug: 'the-barn' });
  const { status } = await api('POST', '/api/bookings', {
    body: {
      propertyId: guestHouse._id.toString(),
      ...bookingDates,
      guests: 2,
      guestName: 'Mary Jackson',
      guestEmail: 'mary@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(status, 201);
});

section('Race conditions');

await test('16 simultaneous requests for identical dates produce exactly one booking', async () => {
  const dates = { checkIn: iso(120), checkOut: iso(125) };

  const attempts = Array.from({ length: 16 }, (_, i) =>
    api('POST', '/api/bookings', {
      body: {
        propertyId: theHome._id.toString(),
        ...dates,
        guests: 2,
        guestName: `Racer ${i}`,
        guestEmail: `racer${i}@example.com`,
        acceptedTerms: true,
      },
    })
  );

  const results = await Promise.all(attempts);
  const created = results.filter((r) => r.status === 201);
  const rejected = results.filter((r) => r.status === 409);

  assert.equal(created.length, 1, `expected exactly 1 winner, got ${created.length}`);
  assert.equal(rejected.length, 15, `expected 15 conflicts, got ${rejected.length}`);

  const persisted = await Booking.countDocuments({
    propertyId: theHome._id,
    status: { $ne: 'cancelled' },
    checkIn: { $lt: new Date(`${dates.checkOut}T00:00:00Z`) },
    checkOut: { $gt: new Date(`${dates.checkIn}T00:00:00Z`) },
  });
  assert.equal(persisted, 1, `database holds ${persisted} overlapping bookings`);
});

await test('16 simultaneous requests for staggered overlapping ranges leave no overlap', async () => {
  const attempts = Array.from({ length: 16 }, (_, i) =>
    api('POST', '/api/bookings', {
      body: {
        propertyId: theHome._id.toString(),
        checkIn: iso(200 + i),
        checkOut: iso(204 + i),
        guests: 2,
        guestName: `Overlap ${i}`,
        guestEmail: `overlap${i}@example.com`,
        acceptedTerms: true,
      },
    })
  );

  await Promise.all(attempts);

  const rows = await Booking.find({
    propertyId: theHome._id,
    status: { $ne: 'cancelled' },
    checkIn: { $gte: new Date(`${iso(195)}T00:00:00Z`) },
  })
    .sort({ checkIn: 1 })
    .select('checkIn checkOut')
    .lean();

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(
      rows[i].checkIn >= rows[i - 1].checkOut,
      `overlap between ${rows[i - 1].checkIn.toISOString()}–${rows[i - 1].checkOut.toISOString()} and ${rows[i].checkIn.toISOString()}–${rows[i].checkOut.toISOString()}`
    );
  }
});

section('Stripe webhook');

await test('a webhook with no signature is rejected', async () => {
  const { status } = await api('POST', '/api/webhooks/stripe', {
    body: JSON.stringify({ type: 'checkout.session.completed' }),
    raw: true,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(status, 400);
});

await test('a webhook with a forged signature is rejected', async () => {
  const { status, body } = await api('POST', '/api/webhooks/stripe', {
    body: JSON.stringify({ type: 'checkout.session.completed' }),
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_SIGNATURE');
});

await test('the confirmation page cannot confirm a booking on its own', async () => {
  const stored = await Booking.findById(firstBookingId).lean();
  const { status, body } = await api('GET', `/api/bookings/session/${stored.stripeSessionId}`);
  assert.equal(status, 200);
  assert.equal(body.booking.status, 'pending');
  assert.equal(body.settled, false);
});

let signedPayload;
await test('a correctly signed webhook confirms the booking', async () => {
  const stored = await Booking.findById(firstBookingId).lean();
  const payload = JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: stored.stripeSessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_test_123',
        client_reference_id: firstBookingId,
        metadata: { bookingId: firstBookingId },
      },
    },
  });
  signedPayload = payload;

  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });

  const { status } = await api('POST', '/api/webhooks/stripe', {
    body: payload,
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  });
  assert.equal(status, 200);

  const confirmed = await Booking.findById(firstBookingId).select('+cancellationToken').lean();
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.stripePaymentIntentId, 'pi_test_123');
  assert.ok(confirmed.paidAt);
  assert.equal(confirmed.holdExpiresAt, null);
  assert.match(confirmed.cancellationToken, /^[a-f0-9]{64}$/, 'manage token must be stored hashed');
});

await test('replaying the same webhook does not double-process', async () => {
  const header = stripe.webhooks.generateTestHeaderString({
    payload: signedPayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const { status } = await api('POST', '/api/webhooks/stripe', {
    body: signedPayload,
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  });
  assert.equal(status, 200);

  const booking = await Booking.findById(firstBookingId).lean();
  assert.equal(booking.status, 'confirmed');
  assert.equal(booking.amountRefundedCents, 0);
});

section('Manage & cancel');

const knownToken = 'verify-token-000000000000000000000000000';

await test('a bad manage token returns 404 without revealing anything', async () => {
  const { status } = await api('GET', '/api/bookings/manage/not-a-real-token-value-000000000000');
  assert.equal(status, 404);
});

await test('a valid manage token returns the booking', async () => {
  await Booking.updateOne(
    { _id: firstBookingId },
    { $set: { cancellationToken: hashToken(knownToken) } }
  );

  const { status, body } = await api('GET', `/api/bookings/manage/${knownToken}`);
  assert.equal(status, 200);
  assert.equal(body.booking.id, firstBookingId);
  assert.equal(body.booking.guestName, 'Ada Lovelace');
  assert.ok(body.cancellation.refundIfCancelledNowCents > 0, 'a 60-day-out stay is fully refundable');
});

await test('guest cancellation refunds per policy and frees the dates', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${knownToken}/cancel`, {
    body: { reason: 'Plans changed' },
  });
  assert.equal(status, 200);
  assert.equal(body.booking.status, 'cancelled');
  assert.ok(body.refundCents > 0);

  const { status: rebookStatus } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      ...bookingDates,
      guests: 2,
      guestName: 'Next Guest',
      guestEmail: 'next@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(rebookStatus, 201, 'cancelled dates must become bookable again');
});

await test('cancelling twice is refused', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${knownToken}/cancel`, {
    body: {},
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'ALREADY_CANCELLED');
});

section('Availability & iCal');

await test('availability reports occupied nights without guest details', async () => {
  const { status, body } = await api(
    'GET',
    `/api/properties/${theHome._id}/availability?from=${iso(0)}&to=${iso(150)}`
  );
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.unavailableNights));
  assert.ok(body.unavailableNights.includes(iso(120)), 'the raced booking must block its nights');
  assert.ok(!JSON.stringify(body).includes('example.com'), 'availability must not leak guest emails');
});

await test('the outbound iCal feed is valid and anonymous', async () => {
  const { status, body, headers } = await api('GET', `/api/properties/${theHome._id}/calendar.ics`);
  assert.equal(status, 200);
  assert.match(headers.get('content-type'), /text\/calendar/);
  assert.match(body, /^BEGIN:VCALENDAR/);
  assert.match(body, /END:VCALENDAR\s*$/);
  assert.ok(body.includes('SUMMARY:Reserved'));
  assert.ok(!body.includes('Ada Lovelace'), 'the feed must not carry guest names');
});

section('Admin');

await test('admin routes reject anonymous callers', async () => {
  const { status } = await api('GET', '/api/admin/dashboard');
  assert.equal(status, 401);
});

await test('login with a wrong password fails generically', async () => {
  await Admin.create({
    email: 'owner@example.com',
    passwordHash: await Admin.hashPassword('a-very-long-test-password'),
    role: 'owner',
  });

  const { status, body } = await api('POST', '/api/admin/login', {
    body: { email: 'owner@example.com', password: 'wrong-password-entirely' },
  });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'BAD_CREDENTIALS');
});

await test('login sets an httpOnly session cookie', async () => {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'a-very-long-test-password' }),
  });
  assert.equal(res.status, 200);

  const cookies = res.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith('lbf_admin_session='));
  assert.ok(session, 'no session cookie was set');
  assert.match(session, /HttpOnly/i);
  cookieJar = session.split(';')[0];

  const payload = await res.json();
  assert.equal(payload.admin.email, 'owner@example.com');
  assert.ok(!('passwordHash' in payload.admin), 'password hash must never be returned');
});

await test('the dashboard returns stats for a signed-in admin', async () => {
  const { status, body } = await api('GET', '/api/admin/dashboard');
  assert.equal(status, 200);
  assert.ok(typeof body.stats.confirmed === 'number');
  assert.ok(Array.isArray(body.recentBookings));
});

await test('bookings list filters by property and status', async () => {
  const { status, body } = await api(
    'GET',
    `/api/admin/bookings?propertyId=${theHome._id}&status=pending&limit=5`
  );
  assert.equal(status, 200);
  assert.ok(body.bookings.every((b) => b.status === 'pending'));
  assert.ok(body.pagination.total >= 1);
});

await test('a manual block refuses to sit on top of a live booking', async () => {
  const { status, body } = await api('POST', '/api/admin/blocked-dates', {
    body: {
      propertyId: theHome._id.toString(),
      startDate: iso(121),
      endDate: iso(123),
      reason: 'Maintenance',
    },
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'BOOKINGS_IN_RANGE');
});

await test('a manual block on free dates is created and blocks booking', async () => {
  const { status } = await api('POST', '/api/admin/blocked-dates', {
    body: {
      propertyId: theHome._id.toString(),
      startDate: iso(300),
      endDate: iso(305),
      reason: 'Family visiting',
    },
  });
  assert.equal(status, 201);

  const { status: bookStatus, body: bookBody } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(302),
      checkOut: iso(307),
      guests: 2,
      guestName: 'Blocked Out',
      guestEmail: 'blocked@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(bookStatus, 409);
  assert.equal(bookBody.error.code, 'DATES_UNAVAILABLE');
});

await test('an SSRF-shaped iCal URL is refused', async () => {
  const { status } = await api('PATCH', `/api/admin/properties/${theHome._id}`, {
    body: { airbnbIcalUrl: 'https://169.254.169.254/latest/meta-data/' },
  });
  assert.equal(status, 400);
});

/**
 * The admin form PATCHes the whole property, photos included, and the shipped
 * photos are site-relative paths. A strict `z.string().url()` rejected those,
 * so the entire save 400'd and an unrelated edit — a calendar link — appeared
 * to succeed and silently did not persist.
 */
await test('saving the whole property keeps relative photo paths and stores the feed', async () => {
  const feed = 'https://www.airbnb.com/calendar/ical/1234567890.ics?t=abc123';
  const { status, body } = await api('PATCH', `/api/admin/properties/${theHome._id}`, {
    body: {
      airbnbIcalUrl: feed,
      photos: [
        { url: '/media/stay/home-01.jpg', alt: 'Relative path, as shipped', order: 0 },
        { url: 'https://res.cloudinary.com/demo/image/upload/x.jpg', alt: 'Absolute', order: 1 },
      ],
    },
  });
  assert.equal(status, 200, `expected 200, got ${status} ${JSON.stringify(body?.error ?? {})}`);

  const saved = await Property.findById(theHome._id).lean();
  assert.equal(saved.airbnbIcalUrl, feed, 'the calendar link must actually persist');
  assert.equal(saved.photos.length, 2);
  assert.equal(saved.photos[0].url, '/media/stay/home-01.jpg');
});

await test('a photo URL that is neither absolute nor rooted is still refused', async () => {
  const { status } = await api('PATCH', `/api/admin/properties/${theHome._id}`, {
    body: { photos: [{ url: 'javascript:alert(1)', alt: 'nope', order: 0 }] },
  });
  assert.equal(status, 400);
});

await test('a cross-origin admin mutation is refused (CSRF backstop)', async () => {
  const { status, body } = await api('POST', '/api/admin/blocked-dates', {
    body: {
      propertyId: theHome._id.toString(),
      startDate: iso(400),
      endDate: iso(402),
    },
    headers: { Origin: 'https://evil.example.com' },
  });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'BAD_ORIGIN');
});

await test('a same-origin admin mutation is allowed', async () => {
  const { status } = await api('POST', '/api/admin/blocked-dates', {
    body: {
      propertyId: theHome._id.toString(),
      startDate: iso(400),
      endDate: iso(402),
      reason: 'Origin check',
    },
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(status, 201);
});

await test('reads are not blocked by the origin check', async () => {
  const { status } = await api('GET', '/api/admin/dashboard', {
    headers: { Origin: 'https://evil.example.com' },
  });
  assert.equal(status, 200);
});

await test('logout clears the session', async () => {
  await api('POST', '/api/admin/logout');
  cookieJar = '';
  const { status } = await api('GET', '/api/admin/dashboard');
  assert.equal(status, 401);
});

section('Airbnb calendar sync');

const { syncPropertyCalendars } = await import('../services/icalService.js');
const { BlockedDate } = await import('../models/BlockedDate.js');

await test('an Airbnb feed imports as blocked dates', async () => {
  icalMock.state.events = [
    { start: iso(300), end: iso(305), uid: 'abc123@airbnb.com', summary: 'Reserved' },
    { start: iso(320), end: iso(323), uid: 'def456@airbnb.com', summary: 'Airbnb (Not available)' },
  ];

  theHome.airbnbIcalUrl = `http://127.0.0.1:${icalMock.port}/calendar.ics`;
  await theHome.save();

  const result = await syncPropertyCalendars(theHome._id);
  const feed = result.feeds.find((f) => f.source === 'airbnb');
  assert.ok(!feed.error, `sync errored: ${feed.error}`);
  assert.equal(feed.events, 2, 'both a reservation and a block must import');
  assert.equal(feed.added, 2);

  const blocks = await BlockedDate.find({ propertyId: theHome._id, source: 'airbnb' }).lean();
  assert.equal(blocks.length, 2);
});

await test('Airbnb-blocked dates are refused for direct booking', async () => {
  const { status, body } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(301),
      checkOut: iso(304),
      guests: 2,
      guestName: 'Would Double Book',
      guestEmail: 'double@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(status, 409, 'a night held on Airbnb must not be sellable here');
  assert.equal(body.error.code, 'DATES_UNAVAILABLE');
});

await test('Airbnb-blocked nights show as unavailable on the public calendar', async () => {
  const { body } = await api(
    'GET',
    `/api/properties/${theHome._id}/availability?from=${iso(0)}&to=${iso(360)}`
  );
  assert.ok(body.unavailableNights.includes(iso(300)));
  assert.ok(body.unavailableNights.includes(iso(304)), 'last night of the Airbnb stay');
  assert.ok(!body.unavailableNights.includes(iso(305)), 'their checkout day is bookable');
});

await test('re-syncing an unchanged feed creates no duplicates', async () => {
  const before = await BlockedDate.countDocuments({ propertyId: theHome._id, source: 'airbnb' });
  await syncPropertyCalendars(theHome._id);
  const after = await BlockedDate.countDocuments({ propertyId: theHome._id, source: 'airbnb' });
  assert.equal(after, before, 'reconciliation is by UID, so nothing should duplicate');
});

await test('an extended Airbnb stay updates in place', async () => {
  icalMock.state.events[0].end = iso(308);
  await syncPropertyCalendars(theHome._id);

  const block = await BlockedDate.findOne({
    propertyId: theHome._id,
    source: 'airbnb',
    externalUid: 'abc123@airbnb.com',
  }).lean();
  assert.equal(block.endDate.toISOString().slice(0, 10), iso(308));

  const { body } = await api(
    'GET',
    `/api/properties/${theHome._id}/availability?from=${iso(0)}&to=${iso(360)}`
  );
  assert.ok(body.unavailableNights.includes(iso(307)), 'the extra nights must now be blocked');
});

await test('a cancelled Airbnb reservation frees its dates again', async () => {
  icalMock.state.events = icalMock.state.events.filter((e) => e.uid !== 'def456@airbnb.com');
  await syncPropertyCalendars(theHome._id);

  const remaining = await BlockedDate.find({ propertyId: theHome._id, source: 'airbnb' }).lean();
  assert.equal(remaining.length, 1, 'the vanished reservation must be pruned');

  const { status } = await api('POST', '/api/bookings', {
    body: {
      propertyId: theHome._id.toString(),
      checkIn: iso(320),
      checkOut: iso(323),
      guests: 2,
      guestName: 'Now Free',
      guestEmail: 'free@example.com',
      acceptedTerms: true,
    },
  });
  assert.equal(status, 201, 'dates released on Airbnb become bookable here');
});

await test('a sync never removes the owner’s manual blocks', async () => {
  await BlockedDate.create({
    propertyId: theHome._id,
    startDate: new Date(`${iso(330)}T00:00:00Z`),
    endDate: new Date(`${iso(333)}T00:00:00Z`),
    source: 'manual',
    reason: 'ical-test-owner-hold-a',
  });

  await syncPropertyCalendars(theHome._id);

  const survived = await BlockedDate.findOne({
    propertyId: theHome._id,
    source: 'manual',
    reason: 'ical-test-owner-hold-a',
  }).lean();
  assert.ok(survived, 'manual blocks are outside the sync’s reconciliation scope');
});

await test('two manual blocks can coexist on one property', async () => {
  await BlockedDate.create({
    propertyId: theHome._id,
    startDate: new Date(`${iso(335)}T00:00:00Z`),
    endDate: new Date(`${iso(337)}T00:00:00Z`),
    source: 'manual',
    reason: 'ical-test-owner-hold-b',
  });
  // The real assertion: a second manual block inserts at all. A sparse unique
  // index on (propertyId, source, externalUid) would reject this one.
  const both = await BlockedDate.countDocuments({
    propertyId: theHome._id,
    source: 'manual',
    reason: { $in: ['ical-test-owner-hold-a', 'ical-test-owner-hold-b'] },
  });
  assert.equal(both, 2);
});

// Leave the calendar clean for later sections.
icalMock.state.events = [];
await syncPropertyCalendars(theHome._id);
theHome.airbnbIcalUrl = '';
await theHome.save();

section('Deposit & balance');

const guestHouse = await Property.findOne({ slug: 'the-barn' });
let depositBookingId;
let depositToken;

await test('a far-off stay is quoted as deposit now, balance later', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(200),
      checkOut: iso(205),
      guests: 2,
      depositPercent: 50,
    },
  });
  assert.equal(status, 200);
  assert.equal(body.schedule.length, 2, 'expected a deposit and a balance');
  assert.equal(body.schedule[0].kind, 'deposit');
  assert.equal(body.schedule[1].kind, 'balance');

  const total = body.quote.totalPriceCents;
  assert.equal(
    body.schedule[0].amountCents + body.schedule[1].amountCents,
    total,
    'instalments must sum to the total exactly — no lost or invented cent'
  );
  assert.equal(body.dueNowCents, body.schedule[0].amountCents);
});

await test('a last-minute stay is charged in full', async () => {
  const { body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(5),
      checkOut: iso(8),
      guests: 2,
    },
  });
  assert.equal(body.schedule.length, 1);
  assert.equal(body.schedule[0].kind, 'full');
  assert.equal(body.dueNowCents, body.quote.totalPriceCents);
});

await test('booking far out charges only the deposit', async () => {
  const { status, body } = await api('POST', '/api/bookings', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(200),
      checkOut: iso(205),
      guests: 2,
      guestName: 'Deposit Payer',
      guestEmail: 'deposit@example.com',
      acceptedTerms: true,
      depositPercent: 50,
    },
  });
  assert.equal(status, 201);
  depositBookingId = body.bookingId;

  const stored = await Booking.findById(depositBookingId).lean();
  assert.equal(stored.payments.length, 2);
  assert.equal(body.dueNowCents, stored.payments[0].amountCents);
  assert.ok(body.dueNowCents < stored.totalPriceCents, 'must not charge the full total');
});

await test('paying the deposit confirms the booking with a balance outstanding', async () => {
  const stored = await Booking.findById(depositBookingId).lean();
  const payload = JSON.stringify({
    id: 'evt_deposit',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: stored.payments[0].stripeSessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_deposit_1',
        client_reference_id: depositBookingId,
        metadata: { bookingId: depositBookingId, paymentId: stored.payments[0]._id.toString() },
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const { status } = await api('POST', '/api/webhooks/stripe', {
    body: payload,
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  });
  assert.equal(status, 200);

  const after = await Booking.findById(depositBookingId);
  assert.equal(after.status, 'confirmed');
  assert.equal(after.payments[0].status, 'paid');
  assert.equal(after.payments[1].status, 'due');
  assert.ok(after.balanceDueCents() > 0);
  assert.equal(after.amountPaidCents(), after.payments[0].amountCents);
});

await test('the quote offers 25/50/75 and pay-in-full, priced', async () => {
  const { body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(210),
      checkOut: iso(215),
      guests: 2,
    },
  });

  assert.equal(body.depositChoice.available, true);
  assert.deepEqual(
    body.depositChoice.options.map((o) => o.percent),
    [25, 50, 75, 100],
    'deposits ascending, pay-in-full last'
  );

  const total = body.quote.totalPriceCents;
  for (const option of body.depositChoice.options) {
    assert.equal(
      option.dueNowCents + option.balanceCents,
      total,
      `${option.percent}% must still add up to the total`
    );
  }
  assert.equal(body.depositChoice.options.at(-1).dueNowCents, total, 'full = the whole total');
});

await test('each deposit choice changes only the timing, never the total', async () => {
  const totals = [];
  for (const percent of [25, 50, 75, 100]) {
    const { body } = await api('POST', '/api/bookings/quote', {
      body: {
        propertyId: guestHouse._id.toString(),
        checkIn: iso(210),
        checkOut: iso(215),
        guests: 2,
        depositPercent: percent,
      },
    });
    const sum = body.schedule.reduce((s, p) => s + p.amountCents, 0);
    assert.equal(sum, body.quote.totalPriceCents, `${percent}% instalments must sum to the total`);
    assert.equal(body.dueNowCents, body.schedule[0].amountCents);
    totals.push(body.quote.totalPriceCents);
  }
  assert.equal(new Set(totals).size, 1, 'the stay total must not move with the deposit choice');
});

await test('choosing 25% charges a quarter today and the rest later', async () => {
  const { body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(210),
      checkOut: iso(215),
      guests: 2,
      depositPercent: 25,
    },
  });
  const total = body.quote.totalPriceCents;
  assert.equal(body.schedule.length, 2);
  assert.equal(body.schedule[0].amountCents, Math.ceil(total * 0.25));
  assert.equal(body.schedule[1].amountCents, total - Math.ceil(total * 0.25));
});

await test('pay-in-full is a single instalment', async () => {
  const { body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(210),
      checkOut: iso(215),
      guests: 2,
      depositPercent: 100,
    },
  });
  assert.equal(body.schedule.length, 1);
  assert.equal(body.schedule[0].kind, 'full');
  assert.equal(body.dueNowCents, body.quote.totalPriceCents);
});

await test('a deposit the property does not offer is refused', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(210),
      checkOut: iso(215),
      guests: 2,
      depositPercent: 5,
    },
  });
  assert.equal(status, 400, 'the browser must not be able to dictate the split');
  assert.equal(body.error.code, 'BAD_DEPOSIT_CHOICE');
});

await test('a bogus deposit is refused at booking, not just at quoting', async () => {
  const { status, body } = await api('POST', '/api/bookings', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(230),
      checkOut: iso(234),
      guests: 2,
      guestName: 'Sneaky Payer',
      guestEmail: 'sneaky@example.com',
      acceptedTerms: true,
      depositPercent: 1,
    },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'BAD_DEPOSIT_CHOICE');
});

await test('no split is offered when arrival is too close', async () => {
  const { body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(5),
      checkOut: iso(8),
      guests: 2,
    },
  });
  assert.equal(body.depositChoice.available, false);
  assert.equal(body.schedule.length, 1);
  assert.equal(body.schedule[0].kind, 'full');
});

await test('asking for a deposit too close to arrival is refused', async () => {
  const { status, body } = await api('POST', '/api/bookings/quote', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(5),
      checkOut: iso(8),
      guests: 2,
      depositPercent: 50,
    },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'SPLIT_UNAVAILABLE');
});

await test('the chosen deposit is what actually gets charged', async () => {
  const { status, body } = await api('POST', '/api/bookings', {
    body: {
      propertyId: guestHouse._id.toString(),
      checkIn: iso(240),
      checkOut: iso(245),
      guests: 2,
      guestName: 'Quarter Payer',
      guestEmail: 'quarter@example.com',
      acceptedTerms: true,
      depositPercent: 25,
    },
  });
  assert.equal(status, 201);

  const stored = await Booking.findById(body.bookingId).lean();
  assert.equal(stored.payments.length, 2);
  assert.equal(stored.payments[0].amountCents, Math.ceil(stored.totalPriceCents * 0.25));
  assert.equal(body.dueNowCents, stored.payments[0].amountCents);
  assert.equal(
    stored.payments[0].amountCents + stored.payments[1].amountCents,
    stored.totalPriceCents
  );
});

section('Guest portal');

await test('the portal shows the schedule, agreement and gated arrival info', async () => {
  depositToken = 'portal-token-0000000000000000000000000';
  await Booking.updateOne(
    { _id: depositBookingId },
    { $set: { cancellationToken: hashToken(depositToken) } }
  );

  const { status, body } = await api('GET', `/api/bookings/manage/${depositToken}`);
  assert.equal(status, 200);
  assert.equal(body.booking.payments.length, 2);
  assert.ok(body.booking.balanceDueCents > 0);
  assert.equal(body.agreement.required, true);
  assert.equal(body.agreement.accepted, false);
  assert.ok(body.agreement.body.includes('SHORT-TERM RENTAL AGREEMENT'));

  assert.equal(body.arrival.released, false, 'balance outstanding — no keys yet');
  assert.ok(!body.booking.property.arrivalInfo, 'arrival info must not be in the payload at all');
});

await test('the gate code is never sent while the balance is unpaid', async () => {
  const { body } = await api('GET', `/api/bookings/manage/${depositToken}`);
  const serialised = JSON.stringify(body);
  assert.ok(!serialised.includes('Roblar Avenue'), 'address leaked');
  assert.ok(!serialised.includes('BloomingFarm'), 'wifi network leaked');
});

await test('signing with the wrong name is refused', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${depositToken}/agreement`, {
    body: { signatureName: 'Somebody Else', agreementVersion: 1 },
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'SIGNATURE_MISMATCH');
});

await test('signing against a stale agreement version is refused', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${depositToken}/agreement`, {
    body: { signatureName: 'Deposit Payer', agreementVersion: 99 },
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'AGREEMENT_CHANGED');
});

await test('signing with the booking name is recorded with evidence', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${depositToken}/agreement`, {
    body: { signatureName: 'Deposit Payer', agreementVersion: 1 },
  });
  assert.equal(status, 200);
  assert.equal(body.booking.agreement.accepted, true);

  const stored = await Booking.findById(depositBookingId).lean();
  assert.equal(stored.agreement.version, 1);
  assert.ok(stored.agreement.acceptedAt);
  assert.ok(stored.agreement.ip, 'the IP is kept as evidence of assent');
});

await test('signing twice is refused', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${depositToken}/agreement`, {
    body: { signatureName: 'Deposit Payer', agreementVersion: 1 },
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'ALREADY_SIGNED');
});

await test('the portal opens a Checkout Session for the balance', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${depositToken}/pay`, {
    body: {},
  });
  assert.equal(status, 200);
  assert.equal(body.kind, 'balance');
  assert.match(body.checkoutUrl, /^https:\/\/checkout\.stripe\.example\//);

  const stored = await Booking.findById(depositBookingId).lean();
  assert.ok(stored.payments[1].stripeSessionId, 'the balance session is recorded');
});

await test('paying the balance settles the booking', async () => {
  const stored = await Booking.findById(depositBookingId).lean();
  const balance = stored.payments[1];

  const payload = JSON.stringify({
    id: 'evt_balance',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: balance.stripeSessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_balance_1',
        client_reference_id: depositBookingId,
        metadata: { bookingId: depositBookingId, paymentId: balance._id.toString() },
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const { status } = await api('POST', '/api/webhooks/stripe', {
    body: payload,
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  });
  assert.equal(status, 200);

  const after = await Booking.findById(depositBookingId);
  assert.equal(after.balanceDueCents(), 0);
  assert.equal(after.amountPaidCents(), after.totalPriceCents);
  assert.equal(after.status, 'confirmed', 'still one booking, now fully paid');
});

await test('replaying the balance webhook does not double-count', async () => {
  const before = await Booking.findById(depositBookingId);
  const paidBefore = before.amountPaidCents();

  const balance = before.payments[1];
  const payload = JSON.stringify({
    id: 'evt_balance',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: balance.stripeSessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_balance_1',
        client_reference_id: depositBookingId,
        metadata: { bookingId: depositBookingId, paymentId: balance._id.toString() },
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  await api('POST', '/api/webhooks/stripe', {
    body: payload,
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  });

  const after = await Booking.findById(depositBookingId);
  assert.equal(after.amountPaidCents(), paidBefore);
});

await test('paying again when nothing is due is refused', async () => {
  const { status, body } = await api('POST', `/api/bookings/manage/${depositToken}/pay`, {
    body: {},
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'NOTHING_DUE');
});

await test('arrival info stays locked until close to check-in', async () => {
  const { body } = await api('GET', `/api/bookings/manage/${depositToken}`);
  assert.equal(body.arrival.released, false, 'still 200 days out');
  assert.match(body.arrival.reason, /days before you arrive/);
});

await test('arrival info unlocks once paid, signed and near arrival', async () => {
  // Move the stay to next week; everything else is already satisfied.
  await Booking.updateOne(
    { _id: depositBookingId },
    {
      $set: {
        checkIn: new Date(`${iso(3)}T00:00:00Z`),
        checkOut: new Date(`${iso(8)}T00:00:00Z`),
      },
    }
  );

  const { body } = await api('GET', `/api/bookings/manage/${depositToken}`);
  assert.equal(body.arrival.released, true);
  assert.ok(body.booking.property.arrivalInfo, 'arrival info now present');
  assert.equal(body.booking.property.arrivalInfo.wifiNetwork, 'BloomingFarm');
  assert.ok(body.booking.property.arrivalInfo.houseManual.length > 0);
});

await test('an abandoned balance session never deletes a confirmed booking', async () => {
  const booking = await Booking.findById(depositBookingId);
  const payload = JSON.stringify({
    id: 'evt_expired',
    type: 'checkout.session.expired',
    data: {
      object: {
        id: booking.payments[1].stripeSessionId,
        object: 'checkout.session',
        client_reference_id: depositBookingId,
        metadata: { bookingId: depositBookingId },
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  await api('POST', '/api/webhooks/stripe', {
    body: payload,
    raw: true,
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  });

  const after = await Booking.findById(depositBookingId);
  assert.ok(after, 'the confirmed booking must survive an expired balance session');
  assert.equal(after.status, 'confirmed');
});

// --- Teardown ---------------------------------------------------------------
console.log(`\n[1m${passed} passed, ${failures.length} failed[0m\n`);

server.close();
await disconnectDatabase();
await replSet.stop();
stripeMock.server.close();
icalMock.server.close();

if (failures.length > 0) {
  for (const { name, err } of failures) {
    console.log(`[31m${name}[0m\n${err.stack}\n`);
  }
  process.exit(1);
}
process.exit(0);
