/**
 * Create or reset an admin account.
 *
 *   npm run create-admin -- --email you@example.com
 *   npm run create-admin -- --email you@example.com --password 'a long passphrase'
 *   npm run create-admin -- --email you@example.com --reset
 *
 * With no --password, a strong one is generated and printed once. It is never
 * written to the database in plaintext and never logged again.
 */
import { randomBytes } from 'node:crypto';

import logger from '../lib/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Admin } from '../models/Admin.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/** Readable, high-entropy passphrase: 4 groups of 5 base32-ish characters. */
function generatePassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('\nUsage: npm run create-admin -- --email you@example.com [--password "…"] [--reset]\n');
    process.exit(1);
  }

  const password = typeof args.password === 'string' ? args.password : generatePassword();
  const generated = typeof args.password !== 'string';

  if (password.length < 12) {
    console.error('\nPassword must be at least 12 characters.\n');
    process.exit(1);
  }

  await connectDatabase();

  const existing = await Admin.findOne({ email });

  if (existing && !args.reset) {
    console.error(
      `\nAn admin with ${email} already exists. Re-run with --reset to set a new password.\n`
    );
    await disconnectDatabase();
    process.exit(1);
  }

  if (existing) {
    existing.passwordHash = await Admin.hashPassword(password);
    existing.tokenVersion += 1; // sign out every existing session
    existing.failedLoginAttempts = 0;
    existing.lockedUntil = null;
    existing.isActive = true;
    await existing.save();
    logger.info('Admin password reset', { email });
  } else {
    await Admin.create({
      email,
      passwordHash: await Admin.hashPassword(password),
      name: typeof args.name === 'string' ? args.name : '',
      role: 'owner',
    });
    logger.info('Admin created', { email });
  }

  console.log('\n  Admin account ready');
  console.log(`  Email:    ${email}`);
  if (generated) {
    console.log(`  Password: ${password}`);
    console.log('\n  This password is shown once. Store it in a password manager now.\n');
  } else {
    console.log('  Password: (the one you supplied)\n');
  }

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error('create-admin failed', { error: err.message });
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
