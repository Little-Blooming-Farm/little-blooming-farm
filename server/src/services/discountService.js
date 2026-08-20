import Discount from '../models/Discount.js';
import logger from '../lib/logger.js';

/**
 * Look a code up for pricing. Returns null rather than throwing: an unknown
 * code is a quote without a discount, not an error, and the quote route
 * decides how to phrase that to the guest.
 */
export async function findDiscountByCode(code) {
  const normalised = String(code ?? '').trim().toUpperCase();
  if (normalised.length < 3 || normalised.length > 40) return null;
  return Discount.findOne({ code: normalised });
}

/**
 * Claim one redemption, atomically.
 *
 * The cap is enforced inside the update filter, not by reading `timesRedeemed`
 * and writing back — two checkouts landing together would both read the same
 * count, both decide there was room, and both write. Mongo evaluates the
 * filter and the `$inc` as one operation, so exactly one of them matches when
 * a single redemption is left.
 *
 * Returns false when the code has just run out, which the caller surfaces as a
 * plain "no longer available" rather than silently charging full price.
 */
export async function claimRedemption(code, { session } = {}) {
  const normalised = String(code ?? '').trim().toUpperCase();
  if (!normalised) return false;

  const claimed = await Discount.findOneAndUpdate(
    {
      code: normalised,
      isActive: true,
      $or: [
        { maxRedemptions: null },
        { $expr: { $lt: ['$timesRedeemed', '$maxRedemptions'] } },
      ],
    },
    { $inc: { timesRedeemed: 1 } },
    { new: true, ...(session ? { session } : {}) }
  );

  return Boolean(claimed);
}

/**
 * Hand a redemption back.
 *
 * Called when a booking that claimed a code never becomes real — the hold
 * lapses, or it is cancelled. Floored at zero so a double release (a cancel
 * racing an expiry sweep, say) cannot push the count negative and quietly hand
 * out extra redemptions.
 */
export async function releaseRedemption(code, { session } = {}) {
  const normalised = String(code ?? '').trim().toUpperCase();
  if (!normalised) return;

  const result = await Discount.findOneAndUpdate(
    { code: normalised, timesRedeemed: { $gt: 0 } },
    { $inc: { timesRedeemed: -1 } },
    { new: true, ...(session ? { session } : {}) }
  );

  if (!result) {
    logger.debug('Discount release was a no-op', { code: normalised });
  }
}
