import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { DB } from './schema';

function getPoolConfig(): pg.PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.trim()) throw new Error('DATABASE_URL is not set');
  const withProtocol = raw.match(/^postgres(ql)?:\/\//i) ? raw : `postgresql://${raw}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL (e.g. postgresql://user:password@localhost:5432/loveline)');
  }
  const user = url.username || process.env.POSTGRES_USER;
  const password = (url.password || process.env.POSTGRES_PASSWORD) ?? '';
  return {
    host: url.hostname || 'localhost',
    port: url.port ? parseInt(url.port, 10) : 5432,
    user,
    password: String(password),
    database: url.pathname.slice(1).replace(/\/$/, '') || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new pg.Pool(getPoolConfig());

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        "participantId" INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
        "matchParticipantId" INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        "scheduledAt" TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id SERIAL PRIMARY KEY,
        "matchId" INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('started', 'ended', 'participant_joined', 'participant_left', 'error')),
        "participantId" INTEGER NOT NULL REFERENCES participants(id),
        "conferenceId" TEXT,
        "conferenceSid" TEXT,
        "callSid" TEXT NOT NULL,
        "startedAt" TIMESTAMPTZ,
        "endedAt" TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS conferences (
        id SERIAL PRIMARY KEY,
        "matchId" INTEGER NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
        "conferenceId" TEXT NOT NULL UNIQUE,
        "conferenceSid" TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
        "startedAt" TIMESTAMPTZ,
        "endedAt" TIMESTAMPTZ
      );
    `);
  } finally {
    client.release();
  }
}

let migrationsPromise: Promise<void> | null = null;

/**
 * Ensures DB tables exist (CREATE TABLE IF NOT EXISTS). Called once at app startup
 * and before standalone scripts (seed, reset) so we can start the server only after
 * the DB is ready. The cached promise ensures we run migrations only once even if
 * ensureMigrations() is called from multiple places (e.g. server + seed).
 */
export async function ensureMigrations(): Promise<void> {
  if (!migrationsPromise) {
    migrationsPromise = runMigrations();
  }
  return migrationsPromise;
}

export async function destroyDb(): Promise<void> {
  await db.destroy();
  await pool.end();
}
