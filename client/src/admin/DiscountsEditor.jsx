import { useState } from 'react';

import {
  adminCreateDiscount,
  adminDeleteDiscount,
  adminDiscounts,
  adminProperties,
  adminUpdateDiscount,
} from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import { formatDate, formatMoney } from '../lib/format.js';
import {
  AdminPage,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
  Td,
  Textarea,
} from './components.jsx';

const BLANK = {
  code: '',
  label: '',
  kind: 'percent',
  value: 10,
  isActive: true,
  startsAt: '',
  endsAt: '',
  maxRedemptions: '',
  propertyIds: [],
  minNights: '',
  minSubtotalCents: '',
  notes: '',
};

const dateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
/** '' means "no limit", which the API expects as null rather than 0. */
const numberOrNull = (v) => (v === '' || v == null ? null : Number(v));

function describe(d) {
  return d.kind === 'percent' ? `${d.value}% off` : `${formatMoney(d.value)} off`;
}

export default function DiscountsEditor() {
  const { data, loading, error, refresh } = useAsync(() => adminDiscounts(), []);
  const properties = useAsync(() => adminProperties(), []);

  const [form, setForm] = useState(null); // null = closed, {} = creating, {id} = editing
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const discounts = data?.discounts ?? [];
  const homes = properties.data?.properties ?? [];
  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openCreate = () => {
    setNotice(null);
    setForm({ ...BLANK });
  };

  const openEdit = (d) => {
    setNotice(null);
    setForm({
      id: d.id,
      code: d.code,
      label: d.label ?? '',
      kind: d.kind,
      // Fixed amounts are stored in cents and edited in whole currency.
      value: d.kind === 'fixed' ? d.value / 100 : d.value,
      isActive: d.isActive,
      startsAt: dateInput(d.startsAt),
      endsAt: dateInput(d.endsAt),
      maxRedemptions: d.maxRedemptions ?? '',
      propertyIds: d.propertyIds ?? [],
      minNights: d.minNights ?? '',
      minSubtotalCents: d.minSubtotalCents == null ? '' : d.minSubtotalCents / 100,
      notes: d.notes ?? '',
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        label: form.label,
        kind: form.kind,
        value:
          form.kind === 'fixed' ? Math.round(Number(form.value) * 100) : Number(form.value),
        isActive: form.isActive,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        maxRedemptions: numberOrNull(form.maxRedemptions),
        propertyIds: form.propertyIds,
        minNights: numberOrNull(form.minNights),
        minSubtotalCents:
          form.minSubtotalCents === '' ? null : Math.round(Number(form.minSubtotalCents) * 100),
        notes: form.notes,
      };

      if (form.id) await adminUpdateDiscount(form.id, payload);
      else await adminCreateDiscount(payload);

      setNotice({ tone: 'moss', text: `${payload.code} saved.` });
      setForm(null);
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

  const toggleActive = async (d) => {
    setNotice(null);
    try {
      await adminUpdateDiscount(d.id, { isActive: !d.isActive });
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    }
  };

  const remove = async (d) => {
    const warning =
      d.bookingsUsed > 0
        ? `${d.code} has been used by ${d.bookingsUsed} booking(s). Those bookings keep their price — deleting only removes the code. Continue?`
        : `Delete ${d.code}?`;
    if (!window.confirm(warning)) return;

    setNotice(null);
    try {
      await adminDeleteDiscount(d.id);
      setNotice({ tone: 'moss', text: `${d.code} deleted.` });
      refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    }
  };

  return (
    <AdminPage
      title="Discounts"
      description="Codes a guest can enter when they book. Percentage or a fixed amount, taken off the nightly total."
      actions={<Button onClick={openCreate}>New discount</Button>}
    >
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {form && (
        <Card className="mb-8">
          <form onSubmit={save}>
            <h2 className="font-display text-xl font-light text-moss-800">
              {form.id ? `Edit ${form.code}` : 'New discount'}
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Code" hint="Letters, numbers and dashes. Guests type this.">
                <Input value={form.code} onChange={set('code')} required placeholder="SPRING25" />
              </Field>
              <Field label="Label" hint="Shown on the guest's price breakdown.">
                <Input value={form.label} onChange={set('label')} placeholder="Spring offer" />
              </Field>

              <Field label="Type">
                <Select value={form.kind} onChange={set('kind')}>
                  <option value="percent">Percentage off</option>
                  <option value="fixed">Amount off</option>
                </Select>
              </Field>
              <Field
                label={form.kind === 'percent' ? 'Percent off' : 'Amount off'}
                hint={form.kind === 'percent' ? '1 to 100' : 'In dollars, e.g. 150'}
              >
                <Input
                  type="number"
                  min="1"
                  max={form.kind === 'percent' ? 100 : undefined}
                  step={form.kind === 'percent' ? 1 : '0.01'}
                  value={form.value}
                  onChange={set('value')}
                  required
                />
              </Field>

              <Field label="Starts" hint="Leave blank to start immediately.">
                <Input type="date" value={form.startsAt} onChange={set('startsAt')} />
              </Field>
              <Field label="Ends" hint="Leave blank for no end date.">
                <Input type="date" value={form.endsAt} onChange={set('endsAt')} />
              </Field>

              <Field label="Maximum redemptions" hint="Leave blank for unlimited.">
                <Input
                  type="number"
                  min="1"
                  value={form.maxRedemptions}
                  onChange={set('maxRedemptions')}
                />
              </Field>
              <Field label="Minimum nights" hint="Leave blank for any length of stay.">
                <Input type="number" min="1" value={form.minNights} onChange={set('minNights')} />
              </Field>

              <Field label="Minimum booking value" hint="In dollars. Leave blank for any.">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minSubtotalCents}
                  onChange={set('minSubtotalCents')}
                />
              </Field>
              <Field label="Applies to" hint="Leave all unticked for every home.">
                <div className="space-y-2 pt-2">
                  {homes.map((p) => (
                    <label key={p._id} className="flex items-center gap-2 font-sans text-[14px]">
                      <input
                        type="checkbox"
                        checked={form.propertyIds.includes(p._id)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            propertyIds: e.target.checked
                              ? [...f.propertyIds, p._id]
                              : f.propertyIds.filter((id) => id !== p._id),
                          }))
                        }
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Notes" className="mt-5" hint="For you, never shown to guests.">
              <Textarea rows={2} value={form.notes} onChange={set('notes')} />
            </Field>

            <label className="mt-5 flex items-center gap-2 font-sans text-[14px]">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
              Active — guests can use this code
            </label>

            <div className="mt-7 flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save discount'}
              </Button>
              <Button type="button" variant="quiet" onClick={() => setForm(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {discounts.length === 0 ? (
        <EmptyState
          title="No discounts yet"
          body="Create a code and guests can enter it on the booking page."
          action={<Button onClick={openCreate}>New discount</Button>}
        />
      ) : (
        <Table headers={['Code', 'Discount', 'Valid', 'Used', 'Status', '']}>
          {discounts.map((d) => (
            <tr key={d.id} className="border-t border-bloom-300">
              <Td>
                <span className="font-mono text-[14px] text-ink">{d.code}</span>
                {d.label && (
                  <span className="mt-0.5 block font-sans text-[12px] text-ink-muted">{d.label}</span>
                )}
              </Td>
              <Td>{describe(d)}</Td>
              <Td className="font-sans text-[13px] text-ink-muted">
                {d.startsAt || d.endsAt ? (
                  <>
                    {d.startsAt ? formatDate(d.startsAt, { month: 'short', day: 'numeric' }) : 'now'}
                    {' – '}
                    {d.endsAt ? formatDate(d.endsAt, { month: 'short', day: 'numeric' }) : 'open'}
                  </>
                ) : (
                  'Always'
                )}
                {d.minNights ? <div>{d.minNights}+ nights</div> : null}
              </Td>
              <Td className="font-sans text-[13px] text-ink-muted">
                {d.bookingsUsed} booking{d.bookingsUsed === 1 ? '' : 's'}
                {d.guestsSavedCents > 0 && <div>{formatMoney(d.guestsSavedCents)} given</div>}
                {d.maxRedemptions != null && (
                  <div>
                    {d.remaining} of {d.maxRedemptions} left
                  </div>
                )}
              </Td>
              <Td>
                <span
                  className={`font-sans text-[12px] ${d.isActive ? 'text-moss-700' : 'text-ink-faint'}`}
                >
                  {d.isActive ? 'Active' : 'Off'}
                </span>
              </Td>
              <Td>
                <div className="flex justify-end gap-3 font-sans text-[12px]">
                  <button type="button" className="link-underline" onClick={() => openEdit(d)}>
                    Edit
                  </button>
                  <button type="button" className="link-underline" onClick={() => toggleActive(d)}>
                    {d.isActive ? 'Turn off' : 'Turn on'}
                  </button>
                  <button
                    type="button"
                    className="link-underline text-clay-600"
                    onClick={() => remove(d)}
                  >
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </AdminPage>
  );
}
