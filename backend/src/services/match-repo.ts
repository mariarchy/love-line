import { getDb } from './db';

export interface MatchRecord {
  id: number;
  participantId: number;
  matchParticipantId: number;
  scheduledAt: string | null;
}

export class MatchRepository {
  findByParticipantId(participantId: number): MatchRecord | null {
    const db = getDb();
    const row = db.prepare(
      `SELECT id, participant_id as participantId, match_participant_id as matchParticipantId, scheduled_at as scheduledAt
       FROM matches
       WHERE participant_id = ?`
    ).get(participantId);
    return row || null;
  }
}

export const matchRepository = new MatchRepository();

