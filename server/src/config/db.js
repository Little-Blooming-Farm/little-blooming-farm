import mongoose from 'mongoose';
import env from './env.js';
import logger from '../lib/logger.js';

// Drop filter fields that aren't in the schema rather than querying on them.
mongoose.set('strictQuery', true);

/**
 * Note on `sanitizeFilter`: mongoose's global option is deliberately NOT used.
 * It wraps any nested object containing a `$`-prefixed key in `$eq`, which it
 * applies indiscriminately — including to the operators this codebase writes
 * itself, breaking every range query (`{ checkOut: { $gt: date } }`) and the
 * advisory lock.
 *
 * Injection is instead prevented where the untrusted data actually enters:
 *   • middleware/sanitize.js strips `$`-prefixed and dotted keys from every
 *     request body, query and param before a handler runs;
 *   • every route parses its input through a strict zod schema, so handlers
 *     only ever see declared fields of declared primitive types.
 * A user-controlled object can therefore never reach a query in the first place.
 */

let replicaSetCapable = false;

/**
 * True when the connected deployment can run multi-document transactions
 * (replica set / sharded cluster). A standalone `mongod` cannot, so the
 * booking path falls back to advisory locking alone.
 */
export function supportsTransactions() {
  return replicaSetCapable;
}

export async function connectDatabase() {
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    autoIndex: !env.isProduction, // build indexes explicitly in production
  });

  try {
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ hello: 1 });
    replicaSetCapable = Boolean(info.setName || info.msg === 'isdbgrid');
  } catch {
    // Least-privilege users may not be allowed to run `hello`. Assume no
    // transaction support; the advisory lock still guarantees correctness.
    replicaSetCapable = false;
  }

  logger.info('MongoDB connected', {
    database: mongoose.connection.name,
    transactions: replicaSetCapable ? 'enabled' : 'unavailable (advisory lock only)',
  });

  if (env.isProduction) {
    // Ensure indexes exist without paying the cost on every model access.
    await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
    logger.info('MongoDB indexes ensured');
  }

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}

export default connectDatabase;
