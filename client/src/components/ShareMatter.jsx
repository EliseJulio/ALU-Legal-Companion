import { useState } from 'react';
import { apiDelete, apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import Wizard from '@/components/wizard/Wizard';
import { FieldError } from '@/components/wizard/WizardField';
import { useWizardErrors } from '@/components/wizard/WizardContext';
import { CATEGORIES } from '@/lib/directory';
import { BUTTON_OUTLINE, CARD } from '@/lib/ui';

const H2 = 'font-head text-base font-semibold leading-[1.3] text-ink';

const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label ?? value;

// The lawyer or office to share with. It is one radio group. The message and the focus go to the
// group itself, so a screen reader hears the question before the first choice.
function ChooseLawyer({ targets, choice, setChoice }) {
  const errors = useWizardErrors();
  return (
    <fieldset id="share-target" tabIndex={-1} className="min-w-0 focus:outline-none">
      <legend className="text-sm font-semibold">Choose one lawyer or office</legend>
      <p className="mt-1 text-sm text-muted-foreground">Only lawyers and offices who take shared matters are listed.</p>
      <div className="mt-3 grid gap-2">
        {targets.map((t) => (
          <label key={t.id} className="flex min-h-touch cursor-pointer items-start gap-3 rounded-card border border-border bg-surface p-3 text-sm">
            <input
              type="radio"
              name="share-target"
              value={t.id}
              checked={choice === String(t.id)}
              onChange={() => setChoice(String(t.id))}
              aria-invalid={errors['share-target'] ? true : undefined}
              aria-describedby={errors['share-target'] ? 'share-target-error' : undefined}
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
            />
            <span>
              <span className="font-semibold">{t.name}</span>
              <span className="block text-muted-foreground">{[categoryLabel(t.category), t.location].filter(Boolean).join(' · ')}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError id="share-target-error" message={errors['share-target']} />
    </fieldset>
  );
}

// Share one matter with one lawyer or office. The owner chooses and reads what the lawyer sees.
// Then the owner ticks the box. Nothing is sent before the tick. Sharing is never automatic.
function ShareWizard({ matter, targets, onDone }) {
  const [choice, setChoice] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const chosen = targets.find((t) => String(t.id) === choice);

  async function share() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/matters/${matter.id}/share`, { provider_id: Number(choice) });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const steps = [
    {
      id: 'choose',
      label: 'Choose the lawyer',
      title: 'Choose the lawyer',
      lede: 'Share with one chosen expert. You can stop at any time.',
      validate: () => (choice ? {} : { 'share-target': 'Choose one lawyer or office to share with.' }),
      facts: () => [{ label: 'Lawyer or office', value: chosen?.name ?? '' }],
      render: () => <ChooseLawyer targets={targets} choice={choice} setChoice={setChoice} />,
    },
    {
      id: 'see',
      label: 'What they will see',
      title: 'What they will see',
      lede: 'The lawyer reads this record. Nothing else of yours comes with it.',
      facts: () => [
        { label: 'They can read', value: 'Your record: the title, the next step, the deadline and every dated step. Your documents, once you have added them.' },
        { label: 'They can add', value: 'Notes to the record, and a mark on each of your documents.' },
        { label: 'They never see', value: 'Your name, your account, your email, your reminders or any other matter you keep.' },
      ],
      render: () => (
        <div className="grid gap-4 text-sm">
          <section>
            <h3 className="font-semibold text-ink">They can read</h3>
            <ul className="mt-2 grid list-disc gap-1 pl-5">
              <li>Your record: the title, the next step, the deadline and every dated step. They can add a note to the record.</li>
              <li>Your documents, once you have added them. They mark each file Complete, Needs fixing or Out of date, and leave a note on it.</li>
            </ul>
          </section>
          <section>
            <h3 className="font-semibold text-ink">They never see</h3>
            <ul className="mt-2 grid list-disc gap-1 pl-5">
              <li>Your name, your account and your email.</li>
              <li>Your reminders and the days you chose for them.</li>
              <li>Any other matter you keep.</li>
            </ul>
          </section>
        </div>
      ),
    },
    {
      id: 'confirm',
      label: 'Confirm',
      title: 'Confirm',
      review: true,
      render: () => (
        <div className="rounded-card border border-border bg-surface p-4 text-sm">
          <p className="font-semibold text-ink">You can stop at any time.</p>
          <p className="mt-2 text-muted-foreground">
            Stopping takes effect on their next request. They can no longer open the matter or add notes.
            Your record and your files stay with you. Notes they already left stay on the record, with the
            lawyer’s name, for you to read. Use Stop sharing on this matter to end it.
          </p>
        </div>
      ),
    },
  ];

  const gate = {
    id: 'share-understood',
    label: 'I understand what they will see',
    sub: 'I can stop sharing at any time from this matter.',
    message: 'Tick the box to confirm you understand what they will see.',
    required: true,
    checked: understood,
    onChange: setUnderstood,
  };

  return (
    <div>
      <Wizard
        steps={steps}
        finalLabel="Share this matter"
        saveLabel={null}
        busy={busy}
        gate={gate}
        label="Share steps"
        variant="aside"
        onFinish={share}
        notice={error ? <ErrorNotice error={error} className="mb-4" /> : null}
      />
    </div>
  );
}

// The panel that shares a matter or says who it is shared with.
// The owner only and only while it is not shared.
// The wizard holds the share until the owner has read what the lawyer will see.
export function ShareCard({ matter, onDone }) {
  const { data: targets } = useApi('/matters/share-targets');
  return (
    <section className={CARD} aria-labelledby="share-heading">
      <h2 id="share-heading" className={H2}>Share with one chosen expert</h2>
      <p className="mt-3 text-sm">
        The expert sees the shared record, not your account identity. Your free text may still
        identify you.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">Sharing is never automatic.</p>
      {targets?.length === 0 && <p className="mt-3 text-sm">No lawyer on the platform is taking shared matters yet.</p>}
      {targets?.length > 0 && <div className="mt-4"><ShareWizard matter={matter} targets={targets} onDone={onDone} /></div>}
    </section>
  );
}

// Who can open the matter now and the way to end it. Revoking takes effect at once.
export function AccessCard({ matter, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/matters/${matter.id}/share`);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD}>
      <h2 id="access-heading" className={H2}>Expert access</h2>
      <p className="mt-3 text-sm font-semibold text-muted-foreground">Current access</p>
      {matter.shared_with ? (
        <>
          <p className="mt-1 text-sm">
            <span className="font-semibold">{matter.shared_with_name}</span> can read this record and add
            notes. They cannot see your name or email, change anything or see your reminders.
          </p>
          <button type="button" aria-disabled={busy || undefined} className={`${BUTTON_OUTLINE} mt-3`} onClick={revoke}>
            Revoke expert access
          </button>
          <p className="mt-3 text-xs text-muted-foreground">When shared, revoking access takes effect immediately.</p>
        </>
      ) : (
        <p className="mt-1 text-sm">No expert has been chosen yet.</p>
      )}
      {error && <ErrorNotice error={error} className="mt-3" />}
    </section>
  );
}
