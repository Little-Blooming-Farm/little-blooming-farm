import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A discount code the owner hands out.
 *
 * Two kinds, and the distinction is in the units rather than a separate field
 * pair: `percent` reads `value` as 1–100, `fixed` reads it as cents. Keeping
 * one field means a code can never be half-percentage and half-amount, which
 * is the state a `percentOff` + `amountOffCents` pair eventually reaches.
 *
 * Money is never taken from here directly. The code travels to the server as a
 * string and the server decides what it is worth — see applyDiscount in
 * lib/pricing.js. A client that posts `discountCents: 500000` gets nothing.
 */
const discountSchema = new Schema(
  {
    /**
     * Stored upper-case and compared upper-case, so `spring25` and `SPRING25`
     * are the same code rather than two codes that differ invisibly on a
     * printed card.
     */
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
    },

    /** Shown in the admin list and on the guest's quote. */
    label: { type: String, trim: true, maxlength: 120, default: '' },

    kind: { type: String, required: true, enum: ['percent', 'fixed'] },

    /** Percent: 1–100. Fixed: cents. Validated against `kind` on save. */
    value: { type: Number, required: true, min: 1 },

    isActive: { type: Boolean, default: true },

    /** Optional validity window. Null means unbounded on that side. */
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    /**
     * Optional cap. `timesRedeemed` is incremented atomically when a booking
     * claims the code and decremented if that booking never becomes real, so
     * two guests checking out at once cannot both take the last redemption.
     */
    maxRedemptions: { type: Number, default: null, min: 1 },
    timesRedeemed: { type: Number, default: 0, min: 0 },

    /** Empty means every property. */
    propertyIds: [{ type: Schema.Types.ObjectId, ref: 'Property' }],

    /** Optional qualifying thresholds, checked against the stay. */
    minNights: { type: Number, default: null, min: 1 },
    minSubtotalCents: { type: Number, default: null, min: 0 },

    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

/**
 * A percentage above 100 would make the stay free and then some, and a fixed
 * amount is in cents so it has no upper bound worth guessing. Enforced here
 * rather than only in the route so a seed or a script cannot create one either.
 */
discountSchema.pre('validate', function coerceValue(next) {
  if (this.kind === 'percent' && this.value > 100) {
    return next(new Error('A percentage discount cannot exceed 100.'));
  }
  if (!Number.isInteger(this.value)) {
    return next(new Error('Discount value must be a whole number.'));
  }
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    return next(new Error('The end date must be after the start date.'));
  }
  return next();
});

/** Redemptions left, or null when uncapped. */
discountSchema.methods.remainingRedemptions = function remainingRedemptions() {
  if (this.maxRedemptions == null) return null;
  return Math.max(0, this.maxRedemptions - (this.timesRedeemed ?? 0));
};

discountSchema.methods.toAdminJSON = function toAdminJSON() {
  return {
    id: this._id.toString(),
    code: this.code,
    label: this.label,
    kind: this.kind,
    value: this.value,
    isActive: this.isActive,
    startsAt: this.startsAt,
    endsAt: this.endsAt,
    maxRedemptions: this.maxRedemptions,
    timesRedeemed: this.timesRedeemed,
    remaining: this.remainingRedemptions(),
    propertyIds: (this.propertyIds ?? []).map((id) => id.toString()),
    minNights: this.minNights,
    minSubtotalCents: this.minSubtotalCents,
    notes: this.notes,
    createdAt: this.createdAt,
  };
};

/**
 * What a guest is allowed to see. Deliberately omits the caps and the
 * redemption count: how many are left is commercial information, and leaking
 * it invites someone to race the last one.
 */
discountSchema.methods.toGuestJSON = function toGuestJSON() {
  return { code: this.code, label: this.label, kind: this.kind, value: this.value };
};

export const Discount = mongoose.model('Discount', discountSchema);
export default Discount;
