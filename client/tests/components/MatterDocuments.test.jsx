import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatterDocuments from '@/components/MatterDocuments';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const MATTER = { id: 7, status: 'open' };

const doc = (over = {}) => ({
  id: 1, label: 'Sale agreement', item_key: 'sale-agreement', mime: 'application/pdf',
  uploaded_at: '2026-10-01T10:00:00Z', review: { status: 'pending', note: null },
  ...over,
});

const item = (over = {}) => ({
  key: 'sale-agreement', name: 'Sale agreement', required: true, state: 'missing', document: null, ...over,
});

let checklist;
let docs;

// Answers by method and path. Anything not listed is an empty success.
function serve(overrides = {}) {
  global.fetch = vi.fn().mockImplementation(async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    const key = `${options.method ?? 'GET'} ${path}`;
    if (overrides[key]) return overrides[key]();
    if (key === 'GET /matters/7/documents/checklist') return reply(200, checklist);
    if (key === 'GET /matters/7/documents') return reply(200, docs);
    if (key === 'GET /checklists') return reply(200, [{ id: 3, title: 'Buying a second-hand car' }]);
    return reply(200, {});
  });
}

const sent = (method, startsWith) => global.fetch.mock.calls.filter(
  ([url, options = {}]) => (options.method ?? 'GET') === method && String(url).replace(/^https?:\/\/[^/]+\/api/, '').startsWith(startsWith),
);

beforeEach(() => {
  checklist = { checklist: null, items: [], ready: false };
  docs = [];
  serve();
});

describe('the owner', () => {
  it('can pick a checklist and follow it', async () => {
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    await userEvent.selectOptions(await screen.findByLabelText(/follow a checklist/i), '3');
    await userEvent.click(screen.getByRole('button', { name: /follow this checklist/i }));
    await waitFor(() => expect(sent('POST', '/matters/7/checklist')).toHaveLength(1));
    expect(JSON.parse(sent('POST', '/matters/7/checklist')[0][1].body)).toEqual({ checklist_id: 3 });
  });

  it('says when no checklist exists and still allows another document', async () => {
    serve({ 'GET /checklists': () => reply(200, []) });
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText(/no checklist of required documents/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what is it/i)).toBeInTheDocument();
  });

  it('shows each item with its state in words and uploads for an item', async () => {
    const done = doc({ id: 2, label: 'Your ID', item_key: 'id', review: { status: 'complete', note: null } });
    checklist = {
      checklist: { title: 'Buying a second-hand car', under_review: false },
      items: [item(), item({ key: 'id', name: 'Your ID', state: 'complete', document: done })],
      ready: false,
    };
    docs = [done];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();

    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText(/upload the document for sale agreement/i), file);
    // Choosing the file sends nothing. The button sends it.
    expect(sent('POST', '/matters/7/documents?')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /upload for sale agreement/i }));
    await waitFor(() => expect(sent('POST', '/matters/7/documents?')).toHaveLength(1));
    const url = sent('POST', '/matters/7/documents?')[0][0];
    expect(url).toContain('item=sale-agreement');
    expect(url).toContain('label=Sale+agreement');
  });

  it('shows an unchecked file as Awaiting check', async () => {
    checklist = { checklist: { title: 'Car', under_review: false }, items: [item({ state: 'pending', document: doc() })], ready: false };
    docs = [doc()];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText('Awaiting check')).toBeInTheDocument();
    expect(screen.queryByText('Waiting')).not.toBeInTheDocument();
  });

  it('shows the lawyer note when a file needs fixing', async () => {
    const d = doc({ review: { status: 'needs_fix', note: 'The plate number is missing.' } });
    checklist = { checklist: { title: 'Car', under_review: false }, items: [item({ state: 'needs_fix', document: d })], ready: false };
    docs = [d];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText(/the plate number is missing/i)).toBeInTheDocument();
    expect(screen.getByText('Needs fixing')).toBeInTheDocument();
  });

  it('asks before deleting a file and sends nothing until confirmed', async () => {
    docs = [doc({ item_key: null, label: 'Lease' })];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Lease' }));
    expect(screen.getByText(/delete this file for good/i)).toBeInTheDocument();
    expect(sent('DELETE', '/matters/7/documents')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /yes, delete this file/i }));
    await waitFor(() => expect(sent('DELETE', '/matters/7/documents/1')).toHaveLength(1));
  });

  it('keeping the file sends nothing', async () => {
    docs = [doc({ item_key: null, label: 'Lease' })];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Lease' }));
    await userEvent.click(screen.getByRole('button', { name: /keep it/i }));
    expect(sent('DELETE', '/matters/7/documents')).toHaveLength(0);
  });

  it('says ready is a check of the files and no promise', async () => {
    checklist = { checklist: { title: 'Car', under_review: false }, items: [], ready: true };
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText(/not a promise that the office will accept/i)).toBeInTheDocument();
  });

  it('says a checklist is hidden while it is being updated', async () => {
    checklist = { checklist: { title: 'Car', under_review: true }, items: [], ready: false };
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText(/this checklist is being updated/i)).toBeInTheDocument();
  });

  it('offers no upload on a finished matter', async () => {
    render(<MatterDocuments matter={{ id: 7, status: 'closed' }} viewer="owner" />);
    expect(await screen.findByText(/this matter is finished/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/what is it/i)).not.toBeInTheDocument();
  });

  it('shows the server message when an upload is refused', async () => {
    serve({ 'POST /matters/7/documents?label=Lease': () => reply(503, { error: 'Document storage is not switched on.' }) });
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    await userEvent.type(await screen.findByLabelText(/what is it/i), 'Lease');
    await userEvent.upload(screen.getByLabelText(/choose the file/i), new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));
    expect(await screen.findByText(/document storage is not switched on/i)).toBeInTheDocument();
  });

  it('survives a reply that is not the expected shape', async () => {
    serve({
      'GET /matters/7/documents/checklist': () => reply(200, 'oops'),
      'GET /matters/7/documents': () => reply(200, { not: 'a list' }),
    });
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument();
  });
});

describe('sending a document', () => {
  const pdf = () => new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
  const SHARED = { id: 7, status: 'open', shared_with: 3, shared_with_name: 'Adv. Amani' };

  it('sends nothing when a file is only chosen, and keeps the button off until there is a label and a file', async () => {
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    const button = await screen.findByRole('button', { name: 'Add document' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.upload(screen.getByLabelText(/choose the file/i), pdf());
    expect(button).toHaveAttribute('aria-disabled', 'true'); // a file but no label
    await userEvent.type(screen.getByLabelText(/what is it/i), 'Lease');
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    expect(sent('POST', '/matters/7/documents?')).toHaveLength(0);
    await userEvent.click(button);
    await waitFor(() => expect(sent('POST', '/matters/7/documents?')).toHaveLength(1));
    expect(sent('POST', '/matters/7/documents?')[0][0]).toContain('label=Lease');
  });

  it('sends nothing when the button is pressed with no file', async () => {
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    await userEvent.type(await screen.findByLabelText(/what is it/i), 'Lease');
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));
    expect(sent('POST', '/matters/7/documents?')).toHaveLength(0);
  });

  it('empties the label and the file after a send, so one file is not sent twice', async () => {
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    const label = await screen.findByLabelText(/what is it/i);
    await userEvent.type(label, 'Lease');
    await userEvent.upload(screen.getByLabelText(/choose the file/i), pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));
    await waitFor(() => expect(label).toHaveValue(''));
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));
    expect(sent('POST', '/matters/7/documents?')).toHaveLength(1);
  });

  it('says it is saved but no lawyer can see it when the matter is not shared', async () => {
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText(/not shared with a lawyer yet, so no lawyer can see these documents/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/what is it/i), 'Lease');
    await userEvent.upload(screen.getByLabelText(/choose the file/i), pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));
    expect(await screen.findByText(/No lawyer can see it until you share this matter with one/)).toBeInTheDocument();
  });

  it('names the lawyer on the button and in the message when the matter is shared', async () => {
    render(<MatterDocuments matter={SHARED} viewer="owner" />);
    expect(await screen.findByText(/They can open every document here and are told by email/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/what is it/i), 'Lease');
    await userEvent.upload(screen.getByLabelText(/choose the file/i), pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Add and send to my lawyer' }));
    expect(await screen.findByText(/Added and sent\. Adv\. Amani can open it now and has been told by email/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add document' })).not.toBeInTheDocument();
  });

  it('shows the owner how many files wait for the lawyer', async () => {
    docs = [doc({ id: 1, item_key: null, label: 'Lease' }), doc({ id: 2, item_key: null, label: 'ID', review: { status: 'complete', note: null } })];
    render(<MatterDocuments matter={SHARED} viewer="owner" />);
    expect(await screen.findByText(/Waiting for Adv\. Amani.s check/)).toBeInTheDocument();
    expect(screen.getByText('1', { selector: 'span.font-semibold' })).toBeInTheDocument();
  });

  it('replaces a file only when Replace file is pressed, and says the lawyer checks it again', async () => {
    docs = [doc({ id: 4, item_key: null, label: 'Lease' })];
    render(<MatterDocuments matter={SHARED} viewer="owner" />);
    await userEvent.upload(await screen.findByLabelText(/replace this file/i), pdf());
    expect(sent('POST', '/matters/7/documents?')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Replace Lease' }));
    await waitFor(() => expect(sent('POST', '/matters/7/documents?')).toHaveLength(1));
    expect(sent('POST', '/matters/7/documents?')[0][0]).toContain('replaces=4');
    expect(await screen.findByText(/Replaced\. Adv\. Amani has been told by email and will check the new file again/)).toBeInTheDocument();
  });
});

describe('the legal expert', () => {
  const pendingCar = () => {
    docs = [doc()];
    checklist = { checklist: { title: 'Car', under_review: false }, items: [item({ state: 'pending', document: doc() })], ready: false };
  };

  it('can give a verdict and cannot upload or delete', async () => {
    pendingCar();
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    expect(await screen.findByRole('button', { name: /save my check/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/replace this file/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/what is it/i)).not.toBeInTheDocument();
  });

  it('is told in words how many documents are waiting for the check', async () => {
    docs = [doc({ id: 1, item_key: null, label: 'Lease' }), doc({ id: 2, item_key: null, label: 'ID' })];
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    expect(await screen.findByText('2 documents are waiting for your check.')).toBeInTheDocument();
  });

  it('says one document, not one documents', async () => {
    docs = [doc({ id: 1, item_key: null, label: 'Lease' })];
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    expect(await screen.findByText('1 document is waiting for your check.')).toBeInTheDocument();
  });

  it('says nothing about waiting once every file has a check', async () => {
    docs = [doc({ id: 1, item_key: null, label: 'Lease', review: { status: 'complete', note: null } })];
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    await screen.findByRole('button', { name: 'Download Lease' });
    expect(screen.queryByText(/waiting for your check/)).not.toBeInTheDocument();
  });

  it('needs a note unless the verdict is complete', async () => {
    pendingCar();
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    const save = await screen.findByRole('button', { name: /save my check/i });
    expect(save).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.selectOptions(screen.getByLabelText(/your check of this file/i), 'needs_fix');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(screen.getByLabelText(/note/i), 'Plate missing');
    expect(save).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(save);
    await waitFor(() => expect(sent('PUT', '/matters/7/documents/1/review')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/matters/7/documents/1/review')[0][1].body)).toEqual({ status: 'needs_fix', note: 'Plate missing' });
  });

  it('downloads a file through the login', async () => {
    docs = [doc({ item_key: null, label: 'Lease' })];
    global.URL.createObjectURL = vi.fn(() => 'blob:x');
    global.URL.revokeObjectURL = vi.fn();
    serve({ 'GET /matters/7/documents/1/file': () => ({ ok: true, status: 200, blob: async () => new Blob(['pdf']) }) });
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    const row = (await screen.findByRole('button', { name: 'Download Lease' })).closest('li');
    await userEvent.click(within(row).getByRole('button', { name: 'Download Lease' }));
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled());
  });
});

describe('comments', () => {
  const COMMENTS = [
    { id: 1, body: 'Is the plate number right?', created_at: '2026-10-02T09:00:00Z', author_name: 'Adv. Amani', by_you: false },
    { id: 2, body: 'Checked the seller.', created_at: '2026-10-03T09:00:00Z', author_name: null, by_you: true },
  ];

  it('shows the owner the lawyer name and gives no box to write one', async () => {
    docs = [doc({ item_key: null, label: 'Lease', comments: COMMENTS })];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    expect(await screen.findByText('Is the plate number right?')).toBeInTheDocument();
    expect(screen.getByText(/Adv\. Amani/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/add a comment/i)).not.toBeInTheDocument();
  });

  it('shows a lawyer their own comment as You and another lawyer without a name', async () => {
    docs = [doc({ item_key: null, label: 'Lease', comments: [
      { id: 1, body: 'Earlier note.', created_at: '2026-10-02T09:00:00Z', author_name: null, by_you: false },
      COMMENTS[1],
    ] })];
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    expect(await screen.findByText(/Another lawyer/)).toBeInTheDocument();
    expect(screen.getByText(/^You ·/)).toBeInTheDocument();
  });

  it('lets the lawyer post a comment and clears the box once it is saved', async () => {
    docs = [doc({ item_key: null, label: 'Lease' })];
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    const box = await screen.findByLabelText(/add a comment/i);
    const send = screen.getByRole('button', { name: 'Post comment on Lease' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(box, 'Please check the seller ID.');
    await userEvent.click(send);
    await waitFor(() => expect(sent('POST', '/matters/7/documents/1/comments')).toHaveLength(1));
    expect(JSON.parse(sent('POST', '/matters/7/documents/1/comments')[0][1].body)).toEqual({ body: 'Please check the seller ID.' });
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('keeps what the lawyer typed when the comment could not be saved', async () => {
    docs = [doc({ item_key: null, label: 'Lease' })];
    serve({ 'POST /matters/7/documents/1/comments': () => reply(404, { error: 'Document not found' }) });
    render(<MatterDocuments matter={MATTER} viewer="legal_expert" />);
    const box = await screen.findByLabelText(/add a comment/i);
    await userEvent.type(box, 'Keep me');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment on Lease' }));
    expect(await screen.findByText('Document not found')).toBeInTheDocument();
    expect(box).toHaveValue('Keep me');
  });

  it('copes with a document that has no comments key', async () => {
    docs = [doc({ item_key: null, label: 'Lease' })];
    render(<MatterDocuments matter={MATTER} viewer="owner" />);
    await screen.findByText('Lease', { selector: 'span' });
    expect(screen.queryByText('Comments')).not.toBeInTheDocument();
  });
});
