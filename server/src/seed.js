// Demo accounts for development. Usage: npm run seed
// Safe to run again. An account that already exists is left as it is.
import { q, pool } from './db.js';
import { hashPassword } from './passwords.js';

// These accounts are created already verified. Login is blocked until an address is verified
// and there is no inbox behind these demo addresses.
async function upsertUser(name, email, password, role) {
  const [existing] = await q('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return existing;
  const [user] = await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at)
     VALUES ($1,$2,$3,$4,now()) RETURNING id`,
    [name, email, await hashPassword(password), role]);
  return user;
}

// The defaults are for local development only. Set the SEED_* variables to use other passwords.
await upsertUser('Demo Admin', 'admin@example.org', process.env.SEED_ADMIN_PASSWORD || 'dev_admin_password', 'admin');
await upsertUser('Demo Legal Expert', 'expert@example.org', process.env.SEED_EXPERT_PASSWORD || 'dev_expert_password', 'legal_expert');
await upsertUser('Demo Student', 'test.student@alustudent.com', process.env.SEED_STUDENT_PASSWORD || 'dev_student_password', 'student');

console.log('✓ seed complete');
console.log('  admin:   admin@example.org');
console.log('  expert:  expert@example.org');
console.log('  student: test.student@alustudent.com');
await pool.end();
