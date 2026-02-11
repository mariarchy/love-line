import fs from 'fs';
import path from 'path';
import { getDb, resetDb } from '../services/db';
import { normalizePhoneNumber } from './conference';

interface SeedParticipant {
  phoneNumber: string;
  name: string;
  match: {
    name: string;
    phoneNumber: string;
  };
  scheduledAt?: string;
}

function loadSeedData(): SeedParticipant[] {
  const dataPath = process.env.SEED_FILE || path.join(__dirname, '../../data/participants.example.json');
  const content = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(content) as SeedParticipant[];
}

function seed() {
  // reset any existing connection so WAL file doesn't lock deletes
  resetDb();
  const db = getDb();

  const participants = loadSeedData();

  const insertParticipant = db.prepare(
    'INSERT INTO participants (name, phone) VALUES (?, ?)'
  );
  const insertMatch = db.prepare(
    'INSERT INTO matches (participant_id, match_participant_id, scheduled_at) VALUES (?, ?, ?)' 
  );

  const participantIdByPhone = new Map<string, number>();

  db.transaction(() => {
    for (const p of participants) {
      const phone = normalizePhoneNumber(p.phoneNumber);
      const result = insertParticipant.run(p.name, phone);
      participantIdByPhone.set(phone, result.lastInsertRowid as number);
    }

    for (const p of participants) {
      const participantId = participantIdByPhone.get(normalizePhoneNumber(p.phoneNumber));
      const matchId = participantIdByPhone.get(normalizePhoneNumber(p.match.phoneNumber));
      if (!participantId || !matchId) continue;
      insertMatch.run(participantId, matchId, p.scheduledAt || null);
    }
  })();

  console.log(`Seeded ${participants.length} participants and matches.`);
}

if (require.main === module) {
  seed();
}

export default seed;

