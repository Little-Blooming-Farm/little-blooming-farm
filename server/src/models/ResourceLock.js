import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A short-lived advisory lock, used to serialise booking creation per property.
 *
 * Acquisition is a single atomic `findOneAndUpdate` with `upsert: true` against
 * a unique `key`. Two concurrent callers race on the unique index; exactly one
 * wins, the other gets a duplicate-key error and retries or gives up. The TTL
 * index guarantees a crashed holder cannot deadlock the calendar forever.
 */
const resourceLockSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    owner: { type: String, required: true }, // random id of the holder
    expiresAt: { type: Date, required: true },
    acquiredAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// MongoDB's background TTL monitor sweeps expired locks roughly once a minute.
// Acquisition also treats an expired-but-present lock as free, so correctness
// never depends on the sweeper's timing.
resourceLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ResourceLock = mongoose.model('ResourceLock', resourceLockSchema);
export default ResourceLock;
