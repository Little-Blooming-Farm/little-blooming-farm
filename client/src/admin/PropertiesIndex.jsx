import { Link } from 'react-router-dom';

import { adminProperties } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import SmartImage from '../components/SmartImage.jsx';
import { AdminPage, Card } from './components.jsx';
import { formatDate, formatMoney } from '../lib/format.js';

export default function PropertiesIndex() {
  const { data, loading, error, refresh } = useAsync(() => adminProperties(), []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  return (
    <AdminPage
      title="Properties"
      description="Each home has its own pricing, photos, policies and calendar feeds."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {(data.properties ?? []).map((property) => (
          <Card key={property._id} className="!p-0">
            <SmartImage
              src={property.photos?.[0]?.url}
              alt={property.name}
              ratio="16 / 9"
              className="w-full"
              showMark={false}
            />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-light text-moss-800">
                    {property.name}
                  </h2>
                  <p className="mt-1 font-sans text-[13px] font-light text-ink-muted">
                    /{property.slug} · sleeps {property.maxGuests}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-2.5 py-1 font-sans text-[10px] uppercase tracking-label ${
                    property.isActive
                      ? 'border-moss-300 bg-moss-50 text-moss-700'
                      : 'border-clay-200 bg-clay-100 text-clay-600'
                  }`}
                >
                  {property.isActive ? 'Live' : 'Hidden'}
                </span>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-bloom-300 pt-5 sm:grid-cols-3">
                {[
                  ['Nightly', formatMoney(property.basePriceCents)],
                  ['Cleaning', formatMoney(property.cleaningFeeCents)],
                  ['Minimum', `${property.minNights} nights`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="eyebrow">{label}</dt>
                    <dd className="mt-1.5 font-sans text-[15px] text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 font-sans text-[12px] font-light text-ink-faint">
                {property.airbnbIcalUrl || property.vrboIcalUrl
                  ? property.lastIcalSyncAt
                    ? `Calendars synced ${formatDate(property.lastIcalSyncAt, {
                        month: 'short',
                        day: 'numeric',
                      })} — ${property.lastIcalSyncStatus || 'OK'}`
                    : 'Calendar feeds set, not yet synced'
                  : 'No Airbnb or VRBO calendar connected'}
              </p>

              <Link
                to={`/admin/properties/${property._id}`}
                className="btn-quiet mt-7 text-moss-700"
              >
                <span>Edit settings</span>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
