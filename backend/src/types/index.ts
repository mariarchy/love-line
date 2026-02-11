/**
 * Type definitions for the Love Line application
 */

export interface Match {
  name: string;
  phoneNumber: string; // E.164 format
}

export interface Participant {
  phoneNumber: string; // E.164 format
  name: string;
  match: Match;
}

export interface CallEvent {
  timestamp: string;
  eventType: 'call_started' | 'call_ended' | 'participant_joined' | 'participant_left' | 'error' | 'timeout' | 'unknown_number';
  participantPhone: string;
  participantName?: string;
  matchName?: string;
  conferenceSid?: string;
  callDuration?: number; // seconds
  errorMessage?: string;
}

export interface TwilioIncomingCall {
  from: string;
  to: string;
  callSid: string;
}

export interface ConferenceStatusEvent {
  conferenceSid: string;
  friendlyName: string;
  status: string;
  conferenceStatus: string;
  participantSid?: string;
  participantStatus?: string;
  callSid?: string;
  callStatus?: string;
}
