import { useState } from 'react';

import {
  adminAnimals,
  adminCreateAnimal,
  adminDeleteAnimal,
  adminUpdateAnimal,
} from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import SmartImage from '../components/SmartImage.jsx';
import {
  AdminPage,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Textarea,
} from './components.jsx';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const BLANK = {
  name: '',
  slug: '',
  species: '',
  title: '',
  bio: '',
  funFacts: '',
  photoUrl: '',
  photoAlt: '',
  order: 0,
  isActive: true,
};

function toForm(animal) {
  return {
    name: animal.name ?? '',
    slug: animal.slug ?? '',
    species: animal.species ?? '',
    title: animal.title ?? '',
    bio: animal.bio ?? '',
    funFacts: (animal.funFacts ?? []).join('\n'),
    photoUrl: animal.photo?.url ?? '',
    photoAlt: animal.photo?.alt ?? '',
    order: animal.order ?? 0,
    isActive: animal.isActive ?? true,
  };
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || slugify(form.name),
    species: form.species.trim(),
    title: form.title.trim(),
    bio: form.bio,
    funFacts: form.funFacts
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    photo: { url: form.photoUrl.trim(), alt: form.photoAlt.trim(), publicId: '' },
    order: Number(form.order) || 0,
    isActive: form.isActive,
  };
}

function AnimalForm({ form, setForm, onSubmit, onCancel, busy, submitLabel }) {
  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-5 sm:grid-cols-2"
    >
      <Field label="Name">
        <Input
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({ ...f, name, slug: f.slug || slugify(name) }));
          }}
          required
          maxLength={80}
        />
      </Field>
      <Field label="Web address" hint="Lowercase, dashes only.">
        <Input value={form.slug} onChange={set('slug')} required maxLength={80} />
      </Field>
      <Field label="Species">
        <Input value={form.species} onChange={set('species')} maxLength={80} />
      </Field>
      <Field label="Role" hint='Their job, e.g. "Head of arrivals".'>
        <Input value={form.title} onChange={set('title')} maxLength={120} />
      </Field>
      <Field label="Photo URL" className="sm:col-span-2">
        <Input value={form.photoUrl} onChange={set('photoUrl')} />
      </Field>
      <Field label="Photo description" className="sm:col-span-2">
        <Input value={form.photoAlt} onChange={set('photoAlt')} maxLength={300} />
      </Field>
      <Field label="Bio" className="sm:col-span-2" hint="Blank lines become paragraphs.">
        <Textarea rows={8} value={form.bio} onChange={set('bio')} maxLength={6000} />
      </Field>
      <Field label="Fun facts" className="sm:col-span-2" hint="One per line, up to twelve.">
        <Textarea rows={4} value={form.funFacts} onChange={set('funFacts')} />
      </Field>
      <Field label="Display order">
        <Input type="number" min="0" max="999" value={form.order} onChange={set('order')} />
      </Field>
      <label className="flex items-center gap-3 self-end pb-3">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={set('isActive')}
          className="h-4 w-4 accent-moss-700"
        />
        <span className="font-sans text-[14px] font-light text-ink-soft">Shown on the site</span>
      </label>

      <div className="flex items-center gap-6 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default function AnimalsEditor() {
  const { data, loading, error, refresh } = useAsync(() => adminAnimals(), []);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const animals = data.animals ?? [];

  const run = async (action, message) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: 'moss', text: message });
      setEditingId(null);
      setCreating(false);
      setForm(BLANK);
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Animal profiles"
      description="Everyone who lives here, in the order they appear on the site."
      actions={
        !creating && (
          <Button
            variant="quiet"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setForm({ ...BLANK, order: animals.length });
            }}
          >
            Add an animal
          </Button>
        )
      }
    >
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      {creating && (
        <Card className="mb-6">
          <h2 className="mb-6 font-display text-xl font-light text-moss-800">New profile</h2>
          <AnimalForm
            form={form}
            setForm={setForm}
            busy={busy}
            submitLabel="Create profile"
            onSubmit={() => run(() => adminCreateAnimal(toPayload(form)), 'Profile created.')}
            onCancel={() => {
              setCreating(false);
              setForm(BLANK);
            }}
          />
        </Card>
      )}

      {animals.length === 0 && !creating ? (
        <EmptyState
          title="No profiles yet"
          body="Add Cowboy first. He would want it that way."
        />
      ) : (
        <div className="space-y-5">
          {animals.map((animal) => (
            <Card key={animal._id}>
              {editingId === animal._id ? (
                <>
                  <h2 className="mb-6 font-display text-xl font-light text-moss-800">
                    Editing {animal.name}
                  </h2>
                  <AnimalForm
                    form={form}
                    setForm={setForm}
                    busy={busy}
                    submitLabel="Save changes"
                    onSubmit={() =>
                      run(() => adminUpdateAnimal(animal._id, toPayload(form)), 'Profile saved.')
                    }
                    onCancel={() => setEditingId(null)}
                  />
                </>
              ) : (
                <div className="flex flex-wrap items-start gap-6">
                  <SmartImage
                    src={animal.photo?.url}
                    alt={animal.photo?.alt ?? animal.name}
                    className="h-24 w-24 shrink-0"
                    showMark={false}
                  />
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-2xl font-light text-moss-800">
                        {animal.name}
                      </h2>
                      {!animal.isActive && (
                        <span className="border border-clay-200 bg-clay-100 px-2 py-0.5 font-sans text-[10px] uppercase tracking-label text-clay-600">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-sans text-[13px] font-light text-ink-muted">
                      {animal.species} {animal.title && `· ${animal.title}`} · /{animal.slug}
                    </p>
                    <p className="mt-3 line-clamp-2 font-sans text-[14px] font-light text-ink-soft">
                      {(animal.bio ?? '').split(/\n{2,}/)[0]}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(animal._id);
                        setCreating(false);
                        setForm(toForm(animal));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="!text-clay-600"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete ${animal.name}'s profile? This cannot be undone.`)) {
                          return;
                        }
                        run(() => adminDeleteAnimal(animal._id), 'Profile deleted.');
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
