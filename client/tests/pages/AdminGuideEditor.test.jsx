import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminGuideEditor from '@/pages/AdminGuideEditor';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const guide = (overrides) => ({
  id: 3, domain: 'employment', title: 'Your written contract', status: 'draft',
  situation: 'You started work.', law_says: 'Article 11 says so.', your_rights: 'You can ask.',
  steps: 'Ask in writing.', get_help: 'Labour inspector.', source_law: 'Law No. 66/2018',
  source_url: 'https://example.org/law', updated_at: '2026-09-01T00:00:00Z', ...overrides,
});

let guides;
let putReply;
let withdrawReply;

beforeEach(() => {
  localStorage.clear();
  saveSession({ token: 'tok-1', user: { id: 1, name: 'Test Admin', email: 'admin@example.org', role: 'admin' } });
  guides = [guide({})];
  putReply = async () => reply(200, {});
  withdrawReply = async () => reply(200, { id: 3, status: 'withdrawn' });
  global.fetch = vi.fn().mockImplementation(async (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (options.method === 'GET' && path === '/guides/all') return reply(200, guides);
    if (options.method === 'PUT' && path === '/guides/3') return putReply(options);
    if (options.method === 'POST' && path === '/guides') return reply(201, { id: 9 });
    if (options.method === 'POST' && path === '/guides/3/publish') return reply(200, { id: 3, status: 'published' });
    if (options.method === 'POST' && path === '/guides/3/withdraw') return withdrawReply(options);
    return reply(404, { error: 'unexpected' });
  });
});

// With `stubSaved` the page after a save is a stand-in, so a test can see where the editor went.
function show(path, { stubSaved = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/guides/new" element={<AdminGuideEditor />} />
          <Route path="/admin/guides/:id" element={stubSaved ? <p>Edit page nine</p> : <AdminGuideEditor />} />
          <Route path="/admin/guides" element={<p>All guides</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const sent = (method, suffix) => global.fetch.mock.calls.filter(([url, o]) => o.method === method && String(url).endsWith(suffix));
const u = () => userEvent.setup({ delay: null });

describe('Write a new guide', () => {
  it('starts with a blank form and saves it as a draft', async () => {
    const user = u();
    show('/admin/guides/new');
    expect(screen.getByRole('heading', { level: 1, name: 'Write a new guide' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'A new guide');
    await user.click(screen.getByRole('button', { name: 'Save the guide' }));
    const [[, options]] = sent('POST', '/guides');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ title: 'A new guide', domain: 'tenancy', source_url: null });
    // service is always sent. It is null when the how-to part is empty.
    expect(Object.keys(body).sort()).toEqual(['domain', 'get_help', 'law_says', 'service', 'situation', 'source_law', 'source_url', 'steps', 'summary', 'title', 'your_rights']);
    expect(body.service).toBeNull();
    // An empty summary box is sent as null, which means none.
    expect(body.summary).toBeNull();
  });

  it('goes to the saved guide afterwards', async () => {
    const user = u();
    show('/admin/guides/new', { stubSaved: true });
    await user.type(screen.getByLabelText('Title'), 'A new guide');
    await user.click(screen.getByRole('button', { name: 'Save the guide' }));
    expect(await screen.findByText('Edit page nine')).toBeInTheDocument();
  });

  it('never sends a status or a verifier, so a guide cannot be published from here', async () => {
    const user = u();
    show('/admin/guides/new');
    await user.click(screen.getByRole('button', { name: 'Save the guide' }));
    const body = JSON.parse(sent('POST', '/guides')[0][1].body);
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('verified_by');
  });

  it('shows the server message and keeps what was typed', async () => {
    global.fetch.mockImplementation(async () => reply(400, { error: 'title is required' }));
    const user = u();
    show('/admin/guides/new');
    await user.type(screen.getByLabelText('The law it is based on'), 'Law No. 1');
    await user.click(screen.getByRole('button', { name: 'Save the guide' }));
    expect(await screen.findByText('title is required')).toBeInTheDocument();
    expect(screen.getByLabelText('The law it is based on')).toHaveValue('Law No. 1');
  });
});

describe('Edit a draft guide', () => {
  it('starts from what is saved', async () => {
    show('/admin/guides/3');
    expect(await screen.findByLabelText('Title')).toHaveValue('Your written contract');
    expect(screen.getByLabelText('Your rights')).toHaveValue('You can ask.');
    expect(screen.getByLabelText('Link to the full text (optional)')).toHaveValue('https://example.org/law');
    expect(screen.getByLabelText('Area of law')).toHaveValue('employment');
  });

  it('needs no warning for a draft and saves straight away', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(screen.queryByText(/I understand/)).not.toBeInTheDocument();
    expect(sent('PUT', '/guides/3')).toHaveLength(1);
    expect(await screen.findByText(/The guide is now a draft/)).toBeInTheDocument();
  });

  it('keeps the Saved line and the typed text when the guide is loaded again after a save', async () => {
    const user = u();
    putReply = async () => {
      // The server stamps a new time on every save, so the reloaded guide differs from the first.
      guides = [guide({ summary: 'twelve words', updated_at: '2026-09-02T00:00:00Z' })];
      return reply(200, {});
    };
    show('/admin/guides/3');
    await user.type(await screen.findByLabelText('Summary'), 'twelve words');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/The guide is now a draft/)).toBeInTheDocument();
    await waitFor(() => expect(sent('GET', '/guides/all').length).toBeGreaterThan(1));
    expect(screen.getByText(/The guide is now a draft/)).toBeInTheDocument();
    expect(screen.getByLabelText('Summary')).toHaveValue('twelve words');
  });

  it('has a Summary box that counts to 280 and sends what was typed', async () => {
    const user = u();
    show('/admin/guides/3');
    const box = await screen.findByLabelText('Summary');
    expect(box).toHaveAttribute('maxLength', '280');
    expect(screen.getByText('0 of 280')).toBeInTheDocument();
    await user.type(box, 'twelve words');
    expect(screen.getByText('12 of 280')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(JSON.parse(sent('PUT', '/guides/3')[0][1].body).summary).toBe('twelve words');
  });

  it('sends null when the Summary box is empty', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(JSON.parse(sent('PUT', '/guides/3')[0][1].body).summary).toBeNull();
  });

  it('offers to publish a draft', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(sent('POST', '/guides/3/publish')).toHaveLength(1);
  });

  it('empties the link box into null when it is cleared', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.clear(await screen.findByLabelText('Link to the full text (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(JSON.parse(sent('PUT', '/guides/3')[0][1].body).source_url).toBeNull();
  });
});

describe('The integrity rule on a published guide', () => {
  beforeEach(() => {
    guides = [guide({ status: 'published' })];
  });

  it('warns that saving takes the guide off the site', async () => {
    show('/admin/guides/3');
    expect(await screen.findByText(/Saving any change takes it off the site/)).toBeInTheDocument();
  });

  it('sends no request at all until the admin says they understand', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tick the box');
    expect(sent('PUT', '/guides/3')).toHaveLength(0);
  });

  it('saves once the box is ticked', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.click(await screen.findByLabelText('I understand'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(sent('PUT', '/guides/3')).toHaveLength(1);
  });

  it('has no way to send a published guide for review or to publish it', async () => {
    show('/admin/guides/3');
    await screen.findByRole('button', { name: 'Save changes' });
    expect(screen.queryByRole('button', { name: /send for review|publish|verify/i })).not.toBeInTheDocument();
  });

  it('offers to withdraw, and refuses with no reason typed', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.click(await screen.findByRole('button', { name: 'Withdraw' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Say why this guide is being withdrawn.');
    expect(sent('POST', '/guides/3/withdraw')).toHaveLength(0);
  });

  it('withdraws with the typed reason and reloads the guide', async () => {
    const user = u();
    show('/admin/guides/3');
    await user.type(await screen.findByLabelText('Reason'), 'Superseded by a new law.');
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    const [[, options]] = sent('POST', '/guides/3/withdraw');
    expect(JSON.parse(options.body)).toEqual({ comment: 'Superseded by a new law.' });
  });
});

describe('How to do it', () => {
  const saved = () => ({
    portal: { name: 'IremboGov', url: 'https://irembo.gov.rw/x', help_url: 'https://support.irembo.gov.rw/y' },
    who_can_apply: 'A foreign student.',
    fees: [{ item: 'Permit', amount_rwf: 20000, note: 'renewal', source_url: 'https://migration.gov.rw/z' }, { item: 'Express', amount_rwf: null }],
    processing: { text: '7 days', days_min: 7, days_max: 7 },
    documents: [{ name: 'Passport page', notes: 'PDF', where_to_get: 'Passport office', required_if: 'always', source_url: 'https://migration.gov.rw/z' }],
    offices: [{ name: 'DGIE', address: 'KG 7 Ave', district: 'Gasabo', hours: 'Mon-Fri', phone: '+250 788 152 222', map_url: 'https://maps.example/dgie', source_url: 'https://migration.gov.rw/address' }],
    walkthrough: [{ instruction: 'Choose Permits', url_at_step: 'https://irembo.gov.rw/p' }],
    unconfirmed: ['The exact price', 'The days before expiry'],
    checked_at: '2026-10-20',
  });

  it('sends what was typed, with numbers as numbers and an empty amount as null', async () => {
    const user = u();
    show('/admin/guides/new');
    await user.type(screen.getByLabelText('Title'), 'A new guide');
    await user.type(screen.getByLabelText('Portal name'), 'IremboGov');
    await user.click(screen.getByRole('button', { name: 'Add a fee' }));
    await user.type(screen.getByLabelText('What the fee is for'), 'Permit');
    await user.type(screen.getByLabelText(/Amount in FRW/), '20000');
    await user.click(screen.getByRole('button', { name: 'Add a fee' }));
    await user.type(screen.getAllByLabelText('What the fee is for')[1], 'Express');
    await user.click(screen.getByRole('button', { name: 'Add a document' }));
    await user.type(screen.getByLabelText('Document'), 'Passport page');
    await user.click(screen.getByRole('button', { name: 'Save the guide' }));
    const body = JSON.parse(sent('POST', '/guides')[0][1].body);
    expect(body.service).toEqual({
      portal: { name: 'IremboGov' },
      fees: [{ item: 'Permit', amount_rwf: 20000 }, { item: 'Express', amount_rwf: null }],
      documents: [{ name: 'Passport page' }],
    });
  });

  it('starts from the saved block, so saving without a change sends the same block back', async () => {
    guides = [guide({ service: saved() })];
    const user = u();
    show('/admin/guides/3');
    expect(await screen.findByLabelText('Portal name')).toHaveValue('IremboGov');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(JSON.parse(sent('PUT', '/guides/3')[0][1].body).service).toEqual(saved());
  });

  it('clears the block when every box is emptied, by sending null', async () => {
    guides = [guide({ service: { portal: { name: 'IremboGov' } } })];
    const user = u();
    show('/admin/guides/3');
    await user.clear(await screen.findByLabelText('Portal name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(JSON.parse(sent('PUT', '/guides/3')[0][1].body).service).toBeNull();
  });

  it('adds a step with what the reader does and the page it happens on', async () => {
    const user = u();
    show('/admin/guides/new');
    await user.type(screen.getByLabelText('Title'), 'A new guide');
    await user.click(screen.getByRole('button', { name: 'Add a step' }));
    await user.type(screen.getByLabelText('What the reader does'), 'Choose Permits');
    await user.type(screen.getByLabelText(/Page address at this step/), 'https://irembo.gov.rw/p');
    await user.click(screen.getByRole('button', { name: 'Save the guide' }));
    const body = JSON.parse(sent('POST', '/guides')[0][1].body);
    expect(body.service.walkthrough).toEqual([{
      instruction: 'Choose Permits', url_at_step: 'https://irembo.gov.rw/p',
    }]);
  });
});

describe('A guide that does not exist', () => {
  it('says so', async () => {
    show('/admin/guides/77');
    expect(await screen.findByText('That guide does not exist.')).toBeInTheDocument();
  });
});

describe('Guide editor: the page as designed', () => {
  it('says publishing takes the text live at once, beside the form', async () => {
    show('/admin/guides/new');
    expect(await screen.findByRole('heading', { level: 2, name: 'Publishing' })).toBeInTheDocument();
    expect(screen.getByText(/there is no separate reviewer/)).toBeInTheDocument();
    expect(screen.getByText('Source required')).toBeInTheDocument();
  });
});
