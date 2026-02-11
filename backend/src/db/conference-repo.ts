import { Insertable } from 'kysely';
import { db } from './connection';
import { ConferencesTable } from './schema';

export type ConferenceInsert = Insertable<ConferencesTable>;

export class ConferenceRepository {
  async upsertActive(matchId: number, conferenceId: string, conferenceSid: string): Promise<void> {
    const now = new Date().toISOString();
    await db
      .insertInto('conferences')
      .values({
        matchId,
        conferenceId,
        conferenceSid,
        status: 'active',
        startedAt: now,
        endedAt: null
      })
      .onConflict((oc) =>
        oc.column('matchId').doUpdateSet({
          conferenceId,
          conferenceSid,
          status: 'active',
          startedAt: now,
          endedAt: null
        })
      )
      .execute();
  }

  async setConferenceSid(conferenceId: string, conferenceSid: string): Promise<void> {
    await db
      .updateTable('conferences')
      .set({ conferenceSid })
      .where('conferenceId', '=', conferenceId)
      .execute();
  }

  async markEnded(conferenceSid: string): Promise<void> {
    const now = new Date().toISOString();
    await db
      .updateTable('conferences')
      .set({ status: 'ended', endedAt: now })
      .where('conferenceSid', '=', conferenceSid)
      .execute();
  }

  async findActiveByConferenceSid(conferenceSid: string) {
    return db
      .selectFrom('conferences')
      .selectAll()
      .where('conferenceSid', '=', conferenceSid)
      .where('status', '=', 'active')
      .executeTakeFirst();
  }

  async findByConferenceSid(conferenceSid: string) {
    return db
      .selectFrom('conferences')
      .selectAll()
      .where('conferenceSid', '=', conferenceSid)
      .executeTakeFirst();
  }

  async findActiveByMatchId(matchId: number) {
    return db
      .selectFrom('conferences')
      .selectAll()
      .where('matchId', '=', matchId)
      .where('status', '=', 'active')
      .executeTakeFirst();
  }
}

export const conferenceRepository = new ConferenceRepository();
