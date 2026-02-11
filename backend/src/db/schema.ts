import { Generated } from 'kysely';

export type CallStatus = 'started' | 'ended' | 'participant_joined' | 'participant_left' | 'error';
export type ConferenceStatus = 'active' | 'ended';

export interface ParticipantsTable {
  id: Generated<number>;
  name: string;
  phone: string; // E.164
}

export interface MatchesTable {
  id: Generated<number>;
  participantId: number;
  matchParticipantId: number;
  scheduledAt: string | null; // ISO string
}

export interface CallLogsTable {
  id: Generated<number>;
  matchId: number;
  status: CallStatus;
  participantId: number | null;
  conferenceSid: string | null;
  callSid: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface ConferencesTable {
  id: Generated<number>;
  matchId: number;
  conferenceSid: string;
  status: ConferenceStatus;
  startedAt: string | null;
  endedAt: string | null;
}

export interface DB {
  participants: ParticipantsTable;
  matches: MatchesTable;
  call_logs: CallLogsTable;
  conferences: ConferencesTable;
}

