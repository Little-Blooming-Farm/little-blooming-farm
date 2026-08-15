import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { adminProperty, adminSyncIcal, adminUpdateProperty } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import SmartImage from '../components/SmartImage.jsx';
import {
  AdminPage,
  Banner,
  Button,
  Card,
  Field,
  Input,
  Textarea,
} from './components.jsx';

const centsToInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2));
const inputToCents = (value) => Math.round(Number(value || 0) * 100);
const linesToArray = (value) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export default function PropertySettings() {
  const { id } = useParams();
  const { data, loading, error, refresh } = useAsync(() => adminProperty(id), [id]);

  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!data?.property) return;
    const p = data.property;
    setForm({
      name: p.name ?? '',
      tagline: p.tagline ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      maxGuests: p.maxGuests ?? 1,
      bedrooms: p.bedrooms ?? 0,
      bathrooms: p.bathrooms ?? 0,
      beds: p.beds ?? 0,
      basePrice: centsToInput(p.basePriceCents),
      cleaningFee: centsToInput(p.cleaningFeeCents),
      minNights: p.minNights ?? 2,
      maxNights: p.maxNights ?? 30,
      checkInTime: p.checkInTime ?? '',
      checkOutTime: p.checkOutTime ?? '',
      amenities: (p.amenities ?? []).join('\n'),
      houseRules: (p.houseRules ?? []).join('\n'),
      cancellationPolicy: p.cancellationPolicy ?? '',
      airbnbIcalUrl: p.airbnbIcalUrl ?? '',
      vrboIcalUrl: p.vrboIcalUrl ?? '',
      whatsappNumber: p.whatsappNumber ?? '',
      isActive: p.isActive ?? true,
      photos: p.photos ?? [],
      depositPercent: p.depositPercent ?? 100,
      balanceDueDays: p.balanceDueDays ?? 30,
      depositOptions: (p.depositOptions ?? []).join(', '),
      agreementTitle: p.rentalAgreement?.title ?? 'Rental Agreement',
      agreementBody: p.rentalAgreement?.body ?? '',
      requireAcceptance: p.rentalAgreement?.requireAcceptance ?? true,
      address: p.address ?? '',
      arrivalInfoReleaseDays: p.arrivalInfoReleaseDays ?? 7,
      gateCode: p.arrivalInfo?.gateCode ?? '',
      doorCode: p.arrivalInfo?.doorCode ?? '',
      wifiNetwork: p.arrivalInfo?.wifiNetwork ?? '',
      wifiPassword: p.arrivalInfo?.wifiPassword ?? '',
      directions: p.arrivalInfo?.directions ?? '',
      parking: p.arrivalInfo?.parking ?? '',
      checkInInstructions: p.arrivalInfo?.checkInInstructions ?? '',
      checkOutInstructions: p.arrivalInfo?.checkOutInstructions ?? '',
      emergencyContact: p.arrivalInfo?.emergencyContact ?? '',
      houseManual: (p.arrivalInfo?.houseManual ?? [])
        .map((h) => `${h.title}\n${h.body}`)
        .join('\n\n---\n\n'),
    });
  }, [data]);

  if (loading || !form) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const property = data.property;
  const set = (key) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await adminUpdateProperty(id, {
        name: form.name,
        tagline: form.tagline,
        shortDescription: form.shortDescription,
        description: form.description,
        maxGuests: Number(form.maxGuests),
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        beds: Number(form.beds),
        basePriceCents: inputToCents(form.basePrice),
        cleaningFeeCents: inputToCents(form.cleaningFee),
        minNights: Number(form.minNights),
        maxNights: Number(form.maxNights),
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        amenities: linesToArray(form.amenities),
        houseRules: linesToArray(form.houseRules),
        cancellationPolicy: form.cancellationPolicy,
        airbnbIcalUrl: form.airbnbIcalUrl.trim(),
        vrboIcalUrl: form.vrboIcalUrl.trim(),
        whatsappNumber: form.whatsappNumber,
        isActive: form.isActive,
        photos: form.photos.map((photo, index) => ({
          url: photo.url,
          publicId: photo.publicId ?? '',
          alt: photo.alt ?? '',
          caption: photo.caption ?? '',
          order: index,
        })),

        depositPercent: Number(form.depositPercent),
        balanceDueDays: Number(form.balanceDueDays),
        depositOptions: form.depositOptions
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isInteger(v) && v > 0 && v < 100),

        rentalAgreement: {
          title: form.agreementTitle,
          body: form.agreementBody,
          requireAcceptance: form.requireAcceptance,
        },

        address: form.address,
        arrivalInfoReleaseDays: Number(form.arrivalInfoReleaseDays),
        arrivalInfo: {
          gateCode: form.gateCode,
          doorCode: form.doorCode,
          wifiNetwork: form.wifiNetwork,
          wifiPassword: form.wifiPassword,
          directions: form.directions,
          parking: form.parking,
          checkInInstructions: form.checkInInstructions,
          checkOutInstructions: form.checkOutInstructions,
          emergencyContact: form.emergencyContact,
          // Entries are separated by a --- line; the first line is the title.
          houseManual: form.houseManual
            .split(/\n\s*---\s*\n/)
            .map((block) => block.trim())
            .filter(Boolean)
            .map((block) => {
              const [title, ...rest] = block.split('\n');
              return { title: title.trim().slice(0, 120), body: rest.join('\n').trim() };
            })
            .filter((entry) => entry.title),
        },
      });
      setNotice({ tone: 'moss', text: 'Saved. The site is already showing the change.' });
      refresh();
    } catch (err) {
      setNotice({
        tone: 'clay',
        text: err.details?.length
          ? `${err.message} (${err.details.map((d) => d.field).join(', ')})`
          : err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const { result } = await adminSyncIcal(id);
      const summary = (result.feeds ?? [])
        .map((f) =>
          f.error
            ? `${f.source}: failed — ${f.error}`
            : `${f.source}: ${f.events} events, ${f.added} added, ${f.removed} removed`
        )
        .join(' · ');
      setNotice({ tone: 'moss', text: summary || 'No calendar feeds are configured yet.' });
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const addPhoto = () => {
    const url = window.prompt('Image URL (upload it in Gallery & media first, then paste it here)');
    if (!url) return;
    setForm((f) => ({ ...f, photos: [...f.photos, { url: url.trim(), alt: '', caption: '' }] }));
  };

  const movePhoto = (index, delta) => {
    setForm((f) => {
      const next = [...f.photos];
      const target = index + delta;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...f, photos: next };
    });
  };

  return (
    <AdminPage
      title={property.name}
      description={`/${property.slug}`}
      actions={
        <Link
          to="/admin/properties"
          className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted hover:text-ink"
        >
          All properties
        </Link>
      }
    >
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <form onSubmit={save} className="space-y-6">
        <Card>
          <h2 className="mb-6 font-display text-xl font-light text-moss-800">The words</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={set('name')} maxLength={120} required />
            </Field>
            <Field label="Tagline">
              <Input value={form.tagline} onChange={set('tagline')} maxLength={200} />
            </Field>
          </div>
          <Field label="Short description" className="mt-6" hint="Used on cards and the booking page.">
            <Textarea rows={2} value={form.shortDescription} onChange={set('shortDescription')} maxLength={500} />
          </Field>
          <Field label="Full description" className="mt-6" hint="Blank lines become paragraphs.">
            <Textarea rows={10} value={form.description} onChange={set('description')} maxLength={8000} />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-6 font-display text-xl font-light text-moss-800">Capacity & price</h2>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Sleeps">
              <Input type="number" min="1" max="40" value={form.maxGuests} onChange={set('maxGuests')} />
            </Field>
            <Field label="Bedrooms">
              <Input type="number" min="0" max="30" value={form.bedrooms} onChange={set('bedrooms')} />
            </Field>
            <Field label="Bathrooms">
              <Input type="number" min="0" max="30" step="0.5" value={form.bathrooms} onChange={set('bathrooms')} />
            </Field>
            <Field label="Beds">
              <Input type="number" min="0" max="60" value={form.beds} onChange={set('beds')} />
            </Field>
            <Field label="Nightly rate" hint="In dollars.">
              <Input type="number" min="0" step="0.01" value={form.basePrice} onChange={set('basePrice')} />
            </Field>
            <Field label="Cleaning fee" hint="In dollars.">
              <Input type="number" min="0" step="0.01" value={form.cleaningFee} onChange={set('cleaningFee')} />
            </Field>
            <Field label="Minimum nights">
              <Input type="number" min="1" max="30" value={form.minNights} onChange={set('minNights')} />
            </Field>
            <Field label="Maximum nights">
              <Input type="number" min="1" max="365" value={form.maxNights} onChange={set('maxNights')} />
            </Field>
            <Field label="Check-in time">
              <Input value={form.checkInTime} onChange={set('checkInTime')} />
            </Field>
            <Field label="Check-out time">
              <Input value={form.checkOutTime} onChange={set('checkOutTime')} />
            </Field>
            <Field label="WhatsApp number" hint="Optional. Shown to confirmed guests.">
              <Input value={form.whatsappNumber} onChange={set('whatsappNumber')} />
            </Field>
            <label className="flex items-center gap-3 self-end pb-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={set('isActive')}
                className="h-4 w-4 accent-moss-700"
              />
              <span className="font-sans text-[14px] font-light text-ink-soft">
                Bookable on the site
              </span>
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="mb-6 font-display text-xl font-light text-moss-800">Amenities & rules</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Amenities" hint="One per line.">
              <Textarea rows={10} value={form.amenities} onChange={set('amenities')} />
            </Field>
            <Field label="House rules" hint="One per line.">
              <Textarea rows={10} value={form.houseRules} onChange={set('houseRules')} />
            </Field>
          </div>
          <Field label="Cancellation policy" className="mt-6" hint="Shown on the booking page and in emails.">
            <Textarea rows={4} value={form.cancellationPolicy} onChange={set('cancellationPolicy')} maxLength={3000} />
          </Field>
        </Card>

        <Card>
          <div className="mb-6 flex items-center justify-between gap-5">
            <h2 className="font-display text-xl font-light text-moss-800">Photos</h2>
            <Button type="button" variant="ghost" onClick={addPhoto}>
              Add photo
            </Button>
          </div>

          {form.photos.length === 0 ? (
            <p className="font-sans text-[14px] font-light text-ink-muted">
              No photos yet. Upload them under Gallery &amp; media, then add the URLs here.
            </p>
          ) : (
            <ul className="space-y-4">
              {form.photos.map((photo, index) => (
                <li
                  key={`${photo.url}-${index}`}
                  className="flex flex-wrap items-start gap-5 border-b border-bloom-300 pb-4 last:border-0"
                >
                  <SmartImage
                    src={photo.url}
                    alt={photo.alt}
                    className="h-20 w-28 shrink-0"
                    showMark={false}
                  />
                  <div className="min-w-[240px] flex-1">
                    <Input
                      placeholder="Alt text — describe the photo"
                      value={photo.alt ?? ''}
                      onChange={(e) =>
                        setForm((f) => {
                          const photos = [...f.photos];
                          photos[index] = { ...photos[index], alt: e.target.value };
                          return { ...f, photos };
                        })
                      }
                    />
                    <p className="mt-2 truncate font-mono text-[11px] text-ink-faint">{photo.url}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" onClick={() => movePhoto(index, -1)}>
                      Up
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => movePhoto(index, 1)}>
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="!text-clay-600"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          photos: f.photos.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-xl font-light text-moss-800">Payment schedule</h2>
          <p className="mb-6 font-sans text-[14px] font-light leading-relaxed text-ink-muted">
            Guests choose how much to pay at booking from the options you list below; paying in
            full is always offered. A stay booked closer than the balance window is always charged
            in full, because there would be no time to collect a balance.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Deposit options offered to guests (%)"
              hint="Comma separated, e.g. 25, 50, 75. Leave blank to remove the choice."
              className="sm:col-span-2"
            >
              <Input
                value={form.depositOptions}
                onChange={set('depositOptions')}
                placeholder="25, 50, 75"
              />
            </Field>
            <Field
              label="Pre-selected option (%)"
              hint="What is highlighted before the guest chooses. 100 means pay in full."
            >
              <Input
                type="number"
                min="1"
                max="100"
                value={form.depositPercent}
                onChange={set('depositPercent')}
              />
            </Field>
            <Field label="Balance due (days before check-in)">
              <Input
                type="number"
                min="0"
                max="365"
                value={form.balanceDueDays}
                onChange={set('balanceDueDays')}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-xl font-light text-moss-800">Rental agreement</h2>
          <p className="mb-6 font-sans text-[14px] font-light leading-relaxed text-ink-muted">
            Guests sign this in their own booking page by typing their name. Editing the text
            bumps its version, and anyone who signed the previous version is asked to sign again
            rather than being held to words they never saw.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Title">
              <Input value={form.agreementTitle} onChange={set('agreementTitle')} maxLength={200} />
            </Field>
            <label className="flex items-center gap-3 self-end pb-3">
              <input
                type="checkbox"
                checked={form.requireAcceptance}
                onChange={set('requireAcceptance')}
                className="h-4 w-4 accent-moss-700"
              />
              <span className="font-sans text-[14px] font-light text-ink-soft">
                Require a signature before arrival details are released
              </span>
            </label>
          </div>
          <Field label="Agreement text" className="mt-6" hint="Blank lines become paragraphs.">
            <Textarea rows={16} value={form.agreementBody} onChange={set('agreementBody')} maxLength={40000} />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-xl font-light text-moss-800">
            Arrival details
          </h2>
          <p className="mb-6 font-sans text-[14px] font-light leading-relaxed text-clay-600">
            These are the keys to the house. They are never shown publicly and never sent to a
            guest until the stay is confirmed, the balance is settled, the agreement is signed,
            and check-in is close.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Address" className="sm:col-span-2">
              <Input value={form.address} onChange={set('address')} maxLength={300} />
            </Field>
            <Field label="Release details this many days before check-in">
              <Input
                type="number"
                min="0"
                max="90"
                value={form.arrivalInfoReleaseDays}
                onChange={set('arrivalInfoReleaseDays')}
              />
            </Field>
            <div />
            <Field label="Gate code">
              <Input value={form.gateCode} onChange={set('gateCode')} maxLength={40} />
            </Field>
            <Field label="Door code">
              <Input value={form.doorCode} onChange={set('doorCode')} maxLength={40} />
            </Field>
            <Field label="Wifi network">
              <Input value={form.wifiNetwork} onChange={set('wifiNetwork')} maxLength={80} />
            </Field>
            <Field label="Wifi password">
              <Input value={form.wifiPassword} onChange={set('wifiPassword')} maxLength={80} />
            </Field>
            <Field label="Emergency contact" className="sm:col-span-2">
              <Input value={form.emergencyContact} onChange={set('emergencyContact')} maxLength={200} />
            </Field>
          </div>

          <Field label="Getting here" className="mt-6">
            <Textarea rows={4} value={form.directions} onChange={set('directions')} maxLength={4000} />
          </Field>
          <Field label="Parking" className="mt-6">
            <Textarea rows={2} value={form.parking} onChange={set('parking')} maxLength={2000} />
          </Field>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Field label="Checking in">
              <Textarea rows={4} value={form.checkInInstructions} onChange={set('checkInInstructions')} maxLength={4000} />
            </Field>
            <Field label="Checking out">
              <Textarea rows={4} value={form.checkOutInstructions} onChange={set('checkOutInstructions')} maxLength={4000} />
            </Field>
          </div>

          <Field
            label="House manual"
            className="mt-6"
            hint="First line of each block is the title. Separate blocks with a line containing only ---"
          >
            <Textarea rows={14} value={form.houseManual} onChange={set('houseManual')} />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-xl font-light text-moss-800">
            Airbnb &amp; VRBO calendars
          </h2>
          <p className="mb-6 font-sans text-[14px] font-light leading-relaxed text-ink-muted">
            Paste the export links from each platform. We poll them automatically and block those
            dates here, so the same night can never be sold twice. Manual blocks you create are
            never touched by a sync.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field
              label="Airbnb iCal export URL"
              hint="Airbnb → Listing → Availability → Sync calendars → Export."
            >
              <Input
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/…"
                value={form.airbnbIcalUrl}
                onChange={set('airbnbIcalUrl')}
              />
            </Field>
            <Field label="VRBO iCal export URL" hint="VRBO → Calendar → Import/Export.">
              <Input
                type="url"
                placeholder="http://www.vrbo.com/icalendar/…"
                value={form.vrboIcalUrl}
                onChange={set('vrboIcalUrl')}
              />
            </Field>
          </div>

          <div className="mt-7 border-t border-bloom-300 pt-6">
            <p className="eyebrow">Your outbound feed</p>
            <p className="mt-3 font-sans text-[14px] font-light text-ink-soft">
              Give this address to Airbnb and VRBO so they block dates booked here:
            </p>
            <code className="mt-3 block break-all border border-bloom-300 bg-bloom-100 p-3 font-mono text-[12px] text-ink-soft">
              {`${import.meta.env.VITE_API_BASE_URL ?? window.location.origin}/api/properties/${property._id}/calendar.ics`}
            </code>

            <Button type="button" variant="quiet" className="mt-6" disabled={syncing} onClick={syncNow}>
              {syncing ? 'Syncing…' : 'Sync calendars now'}
            </Button>
          </div>
        </Card>

        <div className="sticky bottom-0 flex items-center gap-6 border-t border-bloom-300 bg-bloom-100/95 py-5 backdrop-blur">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <span className="font-sans text-[13px] font-light text-ink-muted">
            Changes go live immediately.
          </span>
        </div>
      </form>
    </AdminPage>
  );
}
