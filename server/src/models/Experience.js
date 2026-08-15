import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Experiences are content-only today (feed the alpacas, pizza night, stargazing).
 * The commercial fields below are deliberately present but inert — flipping
 * `isBookable` is all that stands between this and a paid add-on, so the model
 * never has to be migrated later.
 */
const experienceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'],
    },
    shortDescription: { type: String, trim: true, maxlength: 400, default: '' },
    description: { type: String, trim: true, maxlength: 6000, default: '' },

    image: {
      url: { type: String, trim: true, default: '' },
      publicId: { type: String, trim: true, default: '' },
      alt: { type: String, trim: true, maxlength: 300, default: '' },
    },

    category: {
      type: String,
      enum: ['animals', 'garden', 'gathering', 'kids', 'seasonal', 'quiet'],
      default: 'gathering',
    },
    season: { type: String, trim: true, maxlength: 120, default: 'Year-round' },
    duration: { type: String, trim: true, maxlength: 80, default: '' },

    // --- Dormant add-on fields ------------------------------------------------
    isBookable: { type: Boolean, default: false },
    priceCents: { type: Number, min: 0, default: 0 },
    maxParticipants: { type: Number, min: 0, default: 0 },
    requiresAdvanceNotice: { type: Boolean, default: false },
    advanceNoticeHours: { type: Number, min: 0, default: 48 },
    // -------------------------------------------------------------------------

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

experienceSchema.index({ isActive: 1, order: 1 });
experienceSchema.index({ category: 1, order: 1 });

experienceSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    title: this.title,
    slug: this.slug,
    shortDescription: this.shortDescription,
    description: this.description,
    image: { url: this.image?.url ?? '', alt: this.image?.alt ?? this.title },
    category: this.category,
    season: this.season,
    duration: this.duration,
    isBookable: this.isBookable,
    priceCents: this.isBookable ? this.priceCents : null,
    order: this.order,
  };
};

export const Experience = mongoose.model('Experience', experienceSchema);
export default Experience;
