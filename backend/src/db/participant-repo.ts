import { Selectable } from 'kysely';
import { db } from './connection';
import { ParticipantsTable } from './schema';
import { normalizePhoneNumber } from '../utils/conference';

export type ParticipantRow = Selectable<ParticipantsTable>;

export interface ParticipantWithMatch extends ParticipantRow {
  matchParticipantId: number | null;
  scheduledAt: string | null;
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

  async findMatchForParticipant(participantId: number): Promise<ParticipantWithMatch | null> {
    const row = await db
      .selectFrom('matches')
      .innerJoin('participants', 'participants.id', 'matches.matchParticipantId')
      .select([
        'participants.id as id',
        'participants.name as name',
        'participants.phone as phone',
        'matches.matchParticipantId as matchParticipantId',
        'matches.scheduledAt as scheduledAt'
      ])
      .where('matches.participantId', '=', participantId)
      .executeTakeFirst();

    return row ?? null;
  }
}

export const participantRepository = new ParticipantRepository();

