import { useState } from 'react';
import { apiBlob, apiDelete, apiPost, apiPut, apiUpload } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import Field from '@/components/Field';
import { secureAddress } from '@/lib/url';
import { PANEL, RING, FIELD, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// The documents on a matter. One component for the two people who may see them. The owner uploads
// and replaces and removes. The legal expert the matter is shared with reads each file and gives a
// verdict. The server decides who may do what. This only decides what to offer.
//
// Every state is printed in words. "Ready" is said as a check of these files. It is never a promise
// that an office will accept the application.
const FILE_FIELD = 'mt-1 block min-h-touch w-full text-sm';
const ACCEPT = 'application/pdf,image/png,image/jpeg';
const EXTENSION = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
const MAX_LABEL = 120;
const NOTE = 'mt-2 rounded border border-border bg-canvas p-2 text-sm';

const VERDICTS = [
  ['complete', 'Complete'],
  ['needs_fix', 'Needs fixing'],
  ['out_of_date', 'Out of date'],
];

// The server calls an unchecked file pending. On screen it says Awaiting check. The word pending
// already means something else for invitations.
const shown = (state) => (state === 'pending' ? 'awaiting_check' : state);

// A name for the download from the label the person gave. Never the stored name.
const fileName = (doc) => `${(doc.label || 'document').replace(/[^\w\- ]+/g, '').trim() || 'document'}.${EXTENSION[doc.mime] ?? 'bin'}`;

function ReviewForm({ doc, onSave, busy }) {
  const [status, setStatus] = useState(doc.review.status === 'pending' ? 'complete' : doc.review.status);
  const [note, setNote] = useState(doc.review.note ?? '');
  const needsNote = status !== 'complete';
  return (
    <form
      className="mt-3 border-t border-border pt-3"
      onSubmit={(event) => { event.preventDefault(); onSave(doc, { status, note: note.trim() }); }}
    >
      <Field id={`verdict-${doc.id}`} label="Your check of this file" as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
        {VERDICTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Field>
      <Field
        id={`note-${doc.id}`}
        label={`Note ${needsNote ? '(required. Say what is wrong so the owner knows what to fix)' : '(optional)'}`}
        as="textarea"
        rows={2}
        className="mt-2"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="submit" aria-disabled={(busy || (needsNote && !note.trim())) || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        Save my check
      </button>
    </form>
  );
}

// The lawyer's comment box. A comment is separate from the check above it. A lawyer can ask a
// question without changing Complete or Needs fixing. The box clears only when the comment was
// saved so a failed save does not lose what was typed.
function CommentForm({ doc, onSave, busy }) {
  const [body, setBody] = useState('');
  return (
    <form
      className="mt-3 border-t border-border pt-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onSave(doc, body.trim())) setBody('');
      }}
    >
      <label htmlFor={`comment-${doc.id}`} className="block text-sm font-medium">
        Add a comment<span className="sr-only"> on {doc.label}</span>
      </label>
      <textarea id={`comment-${doc.id}`} rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} className={FIELD} />
      <button type="submit" aria-disabled={(busy || !body.trim()) || undefined} aria-busy={busy} aria-label={`Post comment on ${doc.label}`} className={`${BUTTON_PRIMARY} mt-2`}>
        Post comment
      </button>
    </form>
  );
}

export default function MatterDocuments({ matter, viewer }) {
  const owner = viewer === 'owner';
  const open = matter.status === 'open';
  const base = `/matters/${matter.id}/documents`;

  const checklist = useApi(`${base}/checklist`);
  const docs = useApi(base);
  const available = useApi(owner && checklist.data && !checklist.data.checklist ? '/checklists' : null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [otherLabel, setOtherLabel] = useState('');
  const [chosen, setChosen] = useState('');

  const reload = () => { checklist.refetch(); docs.refetch(); };

  // One place to do a thing and show any error and load again. Every button below goes through it.
  async function act(fn) {
    setBusy(true);
    setError(null);
    try { await fn(); reload(); return true; } catch (err) { setError(err); return false; } finally { setBusy(false); }
  }

  const upload = (file, { label, item, replaces }) => {
    if (!file) return Promise.resolve();
    const params = new URLSearchParams({ label: label.slice(0, MAX_LABEL) });
    if (item) params.set('item', item);
    if (replaces) params.set('replaces', String(replaces));
    return act(() => apiUpload(`${base}?${params}`, file));
  };

  async function download(doc) {
    setError(null);
    try {
      const blob = await apiBlob(`${base}/${doc.id}/file`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName(doc);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err);
    }
  }

  const review = (doc, body) => act(() => apiPut(`${base}/${doc.id}/review`, body));
  const postComment = (doc, body) => act(() => apiPost(`${base}/${doc.id}/comments`, { body }));

  if ((checklist.loading && !checklist.data) || (docs.loading && !docs.data)) {
    return <p className="mt-6 text-muted-foreground">Loading documents…</p>;
  }
  if (checklist.error || docs.error) return <ErrorNotice error={checklist.error || docs.error} className="mt-6" />;

  // A reply that is not the shape we expect must not blank the whole matter page. The record above
  // matters more than this section does.
  const list = checklist.data && typeof checklist.data === 'object' && !Array.isArray(checklist.data)
    ? checklist.data : { checklist: null, items: [], ready: false };
  const items = Array.isArray(list.items) ? list.items : [];
  const itemKeys = new Set(items.map((i) => i.key));
  const allDocs = Array.isArray(docs.data) ? docs.data : [];
  const others = allDocs.filter((d) => !d.item_key || !itemKeys.has(d.item_key));

  // A plain render helper and not a component. A component declared inside render is a new type on
  // every render, so React would mount it again and a note a lawyer had half typed would be lost.
  // `itemName` is given when the file answers an item whose name it already carries.
  const renderFile = (doc, itemName) => (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-3">
        {doc.label !== itemName && <span className="text-sm font-semibold">{doc.label}</span>}
        <button type="button" className={BUTTON_OUTLINE} aria-label={`Download ${doc.label}`} onClick={() => download(doc)}>
          Download
        </button>
      </div>
      {(doc.review.status === 'needs_fix' || doc.review.status === 'out_of_date') && doc.review.note && (
        <p className={NOTE}><span className="font-semibold">The lawyer says: </span>{doc.review.note}</p>
      )}
      {doc.review.status === 'complete' && doc.review.note && (
        <p className="mt-2 text-sm"><span className="font-semibold">The lawyer says: </span>{doc.review.note}</p>
      )}
      {doc.comments?.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold">Comments</p>
          <ul className="mt-1 space-y-2">
            {doc.comments.map((c) => (
              <li key={c.id} className="rounded border border-border p-2 text-sm">
                <span className="block text-xs text-muted-foreground">
                  {c.by_you ? 'You' : (c.author_name ?? 'Another lawyer')} · {c.created_at?.slice(0, 10)}
                </span>
                <span className="whitespace-pre-line">{c.body}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {owner && open && (
        <div className="mt-2">
          <label htmlFor={`replace-${doc.id}`} className="block text-sm">
            Replace this file<span className="sr-only"> for {doc.label}</span> (a new file is checked again)
          </label>
          <input id={`replace-${doc.id}`} type="file" accept={ACCEPT} disabled={busy} className={FILE_FIELD}
            onChange={(e) => { upload(e.target.files?.[0], { label: doc.label, replaces: doc.id }); e.target.value = ''; }} />
        </div>
      )}
      {owner && (removing === doc.id ? (
        <div role="group" aria-label={`Remove ${doc.label}`} className="mt-2">
          <p className="text-sm font-semibold">Delete this file for good? Only this file goes. The matter stays.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={BUTTON_PRIMARY} aria-disabled={busy || undefined}
              onClick={() => { setRemoving(null); act(() => apiDelete(`${base}/${doc.id}`)); }}>Yes, delete this file</button>
            <button type="button" className={BUTTON_OUTLINE} onClick={() => setRemoving(null)}>Keep it</button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${BUTTON_OUTLINE} mt-2`} aria-label={`Remove ${doc.label}`} onClick={() => setRemoving(doc.id)}>
          Remove
        </button>
      ))}
      {!owner && <ReviewForm key={`${doc.id}-${doc.review.status}-${doc.review.note}`} doc={doc} onSave={review} busy={busy} />}
      {!owner && <CommentForm doc={doc} onSave={postComment} busy={busy} />}
    </div>
  );

  return (
    <section className={`mt-6 ${PANEL}`} aria-labelledby="docs-heading">
      <h2 id="docs-heading" className="font-head text-2xl leading-heading text-primary">Documents</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {owner
          ? 'Documents are stored encrypted. Only you and the legal expert you share this matter with can open them. You can delete any of them at any time.'
          : 'These are the documents the owner has shared with you. Open each one and then record your check. You can also leave a comment on any document.'}
      </p>

      {owner && !list.checklist && (
        <div className="mt-3">
          {available.data?.length > 0 ? (
            <>
              <Field id="checklist-choice" label="Follow a checklist of required documents" as="select" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                <option value="">Choose…</option>
                {available.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Field>
              <button type="button" aria-disabled={(busy || !chosen) || undefined} className={`${BUTTON_PRIMARY} mt-3`}
                onClick={() => act(() => apiPost(`/matters/${matter.id}/checklist`, { checklist_id: Number(chosen) }))}>
                Follow this checklist
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No checklist of required documents is available yet. You can still add documents below.</p>
          )}
        </div>
      )}

      {list.checklist && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">{list.checklist.title}</p>
          {owner && (
            <button type="button" className={BUTTON_OUTLINE} aria-disabled={busy || undefined}
              onClick={() => act(() => apiDelete(`/matters/${matter.id}/checklist`))}>
              Stop following this checklist<span className="sr-only"> (your documents stay)</span>
            </button>
          )}
        </div>
      )}

      {list.checklist?.under_review && (
        <p role="status" className={`mt-3 ${NOTE}`}>
          This checklist is being updated, so it is hidden until it is published again. Your documents are safe and still listed below.
        </p>
      )}

      {list.ready && (
        <p role="status" className={`mt-3 ${NOTE}`}>
          <span className="font-semibold">A lawyer has checked every required document.</span> That is a check of these files.
          It is not a promise that the office will accept your application.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.key} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-sans font-semibold">{item.name}</span>
                <StatusPill status={shown(item.state)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {item.required ? 'Required' : 'Optional'}{item.required_if ? `. Only if ${item.required_if}` : ''}
              </p>
              {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
              {item.where_to_get && <p className="mt-1 text-sm text-muted-foreground">Get it from: {item.where_to_get}</p>}
              {secureAddress(item.source_url) && (
                <a href={secureAddress(item.source_url)} target="_blank" rel="noopener noreferrer"
                  aria-label={`Source for ${item.name} (opens in a new tab)`}
                  className={`inline-flex min-h-touch items-center text-sm font-semibold text-primary underline ${RING}`}>
                  Source ↗
                </a>
              )}
              {item.document && renderFile(item.document, item.name)}
              {!item.document && owner && open && (
                <div className="mt-2">
                  <label htmlFor={`upload-${item.key}`} className="block text-sm font-medium">Upload the document for {item.name}</label>
                  <input id={`upload-${item.key}`} type="file" accept={ACCEPT} disabled={busy} className={FILE_FIELD}
                    onChange={(e) => { upload(e.target.files?.[0], { label: item.name, item: item.key }); e.target.value = ''; }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <div className="mt-4">
          <h3 className="font-head text-xl leading-heading text-primary">{items.length > 0 ? 'Other documents' : 'Documents on this matter'}</h3>
          <ul className="mt-2 space-y-3">
            {others.map((doc) => (
              <li key={doc.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Added {doc.uploaded_at?.slice(0, 10)}</span>
                  <StatusPill status={shown(doc.review.status)} />
                </div>
                {renderFile(doc)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!owner && items.length === 0 && others.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No documents have been added to this matter yet.</p>
      )}

      {owner && open && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="font-head text-xl leading-heading text-primary">Add another document</h3>
          <label htmlFor="other-label" className="mt-2 block text-sm font-medium">What is it? (for example, Rental agreement)</label>
          <input id="other-label" type="text" maxLength={MAX_LABEL} value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} className={FIELD} />
          <label htmlFor="other-file" className="mt-2 block text-sm font-medium">Choose the file (PDF, PNG or JPEG, up to 10 MB)</label>
          <input id="other-file" type="file" accept={ACCEPT} disabled={busy || !otherLabel.trim()} className={FILE_FIELD}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              await upload(file, { label: otherLabel.trim() });
              setOtherLabel('');
            }} />
          {!otherLabel.trim() && <p className="mt-1 text-xs text-muted-foreground">Say what it is first and then choose the file.</p>}
        </div>
      )}
      {owner && !open && (
        <p className="mt-4 text-sm text-muted-foreground">This matter is finished. Reopen it to add or replace documents.</p>
      )}

      {error && <ErrorNotice error={error} className="mt-3" />}
    </section>
  );
}
