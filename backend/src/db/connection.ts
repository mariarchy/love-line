import path from 'path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { DB } from './schema';

const dbPath = process.env.PARTICIPANTS_DB || path.join(__dirname, '../../data/participants.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participantId INTEGER NOT NULL UNIQUE,
    matchParticipantId INTEGER NOT NULL,
    scheduledAt TEXT,
    FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (matchParticipantId) REFERENCES participants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matchId INTEGER NOT NULL,
    status TEXT NOT NULL,
    participantId INTEGER,
    conferenceId TEXT,
    conferenceSid TEXT,
    callSid TEXT,
    startedAt TEXT,
    endedAt TEXT,
    FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS conferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matchId INTEGER NOT NULL UNIQUE,
    conferenceId TEXT NOT NULL UNIQUE,
    conferenceSid TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    startedAt TEXT,
    endedAt TEXT,
    FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE
  );
`);

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({ database: sqlite })
});

export async function destroyDb(): Promise<void> {
  await db.destroy();
}
