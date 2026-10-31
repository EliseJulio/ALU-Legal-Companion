import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { BUILT_IN_CONTACTS } from '../../src/routes/contacts.js';
import { resetDb } from '../helpers.js';

beforeEach(resetDb);

describe('GET /api/emergency-contacts', () => {
  it('uses the built-in list when the table is empty', async () => {
    const res = await request(app).get('/api/emergency-contacts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(BUILT_IN_CONTACTS);
  });

  it('uses the table once it has rows and sorts by sort_order', async () => {
    await q(`INSERT INTO emergency_contacts (name, contact, when_to_use, sort_order) VALUES
             ('Second', '222', 'later', 20), ('First', '111', 'now', 10)`);
    const res = await request(app).get('/api/emergency-contacts');
    expect(res.body).toEqual([
      { name: 'First', contact: '111', when: 'now' },
      { name: 'Second', contact: '222', when: 'later' },
    ]);
  });

  it('sends when_to_use under the name "when" and nothing else', async () => {
    await q("INSERT INTO emergency_contacts (name, contact, when_to_use) VALUES ('One', '1', 'Always')");
    const [row] = (await request(app).get('/api/emergency-contacts')).body;
    expect(Object.keys(row).sort()).toEqual(['contact', 'name', 'when']);
  });

  it('still answers when the database cannot be read', async () => {
    await q('ALTER TABLE emergency_contacts RENAME TO emergency_contacts_hidden');
    try {
      const res = await request(app).get('/api/emergency-contacts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(BUILT_IN_CONTACTS);
    } finally {
      await q('ALTER TABLE emergency_contacts_hidden RENAME TO emergency_contacts');
    }
  });

  it('is open to everyone with no login', async () => {
    const res = await request(app).get('/api/emergency-contacts');
    expect(res.status).toBe(200);
  });
});

describe('the built-in list', () => {
  it('has the police and Isange numbers', () => {
    const numbers = BUILT_IN_CONTACTS.map((c) => c.contact);
    expect(numbers).toContain('112');
    expect(numbers).toContain('3029');
  });

  it('has no placeholder in front of a reader in a crisis', () => {
    for (const c of BUILT_IN_CONTACTS) {
      expect(`${c.name} ${c.contact} ${c.when}`).not.toMatch(/\[|to confirm|tbd|todo/i);
      expect(c.name && c.contact && c.when).toBeTruthy();
    }
  });
});
