import { getDb } from './db';
import { normalizePhoneNumber } from '../utils/conference';

export interface ParticipantRecord {
  id: number;
  name: string;
  phone: string;
  matchParticipantId: number | null;
  scheduledAt: string | null;
}

export class ParticipantRepository {
  findByPhone(phone: string): ParticipantRecord | null {
    const db = getDb();
    const normalized = normalizePhoneNumber(phone);

    const row = db.prepare(
      `SELECT p.id, p.name, p.phone, m.match_participant_id as matchParticipantId, m.scheduled_at as scheduledAt
       FROM participants p
       LEFT JOIN matches m ON m.participant_id = p.id
       WHERE p.phone = ?`
    ).get(normalized);

    return row || null;
  }

  findMatchForParticipant(participantId: number): ParticipantRecord | null {
    const db = getDb();
    const row = db.prepare(
      `SELECT p.id, p.name, p.phone, m.match_participant_id as matchParticipantId, m.scheduled_at as scheduledAt
       FROM matches m
       JOIN participants p ON p.id = m.match_participant_id
       WHERE m.participant_id = ?`
    ).get(participantId);

    return row || null;
  }
}

export const participantRepository = new ParticipantRepository();

