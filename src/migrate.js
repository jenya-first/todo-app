import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');

const files = (await readdir(sqlDir)).filter((f) => f.endsWith('.sql')).sort();
try {
  for (const f of files) {
    await pool.query(await readFile(path.join(sqlDir, f), 'utf8'));
    console.log(`applied ${f}`);
  }
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
