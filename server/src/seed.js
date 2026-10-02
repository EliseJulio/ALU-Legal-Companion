// Seed data for development and demo. run: npm run seed
// Creates the three demo accounts: an admin, a legal expert and a student.
// Safe to run twice: an account that already exists is left alone.
import bcrypt from 'bcryptjs';
import { q, pool } from './db.js';
import { BCRYPT_ROUNDS } from './middleware/auth.js';

// The demo accounts are already verified. Login needs a verified email and there is no inbox
// behind these addresses to click a link in.
async function upsertUser(name, email, password, role) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await q(
    `INSERT INTO users (name, email, password_hash, role, email_verified_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (email) DO NOTHING`,
    [name, email, hash, role],
  );
}

await upsertUser('Elise Julio HAKIZIMANA', 'e.hakizimana@alustudent.com', 'admin1234', 'admin');
await upsertUser('Adv. Tresor Shingiro', 'expert@example.org', 'expert1234', 'legal_expert');
await upsertUser('Test Student', 'test.student@alustudent.com', 'student1234', 'student');

console.log('✓ seeded demo accounts (change these passwords in production)');
console.log('  admin:   e.hakizimana@alustudent.com / admin1234');
console.log('  expert:  expert@example.org / expert1234');
console.log('  student: test.student@alustudent.com / student1234');
await pool.end();
