import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { formatCode, typeName, shortDay } from '@/lib/reports';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import { FORM_FIELD, BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_TEXT, PAGE_TITLE, CARD } from '@/lib/ui';

// The four steps a report moves through. The sender sees where it is in words, not in colour.
function steps(report) {
  const stage = report.status === 'resolved' ? 3 : report.status === 'in_progress' ? 2 : report.read_at ? 1 : 0;
  const day = shortDay;
  const list = [
    { label: 'Received', date: day(report.created_at) },
    { label: 'Read', date: day(report.read_at) },
    { label: 'In progress', date: '' },
    { label: 'Resolved', date: day(report.resolved_at) },
  ];
  return list.map((step, i) => {
    // Resolved is the end, so every step is done. Otherwise the stage reached is the current one.
    const state = stage === 3 || i < stage ? 'done' : i === stage ? 'current' : 'next';
    return { ...step, state };
  });
}

const LOOK = {
  done: 'border-primary-subtle bg-primary-subtle text-primary-text',
  current: 'border-ink bg-surface font-semibold text-ink',
  next: 'border-border bg-canvas text-muted-foreground',
};
const STATE_WORD = { done: 'done', current: 'now', next: 'not yet' };

// Check where a report is, with the code shown when it was sent. The code goes in the body of one
// POST and nowhere else: not in the address, not in storage.
export default function ReportCheck() {
  const [code, setCode] = useState('');
  const [report, setReport] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (checking) return;
    if (!code.trim()) {
      setReport(null);
      setError({ message: 'Type the code you were given, then press Check status.' });
      return;
    }
    setError(null);
    setChecking(true);
    try {
      setReport(await apiPost('/reports/check', { code: formatCode(code) }, { anonymous: true }));
    } catch (err) {
      setReport(null);
      setError(err);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Report a problem', to: '/report' }]} current="Check a report" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Check a report</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">Enter the code you saved when you sent your report.</p>

      <div className="mt-8 grid gap-6 wide:grid-cols-12">
        <form onSubmit={handleSubmit} className={`min-w-0 self-start wide:col-span-5 ${CARD}`}>
          <label htmlFor="report-code" className="block text-sm font-semibold">Your code</label>
          <p id="report-code-hint" className="mt-1 text-sm text-muted-foreground">
            It starts with LC and has eight more characters, like LC-4F9K27QX. Small letters are fine.
          </p>
          <input
            id="report-code"
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setReport(null); }}
            aria-describedby="report-code-hint"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            placeholder="LC-XXXXXXXX"
            className={`${FORM_FIELD} font-mono`}
          />
          <button type="submit" aria-disabled={checking || undefined} className={`mt-6 w-full ${checking ? BUTTON_DISABLED : BUTTON_LG_PRIMARY}`}>
            {checking ? 'Checking…' : 'Check status'}
          </button>
          <p className="mt-3 text-sm text-muted-foreground">Lost codes cannot be recovered or reissued.</p>
        </form>

        <div className="min-w-0 wide:col-span-7">
          {error && <ErrorNotice error={error} />}
          {/* Always on the page, so the first result is read out. */}
          <div role="status">
            {checking && <p className="text-sm text-muted-foreground">Looking up your code…</p>}
            {report && (
              <section className={CARD} aria-labelledby="report-title">
                <h2 id="report-title" className="font-head text-[20px] leading-[1.25] text-ink">{typeName(report.type)}</h2>
                {report.about_label && <p className="mt-1 text-sm text-muted-foreground">{report.about_label}</p>}
                <ol aria-label="Progress" className="mt-4 flex flex-wrap gap-2">
                  {steps(report).map((s) => (
                    <li key={s.label} className={`inline-flex items-center whitespace-nowrap rounded-control border px-3 py-1 text-xs ${LOOK[s.state]}`}>
                      {s.label}{s.date ? ` ${s.date}` : ''}
                      <span className="sr-only"> ({STATE_WORD[s.state]})</span>
                    </li>
                  ))}
                </ol>
                {report.admin_reply && (
                  <div className="mt-4 rounded-card bg-chrome-raised p-4 text-sm">
                    <p className="font-semibold text-ink">Reply from the admin</p>
                    <p className="mt-1 whitespace-pre-line">{report.admin_reply}</p>
                  </div>
                )}
                <p className="mt-4 text-xs italic text-muted-foreground">Legal information not legal advice.</p>
              </section>
            )}
          </div>
          <p className="mt-4 text-sm">
            <Link to="/report" className={BUTTON_TEXT}>Report another problem</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
