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
  const dataPath = process.env.SEED_FILE || path.join(__dirname, '../../data/participants.json');
  const content = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(content) as SeedParticipant[];
}

export async function seed() {
  const participants = await loadSeedData();

  await db.transaction().execute(async (trx) => {
    const participantIdByPhone = new Map<string, number>();

    for (const p of participants) {
      const phone = normalizePhoneNumber(p.phoneNumber);
      const inserted = await trx
        .insertInto('participants')
        .values({ name: p.name, phone })
        .returning('id')
        .executeTakeFirstOrThrow();
      participantIdByPhone.set(phone, inserted.id);
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

