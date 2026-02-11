import { getDb } from './db';

export type CallStatus = 'started' | 'ended' | 'participant_joined' | 'participant_left' | 'error';

export interface CallLogRecord {
  id: number;
  matchId: number;
  status: CallStatus;
  participantId: number | null;
  conferenceSid: string | null;
  callSid: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export class CallLogRepository {
  logEvent(event: Omit<CallLogRecord, 'id'>): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO call_logs (match_id, status, participant_id, conference_sid, call_sid, started_at, ended_at)
       VALUES (@matchId, @status, @participantId, @conferenceSid, @callSid, @startedAt, @endedAt)`
    ).run(event);
  }
}

export const callLogRepository = new CallLogRepository();

