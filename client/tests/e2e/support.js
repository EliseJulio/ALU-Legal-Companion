import { expect } from '@playwright/test';
// Helpers shared by the browser tests.
//
// The tests never talk to the real server. `stubApi` answers every call the page makes to /api
// with a fixed reply that the test chose. A call that the test did not plan for gets a 404, and
// `calls` lists everything that was sent, so a test can check what the page asked for.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// A handler returns the body of a 200 reply. To send another status use reply(body, status).
export const reply = (body, status = 200) => ({ __reply: true, body, status });

// handlers: { 'GET /guides/:id': ({ params, query, body }) => [...] }
export async function stubApi(page, handlers = {}) {
  const calls = [];
  const table = Object.entries(handlers).map(([key, handler]) => {
    const [method, pattern] = key.split(' ');
    const names = [...pattern.matchAll(/:([a-z]+)/g)].map((m) => m[1]);
    const regex = new RegExp(`^${pattern.replace(/:[a-z]+/g, '([^/]+)')}$`);
    return { method, regex, names, handler };
  })
    // A fixed path wins over one with a parameter, as in the real server. Without this
    // /matters/:id would also answer /matters/share-targets.
    .sort((a, b) => a.names.length - b.names.length);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const raw = request.postData();
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ method: request.method(), path, query: url.searchParams, body, authorization: request.headers().authorization });

    const hit = table.find((t) => t.method === request.method() && t.regex.test(path));
    if (!hit) {
      return route.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: `Not stubbed: ${request.method()} ${path}` }) });
    }
    const values = path.match(hit.regex).slice(1);
    const params = Object.fromEntries(hit.names.map((name, i) => [name, decodeURIComponent(values[i])]));
    const result = await hit.handler({ params, query: url.searchParams, body });
    const { body: payload, status } = result?.__reply ? result : { body: result, status: 200 };

    if (status === 204) return route.fulfill({ status, headers: CORS });
    return route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(payload ?? {}) });
  });

  return {
    calls,
    // The calls of one kind, for example sent('POST', '/bookings/anonymous').
    sent: (method, path) => calls.filter((c) => c.method === method && c.path === path),
  };
}

const PEOPLE = {
  student: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' },
  expert: { id: 2, name: 'Test Expert', email: 'expert@example.org', role: 'legal_expert' },
  admin: { id: 3, name: 'Test Admin', email: 'admin@example.org', role: 'admin' },
};

// Starts the page already signed in, as the site does after a sign in. Call it before goto.
export async function signInAs(page, role) {
  const user = PEOPLE[role];
  await page.addInitScript((saved) => {
    localStorage.setItem('alc.token', 'tok-test');
    localStorage.setItem('alc.user', JSON.stringify(saved));
  }, user);
  return user;
}

// Fixed example data. Every name, address and code here is made up.
export const DATA = {
  code: '1234-5678-9ABC-DEFG',
  contacts: [
    { name: 'Police', contact: '112', when: 'Immediate danger' },
    { name: 'Isange One Stop Centre', contact: '3029', when: 'Abuse or harassment' },
  ],
  routeCards: [
    { id: 1, title: 'My landlord kept my deposit', first_forum_name: 'Example Abunzi Committee', deadline_days: 30, deadline_runs_from: 'the day you left' },
    { id: 2, title: 'I was dismissed from work', first_forum_name: 'Example Labour Inspector', deadline_days: null, deadline_runs_from: null },
  ],
  provider: (overrides = {}) => ({
    id: 1, name: 'Example Pro Bono Lawyer', category: 'lawyer', type: 'pro_bono_lawyer', location: 'Kigali',
    contact: 'Phone number on file', services: 'Free advice on rent and work.', languages: 'English, Kinyarwanda',
    is_free: true, bookable: true, last_checked_at: '2026-09-01', stale: false,
    verified_at: '2026-09-02T09:00:00Z', ...overrides,
  }),
  route: () => ({
    id: 1,
    title: 'My landlord kept my deposit',
    legal_basis: 'A lease is a contract. Abunzi committees hear contract disputes between individuals.',
    exclusions: 'The amount is above the limit of the committee.',
    steps: ['Write to the landlord', 'Go to the committee', 'Keep a copy of every paper'],
    deadline_days: 30,
    deadline_runs_from: 'the day you left',
    deadline_note: null,
    verified_at: '2026-09-02T09:00:00Z',
    first_forum: {
      id: 9, name: 'Example Abunzi Committee', type: 'abunzi', location: 'Kigali', contact: 'Sector office',
      services: 'Mediation.', languages: 'Kinyarwanda', is_free: true, bookable: false,
      last_checked_at: '2026-09-01', stale: false, verified_at: '2026-09-02T09:00:00Z',
    },
  }),
  guide: (overrides = {}) => ({
    id: 1, domain: 'tenancy', title: 'Getting your deposit back', status: 'published',
    situation: 'Your landlord keeps your deposit.', law_says: 'A lease is a contract.',
    your_rights: 'You can ask for it back.', steps: 'Write a letter.', get_help: 'Go to the committee.',
    source_law: 'Law No. 00/0000', source_url: 'https://example.org/law',
    verified_at: '2026-09-02T09:00:00Z', updated_at: '2026-09-02T09:00:00Z', ...overrides,
  }),
  matter: (overrides = {}) => ({
    id: 7, title: 'My landlord kept my deposit', status: 'open', next_action: 'Write to the landlord',
    next_due: '2099-01-10', route_id: 1, shared_with: null, shared_with_name: null, viewer: 'owner',
    events: [], reminders: [{ id: 1, send_on: '2099-01-03', status: 'pending' }, { id: 2, send_on: '2099-01-09', status: 'pending' }],
    ...overrides,
  }),
};

// True when the page is wider than the screen, so a phone would scroll sideways.
export const scrollsSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

// On a phone the main menu is closed until Menu is tapped. A journey that needs a nav link calls
// this first. It does nothing at a width where the menu is always open and does nothing if the menu
// is already open.
export async function openMenu(page) {
  const button = page.getByRole('button', { name: 'Menu', exact: true });
  if (!(await button.isVisible())) return;
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
}
