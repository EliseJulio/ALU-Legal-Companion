// The app opens a database connection pool when it loads. Close it after each test file
// or Jest will hang instead of finishing.
import { pool } from '../src/db.js';

afterAll(async () => {
  await pool.end();
});
