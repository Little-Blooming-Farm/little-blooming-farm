import mongoose from 'mongoose';

const { Schema } = mongoose;

const animalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'],
    },

    // "Great Pyrenees", "Alpacas", "Nigerian Dwarf Goats"…
    species: { type: String, trim: true, maxlength: 80, default: '' },
    // A one-line role, e.g. "Head of security (retired)".
    title: { type: String, trim: true, maxlength: 120, default: '' },

    photo: {
      url: { type: String, trim: true, default: '' },
      publicId: { type: String, trim: true, default: '' },
      alt: { type: String, trim: true, maxlength: 300, default: '' },
    },
    gallery: {
      type: [
        {
          url: { type: String, trim: true },
          publicId: { type: String, trim: true },
          alt: { type: String, trim: true, maxlength: 300, default: '' },
        },
      ],
      default: [],
    },

    bio: { type: String, trim: true, maxlength: 6000, default: '' },
    funFacts: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: [],
      validate: [(v) => v.length <= 12, 'at most 12 fun facts'],
    },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

animalSchema.index({ isActive: 1, order: 1 });

animalSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    species: this.species,
    title: this.title,
    photo: { url: this.photo?.url ?? '', alt: this.photo?.alt ?? this.name },
    gallery: (this.gallery ?? []).map((g) => ({ url: g.url, alt: g.alt })),
    bio: this.bio,
    funFacts: this.funFacts,
    order: this.order,
  };
};

export const Animal = mongoose.model('Animal', animalSchema);
export default Animal;
