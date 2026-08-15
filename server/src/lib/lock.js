import { randomUUID } from 'node:crypto';
import { ResourceLock } from '../models/ResourceLock.js';
import { conflict } from './errors.js';
import logger from './logger.js';

const DEFAULT_TTL_MS = 15_000;
const DEFAULT_ATTEMPTS = 8;
const DEFAULT_BACKOFF_MS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Atomically take a named lock.
 *
 * The filter matches only when the lock is absent or already expired. Combined
 * with `upsert` and the unique index on `key`, this collapses to a single
 * document operation: concurrent callers either update the expired row (one
 * winner, decided by the storage engine) or collide on the unique index and
 * receive E11000. There is no read-then-write window.
 *
 * @returns {Promise<{key: string, owner: string} | null>} null if held elsewhere
 */
export async function acquireLock(key, ttlMs = DEFAULT_TTL_MS) {
  const now = new Date();
  const owner = randomUUID();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const doc = await ResourceLock.findOneAndUpdate(
      { key, expiresAt: { $lte: now } },
      { $set: { key, owner, expiresAt, acquiredAt: now } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return doc?.owner === owner ? { key, owner } : null;
  } catch (err) {
    // 11000 = a live lock already exists. Expected under contention.
    if (err?.code === 11000) return null;
    throw err;
  }
}

/** Release a lock, but only if we still hold it (never steal someone else's). */
export async function releaseLock(handle) {
  if (!handle) return;
  try {
    await ResourceLock.deleteOne({ key: handle.key, owner: handle.owner });
  } catch (err) {
    // A failed release is not fatal — the TTL index reclaims it.
    logger.warn('Failed to release lock', { key: handle.key, error: err.message });
  }
}

/**
 * Run `fn` while holding `key`. Retries with backoff, then gives up with a 409
 * rather than queueing indefinitely — a guest waiting on a checkout button
 * should get a fast, honest answer.
 */
export async function withLock(key, fn, options = {}) {
  const {
    ttlMs = DEFAULT_TTL_MS,
    attempts = DEFAULT_ATTEMPTS,
    backoffMs = DEFAULT_BACKOFF_MS,
  } = options;

  let handle = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    handle = await acquireLock(key, ttlMs);
    if (handle) break;
    // Jittered backoff so retries from a burst don't re-collide in lockstep.
    await sleep(backoffMs * (attempt + 1) + Math.floor(Math.random() * backoffMs));
  }

  if (!handle) {
    logger.warn('Lock acquisition timed out', { key });
    throw conflict(
      'These dates are being booked by someone else right now. Please try again in a moment.',
      undefined,
      'LOCK_TIMEOUT'
    );
  }

  try {
    return await fn();
  } finally {
    await releaseLock(handle);
  }
}

export const propertyLockKey = (propertyId) => `booking:property:${propertyId}`;
