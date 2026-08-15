import { useRef, useState } from 'react';

import {
  adminDeleteMedia,
  adminMedia,
  adminReorderMedia,
  adminUpdateMedia,
  adminUploadMedia,
} from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import SmartImage from '../components/SmartImage.jsx';
import { AdminPage, Banner, Button, Card, EmptyState, Field, Input, Select } from './components.jsx';

const COLLECTIONS = ['gallery', 'stay', 'the-land', 'experiences', 'animals', 'local', 'erin', 'home'];

export default function MediaManager() {
  const [collection, setCollection] = useState('gallery');
  const { data, loading, error, refresh } = useAsync(
    () => adminMedia(`?collection=${collection}&limit=300`),
    [collection]
  );

  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ alt: '', caption: '' });

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    setNotice(null);
    setProgress(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);

    try {
      // The endpoint takes up to 12 files at once; chunk anything larger.
      const list = Array.from(files);
      for (let i = 0; i < list.length; i += 12) {
        const chunk = list.slice(i, i + 12);
        const formData = new FormData();
        chunk.forEach((file) => formData.append('files', file));
        formData.append('collection', collection);
        await adminUploadMedia(formData);
        setProgress(`Uploaded ${Math.min(i + chunk.length, list.length)} of ${list.length}…`);
      }
      setNotice({ tone: 'moss', text: 'Uploaded.' });
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setUploading(false);
      setProgress('');
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const move = async (index, delta) => {
    const items = [...(data?.media ?? [])];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];

    setBusy(true);
    try {
      await adminReorderMedia(items.map((item, i) => ({ id: item._id, order: i })));
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async (id) => {
    setBusy(true);
    try {
      await adminUpdateMedia(id, { alt: draft.alt, caption: draft.caption });
      setEditingId(null);
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm('Delete this file? It is removed from storage as well.')) return;
    setBusy(true);
    try {
      await adminDeleteMedia(item._id);
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const media = data?.media ?? [];

  return (
    <AdminPage
      title="Gallery & media"
      description="Upload photographs and video, set their descriptions, and order them."
      actions={
        <Select
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          className="!w-auto !py-2"
        >
          {COLLECTIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      }
    >
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <Card className="mb-7">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
          className="border border-dashed border-bloom-300 px-8 py-12 text-center"
        >
          <p className="font-display text-xl font-light text-moss-800">
            Drop files here, or choose them
          </p>
          <p className="mx-auto mt-2 max-w-[52ch] font-sans text-[13px] font-light text-ink-muted">
            JPEG, PNG, WebP, AVIF or GIF up to 15 MB. MP4, WebM or MOV up to 200 MB. Files are
            checked by their actual contents, not their names.
          </p>

          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={(e) => upload(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            variant="quiet"
            className="mt-6"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? progress || 'Uploading…' : `Add to “${collection}”`}
          </Button>
        </div>
      </Card>

      {media.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={`The “${collection}” collection is empty. Drop some files above to fill it.`}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {media.map((item, index) => (
            <Card key={item._id} className="!p-0">
              <SmartImage
                src={item.thumbnailUrl || item.url}
                alt={item.alt ?? ''}
                ratio="4 / 3"
                className="w-full"
                showMark={false}
              />

              <div className="p-5">
                {editingId === item._id ? (
                  <div className="space-y-4">
                    <Field label="Description" hint="Read aloud by screen readers.">
                      <Input
                        value={draft.alt}
                        maxLength={300}
                        onChange={(e) => setDraft((d) => ({ ...d, alt: e.target.value }))}
                      />
                    </Field>
                    <Field label="Caption">
                      <Input
                        value={draft.caption}
                        maxLength={300}
                        onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                      />
                    </Field>
                    <div className="flex items-center gap-5">
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={busy}
                        onClick={() => saveDetails(item._id)}
                      >
                        Save
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-sans text-[14px] font-light text-ink">
                      {item.alt || <span className="text-clay-600">No description yet</span>}
                    </p>
                    <p className="mt-1 font-sans text-[12px] font-light text-ink-faint">
                      {item.type} · {item.width || '?'}×{item.height || '?'} ·{' '}
                      {Math.round((item.bytes ?? 0) / 1024)} KB
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingId(item._id);
                          setDraft({ alt: item.alt ?? '', caption: item.caption ?? '' });
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => move(index, -1)}>
                        Up
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => move(index, 1)}>
                        Down
                      </Button>
                      <Button
                        variant="ghost"
                        className="!text-clay-600"
                        disabled={busy}
                        onClick={() => remove(item)}
                      >
                        Delete
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(item.url)}
                      className="mt-4 block w-full truncate border border-bloom-300 bg-bloom-100 px-3 py-2 text-left font-mono text-[11px] text-ink-muted hover:text-ink"
                      title="Copy URL"
                    >
                      {item.url}
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
