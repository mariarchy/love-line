import { Selectable } from 'kysely';
import { db } from './connection';
import { ParticipantsTable } from './schema';
import { normalizePhoneNumber } from '../utils/conference';

export type ParticipantRow = Selectable<ParticipantsTable>;

export interface ParticipantWithMatch extends ParticipantRow {
  matchParticipantId: number | null;
  scheduledAt: Date | null;
}

export class ParticipantRepository {
  async findByPhone(phone: string): Promise<ParticipantWithMatch | null> {
    const normalized = normalizePhoneNumber(phone);
    const row = await db
      .selectFrom('participants')
      .leftJoin('matches', 'matches.participantId', 'participants.id')
      .select([
        'participants.id as id',
        'participants.name as name',
        'participants.phone as phone',
        'matches.matchParticipantId as matchParticipantId',
        'matches.scheduledAt as scheduledAt'
      ])
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

