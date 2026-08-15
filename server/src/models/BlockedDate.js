import mongoose from 'mongoose';

const { Schema } = mongoose;

export const BLOCK_SOURCE = Object.freeze({
  MANUAL: 'manual',
  AIRBNB: 'airbnb',
  VRBO: 'vrbo',
  DIRECT: 'direct',
});

const blockedDateSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },

    // Same convention as Booking: endDate is exclusive (the departure morning).
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    source: {
      type: String,
      enum: Object.values(BLOCK_SOURCE),
      required: true,
      default: BLOCK_SOURCE.MANUAL,
    },

    /**
     * The VEVENT UID from the OTA feed. Re-syncing matches on this so an
     * unchanged Airbnb reservation updates in place instead of duplicating,
     * and manual blocks (which have no UID) are never touched by the sync.
     *
     * No `default: null` — see the index note below. Manual blocks leave this
     * field absent entirely.
     */
    externalUid: { type: String },

    reason: { type: String, trim: true, maxlength: 300, default: '' },
    summary: { type: String, trim: true, maxlength: 300, default: '' },

    /** Bumped on every sync pass; stale OTA rows are pruned by comparing this. */
    lastSyncedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

blockedDateSchema.index({ propertyId: 1, startDate: 1, endDate: 1 });

/**
 * Dedup guarantee for OTA imports — partial, not sparse.
 *
 * A sparse unique index still enforces uniqueness across explicit nulls, and
 * only ignores documents where the field is absent. Manual blocks have no UID,
 * so under a sparse index the owner could create exactly one manual block per
 * property before hitting a duplicate-key error. Restricting the index to rows
 * where `externalUid` is actually a string exempts manual blocks entirely.
 */
blockedDateSchema.index(
  { propertyId: 1, source: 1, externalUid: 1 },
  { unique: true, partialFilterExpression: { externalUid: { $type: 'string' } } }
);
blockedDateSchema.index({ source: 1, lastSyncedAt: 1 });

export const BlockedDate = mongoose.model('BlockedDate', blockedDateSchema);
export default BlockedDate;
