import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { REPORT_TYPES, parseAbout, aboutLookupPath, aboutText } from '@/lib/reports';
import { looksLikeEmail } from '@/lib/email';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import Field, { CheckField } from '@/components/Field';
import {
  RING, RING_ON_CANVAS, FORM_FIELD, FORM_TEXTAREA, BUTTON_LG_PRIMARY, BUTTON_OUTLINE,
  PAGE_TITLE, CARD, CHIP, CHIP_ON, TAB, TAB_CURRENT, TAB_IDLE,
} from '@/lib/ui';

const MAX_MESSAGE = 2000;
const MIN_MESSAGE = 10;
const TAB_RING = 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2';

// Anyone can report a problem, with or without an account. The report never carries a user id.
// "Where did you see it?" is filled from the address (?about=guide:12) and then read only.
// With no address or after Clear the reader types it. A typed place is sent as a page with that label.
export default function ReportProblem() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const about = parseAbout(params.get('about'));

  const [type, setType] = useState('info');
  const [message, setMessage] = useState('');
  const [replyBy, setReplyBy] = useState('code');
  const [email, setEmail] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  // The place the report is about. It can be cleared if the reader meant something else.
  const [where, setWhere] = useState('');
  const [aboutCleared, setAboutCleared] = useState(false);
  const [typed, setTyped] = useState('');
  const filled = Boolean(about) && !aboutCleared;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [errorFor, setErrorFor] = useState(null);
  const messageRef = useRef(null);

  const fail = (err, target = null) => {
    setError(err);
    setErrorFor(target);
    setErrorCount((n) => n + 1);
  };

  // Find the title of the guide, route or entry. With no answer the field stays empty.
  const aboutKey = about ? `${about.kind}:${about.id ?? about.path}` : '';
  useEffect(() => {
    let cancelled = false;
    setAboutCleared(false);
    if (!about) { setWhere(''); return undefined; }
    if (about.kind === 'page') { setWhere(aboutText('page', about.path)); return undefined; }
    setWhere('');
    apiGet(aboutLookupPath(about), { anonymous: true })
      .then((data) => { if (!cancelled) setWhere(aboutText(about.kind, data.title ?? data.name)); })
      .catch(() => {});
    return () => { cancelled = true; };
    // "about" is rebuilt on every render. Its key says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aboutKey]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending) return;
    if (message.trim().length < MIN_MESSAGE) {
      fail({ message: `Tell us a little more. Use at least ${MIN_MESSAGE} characters.` }, 'report-message');
      messageRef.current?.focus();
      return;
    }
    if (replyBy === 'email' && !looksLikeEmail(email.trim())) {
      fail({ message: 'Enter a valid email address, or choose "Code only".' }, 'report-email');
      document.getElementById('report-email')?.focus();
      return;
    }
    if (replyBy === 'code' && !acknowledged) {
      fail({ message: 'Tick the box to say you understand the code cannot be recovered. It is shown once.' }, 'report-saved');
      document.getElementById('report-saved')?.focus();
      return;
    }

    setError(null);
    setSending(true);
    try {
      const body = { type, message: message.trim(), reply_by: replyBy };
      if (!filled && typed.trim()) {
        body.about_kind = 'page';
        body.about_label = typed.trim().slice(0, 200);
      }
      if (filled) {
        body.about_kind = about.kind;
        if (about.kind !== 'page') body.about_id = about.id;
        // Only the title is sent. The admin page adds the words "Guide:" and the rest itself.
        body.about_label = where.replace(/^[^:]+: /, '') || (about.kind === 'page' ? about.path : '');
      }
      if (replyBy === 'email') body.email = email.trim();
      const sent = await apiPost('/reports', body, { anonymous: true });
      if (replyBy === 'code' && !sent?.code) {
        fail({ message: 'Your report was sent but the server did not return a code, so you cannot check it. Please tell us before trying again.' });
        return;
      }
      // The code travels in router state only. It is never written to storage or the address.
      navigate('/report/sent', { state: { code: sent.code ?? null, email: replyBy === 'email' ? email.trim() : null } });
    } catch (err) {
      // The text stays in the box. A reader must not lose a long report to an error.
      fail(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Report a problem" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Report a problem</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        Tell us what is wrong or what could be better. An admin reads every report. You can stay anonymous.
      </p>

      <div className="mt-8 grid gap-6 wide:grid-cols-12">
        <div className="min-w-0 wide:col-span-7">
          {error && <ErrorNotice key={errorCount} id="report-error" error={error} className="mb-4" />}
          <form onSubmit={handleSubmit} noValidate className={CARD}>
            <fieldset>
              <legend className="text-sm font-semibold">What is this about?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={type === t.value}
                    onClick={() => setType(t.value)}
                    className={`${type === t.value ? CHIP_ON : CHIP} ${RING_ON_CANVAS}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {type === 'safety' && (
              <Callout className="mt-4">
                <b>If someone is in danger, call now.</b> Police 112 or Isange One Stop Centre 3029. This form is
                read by an admin and is not an emergency line.{' '}
                <Link to="/emergency" className={`inline-flex min-h-touch items-center font-semibold text-primary-text underline ${RING}`}>
                  All emergency numbers
                </Link>
              </Callout>
            )}

            <div className="mt-6">
              <label htmlFor="report-where" className="block text-sm font-semibold">Where did you see it?</label>
              <input
                id="report-where"
                type="text"
                readOnly={filled}
                maxLength={200}
                value={filled ? where : typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={filled ? undefined : 'A guide, an office or a page'}
                aria-describedby="report-where-hint"
                className={FORM_FIELD}
              />
              <p id="report-where-hint" className="mt-1 text-sm text-muted-foreground">
                {filled
                  ? 'Filled in from the page you came from. Clear it if it is about something else.'
                  : 'Optional. Say which guide or office or page it was about.'}
                {where && filled && (
                  <button type="button" onClick={() => setAboutCleared(true)} className={`ml-2 inline-flex min-h-touch items-center font-semibold text-primary-text ${RING}`}>
                    Clear
                  </button>
                )}
              </p>
            </div>

            <div className="mt-6">
              <label htmlFor="report-message" className="block text-sm font-semibold">What happened?</label>
              <textarea
                id="report-message"
                ref={messageRef}
                rows={6}
                value={message}
                maxLength={MAX_MESSAGE}
                onChange={(e) => { setMessage(e.target.value); if (errorFor === 'report-message') setErrorFor(null); }}
                placeholder="Say what is wrong and what you expected. Do not write anyone's phone number or a case number."
                aria-describedby={errorFor === 'report-message' ? 'report-error' : undefined}
                aria-invalid={errorFor === 'report-message' || undefined}
                className={FORM_TEXTAREA}
              />
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">How should we reach you?</legend>
              <div className="mt-2 flex flex-wrap gap-1">
                {[['code', 'Code only'], ['email', 'By email']].map(([value, label]) => (
                  <label key={value} className={`${TAB} ${replyBy === value ? TAB_CURRENT : TAB_IDLE} relative min-w-touch cursor-pointer ${TAB_RING}`}>
                    <input
                      type="radio"
                      name="report-reply-by"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      checked={replyBy === value}
                      onChange={() => { setReplyBy(value); setAcknowledged(false); setError(null); }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {replyBy === 'email' ? (
              <Field
                id="report-email"
                className="mt-4"
                label="Your email"
                hint="Used once, to tell you when this is resolved. It is shown to the admin who reads your report."
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errorFor === 'report-email') setErrorFor(null); }}
                placeholder="name@alustudent.com"
                autoComplete="email"
                aria-invalid={errorFor === 'report-email' || undefined}
              />
            ) : (
              <>
                <p className="mt-4 text-sm text-muted-foreground">No name and no email. You get a code on the next screen.</p>
                <CheckField
                  id="report-saved"
                  className="mt-2"
                  label="I understand that I must save my code. It is shown once and cannot be recovered."
                  checked={acknowledged}
                  onChange={(value) => { setAcknowledged(value); if (errorFor === 'report-saved') setErrorFor(null); }}
                  describedBy={errorFor === 'report-saved' ? 'report-error' : undefined}
                  invalid={errorFor === 'report-saved'}
                />
              </>
            )}

            <button type="submit" aria-disabled={sending || undefined} className={`mt-6 ${BUTTON_LG_PRIMARY}`}>
              {sending ? 'Sending…' : 'Send report'}
            </button>
          </form>
        </div>

        <aside className={`min-w-0 self-start wide:col-span-5 ${CARD}`} aria-labelledby="report-next">
          <h2 id="report-next" className="font-head text-[17px] leading-[1.25] text-ink">What happens next</h2>
          <ol className="mt-4 space-y-5">
            {[
              ['You send the report', 'No account is needed.'],
              ['You get a code or an email', 'Your choice above.'],
              ['An admin reads it', 'Mistakes in a guide or an office are fixed and published again.'],
              ['You can check the status', 'Received, In progress or Resolved, with a short reply.'],
            ].map(([title, note], i) => (
              <li key={title} className="flex gap-4">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{note}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/report/check" className={`mt-5 ${BUTTON_OUTLINE}`}>Check a report with your code</Link>
        </aside>
      </div>
    </div>
  );
}
