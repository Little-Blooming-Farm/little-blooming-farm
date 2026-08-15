import mongoose from 'mongoose';

const { Schema } = mongoose;

const photoSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true }, // Cloudinary handle, for deletion
    alt: { type: String, trim: true, maxlength: 300, default: '' },
    caption: { type: String, trim: true, maxlength: 300, default: '' },
    width: Number,
    height: Number,
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const propertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'],
    },

    // Editorial copy — this is a story site, so a property has more than a blurb.
    tagline: { type: String, trim: true, maxlength: 200, default: '' },
    shortDescription: { type: String, trim: true, maxlength: 500, default: '' },
    description: { type: String, trim: true, maxlength: 8000, default: '' },

    maxGuests: { type: Number, required: true, min: 1, max: 40 },
    bedrooms: { type: Number, min: 0, max: 30, default: 0 },
    bathrooms: { type: Number, min: 0, max: 30, default: 0 },
    beds: { type: Number, min: 0, max: 60, default: 0 },

    // All money is stored in integer cents. Never floats.
    basePriceCents: { type: Number, required: true, min: 0, max: 100_000_00 },
    cleaningFeeCents: { type: Number, required: true, min: 0, max: 100_000_00, default: 0 },

    minNights: { type: Number, min: 1, max: 30, default: 2 },
    maxNights: { type: Number, min: 1, max: 365, default: 30 },
    checkInTime: { type: String, default: '4:00 PM' },
    checkOutTime: { type: String, default: '11:00 AM' },

    photos: { type: [photoSchema], default: [] },
    amenities: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
      validate: [(v) => v.length <= 100, 'too many amenities'],
    },

    // OTA calendars we import blocked dates from.
    airbnbIcalUrl: { type: String, trim: true, default: '' },
    vrboIcalUrl: { type: String, trim: true, default: '' },
    lastIcalSyncAt: { type: Date, default: null },
    lastIcalSyncStatus: { type: String, default: '' },

    whatsappNumber: { type: String, trim: true, maxlength: 32, default: '' },

    cancellationPolicy: {
      type: String,
      trim: true,
      maxlength: 3000,
      default:
        'Free cancellation up to 30 days before check-in for a full refund. ' +
        'Cancellations within 30 days are refunded 50%. ' +
        'Within 7 days of arrival the booking is non-refundable.',
    },
    houseRules: { type: [{ type: String, trim: true, maxlength: 240 }], default: [] },

    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },

    // --- Payment schedule ----------------------------------------------------
    /**
     * Share of the total taken at booking. 100 means pay in full up front.
     * Anything less splits the stay into a deposit now and a balance later —
     * but only when there is enough runway; see `balanceDueDays`.
     */
    depositPercent: { type: Number, min: 1, max: 100, default: 100 },
    /**
     * How many days before check-in the balance falls due. A booking made
     * closer than this is always charged in full at the time of booking,
     * because there is no sensible window in which to collect a balance.
     */
    balanceDueDays: { type: Number, min: 0, max: 365, default: 30 },

    /**
     * Deposit sizes the guest may choose at checkout, as percentages.
     *
     * Paying in full is always offered and is not listed here — there is never
     * a reason to stop someone settling the whole thing up front. An empty
     * array removes the choice entirely and falls back to `depositPercent`.
     *
     * Whatever the guest picks, the stay total is unchanged; only the timing
     * of the money moves. The server validates the choice against this list —
     * a percentage that is not here is refused, so the split cannot be dictated
     * by the browser.
     */
    depositOptions: {
      type: [Number],
      default: [25, 50, 75],
      validate: [
        (values) => values.every((v) => Number.isInteger(v) && v >= 1 && v <= 99),
        'deposit options must be whole percentages between 1 and 99',
      ],
    },

    // --- Rental agreement ----------------------------------------------------
    rentalAgreement: {
      /**
       * Bumped whenever the text changes. A guest's acceptance records the
       * version they saw, so an edit made after they signed cannot silently
       * rewrite what they agreed to.
       */
      version: { type: Number, default: 1 },
      title: { type: String, trim: true, maxlength: 200, default: 'Rental Agreement' },
      body: { type: String, trim: true, maxlength: 40000, default: '' },
      requireAcceptance: { type: Boolean, default: true },
      updatedAt: { type: Date, default: Date.now },
    },

    // --- Arrival information -------------------------------------------------
    address: { type: String, trim: true, maxlength: 300, default: '' },
    /**
     * Sensitive. Released only to a confirmed guest whose balance is settled,
     * and only within `arrivalInfoReleaseDays` of arrival — never on any public
     * endpoint. Treat every field here as a key to the house.
     */
    arrivalInfo: {
      gateCode: { type: String, trim: true, maxlength: 40, default: '' },
      doorCode: { type: String, trim: true, maxlength: 40, default: '' },
      wifiNetwork: { type: String, trim: true, maxlength: 80, default: '' },
      wifiPassword: { type: String, trim: true, maxlength: 80, default: '' },
      directions: { type: String, trim: true, maxlength: 4000, default: '' },
      parking: { type: String, trim: true, maxlength: 2000, default: '' },
      checkInInstructions: { type: String, trim: true, maxlength: 4000, default: '' },
      checkOutInstructions: { type: String, trim: true, maxlength: 4000, default: '' },
      emergencyContact: { type: String, trim: true, maxlength: 200, default: '' },
      houseManual: {
        type: [
          {
            title: { type: String, trim: true, maxlength: 120 },
            body: { type: String, trim: true, maxlength: 4000 },
          },
        ],
        default: [],
      },
    },
    /** How many days before check-in the arrival details unlock. */
    arrivalInfoReleaseDays: { type: Number, min: 0, max: 90, default: 7 },
  },
  { timestamps: true }
);

propertySchema.index({ isActive: 1, displayOrder: 1 });

/** Public shape — never expose internal iCal URLs to the customer-facing site. */
propertySchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    tagline: this.tagline,
    shortDescription: this.shortDescription,
    description: this.description,
    maxGuests: this.maxGuests,
    bedrooms: this.bedrooms,
    bathrooms: this.bathrooms,
    beds: this.beds,
    basePriceCents: this.basePriceCents,
    cleaningFeeCents: this.cleaningFeeCents,
    minNights: this.minNights,
    maxNights: this.maxNights,
    checkInTime: this.checkInTime,
    checkOutTime: this.checkOutTime,
    photos: (this.photos ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        url: p.url,
        alt: p.alt,
        caption: p.caption,
        width: p.width,
        height: p.height,
      })),
    amenities: this.amenities,
    cancellationPolicy: this.cancellationPolicy,
    houseRules: this.houseRules,
    displayOrder: this.displayOrder,

    // Deliberately included: guests should see the payment terms and the
    // agreement before they book, not after.
    depositPercent: this.depositPercent,
    balanceDueDays: this.balanceDueDays,
    depositOptions: this.depositOptions ?? [],
    rentalAgreement: {
      version: this.rentalAgreement?.version ?? 1,
      title: this.rentalAgreement?.title ?? 'Rental Agreement',
      body: this.rentalAgreement?.body ?? '',
      requireAcceptance: this.rentalAgreement?.requireAcceptance ?? true,
    },

    // NOTE: `address` and `arrivalInfo` are intentionally absent. They are the
    // keys to the house and are released only through the guest portal, to a
    // confirmed guest, close to arrival.
  };
};

export const Property = mongoose.model('Property', propertySchema);
export default Property;
