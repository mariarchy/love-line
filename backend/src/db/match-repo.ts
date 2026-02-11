import { Selectable } from 'kysely';
import { db } from './connection';
import { MatchesTable } from './schema';

export type MatchRow = Selectable<MatchesTable>;

export class MatchRepository {
  async findByParticipantId(participantId: number): Promise<MatchRow | null> {
    const row = await db
      .selectFrom('matches')
      .selectAll()
      .where('participantId', '=', participantId)
      .executeTakeFirst();
    return row ?? null;
  }
}

export const matchRepository = new MatchRepository();

