/**
 * Seeding that can run without a shell.
 *
 * Render's Shell tab is a paid feature, so on the free plan there is no way to
 * run `npm run seed` against the deployed database — which would otherwise
 * leave the site permanently empty. This module holds the seeding logic so both
 * the CLI script and the server itself can use it.
 *
 * Everything here is idempotent: content is upserted by slug, so running it
 * repeatedly restores the shipped copy without duplicating anything and without
 * ever touching bookings.
 */
import { Property } from '../models/Property.js';
import { Animal } from '../models/Animal.js';
import { Experience } from '../models/Experience.js';
import { ContentPage } from '../models/ContentPage.js';
import { Media } from '../models/Media.js';
import { Admin } from '../models/Admin.js';
import logger from '../lib/logger.js';
import { animals, contentPages, experiences, gallery, properties } from '../scripts/seedData.js';

async function upsertAll(Model, docs, key = 'slug') {
  const result = await Model.bulkWrite(
    docs.map((doc) => ({
      updateOne: { filter: { [key]: doc[key] }, update: { $set: doc }, upsert: true },
    })),
    { ordered: false }
  );
  return { inserted: result.upsertedCount ?? 0, updated: result.modifiedCount ?? 0 };
}

async function seedGallery() {
  let created = 0;
  for (const item of gallery) {
    if (await Media.findOne({ url: item.url }).lean()) continue;
    await Media.create({
      url: item.url,
      thumbnailUrl: item.url,
      type: 'image',
      alt: item.alt,
      caption: item.alt,
      collectionName: 'gallery',
      order: item.order,
      provider: 'local',
    });
    created += 1;
  }
  return created;
}

/** Load or refresh the shipped content. Never touches bookings. */
export async function seedContent() {
  const [property, animal, experience, page, galleryCreated] = [
    await upsertAll(Property, properties),
    await upsertAll(Animal, animals),
    await upsertAll(Experience, experiences),
    await upsertAll(ContentPage, contentPages),
    await seedGallery(),
  ];

  return { property, animal, experience, page, galleryCreated };
}

/**
 * Create the first admin from the environment, if one is asked for and none
 * exists. Never changes an existing account — a redeploy must not silently
 * reset the owner's password, and it must not resurrect an account that was
 * deliberately deleted while the variables are still set.
 */
export async function seedAdminFromEnv({ email, password }) {
  if (!email || !password) return { created: false, reason: 'not configured' };
  if (password.length < 12) {
    logger.error('SEED_ADMIN_PASSWORD is too short (needs 12+ characters) — admin not created');
    return { created: false, reason: 'password too short' };
  }

  /**
   * Keyed on the address, not on "are there any admins at all".
   *
   * The safety property worth keeping is that a redeploy must never silently
   * reset someone's password — so an address that already exists is left
   * completely alone. Checking the address rather than the count also makes
   * this the way to add a *second* admin on a host with no shell, which is
   * otherwise impossible on Render's free plan.
   */
  const address = email.trim().toLowerCase();
  const existing = await Admin.findOne({ email: address });
  if (existing) {
    return { created: false, reason: `${address} already exists — password left unchanged` };
  }

  const admin = await Admin.create({
    email: address,
    passwordHash: await Admin.hashPassword(password),
    role: 'owner',
  });

  logger.info('Admin account created from environment', { email: admin.email });
  return { created: true, email: admin.email };
}

/**
 * Startup bootstrap for hosts without shell access.
 *
 * Deliberately gated on AUTO_SEED rather than "is the database empty", so it
 * can never surprise anyone by repopulating a database that was emptied on
 * purpose. Runs after the HTTP port is already listening, so a slow seed cannot
 * delay the port and get the deploy killed.
 */
export async function runStartupBootstrap({ autoSeed, adminEmail, adminPassword }) {
  if (!autoSeed) return { ran: false };

  try {
    const propertyCount = await Property.countDocuments();
    const result = await seedContent();

    logger.info('Auto-seed complete', {
      propertiesBefore: propertyCount,
      properties: result.property,
      contentPages: result.page,
      galleryItemsCreated: result.galleryCreated,
    });

    const admin = await seedAdminFromEnv({ email: adminEmail, password: adminPassword });
    if (admin.created) {
      logger.warn(
        'An admin was created from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD. ' +
          'Remove those variables and change the password once you have signed in.'
      );
    }

    return { ran: true, ...result, admin };
  } catch (err) {
    // Never fatal: the API is already serving, and a failed seed is a content
    // problem, not an availability one.
    logger.error('Auto-seed failed', { error: err.message });
    return { ran: true, error: err.message };
  }
}
