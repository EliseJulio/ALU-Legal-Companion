import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiBlob, apiGet, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { REPORT_TYPES, REPORT_STATUSES, typeName, aboutText, shortDay } from '@/lib/reports';
import Breadcrumb from '@/components/Breadcrumb';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import Icon from '@/components/Icon';
import FigureStrip from '@/components/overview/FigureStrip';
import { ADMIN_BUTTON_PRIMARY, ADMIN_BUTTON_OUTLINE, Cell, RecordList, RecordRow, SelectField } from '@/components/AdminRecords';
import { CARD, CHIP, CHIP_ON, FORM_TEXTAREA, PAGE_TITLE, RING } from '@/lib/ui';

// Name and about and reply by and status. Wide screens get four columns. Phones stack them.
const ROW = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_5rem_7.5rem]';

// Where a report's page lives in the admin workspace, when the page still exists.
const OPEN_LINKS = {
  guide: (id) => [`/admin/guides/${id}`, 'Open the guide'],
  route: () => ['/admin/routes', 'Open the routes'],
  provider: () => ['/admin/providers', 'Open the directory entries'],
};

function replyBy(report) {
  if (report.reply_channel === 'code') return 'Code only. No name, no email.';
  return report.contact_email ?? 'Email. The address was removed after the reply was sent.';
}

// One report in full. Opening it marks it read on the server.
function Detail({ id, onSaved, onOpened }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('received');
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    setNote('');
    apiGet(`/admin/reports/${id}`)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setStatus(data.status);
        setReply(data.admin_reply ?? '');
        // Opening marks it read, so the list is loaded again.
        onOpened();
      })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setNote('');
    try {
      const saved = await apiPut(`/admin/reports/${id}`, { status, admin_reply: reply });
      setReport((r) => ({ ...r, ...saved, contact_email: saved.has_email ? r.contact_email : null }));
      setNote(saved.delivery === 'failed'
        ? 'Saved. The email could not be sent, so the address is kept. Press Save and reply to try again.'
        : saved.delivery === 'sent'
          ? 'Saved. The email was sent and the address was removed.'
          : 'Saved.');
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (error && !report) return <ErrorNotice error={error} />;
  if (!report) return <p className="text-muted-foreground">Loading…</p>;

  const open = report.about_exists ? OPEN_LINKS[report.about_kind]?.(report.about_id) : null;
  const about = aboutText(report.about_kind, report.about_label) || report.about_label || 'Not said';

  return (
    <form onSubmit={save} aria-label="Report">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-head text-[17px] leading-[1.25] text-ink">{typeName(report.type)}</h2>
        <StatusPill status={report.status} />
      </div>
      <dl className="mt-3 space-y-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">About</dt><dd className="break-words">{about}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Reply by</dt><dd className="break-all">{replyBy(report)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Sent</dt><dd>{shortDay(report.created_at)}</dd></div>
      </dl>
      <p className="mt-4 whitespace-pre-line break-words">{report.message}</p>

      <SelectField id="report-status" label="Status" className="mt-5" value={status} onChange={(e) => setStatus(e.target.value)}>
        {REPORT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </SelectField>
      <div className="mt-4">
        <label htmlFor="report-reply" className="block text-sm font-semibold">Reply to the reporter</label>
        <textarea
          id="report-reply"
          rows={4}
          maxLength={1000}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="A short answer they will see when they check with their code."
          className={FORM_TEXTAREA}
        />
      </div>
      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" aria-disabled={saving || undefined} className={ADMIN_BUTTON_PRIMARY}>{saving ? 'Saving…' : 'Save and reply'}</button>
        {open && <Link to={open[0]} className={ADMIN_BUTTON_OUTLINE}>{open[1]}</Link>}
      </div>
      <p role="status" className="mt-3 text-sm">{note}</p>
    </form>
  );
}

// The reports people sent. Unresolved safety concerns come first, then the newest.
export default function AdminReports() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadNote, setDownloadNote] = useState('');
  const [downloadError, setDownloadError] = useState(null);

  const query = [status && `status=${status}`, type && `type=${type}`].filter(Boolean).join('&');
  const { data, error, loading, refetch } = useApi(`/admin/reports${query ? `?${query}` : ''}`);
  const counts = data?.counts;

  // The file is fetched with the login, because a plain link cannot send it. The filters are the
  // ones on the screen.
  async function download() {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloadNote('');
    try {
      const blob = await apiBlob(`/admin/reports/export${query ? `?${query}` : ''}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const n = data?.reports.length ?? 0;
      setDownloadNote(`Downloaded ${n} ${n === 1 ? 'report' : 'reports'}.`);
    } catch (err) {
      setDownloadError(err);
    } finally {
      setDownloading(false);
    }
  }
  const state = error ? 'error' : counts ? 'ready' : 'loading';

  const chips = [
    { value: '', label: 'All', n: counts ? counts.received + counts.in_progress + counts.resolved : null },
    { value: 'received', label: 'Received', n: counts?.received },
    { value: 'in_progress', label: 'In progress', n: counts?.in_progress },
    { value: 'resolved', label: 'Resolved', n: counts?.resolved },
  ];

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Reports" />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE}>Reports</h1>
          <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
            What people told us is wrong or could be better. Answer them here.
          </p>
        </div>
        <button type="button" onClick={download} aria-disabled={downloading || undefined} className={ADMIN_BUTTON_OUTLINE}>
          <Icon name="download" />
          {downloading ? 'Downloading…' : 'Download'}
        </button>
      </div>
      <p role="status" className="mt-2 text-right text-sm text-muted-foreground">{downloadNote}</p>
      {downloadError && <ErrorNotice error={downloadError} className="mt-2" />}

      <FigureStrip
        figures={[
          { label: 'Received', value: counts?.received, note: 'not read yet', state },
          { label: 'In progress', value: counts?.in_progress, note: 'being fixed', state },
          { label: 'Resolved', value: counts?.resolved_this_month, note: 'this month', state },
          { label: 'Safety concerns', value: counts?.unresolved_safety, note: 'read these first', state },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={status === c.value}
              onClick={() => setStatus(c.value)}
              className={`${status === c.value ? CHIP_ON : CHIP} ${RING}`}
            >
              {c.n === null || c.n === undefined ? c.label : `${c.label} ${c.n}`}
            </button>
          ))}
        </div>
        <SelectField id="report-type" label="Type" className="w-full max-w-xs [&>label]:sr-only" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </SelectField>
      </div>

      {error && <ErrorNotice error={error} className="mt-6" />}
      {loading && !data && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {data?.reports.length === 0 && <p className={`mt-6 text-muted-foreground ${CARD}`}>There are no reports here.</p>}

      <div className="mt-6 grid gap-6 wide:grid-cols-12">
        <div className="min-w-0 wide:col-span-7">
          {data?.reports.length > 0 && (
            <RecordList title="Reports" columns={['Report', 'About', 'Reply by', 'Status']} template={ROW}>
              {data.reports.map((r) => (
                <RecordRow key={r.id} template={ROW} className={selected === r.id ? 'bg-chrome-raised' : ''}>
                  <Cell>
                    <button
                      type="button"
                      aria-pressed={selected === r.id}
                      onClick={() => setSelected(r.id)}
                      className={`min-h-touch rounded-control text-left ${RING}`}
                    >
                      <span className="block font-head text-base leading-[1.3] text-ink">{typeName(r.type)}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {shortDay(r.created_at)}{!r.read_at && ' · Not read yet'}
                      </span>
                    </button>
                  </Cell>
                  <Cell label="About"><span className="break-words text-sm">{aboutText(r.about_kind, r.about_label) || r.about_label || 'Not said'}</span></Cell>
                  <Cell label="Reply by"><span className="text-sm">{r.reply_channel === 'code' ? 'Code' : 'Email'}</span></Cell>
                  <Cell label="Status"><StatusPill status={r.status} /></Cell>
                </RecordRow>
              ))}
            </RecordList>
          )}
        </div>
        <aside className={`min-w-0 self-start wide:col-span-5 ${CARD}`} aria-label="Report">
          {selected
            ? <Detail key={selected} id={selected} onSaved={refetch} onOpened={refetch} />
            : <p className="text-sm text-muted-foreground">Choose a report to read it and reply.</p>}
        </aside>
      </div>
    </div>
  );
}
