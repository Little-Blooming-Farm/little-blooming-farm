import mongoose from 'mongoose';

const { Schema } = mongoose;

export const BOOKING_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
});

/** Statuses that occupy the calendar. `cancelled` never blocks dates. */
export const BLOCKING_STATUSES = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED];

export const PAYMENT_KIND = Object.freeze({
  FULL: 'full',
  DEPOSIT: 'deposit',
  BALANCE: 'balance',
});

export const PAYMENT_STATUS = Object.freeze({
  DUE: 'due',
  PAID: 'paid',
  REFUNDED: 'refunded',
  VOID: 'void',
});

/**
 * One instalment of a booking.
 *
 * A stay far enough ahead is split into a deposit taken now and a balance taken
 * closer to arrival; a last-minute stay is a single `full` payment. Each
 * instalment carries its own Stripe session, so the webhook can settle them
 * independently and a replayed event can never double-count.
 */
const paymentSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(PAYMENT_KIND), required: true },
    amountCents: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.DUE,
    },
    dueDate: { type: Date, default: null },

    stripeSessionId: { type: String, default: undefined },
    stripePaymentIntentId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    amountRefundedCents: { type: Number, default: 0, min: 0 },

    reminderSentAt: { type: Date, default: null },
  },
  { _id: true }
);

const bookingSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },

    guestName: { type: String, required: true, trim: true, maxlength: 120 },
    guestEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    guestPhone: { type: String, trim: true, maxlength: 40, default: '' },
    guests: { type: Number, min: 1, max: 40, default: 1 },
    message: { type: String, trim: true, maxlength: 2000, default: '' },

    // Calendar dates, normalised to UTC midnight. Check-out is exclusive.
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },

    // Price breakdown frozen at booking time, so a later rate change never
    // rewrites what the guest actually agreed to pay.
    nightlyRateCents: { type: Number, required: true, min: 0 },
    accommodationCents: { type: Number, required: true, min: 0 },
    cleaningFeeCents: { type: Number, required: true, min: 0 },
    totalPriceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'usd', lowercase: true },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
      required: true,
    },

    /**
     * A pending booking holds its dates only until this moment. Past it, the
     * calendar treats the dates as free again — otherwise an abandoned Stripe
     * Checkout would block the property forever.
     */
    holdExpiresAt: { type: Date, default: null },

    // No `default: null` on the uniquely-indexed fields below — an explicit
    // null is a *value*, and every unpaid booking would collide on it. They
    // stay absent until there is something real to store.
    stripeSessionId: { type: String },
    stripePaymentIntentId: { type: String, default: null },
    stripeRefundId: { type: String, default: null },
    amountRefundedCents: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },

    /**
     * SHA-256 hash of the manage-booking token emailed to the guest.
     * The raw token is generated once, sent, and never persisted — so a leaked
     * database dump cannot be used to cancel anyone's stay.
     */
    cancellationToken: { type: String, select: false },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ['guest', 'admin', 'system', null], default: null },
    cancellationReason: { type: String, trim: true, maxlength: 1000, default: '' },

    source: {
      type: String,
      enum: ['direct', 'admin', 'airbnb', 'vrbo'],
      default: 'direct',
    },
    adminNotes: { type: String, trim: true, maxlength: 4000, default: '' },
    confirmationEmailSentAt: { type: Date, default: null },

    // --- Instalments ---------------------------------------------------------
    /**
     * The payment schedule. Either one `full` instalment, or a `deposit` taken
     * at booking plus a `balance` due before arrival. `totalPriceCents` is
     * always the sum — the schedule never changes what is owed, only when.
     */
    payments: { type: [paymentSchema], default: [] },

    // --- Rental agreement ----------------------------------------------------
    agreement: {
      /** Which version of the property's agreement text the guest accepted. */
      version: { type: Number, default: null },
      acceptedAt: { type: Date, default: null },
      /** Typed full name — a simple e-signature, kept with the evidence below. */
      signatureName: { type: String, trim: true, maxlength: 120, default: '' },
      ip: { type: String, trim: true, maxlength: 64, default: '' },
      userAgent: { type: String, trim: true, maxlength: 300, default: '' },
    },

    /** Set when the gate code and directions were released to the guest. */
    arrivalInfoSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The overlap query's workhorse index: property first, then the date bounds.
bookingSchema.index({ propertyId: 1, checkIn: 1, checkOut: 1 });
// Narrows the overlap scan to bookings that actually occupy the calendar.
bookingSchema.index({ propertyId: 1, status: 1, checkOut: 1 });
/**
 * Partial, not sparse. A sparse unique index only ignores documents where the
 * field is *absent* — it still enforces uniqueness across explicit nulls, so
 * two unpaid bookings would collide on `null`. Restricting the index to actual
 * strings is what makes "unique when set, unconstrained when not" work.
 */
bookingSchema.index(
  { cancellationToken: 1 },
  { unique: true, partialFilterExpression: { cancellationToken: { $type: 'string' } } }
);
bookingSchema.index(
  { stripeSessionId: 1 },
  { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } }
);
/**
 * Instalment session lookup — deliberately NOT unique.
 *
 * A unique index on an array subfield is multikey: it indexes *every* element
 * of the array, and `partialFilterExpression` selects whole documents, not
 * individual entries. So a booking with a paid deposit and an unpaid balance
 * qualifies for the index and then contributes a null entry for the balance —
 * and the second such booking collides on that null. Uniqueness here is not
 * needed anyway: Stripe's idempotency key stops duplicate sessions being
 * created, and settlement is guarded by the instalment's own `due` status.
 */
bookingSchema.index({ 'payments.stripeSessionId': 1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
bookingSchema.index({ guestEmail: 1, createdAt: -1 });
bookingSchema.index({ createdAt: -1 });
// Drives the balance-reminder job.
bookingSchema.index({ status: 1, 'payments.status': 1, 'payments.dueDate': 1 });

bookingSchema.virtual('isActive').get(function isActive() {
  return this.status !== BOOKING_STATUS.CANCELLED;
});

/** Cents actually collected, net of refunds. */
bookingSchema.methods.amountPaidCents = function amountPaidCents() {
  return (this.payments ?? [])
    .filter((p) => p.status === PAYMENT_STATUS.PAID)
    .reduce((sum, p) => sum + p.amountCents - (p.amountRefundedCents ?? 0), 0);
};

/** Cents still owed on instalments that have not been paid. */
bookingSchema.methods.balanceDueCents = function balanceDueCents() {
  return (this.payments ?? [])
    .filter((p) => p.status === PAYMENT_STATUS.DUE)
    .reduce((sum, p) => sum + p.amountCents, 0);
};

/** The next unpaid instalment, if any. */
bookingSchema.methods.nextPayment = function nextPayment() {
  return (this.payments ?? []).find((p) => p.status === PAYMENT_STATUS.DUE) ?? null;
};

/**
 * What the guest is allowed to see in their portal.
 *
 * `includeArrivalInfo` gates the sensitive half — gate code, wifi password,
 * alarm and directions. That is decided by the caller from booking status and
 * proximity to arrival, never by the client asking for it.
 */
bookingSchema.methods.toGuestJSON = function toGuestJSON({ includeArrivalInfo = false } = {}) {
  const populated =
    this.propertyId && typeof this.propertyId === 'object' && this.propertyId.name;

  const property = populated
    ? {
        id: this.propertyId._id.toString(),
        name: this.propertyId.name,
        slug: this.propertyId.slug,
        checkInTime: this.propertyId.checkInTime,
        checkOutTime: this.propertyId.checkOutTime,
        cancellationPolicy: this.propertyId.cancellationPolicy,
        houseRules: this.propertyId.houseRules,
        whatsappNumber: this.propertyId.whatsappNumber,
        // The address is part of the arrival information, not public detail —
        // it is as much a key to the house as the gate code.
        ...(includeArrivalInfo
          ? {
              address: this.propertyId.address ?? '',
              arrivalInfo: {
                gateCode: this.propertyId.arrivalInfo?.gateCode ?? '',
                doorCode: this.propertyId.arrivalInfo?.doorCode ?? '',
                wifiNetwork: this.propertyId.arrivalInfo?.wifiNetwork ?? '',
                wifiPassword: this.propertyId.arrivalInfo?.wifiPassword ?? '',
                directions: this.propertyId.arrivalInfo?.directions ?? '',
                parking: this.propertyId.arrivalInfo?.parking ?? '',
                checkInInstructions: this.propertyId.arrivalInfo?.checkInInstructions ?? '',
                checkOutInstructions: this.propertyId.arrivalInfo?.checkOutInstructions ?? '',
                emergencyContact: this.propertyId.arrivalInfo?.emergencyContact ?? '',
                houseManual: this.propertyId.arrivalInfo?.houseManual ?? [],
              },
            }
          : {}),
      }
    : { id: this.propertyId?.toString?.() ?? null };

  return {
    id: this._id.toString(),
    reference: this._id.toString().slice(-8).toUpperCase(),
    property,
    guestName: this.guestName,
    guestEmail: this.guestEmail,
    guestPhone: this.guestPhone,
    guests: this.guests,
    checkIn: this.checkIn,
    checkOut: this.checkOut,
    nights: this.nights,
    nightlyRateCents: this.nightlyRateCents,
    accommodationCents: this.accommodationCents,
    cleaningFeeCents: this.cleaningFeeCents,
    totalPriceCents: this.totalPriceCents,
    amountPaidCents: this.amountPaidCents(),
    balanceDueCents: this.balanceDueCents(),
    amountRefundedCents: this.amountRefundedCents,
    currency: this.currency,
    status: this.status,
    paidAt: this.paidAt,
    cancelledAt: this.cancelledAt,
    createdAt: this.createdAt,

    payments: (this.payments ?? []).map((p) => ({
      id: p._id.toString(),
      kind: p.kind,
      amountCents: p.amountCents,
      status: p.status,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      amountRefundedCents: p.amountRefundedCents,
    })),

    agreement: {
      accepted: Boolean(this.agreement?.acceptedAt),
      acceptedAt: this.agreement?.acceptedAt ?? null,
      signatureName: this.agreement?.signatureName ?? '',
      version: this.agreement?.version ?? null,
    },

    arrivalInfoAvailable: includeArrivalInfo,
  };
};

export const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
