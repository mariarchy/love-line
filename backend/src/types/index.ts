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
  From: string;
  To: string;
  CallSid: string;
}

export interface ConferenceStatusEvent {
  ConferenceSid: string;
  FriendlyName: string;
  Status: string;
  ConferenceStatusCallbackEvent: string;
  ParticipantSid?: string;
  ParticipantStatus?: string;
  CallSid?: string;
  CallStatus?: string;
}
