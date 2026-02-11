import Database from 'better-sqlite3';
import path from 'path';

export interface ParticipantRow {
  id: number;
  name: string;
  phone: string;
}

export interface MatchRow {
  id: number;
  participant_id: number;
  match_participant_id: number;
  scheduled_at: string | null; // ISO string
}

export interface CallLogRow {
  id: number;
  match_id: number;
  status: 'started' | 'ended' | 'participant_joined' | 'participant_left' | 'error';
  participant_id: number | null;
  conference_sid: string | null;
  call_sid: string | null;
  started_at: string | null;
  ended_at: string | null;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.PARTICIPANTS_DB || path.join(__dirname, '../../data/participants.db');

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      match_participant_id INTEGER NOT NULL,
      scheduled_at TEXT,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
      FOREIGN KEY (match_participant_id) REFERENCES participants(id) ON DELETE CASCADE,
      UNIQUE(participant_id)
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      participant_id INTEGER,
      conference_sid TEXT,
      call_sid TEXT,
      started_at TEXT,
      ended_at TEXT,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
    );
  `);

  dbInstance = db;
  return dbInstance;
}

export function resetDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

