import { Selectable } from 'kysely';
import { db } from './connection';
import { MatchesTable } from './schema';

export type MatchRow = Selectable<MatchesTable>;

function withParticipantAsPrimary(row: MatchRow, participantId: number) {
  if (row.participantId === participantId) return row;
  return {
    ...row,
    participantId: row.matchParticipantId,
    matchParticipantId: row.participantId,
  };
}

export class MatchRepository {
  /**
   * Returns the match for this participant, with the given participant as primary
   * (participantId). The other person is matchParticipantId. Callers don't need to
   * know which column the participant was stored in.
   */
  async findByParticipantId(participantId: number): Promise<MatchRow | null> {
    const row = await this.findRowByEitherParticipant(participantId);
    return row ? withParticipantAsPrimary(row, participantId) : null;
  }

  /** find raw match row where the given id appears in either column. */
  private async findRowByEitherParticipant(participantId: number): Promise<MatchRow | null> {
    const row = await db
      .selectFrom('matches')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('participantId', '=', participantId),
          eb('matchParticipantId', '=', participantId),
        ])
      )
      .executeTakeFirst();
    return row ?? null;
  }
}

export const matchRepository = new MatchRepository();

