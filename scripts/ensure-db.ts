/**
 * Ensures the database in DATABASE_URL exists; creates it if not.
 * If Postgres isn't running, starts it via Docker Compose.
 * Requires: DATABASE_URL, POSTGRES_USER, POSTGRES_PASSWORD in .env
 */
import 'dotenv/config';
import path from 'path';
import { spawnSync } from 'child_process';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const POSTGRES_USER = process.env.POSTGRES_USER;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;

if (!DATABASE_URL || !POSTGRES_USER || !POSTGRES_PASSWORD) {
  console.error('Set DATABASE_URL, POSTGRES_USER, and POSTGRES_PASSWORD in .env');
  process.exit(1);
}

let url: URL;
try {
  url = new URL(DATABASE_URL.match(/^postgres(ql)?:\/\//i) ? DATABASE_URL : `postgresql://${DATABASE_URL}`);
} catch {
  console.error('DATABASE_URL must be a valid URL (e.g. postgresql://user:password@localhost:5432/loveline)');
  process.exit(1);
}
const dbName = url.pathname.replace(/^\/|\/$/g, '') || 'postgres';
if (dbName === 'postgres') process.exit(0);
if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
  console.error('DATABASE_URL database name must be alphanumeric or underscore.');
  process.exit(1);
}

function pgConfig(database = 'postgres'): pg.ClientConfig {
  return {
    host: url.hostname || 'localhost',
    port: url.port ? parseInt(url.port, 10) : 5432,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database,
  };
}

async function ensureDb(): Promise<void> {
  const client = new pg.Client(pgConfig());
  try {
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount && rowCount > 0) {
      console.log(`Database "${dbName}" already exists.`);
      return;
    }
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database "${dbName}".`);
  } finally {
    await client.end();
  }
}

function isConnectionRefused(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const errors = (err as { errors?: { code?: string }[] })?.errors;
  return code === 'ECONNREFUSED' || (Array.isArray(errors) && errors.some((e) => e?.code === 'ECONNREFUSED'));
}

function startDockerPostgres(): boolean {
  const cwd = path.join(__dirname, '..');
  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { cwd, stdio: 'pipe', shell: false });
  let out = run('docker', ['compose', 'up', '-d', 'postgres']);
  if (out.status !== 0 && (out.stderr?.toString().includes('compose') || out.stderr?.toString().includes('not found'))) {
    out = run('docker-compose', ['up', '-d', 'postgres']);
  }
  if (out.status !== 0) {
    const msg = (out.stderr?.toString() || out.stdout?.toString() || '').trim();
    if (msg) console.error(msg);
    return false;
  }
  console.log('Started PostgreSQL with Docker Compose.');
  return true;
}

async function waitForPostgres(): Promise<void> {
  const cfg = pgConfig();
  const host = cfg.host === 'localhost' ? '127.0.0.1' : cfg.host!;
  await new Promise((r) => setTimeout(r, 2000));
  for (let i = 0; i < 60; i++) {
    const client = new pg.Client({ ...cfg, host, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await client.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Postgres did not become ready in time');
}

async function main(): Promise<void> {
  try {
    await ensureDb();
    return;
  } catch (err) {
    if (!isConnectionRefused(err)) throw err;
  }

  console.log('PostgreSQL not running. Trying Docker Compose...');
  if (!startDockerPostgres()) {
    console.error('\nDocker could not start Postgres. Try: docker compose up -d postgres');
    console.error('Or: brew services start postgresql | open Postgres.app\n');
    process.exit(1);
  }

  try {
    await waitForPostgres();
  } catch {
    console.error('Postgres is still starting. Run `pnpm run dev` again in a few seconds.');
    process.exit(1);
  }

  await ensureDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    if (isConnectionRefused(err)) {
      console.error('Cannot connect to PostgreSQL. Start Postgres and set DATABASE_URL, POSTGRES_USER, POSTGRES_PASSWORD in .env');
    } else {
      console.error(err);
    }
    process.exit(1);
  });
