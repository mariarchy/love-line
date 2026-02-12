import 'dotenv/config';
import { ensureMigrations, pool } from './connection';
import { seed } from './seed';

async function reset() {
  await ensureMigrations();
  await pool.query(
    'TRUNCATE conferences, call_logs, matches, participants RESTART IDENTITY CASCADE'
  );
  await seed();
}

if (require.main === module) {
  reset()
    .then(() => {
      console.log('Database reset and seeded.');
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => {
      pool.end().then(() => process.exit(process.exitCode ?? 0));
    });
}
