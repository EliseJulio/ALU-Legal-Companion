import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateService } from '../../src/services/guideService.js';

// The seeded how-to guides carry a link to the help article of the service. "Read the official help
// article" must open the article for that guide. A bare home page helps nobody.
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'seed-data', 'guides');
const guides = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, guide: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));

const HOME_PAGES = ['/', '/en', '/en/support', '/en/support/home', '/en/support/solutions'];

describe('the seeded how-to guides', () => {
  it('has at least the two guides', () => {
    expect(guides.length).toBeGreaterThanOrEqual(2);
  });

  it.each(guides.map((g) => [g.file, g.guide]))('%s passes the same checks as an admin save', (_file, guide) => {
    const checked = validateService(guide.service);
    expect(checked.errors).toBeUndefined();
  });

  it.each(guides.map((g) => [g.file, g.guide]))('%s has a help link that is an article and not a home page', (_file, guide) => {
    const help = guide.service?.portal?.help_url;
    expect([guide.title, Boolean(help)]).toEqual([guide.title, true]);
    const url = new URL(help);
    expect(url.protocol).toBe('https:');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    expect([help, HOME_PAGES.includes(pathname)]).toEqual([help, false]);
    // An article or a page inside the site, so more than one part to the path.
    expect([help, pathname.split('/').filter(Boolean).length >= 2]).toEqual([help, true]);
  });

  it('gives each guide its own help link', () => {
    const links = guides.map((g) => g.guide.service.portal.help_url);
    expect(new Set(links).size).toBe(links.length);
  });
});
