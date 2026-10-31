import request from 'supertest';
import app from '../../src/app.js';
import { q } from '../../src/db.js';
import { resetDb, makeUser } from '../helpers.js';

let admin;
let otherAdmin;
let student;
let expert;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  otherAdmin = await makeUser('admin', 'second.admin@example.org');
  student = await makeUser('student');
  expert = await makeUser('legal_expert');
});

const as = (who, method, path) => request(app)[method](path).set('Authorization', who.auth);
const setRole = (who, id, role) => as(who, 'put', `/api/admin/users/${id}/role`).send({ role });
const login = (email, password = 'password1234') => request(app).post('/api/auth/login').send({ email, password });

describe('GET /api/admin/users', () => {
  it('lists every account with only the fields that managing accounts needs', async () => {
    const res = await as(admin, 'get', '/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'created_at', 'deactivated_at', 'email', 'email_verified_at', 'id', 'name', 'role']);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|session_version/i);
  });

  it('puts the newest account first', async () => {
    const res = await as(admin, 'get', '/api/admin/users');
    const times = res.body.map((u) => new Date(u.created_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe('PUT /api/admin/users/:id/role', () => {
  it('changes a role and the new role works on the very next request', async () => {
    const res = await setRole(admin, student.user.id, 'staff');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: student.user.id, role: 'staff' });
    expect(Object.keys(res.body)).not.toContain('password_hash');

    const promoted = await setRole(admin, student.user.id, 'admin');
    expect(promoted.body.role).toBe('admin');
    expect((await as(student, 'get', '/api/admin/users')).status).toBe(200);
  });

  it('takes admin power away at once from an admin who is demoted', async () => {
    expect((await as(otherAdmin, 'get', '/api/admin/users')).status).toBe(200);
    await setRole(admin, otherAdmin.user.id, 'student');
    expect((await as(otherAdmin, 'get', '/api/admin/users')).status).toBe(403);
  });

  it('will not give the legal expert role and says what to do instead', async () => {
    const res = await setRole(admin, student.user.id, 'legal_expert');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invitation/i);
    const [row] = await q('SELECT role FROM users WHERE id = $1', [student.user.id]);
    expect(row.role).toBe('student');
  });

  it('will not change the role of a legal expert', async () => {
    const res = await setRole(admin, expert.user.id, 'student');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be changed/);
    const [row] = await q('SELECT role FROM users WHERE id = $1', [expert.user.id]);
    expect(row.role).toBe('legal_expert');
  });

  it('refuses a role that does not exist', async () => {
    for (const bad of ['owner', '', undefined, 5]) {
      expect((await setRole(admin, student.user.id, bad)).status).toBe(400);
    }
  });

  it('answers 404 for an unknown account and a bad id', async () => {
    expect((await setRole(admin, 99999, 'staff')).status).toBe(404);
    expect((await setRole(admin, 'abc', 'staff')).status).toBe(404);
  });

  it('lets an admin step down when another admin is left', async () => {
    const res = await setRole(admin, admin.user.id, 'staff');
    expect(res.status).toBe(200);
  });

  it('will not let the last active admin step down', async () => {
    await q('UPDATE users SET deactivated_at = now() WHERE id = $1', [otherAdmin.user.id]);
    const res = await setRole(admin, admin.user.id, 'staff');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last active admin/);
    const [row] = await q('SELECT role FROM users WHERE id = $1', [admin.user.id]);
    expect(row.role).toBe('admin');
  });

  it('does not count a switched-off admin as one who is left', async () => {
    await as(admin, 'post', `/api/admin/users/${otherAdmin.user.id}/deactivate`);
    expect((await setRole(admin, admin.user.id, 'student')).status).toBe(400);
  });
});

describe('POST /api/admin/users/:id/deactivate', () => {
  it('switches an account off and its token stops working at once', async () => {
    expect((await as(student, 'get', '/api/auth/me')).status).toBe(200);
    const res = await as(admin, 'post', `/api/admin/users/${student.user.id}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body.deactivated_at).toBeTruthy();
    expect((await as(student, 'get', '/api/auth/me')).status).toBe(401);
  });

  it('stops the person from signing in', async () => {
    await as(admin, 'post', `/api/admin/users/${student.user.id}/deactivate`);
    const res = await login(student.user.email);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/no longer active/);
  });

  it('keeps the first time access was withdrawn', async () => {
    const first = await as(admin, 'post', `/api/admin/users/${student.user.id}/deactivate`);
    const second = await as(admin, 'post', `/api/admin/users/${student.user.id}/deactivate`);
    expect(second.body.deactivated_at).toBe(first.body.deactivated_at);
  });

  it('will not let an admin switch off their own account', async () => {
    const res = await as(admin, 'post', `/api/admin/users/${admin.user.id}/deactivate`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/your own account/);
    expect((await as(admin, 'get', '/api/admin/users')).status).toBe(200);
  });

  it('answers 404 for an unknown account', async () => {
    expect((await as(admin, 'post', '/api/admin/users/99999/deactivate')).status).toBe(404);
    expect((await as(admin, 'post', '/api/admin/users/abc/deactivate')).status).toBe(404);
  });

  it('never deletes the account', async () => {
    await as(admin, 'post', `/api/admin/users/${expert.user.id}/deactivate`);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM users WHERE id = $1', [expert.user.id]);
    expect(n).toBe(1);
  });
});

describe('POST /api/admin/users/:id/reactivate', () => {
  it('lets the person sign in again but does not bring back an old token', async () => {
    await as(admin, 'post', `/api/admin/users/${student.user.id}/deactivate`);
    const res = await as(admin, 'post', `/api/admin/users/${student.user.id}/reactivate`);
    expect(res.status).toBe(200);
    expect(res.body.deactivated_at).toBeNull();

    expect((await as(student, 'get', '/api/auth/me')).status).toBe(401);
    const signedIn = await login(student.user.email);
    expect(signedIn.status).toBe(200);
    const fresh = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${signedIn.body.token}`);
    expect(fresh.status).toBe(200);
  });

  it('answers 404 for an unknown account', async () => {
    expect((await as(admin, 'post', '/api/admin/users/99999/reactivate')).status).toBe(404);
  });
});
