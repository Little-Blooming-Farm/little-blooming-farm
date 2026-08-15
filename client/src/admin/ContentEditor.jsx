import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { adminContentPage, adminContentPages, adminSaveContentPage } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import { AdminPage, Banner, Button, Card, Field, Input, Select, Textarea } from './components.jsx';

/**
 * Field descriptors per block type. Adding a new block means adding it here and
 * in BlockRenderer — the schema on the server is intentionally open, so nothing
 * else has to change.
 */
const BLOCK_FIELDS = {
  richText: [
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea', rows: 8, hint: 'Blank lines become paragraphs.' },
  ],
  imageText: [
    { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea', rows: 6 },
    { key: 'image.url', label: 'Image URL', type: 'text' },
    { key: 'image.alt', label: 'Image description', type: 'text' },
    {
      key: 'imagePosition',
      label: 'Image side',
      type: 'select',
      options: [
        ['left', 'Left'],
        ['right', 'Right'],
      ],
    },
    { key: 'buttonLabel', label: 'Button label', type: 'text' },
    { key: 'buttonHref', label: 'Button link', type: 'text' },
  ],
  fullBleedImage: [
    { key: 'image.url', label: 'Image URL', type: 'text' },
    { key: 'image.alt', label: 'Image description', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
  ],
  quote: [
    { key: 'body', label: 'Quote', type: 'textarea', rows: 3 },
    { key: 'attribution', label: 'Attribution', type: 'text' },
  ],
  grid: [
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'intro', label: 'Intro', type: 'textarea', rows: 3 },
    {
      key: 'items',
      label: 'Items',
      type: 'repeater',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'body', label: 'Description', type: 'textarea', rows: 3 },
        { key: 'image.url', label: 'Image URL', type: 'text' },
        { key: 'image.alt', label: 'Image description', type: 'text' },
      ],
    },
  ],
  gallery: [
    { key: 'heading', label: 'Heading', type: 'text' },
    {
      key: 'images',
      label: 'Images',
      type: 'repeater',
      fields: [
        { key: 'url', label: 'Image URL', type: 'text' },
        { key: 'alt', label: 'Image description', type: 'text' },
      ],
    },
  ],
  list: [
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'items', label: 'Items', type: 'lines', hint: 'One per line.' },
  ],
  cta: [
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea', rows: 3 },
    { key: 'buttonLabel', label: 'Button label', type: 'text' },
    { key: 'buttonHref', label: 'Button link', type: 'text' },
  ],
  spacer: [
    {
      key: 'size',
      label: 'Size',
      type: 'select',
      options: [
        ['sm', 'Small'],
        ['md', 'Medium'],
        ['lg', 'Large'],
        ['xl', 'Extra large'],
      ],
    },
  ],
};

const BLOCK_LABELS = {
  richText: 'Text',
  imageText: 'Image + text',
  fullBleedImage: 'Full-width image',
  quote: 'Quote',
  grid: 'Card grid',
  gallery: 'Image grid',
  list: 'List',
  cta: 'Call to action',
  spacer: 'Spacer',
};

const getPath = (object, path) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), object);

const setPath = (object, path, value) => {
  const keys = path.split('.');
  const next = { ...object };
  let cursor = next;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] ?? {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  return next;
};

function BlockField({ field, content, onChange }) {
  const raw = getPath(content, field.key);

  if (field.type === 'select') {
    return (
      <Field label={field.label} hint={field.hint}>
        <Select value={raw ?? field.options[0][0]} onChange={(e) => onChange(field.key, e.target.value)}>
          {field.options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.type === 'textarea') {
    return (
      <Field label={field.label} hint={field.hint}>
        <Textarea
          rows={field.rows ?? 4}
          value={raw ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      </Field>
    );
  }

  if (field.type === 'lines') {
    return (
      <Field label={field.label} hint={field.hint}>
        <Textarea
          rows={6}
          value={(raw ?? []).join('\n')}
          onChange={(e) =>
            onChange(
              field.key,
              e.target.value.split('\n').map((line) => line.trim()).filter(Boolean)
            )
          }
        />
      </Field>
    );
  }

  if (field.type === 'repeater') {
    const items = raw ?? [];
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="field-label !mb-0">{field.label}</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(field.key, [...items, {}])}
          >
            Add item
          </Button>
        </div>
        <div className="space-y-5">
          {items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="border border-bloom-300 bg-bloom-100 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
                  Item {index + 1}
                </span>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (index === 0) return;
                      const next = [...items];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      onChange(field.key, next);
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (index === items.length - 1) return;
                      const next = [...items];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      onChange(field.key, next);
                    }}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!text-clay-600"
                    onClick={() => onChange(field.key, items.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {field.fields.map((sub) => (
                  <BlockField
                    key={sub.key}
                    field={sub}
                    content={item}
                    onChange={(subKey, value) => {
                      const next = [...items];
                      next[index] = setPath(next[index] ?? {}, subKey, value);
                      onChange(field.key, next);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Field label={field.label} hint={field.hint}>
      <Input value={raw ?? ''} onChange={(e) => onChange(field.key, e.target.value)} />
    </Field>
  );
}

export default function ContentEditor() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const index = useAsync(() => adminContentPages(), []);

  const [page, setPage] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    if (!slug) {
      setPage(null);
      return;
    }
    let cancelled = false;
    setLoadingPage(true);
    adminContentPage(slug)
      .then((result) => {
        if (!cancelled) setPage(result.page);
      })
      .catch((err) => {
        if (!cancelled) setNotice({ tone: 'clay', text: err.message });
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (index.loading) return <LoadingState />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refresh} />;

  const pages = index.data?.pages ?? [];

  const updateSection = (sectionIndex, updater) => {
    setPage((current) => {
      const sections = [...current.sections];
      sections[sectionIndex] = updater(sections[sectionIndex]);
      return { ...current, sections };
    });
  };

  const moveSection = (sectionIndex, delta) => {
    setPage((current) => {
      const target = sectionIndex + delta;
      if (target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[sectionIndex], sections[target]] = [sections[target], sections[sectionIndex]];
      return { ...current, sections };
    });
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await adminSaveContentPage(page.slug, {
        title: page.title,
        subtitle: page.subtitle ?? '',
        seo: {
          title: page.seo?.title ?? '',
          description: page.seo?.description ?? '',
          image: page.seo?.image ?? '',
        },
        heroImage: page.heroImage ?? '',
        heroVideo: page.heroVideo ?? '',
        isPublished: page.isPublished ?? true,
        sections: page.sections.map((section, i) => ({
          type: section.type,
          order: i,
          content: section.content ?? {},
        })),
      });
      setNotice({ tone: 'moss', text: 'Saved. The page is live.' });
      index.refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage
      title="Content pages"
      description="Rewrite the story pages without touching the code or redeploying."
    >
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <Card className="h-fit">
          <p className="eyebrow mb-4">Pages</p>
          <ul className="space-y-1">
            {pages.map((entry) => (
              <li key={entry.slug}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/content/${entry.slug}`)}
                  className={`block w-full border-l-2 py-2 pl-3 text-left font-sans text-[14px] font-light transition-colors duration-300 ${
                    entry.slug === slug
                      ? 'border-moss-600 text-moss-800'
                      : 'border-transparent text-ink-soft hover:border-bloom-300 hover:text-ink'
                  }`}
                >
                  {entry.title}
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                    /{entry.slug}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div>
          {!slug && (
            <Card>
              <p className="font-sans text-[15px] font-light text-ink-soft">
                Choose a page on the left to edit it.
              </p>
            </Card>
          )}

          {slug && (loadingPage || !page) && <LoadingState />}

          {slug && page && (
            <div className="space-y-6">
              <Card>
                <h2 className="mb-6 font-display text-xl font-light text-moss-800">Page</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Title">
                    <Input
                      value={page.title ?? ''}
                      onChange={(e) => setPage({ ...page, title: e.target.value })}
                    />
                  </Field>
                  <Field label="Standfirst">
                    <Input
                      value={page.subtitle ?? ''}
                      onChange={(e) => setPage({ ...page, subtitle: e.target.value })}
                    />
                  </Field>
                  <Field label="Hero image URL">
                    <Input
                      value={page.heroImage ?? ''}
                      onChange={(e) => setPage({ ...page, heroImage: e.target.value })}
                    />
                  </Field>
                  <Field label="Search description" hint="Shown in Google results.">
                    <Input
                      value={page.seo?.description ?? ''}
                      onChange={(e) =>
                        setPage({ ...page, seo: { ...(page.seo ?? {}), description: e.target.value } })
                      }
                    />
                  </Field>
                </div>
                <label className="mt-6 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={page.isPublished ?? true}
                    onChange={(e) => setPage({ ...page, isPublished: e.target.checked })}
                    className="h-4 w-4 accent-moss-700"
                  />
                  <span className="font-sans text-[14px] font-light text-ink-soft">
                    Visible on the site
                  </span>
                </label>
              </Card>

              {(page.sections ?? []).map((section, sectionIndex) => (
                <Card key={section._id ?? section.id ?? sectionIndex}>
                  <div className="mb-6 flex items-center justify-between gap-4 border-b border-bloom-300 pb-4">
                    <div className="flex items-center gap-4">
                      <span className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
                        {sectionIndex + 1}
                      </span>
                      <Select
                        value={section.type}
                        className="!w-auto !py-1.5"
                        onChange={(e) =>
                          updateSection(sectionIndex, (s) => ({ ...s, type: e.target.value }))
                        }
                      >
                        {Object.entries(BLOCK_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex gap-3">
                      <Button type="button" variant="ghost" onClick={() => moveSection(sectionIndex, -1)}>
                        Up
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => moveSection(sectionIndex, 1)}>
                        Down
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!text-clay-600"
                        onClick={() =>
                          setPage({
                            ...page,
                            sections: page.sections.filter((_, i) => i !== sectionIndex),
                          })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {(BLOCK_FIELDS[section.type] ?? []).map((field) => (
                      <div
                        key={field.key}
                        className={
                          field.type === 'repeater' || field.type === 'textarea' || field.type === 'lines'
                            ? 'sm:col-span-2'
                            : ''
                        }
                      >
                        <BlockField
                          field={field}
                          content={section.content ?? {}}
                          onChange={(key, value) =>
                            updateSection(sectionIndex, (s) => ({
                              ...s,
                              content: setPath(s.content ?? {}, key, value),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              <Card>
                <p className="eyebrow mb-4">Add a section</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(BLOCK_LABELS).map(([type, label]) => (
                    <Button
                      key={type}
                      type="button"
                      variant="ghost"
                      className="border border-bloom-300 px-3 py-2"
                      onClick={() =>
                        setPage({
                          ...page,
                          sections: [...(page.sections ?? []), { type, content: {} }],
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </Card>

              <div className="sticky bottom-0 flex items-center gap-6 border-t border-bloom-300 bg-bloom-100/95 py-5 backdrop-blur">
                <Button type="button" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save page'}
                </Button>
                <a
                  href={`/${page.slug === 'stay' ? 'stay' : page.slug}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
                >
                  Preview page
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
