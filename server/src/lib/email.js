import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from './logger.js';
import { formatMoney } from './pricing.js';
import { formatRange } from './dates.js';

let transporter = null;

/**
 * Resend over HTTPS, as a nodemailer-shaped transport.
 *
 * Preferred over SMTP because it needs no SMTP ports. Several hosts block them
 * outright — Render's free tier blocks 25, 465 and 587, and port 25 is blocked
 * on every Render plan — which surfaces as a connection that hangs until it
 * times out rather than a clear refusal.
 */
function resendTransport() {
  return {
    sendMail: async ({ from, to, subject, html, text, replyTo }) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          `Resend ${response.status}: ${payload?.message ?? payload?.name ?? 'send failed'}`
        );
      }
      return { messageId: payload.id ?? 'resend' };
    },

    /**
     * Resend has no "verify" endpoint, so an authenticated GET /domains stands
     * in for one: it proves the key is accepted without sending anything.
     *
     * The wrinkle is that a key created with "Sending access" cannot call
     * /domains at all — Resend answers 400 `restricted_api_key`. That is not a
     * failure. It is the narrower, better-scoped key, and reaching that error
     * *proves* the key authenticated: an invalid key is rejected at 401 before
     * permissions are ever considered. So it counts as a pass.
     *
     * Any other failure carries Resend's own message through. The first version
     * of this reported a bare "Resend returned 400", which says nothing about
     * what to change.
     */
    verify: async () => {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10_000),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok) return true;

      const detail = payload?.message ?? payload?.name ?? `HTTP ${response.status}`;

      if (/restricted/i.test(payload?.name ?? '') || /restricted/i.test(payload?.message ?? '')) {
        logger.info('Resend key is sending-only, which is the recommended scope', {
          detail,
        });
        return true;
      }
      /**
       * Resend reports a bad key as 400 as well as 401, so match on the message
       * rather than the status. The commonest cause is a key that was rotated
       * in Resend but not updated here — deleting a key invalidates it at once.
       */
      const rejected =
        response.status === 401 ||
        response.status === 403 ||
        /api key is invalid|invalid api key|unauthorized/i.test(detail);

      if (rejected) {
        // A Resend key always starts `re_`. Anything else is a different
        // provider's secret pasted into the wrong variable, which is worth
        // saying outright — the message "invalid" does not suggest it.
        const looksWrong = !/^re_/.test(env.RESEND_API_KEY ?? '');
        throw new Error(
          `Resend rejected the API key — ${detail}. ` +
            (looksWrong
              ? 'RESEND_API_KEY does not begin with "re_", so it may not be a Resend key at all.'
              : 'Create a new key in Resend (Sending access) and update RESEND_API_KEY.')
        );
      }
      throw new Error(`Resend ${response.status}: ${detail}`);
    },
  };
}

function getTransporter() {
  if (transporter) return transporter;

  if (env.mailTransport === 'resend-http') {
    transporter = resendTransport();
    return transporter;
  }

  if (!env.mailEnabled) {
    // Development without SMTP configured: log the message instead of sending,
    // so the booking flow stays testable end to end.
    transporter = {
      sendMail: async (message) => {
        logger.info('[email:dev] would send', {
          to: message.to,
          subject: message.subject,
        });
        if (!env.isProduction) console.log(`\n--- EMAIL (${message.subject}) ---\n${message.text}\n---\n`);
        return { messageId: 'dev-noop' };
      },
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    pool: true,
    maxConnections: 3,
  });

  return transporter;
}

/** Escape untrusted values before interpolating into HTML. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sending is best-effort and never blocks a payment or a cancellation — a
 * transient SMTP failure must not roll back a confirmed booking.
 */
async function send({ to, subject, html, text, replyTo }) {
  if (!to) return null;
  try {
    const info = await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return info;
  } catch (err) {
    logger.error('Email failed to send', { to, subject, error: err.message });
    return null;
  }
}

// --- Shared shell -----------------------------------------------------------

const COLORS = {
  paper: '#F8F3E9',
  ink: '#24231F',
  soft: '#4A473F',
  moss: '#374733',
  rule: '#E4D6BE',
};

function layout({ preheader, heading, bodyHtml }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.paper};font-family:Georgia,'Times New Roman',serif;color:${COLORS.ink};">
  <span style="display:none;font-size:1px;color:${COLORS.paper};opacity:0;">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FDFBF7;border:1px solid ${COLORS.rule};">
        <tr><td style="padding:36px 36px 8px;text-align:center;">
          <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.soft};font-family:Helvetica,Arial,sans-serif;">
            The Little Blooming Farm
          </div>
          <div style="width:36px;height:1px;background:${COLORS.rule};margin:18px auto 0;"></div>
        </td></tr>
        <tr><td style="padding:20px 36px 36px;">
          <h1 style="margin:0 0 20px;font-weight:400;font-size:30px;line-height:1.2;color:${COLORS.moss};">${esc(heading)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:0 36px 32px;">
          <div style="border-top:1px solid ${COLORS.rule};padding-top:18px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.soft};">
            Santa Ynez Valley, California<br>
            <a href="${esc(env.CLIENT_URL)}" style="color:${COLORS.moss};">thelittlebloomingfarm.com</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.soft};">${esc(label)}</td>
    <td style="padding:9px 0;border-bottom:1px solid ${COLORS.rule};text-align:right;font-size:16px;color:${COLORS.ink};">${esc(value)}</td>
  </tr>`;
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
    <tr><td style="background:${COLORS.moss};">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;color:#F8F3E9;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">${esc(label)}</a>
    </td></tr></table>`;
}

// --- Messages ---------------------------------------------------------------

export function bookingConfirmationEmail({ booking, property, manageUrl }) {
  const stay = formatRange(booking.checkIn, booking.checkOut);
  const reference = booking._id.toString().slice(-8).toUpperCase();

  // With a deposit schedule, "total paid" would be a lie on day one.
  const paidNow = typeof booking.amountPaidCents === 'function'
    ? booking.amountPaidCents()
    : booking.totalPriceCents;
  const balanceDue = typeof booking.balanceDueCents === 'function' ? booking.balanceDueCents() : 0;
  const balancePayment = (booking.payments ?? []).find((p) => p.status === 'due' && p.dueDate);
  const balanceDueLabel = balancePayment?.dueDate
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' }).format(
        balancePayment.dueDate
      )
    : '';

  const bodyHtml = `
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 8px;">
      ${esc(booking.guestName.split(' ')[0])}, your stay is confirmed. We are already looking forward to it.
    </p>
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 24px;">
      Your booking page has everything from here — the rental agreement, your
      arrival details closer to the time, and any payment still to come.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      ${detailRow('Home', property.name)}
      ${detailRow('Dates', stay)}
      ${detailRow('Nights', String(booking.nights))}
      ${detailRow('Guests', String(booking.guests))}
      ${detailRow('Check-in', property.checkInTime)}
      ${detailRow('Check-out', property.checkOutTime)}
      ${detailRow('Stay total', formatMoney(booking.totalPriceCents, booking.currency))}
      ${detailRow('Paid today', formatMoney(paidNow, booking.currency))}
      ${balanceDue > 0 ? detailRow('Balance due' + (balanceDueLabel ? ` by ${balanceDueLabel}` : ''), formatMoney(balanceDue, booking.currency)) : ''}
      ${detailRow('Reference', reference)}
    </table>
    ${button(manageUrl, balanceDue > 0 ? 'Open your booking page' : 'View or change your stay')}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.soft};margin:0;">
      Keep this link private — anyone with it can view and cancel this booking.
    </p>`;

  const text = [
    `${booking.guestName.split(' ')[0]}, your stay is confirmed.`,
    '',
    `Home: ${property.name}`,
    `Dates: ${stay} (${booking.nights} nights)`,
    `Guests: ${booking.guests}`,
    `Check-in: ${property.checkInTime} · Check-out: ${property.checkOutTime}`,
    `Stay total: ${formatMoney(booking.totalPriceCents, booking.currency)}`,
    `Paid today: ${formatMoney(paidNow, booking.currency)}`,
    ...(balanceDue > 0
      ? [`Balance due${balanceDueLabel ? ` by ${balanceDueLabel}` : ''}: ${formatMoney(balanceDue, booking.currency)}`]
      : []),
    `Reference: ${reference}`,
    '',
    `View or change your stay: ${manageUrl}`,
    '',
    'Keep this link private — anyone with it can view and cancel this booking.',
  ].join('\n');

  return {
    to: booking.guestEmail,
    subject: `Your stay at ${property.name} is confirmed — ${stay}`,
    html: layout({
      preheader: `${stay} · ${property.name}`,
      heading: 'Your stay is confirmed',
      bodyHtml,
    }),
    text,
  };
}

export function bookingCancellationEmail({ booking, property, refundCents }) {
  const stay = formatRange(booking.checkIn, booking.checkOut);
  const refundLine =
    refundCents > 0
      ? `A refund of ${formatMoney(refundCents, booking.currency)} is on its way and typically lands within 5–10 business days.`
      : 'In line with the cancellation policy for these dates, no refund is due.';

  const bodyHtml = `
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 20px;">
      Your stay at ${esc(property.name)} for ${esc(stay)} has been cancelled.
    </p>
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 20px;">${esc(refundLine)}</p>
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0;">
      The gate will be open whenever you are ready to come another time.
    </p>`;

  return {
    to: booking.guestEmail,
    subject: `Your booking at ${property.name} has been cancelled`,
    html: layout({ preheader: refundLine, heading: 'Your booking is cancelled', bodyHtml }),
    text: `Your stay at ${property.name} for ${stay} has been cancelled.\n\n${refundLine}\n`,
  };
}

export function ownerBookingNotificationEmail({ booking, property, kind = 'new' }) {
  const stay = formatRange(booking.checkIn, booking.checkOut);
  const title = kind === 'new' ? 'New booking' : 'Booking cancelled';

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Home', property.name)}
      ${detailRow('Dates', stay)}
      ${detailRow('Nights', String(booking.nights))}
      ${detailRow('Guest', booking.guestName)}
      ${detailRow('Email', booking.guestEmail)}
      ${detailRow('Phone', booking.guestPhone || '—')}
      ${detailRow('Guests', String(booking.guests))}
      ${detailRow('Total', formatMoney(booking.totalPriceCents, booking.currency))}
      ${detailRow('Reference', booking._id.toString().slice(-8).toUpperCase())}
    </table>
    ${booking.message ? `<p style="font-size:16px;line-height:1.7;color:${COLORS.soft};margin:20px 0 0;"><em>“${esc(booking.message)}”</em></p>` : ''}
    ${button(`${env.CLIENT_URL}/admin/bookings/${booking._id.toString()}`, 'Open in admin')}`;

  return {
    to: env.OWNER_NOTIFICATION_EMAIL,
    replyTo: booking.guestEmail,
    subject: `${title}: ${property.name}, ${stay}`,
    html: layout({ preheader: `${booking.guestName} · ${stay}`, heading: title, bodyHtml }),
    text: `${title}\n\n${property.name}\n${stay} (${booking.nights} nights)\n${booking.guestName} <${booking.guestEmail}>\n${formatMoney(booking.totalPriceCents, booking.currency)}\n`,
  };
}

export function balanceReceiptEmail({ booking, property, payment }) {
  const stay = formatRange(booking.checkIn, booking.checkOut);
  const settled = booking.balanceDueCents() === 0;

  const bodyHtml = `
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 20px;">
      Thank you — we have received ${esc(formatMoney(payment.amountCents, booking.currency))}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      ${detailRow('Home', property.name)}
      ${detailRow('Dates', stay)}
      ${detailRow('This payment', formatMoney(payment.amountCents, booking.currency))}
      ${detailRow('Paid to date', formatMoney(booking.amountPaidCents(), booking.currency))}
      ${detailRow('Still to pay', formatMoney(booking.balanceDueCents(), booking.currency))}
      ${detailRow('Reference', booking._id.toString().slice(-8).toUpperCase())}
    </table>
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:24px 0 0;">
      ${settled
        ? 'That settles your stay in full. Your arrival details will appear in your booking page shortly before you come.'
        : 'Thank you — the remainder is shown above.'}
    </p>`;

  return {
    to: booking.guestEmail,
    subject: `Payment received — ${property.name}, ${stay}`,
    html: layout({ preheader: `${formatMoney(payment.amountCents, booking.currency)} received`, heading: 'Payment received', bodyHtml }),
    text: [
      `Thank you — we have received ${formatMoney(payment.amountCents, booking.currency)}.`,
      '',
      `${property.name} · ${stay}`,
      `Paid to date: ${formatMoney(booking.amountPaidCents(), booking.currency)}`,
      `Still to pay: ${formatMoney(booking.balanceDueCents(), booking.currency)}`,
    ].join('\n'),
  };
}

export function balanceReminderEmail({ booking, property, payment, manageUrl }) {
  const stay = formatRange(booking.checkIn, booking.checkOut);
  const due = payment.dueDate
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        day: 'numeric',
      }).format(payment.dueDate)
    : 'shortly';

  const bodyHtml = `
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 20px;">
      ${esc(booking.guestName.split(' ')[0])}, the balance for your stay is due on ${esc(due)}.
      You can settle it whenever suits — it takes a moment.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      ${detailRow('Home', property.name)}
      ${detailRow('Dates', stay)}
      ${detailRow('Balance due', formatMoney(payment.amountCents, booking.currency))}
      ${detailRow('Due by', due)}
    </table>
    ${button(manageUrl, 'Pay the balance')}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.soft};margin:0;">
      Apple Pay and Google Pay are both accepted. Keep this link private.
    </p>`;

  return {
    to: booking.guestEmail,
    subject: `Balance due ${due} — ${property.name}`,
    html: layout({ preheader: `${formatMoney(payment.amountCents, booking.currency)} due ${due}`, heading: 'Your balance is due soon', bodyHtml }),
    text: [
      `${booking.guestName.split(' ')[0]}, the balance for your stay is due on ${due}.`,
      '',
      `${property.name} · ${stay}`,
      `Balance due: ${formatMoney(payment.amountCents, booking.currency)}`,
      '',
      `Pay it here: ${manageUrl}`,
    ].join('\n'),
  };
}

export function arrivalInfoEmail({ booking, property, manageUrl }) {
  const stay = formatRange(booking.checkIn, booking.checkOut);

  const bodyHtml = `
    <p style="font-size:17px;line-height:1.75;color:${COLORS.soft};margin:0 0 20px;">
      ${esc(booking.guestName.split(' ')[0])}, you are coming soon — everything you need is now in
      your booking page: the gate code, the wifi, directions that actually work, and where to
      find things once you are here.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      ${detailRow('Home', property.name)}
      ${detailRow('Dates', stay)}
      ${detailRow('Check-in', property.checkInTime)}
    </table>
    ${button(manageUrl, 'Open your booking')}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.soft};margin:0;">
      Keep this link private — it contains the codes to the house.
    </p>`;

  return {
    to: booking.guestEmail,
    subject: `Arriving soon — your details for ${property.name}`,
    html: layout({ preheader: `Gate code, wifi and directions for ${stay}`, heading: 'Everything you need', bodyHtml }),
    text: [
      `${booking.guestName.split(' ')[0]}, you are coming soon.`,
      '',
      `Your gate code, wifi and directions are in your booking page:`,
      manageUrl,
      '',
      'Keep this link private — it contains the codes to the house.',
    ].join('\n'),
  };
}

// --- Public API -------------------------------------------------------------

export async function sendBookingConfirmation(args) {
  return send(bookingConfirmationEmail(args));
}

export async function sendBookingCancellation(args) {
  return send(bookingCancellationEmail(args));
}

export async function sendBalanceReceipt(args) {
  return send(balanceReceiptEmail(args));
}

export async function sendBalanceReminder(args) {
  return send(balanceReminderEmail(args));
}

export async function sendArrivalInfo(args) {
  return send(arrivalInfoEmail(args));
}

export async function sendOwnerNotification(args) {
  if (!env.OWNER_NOTIFICATION_EMAIL) return null;
  return send(ownerBookingNotificationEmail(args));
}

export async function verifyMailTransport() {
  if (!env.mailEnabled) {
    logger.warn('SMTP not configured — emails will be logged, not sent');
    return false;
  }
  try {
    // Bounded on purpose. Some hosts silently drop outbound SMTP rather than
    // refusing it, and an unbounded verify() then hangs for minutes. This is a
    // diagnostic, not a prerequisite — it must never stall anything.
    await Promise.race([
      getTransporter().verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timed out after 15s')), 15_000).unref()
      ),
    ]);
    logger.info('Email transport ready', {
      via: env.mailTransport,
      ...(env.mailTransport === 'smtp' ? { host: env.SMTP_HOST, port: env.SMTP_PORT } : {}),
    });
    return true;
  } catch (err) {
    logger.error('Email transport check failed — the API is running, but emails may not send', {
      via: env.mailTransport,
      ...(env.mailTransport === 'smtp' ? { host: env.SMTP_HOST, port: env.SMTP_PORT } : {}),
      error: err.message,
      hint:
        env.mailTransport === 'smtp'
          ? 'Many hosts block outbound SMTP ports. Set RESEND_API_KEY to send over HTTPS instead.'
          : undefined,
    });
    return false;
  }
}
