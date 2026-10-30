import { useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import Field from '@/components/Field';
import { readableDate } from '@/lib/dates';
import { PANEL, BUTTON_PRIMARY } from '@/lib/ui';

// Invite a legal expert by email. The link in the email works once and proves the person owns the
// address before they can verify anything. That is why there is no other way to become one. The
// invitation code is never shown on this page. It is only in the email.
function InviteForm({ onSent }) {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function send(event) {
    event.preventDefault();
    if (!email.trim()) {
      setError({ message: 'Enter the email address to invite.' });
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const reply = await apiPost('/admin/invites', { email: email.trim(), expires_days: Number(days) });
      setMessage(reply.message);
      setEmail('');
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className={`mt-3 ${PANEL}`} aria-labelledby="invite-heading">
      <Field id="invite-email" label="Email address" type="email" 
      autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field
        id="invite-days"
        label="Days the invitation lasts"
        hint="From 1 to 30."
        className="mt-4"
        type="number"
        min="1"
        max="30"
        value={days}
        onChange={(e) => setDays(e.target.value)}
      />
      {error && <ErrorNotice error={error} className="mt-4" />}
      <div role="status">{message && <p className="mt-4 text-sm">{message}</p>}</div>
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        {busy ? 'Sending…' : 'Send the invitation'}
      </button>
    </form>
  );
}

export default function AdminInvites() {
  const { data: invites, error, loading, refetch } = useApi('/admin/invites');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Invitations" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Invitations</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Legal experts join by invitation only. The email carries a link that works once. After they
        join, link their account to their directory entry on Directory entries, using the account
        number shown on People. Until then their appointment inbox stays empty.
      </p>

      <div className="mt-6 grid gap-8 xl:grid-cols-[26rem_minmax(0,1fr)] xl:items-start">
      <div className="min-w-0">
      <h2 id="invite-heading" className="font-head text-2xl leading-heading text-primary">New expert invitation</h2>
      <InviteForm onSent={refetch} />
      <Callout title="Validate the recipient first" className="mt-4">
        Confirm the expert’s eligibility through the institution’s approved process before you send an
        invitation.
      </Callout>
      </div>

      <div className="min-w-0">
      <h2 className="font-head text-2xl leading-heading text-primary">Sent invitations</h2>
      {loading && <p className="mt-3 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-3" />}
      {invites?.length === 0 && <p className={`mt-3 text-muted-foreground ${PANEL}`}>No invitations have been sent.</p>}

      <ul className="mt-3 space-y-3">
        {invites?.map((invite) => (
          <li key={invite.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{invite.email}</p>
              <StatusPill status={invite.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Invited by {invite.invited_by} on {readableDate(invite.created_at)}
              {invite.status === 'used' ? ` · used ${readableDate(invite.used_at)}` : ` · lasts until ${readableDate(invite.expires_at)}`}
            </p>
          </li>
        ))}
      </ul>
      </div>
      </div>
    </div>
  );
}
