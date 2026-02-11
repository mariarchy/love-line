import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db } from './connection';
import { normalizePhoneNumber } from '../utils/conference';

interface SeedParticipant {
  phoneNumber: string;
  name: string;
  match: {
    name: string;
    phoneNumber: string;
  };
  scheduledAt?: string;
}

async function loadSeedData(): Promise<SeedParticipant[]> {
  // Production: use SEED_DATA env (JSON string) so personal data is never committed
  const fromEnv = process.env.SEED_DATA;
  if (fromEnv) {
    return JSON.parse(fromEnv) as SeedParticipant[];
  }
  const dataPath = process.env.SEED_FILE || path.join(__dirname, '../../data/participants.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      'No seed data: set SEED_DATA (JSON string) or SEED_FILE, or create data/participants.json. ' +
      'For production, set SEED_DATA in your host\'s environment/secrets.'
    );
  }
  const content = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(content) as SeedParticipant[];
}

export async function seed() {
  // Skip if DB already has participants (e.g. persisted volume on redeploy)
  const existing = await db.selectFrom('participants').select('id').limit(1).executeTakeFirst();
  if (existing) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const participants = await loadSeedData();

  await db.transaction().execute(async (trx) => {
    const participantIdByPhone = new Map<string, number>();

    for (const p of participants) {
      const phone = normalizePhoneNumber(p.phoneNumber);
      const match = { name: p.match.name, phone: p.match.phoneNumber }
      const inserted = await trx
        .insertInto('participants')
        .values([{ name: p.name, phone }, match])
        .returningAll()
        .execute()
      
      for (const r of inserted) {
        participantIdByPhone.set(r.phone, r.id)
      }
    }

    for (const p of participants) {
      const participantId = participantIdByPhone.get(normalizePhoneNumber(p.phoneNumber));
      const matchId = participantIdByPhone.get(normalizePhoneNumber(p.match.phoneNumber));
      if (!participantId || !matchId) continue;

      await trx
        .insertInto('matches')
        .values({
          participantId,
          matchParticipantId: matchId,
          scheduledAt: p.scheduledAt || null
        })
        .execute();
    }
  });

  console.log(`Seeded ${participants.length} participants and matches.`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

