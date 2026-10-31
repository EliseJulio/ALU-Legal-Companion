import { test } from '@playwright/test';
import path from 'node:path';
import { stubApi, signInAs, DATA } from './support.js';

// Pictures of the real pages for docs1/screenshots, on a phone and on a desktop. The pages are
// real and the data is fake. Run: npm run screenshots

const OUT = path.resolve(import.meta.dirname, '../../../docs1/screenshots');

// A date some days from today, so a deadline reads "in 21 days" and not "in 25,000 days".
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const two = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};
const inDaysAt = (n) => `${inDays(n)}T08:00:00.000Z`;

const providers = [
  DATA.provider(),
  DATA.provider({ id: 2, name: 'Example Legal Aid Office', category: 'organisation', type: 'maj_office', bookable: false, services: 'Free legal aid for any legal problem.' }),
  DATA.provider({ id: 3, name: 'Example Labour Consultant', category: 'consultant', type: 'legal_aid', bookable: true, services: 'Advice on contracts and notice.' }),
];

const common = {
  'GET /emergency-contacts': () => DATA.contacts,
  'GET /directory/routes': () => DATA.routeCards,
  'GET /directory/routes/:id': () => DATA.route(),
  'GET /directory/providers': ({ query }) => (query.get('category') ? providers.filter((p) => p.category === query.get('category')) : providers),
  'GET /guides': () => [DATA.guide(), DATA.guide({ id: 2, title: 'Your written contract', domain: 'employment', source_law: 'Law No. 66/2018' })],
  'GET /guides/:id': () => DATA.guide(),
};

async function shoot(page, testInfo, name) {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(OUT, testInfo.project.name, `${name}.png`), fullPage: true });
}

const publicPages = [
  ['01-home', '/'],
  ['02-where-to-go', '/where-to-go'],
  ['03-route', '/where-to-go/1'],
  ['04-directory', '/directory'],
  ['05-book-a-consultation', '/directory/book/1'],
  ['06-ask-a-lawyer', '/ask'],
  ['07-guides', '/guides'],
  ['08-guide', '/guides/1'],
  ['09-urgent-help', '/emergency'],
  ['10-sign-in', '/login'],
];

for (const [name, url] of publicPages) {
  test(`public: ${name}`, async ({ page }, testInfo) => {
    await stubApi(page, common);
    await page.goto(url);
    await shoot(page, testInfo, name);
  });
}

test('student: my matters', async ({ page }, testInfo) => {
  await signInAs(page, 'student');
  await stubApi(page, {
    ...common,
    'GET /matters': () => [
      { id: 7, title: 'My landlord kept my deposit', status: 'open', next_action: 'Write to the landlord', next_due: inDays(5), shared_with_name: 'Example Pro Bono Lawyer' },
      { id: 8, title: 'Contract for my internship', status: 'open', next_action: 'Ask for a written copy', next_due: inDays(40), shared_with_name: null },
    ],
  });
  await page.goto('/matters');
  await shoot(page, testInfo, '11-my-matters');
});

test('student: one matter with its deadline and reminders', async ({ page }, testInfo) => {
  await signInAs(page, 'student');
  await stubApi(page, {
    ...common,
    'GET /matters/share-targets': () => [{ id: 9, name: 'Example Pro Bono Lawyer' }],
    'GET /matters/:id': () => DATA.matter({
      next_due: inDays(21),
      events: [{ id: 1, occurred_on: inDays(-3), description: 'Sent a letter to the landlord', author_is_owner: true, author_name: null }],
      reminders: [{ id: 1, send_on: inDays(14), status: 'pending' }, { id: 2, send_on: inDays(20), status: 'pending' }],
    }),
  });
  await page.goto('/matters/7');
  await shoot(page, testInfo, '12-matter');
});

test('student: my activity', async ({ page }, testInfo) => {
  await signInAs(page, 'student');
  await stubApi(page, {
    ...common,
    'GET /questions/mine': () => [{ id: 4, text: 'Can my landlord keep my deposit?', answer: 'Write to the landlord first and keep a copy.', status: 'answered', created_at: new Date().toISOString() }],
    'GET /bookings/mine': () => [{ id: 4, slot: inDaysAt(3), topic: 'My deposit', status: 'accepted', provider_name: 'Example Pro Bono Lawyer', meet_link: 'https://meet.example.org/abc' }],
  });
  await page.goto('/my-activity');
  await shoot(page, testInfo, '13-my-activity');
});

test('expert: review queue', async ({ page }, testInfo) => {
  await signInAs(page, 'expert');
  await stubApi(page, {
    ...common,
    'GET /guides/all': () => [DATA.guide({ status: 'pending_review', law_says: 'Article 11 says a lease may be written or unwritten.' })],
  });
  await page.goto('/expert');
  await shoot(page, testInfo, '14-expert-review-queue');
});

test('admin: dashboard', async ({ page }, testInfo) => {
  await signInAs(page, 'admin');
  const review = { draft: 1, pending_review: 2, published: 6 };
  await stubApi(page, {
    ...common,
    'GET /admin/stats': () => ({
      guides: review,
      directory: { providers: review, routes: { draft: 0, pending_review: 1, published: 7 }, stale: 1 },
      bookings: { total: 10, anonymous: 6, by_status: { requested: 3, accepted: 4, declined: 1, completed: 2 } },
      questions: { total: 20, anonymous: 15, open: 8 },
      matters: { total: 12, open: 9, shared: 2 },
      reminders: { pending: 4, sent: 11, missed: 1, cancelled: 2, sent_late: 0 },
      users: { student: 30, staff: 5, legal_expert: 2, admin: 1, deactivated: 3 },
    }),
  });
  await page.goto('/admin');
  await shoot(page, testInfo, '15-admin-dashboard');
});
