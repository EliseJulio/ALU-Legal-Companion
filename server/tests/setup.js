// Importing almost anything under src/ opens a database pool through db.js.
// Close it after every test file or Jest cannot exit cleanly.
import { pool } from '../src/db.js';

afterAll(async () => {
  await pool.end();
});
