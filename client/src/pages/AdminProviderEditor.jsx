import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import AdminEditorPage from '@/components/AdminEditorPage';
import MapCard from '@/components/MapCard';
import Wizard from '@/components/wizard/Wizard';
import { WizCheck, WizField } from '@/components/wizard/WizardField';
import { CATEGORIES, PROVIDER_TYPES } from '@/lib/directory';
import { collect, digits, httpsLink, meetLink, requiredText } from '@/lib/wizard';

const LIST = '/admin/providers';

const BLANK = {
  name: '', category: 'lawyer', type: 'pro_bono_lawyer', location: '', contact: '', services: '', languages: '',
  is_free: true, official_source_url: '', bookable: false, meet_link: '', user_id: '',
  address: '', hours: '', address_note: '',
};

// The help card under the entry form. Each line is a rule the admin must keep to.
const ENTRY_HELP = {
  title: 'Before you publish',
  intro: 'Publishing stamps today’s date as the day the facts were checked.',
  items: [
    'Name the body as it publishes its own name.',
    'The expert account receives the bookings and shared matters for this entry. Without it that expert’s inbox stays empty.',
    'Every checked fact points to the body’s own page.',
    'Write the office and the opening hours as the body publishes them.',
  ],
};

const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label ?? value;
const typeLabel = (value) => PROVIDER_TYPES.find((t) => t.value === value)?.label ?? value;

// The form starts from the saved entry. With these update rules a blank box means "empty this".
// An empty account box would unlink an expert while someone edited a phone number. So the form
// shows what is saved first. A published entry is saved as a draft once a checked fact changes, so
// the wizard holds the save until the admin ticks "I understand" on the last step.
function ProviderForm({ provider, onRefresh }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => {
    if (!provider) return BLANK;
    return Object.fromEntries(Object.keys(BLANK).map((key) => [key, provider[key] ?? BLANK[key]]));
  });
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const published = provider?.status === 'published';

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const flip = (key) => (checked) => setValues((v) => ({ ...v, [key]: checked }));

  // A save sends the form body. Publishing is a second call made only when the server says the entry is not yet published.
  // A publish stamps today's date as the check date.
  // A successful save returns to the list which loads the entries again.
  // If the publish is refused the page stays so the message is read.
  // A new entry that was saved but not published goes to its own page. It exists now and a second save would create a copy.
  async function save(publishAfter) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const body = { ...values, user_id: String(values.user_id).trim() === '' ? null : Number(values.user_id) };
    try {
      const row = provider
        ? await apiPut(`/directory/providers/${provider.id}`, body)
        : await apiPost('/directory/providers', body);
      if (publishAfter && row?.status !== 'published') {
        try {
          await apiPost(`/directory/providers/${row.id}/publish`);
        } catch (err) {
          const refusal = `Saved as a draft. It is not published yet: ${err.message}`;
          if (provider) {
            setError({ message: refusal });
            onRefresh();
            return;
          }
          navigate(`/admin/providers/${row.id}`, { state: { notice: refusal } });
          return;
        }
      }
      navigate(LIST);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const whoErrors = () => collect([
    ['p-name', requiredText(values.name, 'Give the body’s name as it publishes it.')],
    ['p-account', digits(values.user_id, 'Use the account number, numbers only.')],
  ]);
  const whereErrors = () => ({});
  const contactErrors = () => collect([
    ['p-room', meetLink(values.meet_link)],
  ]);
  const sourceErrors = () => collect([
    ['p-source', httpsLink(values.official_source_url, 'Paste the body’s own page, starting with https://.')],
  ]);

  const steps = [
    {
      id: 'who',
      label: 'Who',
      title: 'Who',
      lede: 'Name the body and say what kind of body it is. The reader sees these first.',
      validate: whoErrors,
      facts: () => [
        { label: 'Name', value: values.name },
        { label: 'Group', value: categoryLabel(values.category) },
        { label: 'Kind of body', value: typeLabel(values.type) },
        { label: 'Expert account', value: values.user_id ? `Account ${values.user_id}` : 'No account linked' },
      ],
      render: () => (
        <>
          <WizField id="p-name" label="Name" value={values.name} onChange={set('name')} />
          <WizField as="select" id="p-category" label="Group" className="mt-4" value={values.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </WizField>
          <WizField as="select" id="p-type" label="Kind of body" className="mt-4" value={values.type} onChange={set('type')}>
            {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </WizField>
          <WizField
            id="p-account"
            label="Expert account number"
            hint="The account that receives bookings and shared matters for this entry. Without it that expert’s inbox stays empty."
            className="mt-4"
            type="number"
            min="1"
            value={values.user_id}
            onChange={set('user_id')}
          />
        </>
      ),
    },
    {
      id: 'where',
      label: 'Where and when',
      title: 'Where and when',
      lede: 'Write the address as the body publishes it. Say what you could not confirm.',
      validate: whereErrors,
      facts: () => [
        { label: 'Place', value: values.location },
        { label: 'Address', value: values.address },
        { label: 'Opening hours', value: values.hours },
        { label: 'Not confirmed about the address', value: values.address_note },
      ],
      render: () => (
        <>
          <WizField id="p-location" label="Place" value={values.location} onChange={set('location')} />
          <WizField id="p-address" label="Address" hint="As the body publishes it." className="mt-4" value={values.address} onChange={set('address')} />
          <WizField id="p-hours" label="Opening hours" className="mt-4" value={values.hours} onChange={set('hours')} />
          <WizField
            id="p-address-note"
            label="What could not be confirmed about the address"
            as="textarea"
            rows={2}
            className="mt-4"
            value={values.address_note}
            onChange={set('address_note')}
          />
          <div className="mt-6">
            <p className="text-sm font-semibold">Map</p>
            {values.address.trim()
              ? <MapCard name={values.name || 'this body'} address={values.address} />
              : <p className="mt-1 text-sm text-muted-foreground">Write the address to see the map. The map loads only when you press Show map.</p>}
          </div>
        </>
      ),
    },
    {
      id: 'contact',
      label: 'Contact and languages',
      title: 'Contact and languages',
      lede: 'How a student reaches the body, and what it can do for them.',
      validate: contactErrors,
      facts: () => [
        { label: 'How to reach it', value: values.contact },
        { label: 'What it does', value: values.services },
        { label: 'Languages', value: values.languages },
        { label: 'It is free', value: values.is_free ? 'Yes' : 'No' },
        { label: 'Takes online bookings', value: values.bookable ? 'Yes' : 'No' },
        { label: 'Video room address', value: values.meet_link },
      ],
      render: () => (
        <>
          <WizField id="p-contact" label="How to reach it" className="mt-0" value={values.contact} onChange={set('contact')} />
          <WizField id="p-services" label="What it does" as="textarea" rows={3} className="mt-4" value={values.services} onChange={set('services')} />
          <WizField id="p-languages" label="Languages" className="mt-4" value={values.languages} onChange={set('languages')} />
          <WizCheck id="p-free" label="It is free" className="mt-4" checked={values.is_free} onChange={flip('is_free')} />
          <WizCheck id="p-bookable" label="It takes online bookings" className="mt-3" checked={values.bookable} onChange={flip('bookable')} />
          <WizField
            id="p-room"
            label="Video room address"
            hint="A Google Meet address that starts with https://meet.google.com/."
            className="mt-4"
            value={values.meet_link}
            onChange={set('meet_link')}
          />
        </>
      ),
    },
    {
      id: 'source',
      label: 'Source and check',
      title: 'Source and check',
      lede: 'Every checked fact points to the body’s own page. Publishing stamps today’s date as the day the facts were checked.',
      validate: sourceErrors,
      facts: () => [
        { label: 'The body’s own page', value: values.official_source_url },
      ],
      render: () => (
        <WizField
          id="p-source"
          label="The body’s own page"
          hint="Start with https://. Readers can open it from the entry."
          value={values.official_source_url}
          onChange={set('official_source_url')}
        />
      ),
    },
    {
      id: 'review',
      label: 'Review and publish',
      title: 'Review and publish',
      review: true,
      render: () => null,
    },
  ];

  const gate = published ? {
    id: 'p-understood',
    label: 'I understand',
    sub: 'Changing the name, kind, place, address, hours, contact, services, languages, cost or source takes this entry off the directory until it is published again.',
    message: 'Tick the box to say you understand this entry leaves the directory until it is published again.',
    required: true,
    checked: understood,
    onChange: setUnderstood,
  } : null;

  return (
    <>
      {published && (
        <p className="mb-6 text-sm font-semibold text-warning-strong">
          This entry is published. Changing the name, kind, place, address, hours, contact, services,
          languages, cost or source sends it back to draft. Changing the account, bookings or video room
          does not.
        </p>
      )}
      <Wizard
        steps={steps}
        finalLabel={published ? 'Save changes' : 'Publish entry'}
        saveLabel="Save draft"
        busy={busy}
        gate={gate}
        label="Entry steps"
        help={ENTRY_HELP}
        variant="plain"
        onSaveDraft={() => save(false)}
        onFinish={() => save(!published)}
        notice={error ? <ErrorNotice error={error} className="mb-4" /> : null}
      />
    </>
  );
}

// Add a directory entry or change one, on its own page like the routes. An existing entry is read
// from the staff list because the public entry answers 404 for anything that is not published.
export default function AdminProviderEditor() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === 'new';
  const { data: providers, error, loading, refetch } = useApi(isNew ? null : '/directory/providers/all');
  const provider = isNew ? null : providers?.find((p) => String(p.id) === id);
  const title = isNew ? 'New entry' : 'Edit entry';
  // Set when a new entry was saved but could not be published. See ProviderForm.save.
  const notice = location.state?.notice;

  return (
    <AdminEditorPage
      title={title}
      status={provider?.status}
      backTo={LIST}
      backLabel="All directory entries"
    >
      {!isNew && loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} />}
      {notice && <ErrorNotice error={{ message: notice }} className="mb-4" />}
      {!isNew && providers && !provider && (
        <p>
          That entry does not exist. <Link to={LIST} className="font-semibold text-primary-text underline">Back to all directory entries</Link>
        </p>
      )}
      {(isNew || provider) && <ProviderForm key={provider?.id ?? 'new'} provider={provider} onRefresh={refetch} />}
    </AdminEditorPage>
  );
}
