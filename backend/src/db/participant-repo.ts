import { Selectable } from 'kysely';
import { db } from './connection';
import { ParticipantsTable } from './schema';
import { normalizePhoneNumber } from '../utils/conference';

export type ParticipantRow = Selectable<ParticipantsTable>;

export class ParticipantRepository {
  async findByPhone(phone: string): Promise<ParticipantRow | null> {
    const normalized = normalizePhoneNumber(phone);
    const row = await db
      .selectFrom('participants')
      .selectAll()
      .where('participants.phone', '=', normalized)
      .executeTakeFirst();

    return row ?? null;
  }

  async findByIdBang(id: number) {
    const row = await db
      .selectFrom('participants')
      .select([
        'participants.id as id',
        'participants.name as name',
        'participants.phone as phone'
      ])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

    return row;
  }
}

export const participantRepository = new ParticipantRepository();

