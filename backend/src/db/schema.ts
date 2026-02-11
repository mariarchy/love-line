import { ColumnType, Generated } from 'kysely';

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
  // Read returns Date | null; writes accept Date or ISO string
  scheduledAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface CallLogsTable {
  id: Generated<number>;
  matchId: number;
  status: CallStatus;
  participantId: number;
  conferenceId: string | null;
  conferenceSid: string | null;
  callSid: string;
  startedAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
  endedAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface ConferencesTable {
  id: Generated<number>;
  matchId: number;
  conferenceId: string;
  conferenceSid: string | null; // set asynchronously via setConferenceSid()
  status: ConferenceStatus;
  startedAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
  endedAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface DB {
  participants: ParticipantsTable;
  matches: MatchesTable;
  call_logs: CallLogsTable;
  conferences: ConferencesTable;
}
