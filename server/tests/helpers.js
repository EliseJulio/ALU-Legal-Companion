import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';

// Empties the tables. When more tables are added, list the child tables first.
export async function resetDb() {
  await q('TRUNCATE auth_tokens, users RESTART IDENTITY CASCADE');
}

// Makes a verified user and a token that is ready to use. A low bcrypt cost keeps the tests
// fast. The user is verified because a signed-in user always is: login needs it.
export async function makeUser(role, email) {
  const hash = await bcrypt.hash('password1234', 4);
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at)
     VALUES ($1,$2,$3,$4,now()) RETURNING *`,
    [`Test ${role}`, email || `${role}@alustudent.com`, hash, role],
  );
  const token = signToken(user);
  return { user, token, auth: `Bearer ${token}` };
}
