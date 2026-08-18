import { getContentPage } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import BlockRenderer from './BlockRenderer.jsx';
import { ErrorState, LoadingState, PageHero } from './ui.jsx';

/**
 * The shared shell for editable long-form pages (The Land, Local Guide, …).
 * Everything below the hero comes from the ContentPage document, so the owner
 * can rewrite these pages from /admin without touching the codebase.
 */
export default function StoryPage({ slug, eyebrow, fallbackTitle, fallbackSubtitle, fallbackImage, tone = 'paper' }) {
  const { data, loading, error, refresh } = useAsync(() => getContentPage(slug), [slug]);

  if (loading) return <LoadingState />;

  // A missing page is a content gap, not an outage — say so plainly.
  if (error && error.status !== 404) {
    return <ErrorState error={error} onRetry={refresh} />;
  }

  const page = data?.page;

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={page?.title ?? fallbackTitle}
        subtitle={page?.subtitle ?? fallbackSubtitle}
        /*
         * `||`, not `??`. The admin panel stores a cleared image field as an
         * empty string, and `??` only falls back on null/undefined — so an
         * emptied hero would defeat the fallback and render the tonal panel
         * instead of a photograph, which reads as a grey block.
         */
        image={page?.heroImage || fallbackImage}
      />

      <div className={tone === 'cream' ? 'bg-bloom-50' : 'bg-bloom-100'}>
        {page ? (
          <BlockRenderer sections={page.sections} />
        ) : (
          <div className="mx-auto max-w-prose px-6 py-30 text-center">
            <p className="prose-farm">
              This page is being written. Come back shortly — or write to us and we will tell you
              about it directly.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
