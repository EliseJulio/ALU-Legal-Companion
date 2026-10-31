import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, makeUser } from '../helpers.js';

// Every admin route. Nobody except an admin may use any of them.
const ROUTES = [
  ['get', '/api/admin/users'],
  ['put', '/api/admin/users/1/role'],
  ['post', '/api/admin/users/1/deactivate'],
  ['post', '/api/admin/users/1/reactivate'],
  ['get', '/api/admin/invites'],
  ['post', '/api/admin/invites'],
  ['get', '/api/admin/emergency-contacts'],
  ['post', '/api/admin/emergency-contacts'],
  ['put', '/api/admin/emergency-contacts/1'],
  ['delete', '/api/admin/emergency-contacts/1'],
  ['get', '/api/admin/stats'],
];

let people;
beforeEach(async () => {
  await resetDb();
  people = {
    student: await makeUser('student'),
    staff: await makeUser('staff', 'staff.person@alueducation.com'),
    expert: await makeUser('legal_expert'),
  };
});

describe('who may use the admin routes', () => {
  it.each(ROUTES)('%s %s asks for a login', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });

  it.each(ROUTES)('%s %s refuses a student a staff member and a legal expert', async (method, path) => {
    for (const who of Object.values(people)) {
      const res = await request(app)[method](path).set('Authorization', who.auth).send({});
      expect(res.status).toBe(403);
    }
  });
});
