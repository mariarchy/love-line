import twilio from 'twilio';
import { Participant } from '../types';
import { generateConferenceRoomId, normalizePhoneNumber } from '../utils/conference';
import { conferenceRepository } from '../db/conference-repo';
import { callLogRepository } from '../db/call-log-repo';
import dotenv from 'dotenv';

const VoiceResponse = twilio.twiml.VoiceResponse;

// Load env for singleton initialization
dotenv.config();

/**
 * Twilio service for managing calls, conferences, and TwiML generation
 * Handles Twilio API interactions, state tracking, and response generation
 */
export class TwilioService {
  private client: twilio.Twilio;
  private webhookBaseUrl: string;

  constructor(
    accountSid: string,
    authToken: string,
    private maxWaitTimeMinutes: number = 20,
    webhookBaseUrl: string,
  ) {
    this.client = twilio(accountSid, authToken);
    this.webhookBaseUrl = webhookBaseUrl;
  }

  /**
   * Generate TwiML for incoming call
   */
  incomingCall(participant: Participant, webhookBaseUrl?: string): string {
    const twiml = new VoiceResponse();
    const conferenceRoomId = generateConferenceRoomId(participant);
    const baseUrl = webhookBaseUrl || this.webhookBaseUrl;
    
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      `Hi ${participant.name}, welcome to your Valentine's Day match call. We're connecting you with your match now. Please wait while they join.`
    );

    const dial = twiml.dial();
    dial.conference({
      waitUrl: `${baseUrl}/voice/wait-music`,
      statusCallback: `${baseUrl}/voice/conference-status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['start', 'end', 'join', 'leave'],
      maxParticipants: 2,
      endConferenceOnExit: false,
      startConferenceOnEnter: true,
      beep: "true"
    }, conferenceRoomId);

    return twiml.toString();
  }

  /**
   * Generate TwiML for unknown number rejection
   */
  unknownNumber(): string {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      'Sorry, we don\'t recognize this phone number. Please check that you\'re calling from the number you registered with. Goodbye.'
    );
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Generate TwiML for wait music
   */
  waitMusic(): string {
    const twiml = new VoiceResponse();
    twiml.play({ loop: 0 }, 'http://com.twilio.sounds.music.s3.amazonaws.com/ClockworkWaltz.mp3');
    return twiml.toString();
  }

  /**
   * Generate TwiML for timeout message
   */
  timeout(): string {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      'Sorry, your match hasn\'t arrived yet. Please try again later or contact the organizer. Goodbye.'
    );
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Generate TwiML for match exit notification
   */
  matchExit(): string {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      'Your match has left the call. Thank you for participating! Goodbye.'
    );
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Generate TwiML for system error (user-facing message + hangup)
   */
  error(): string {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      'We\'re sorry, we\'ve encountered an error. Please try again later. Goodbye.'
    );
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Play error message to an active call and hang up (e.g. from conference-status webhook).
   * Use when the error happens mid-call so the user hears the message instead of silence.
   */
  async playErrorAndHangup(callSid: string): Promise<void> {
    try {
      await this.client.calls(callSid).update({ twiml: this.error() });
    } catch (err) {
      console.error(`Failed to play error TwiML to call ${callSid}:`, err);
      throw err;
    }
  }

  /**
   * Track participant joining a conference
   */
  async trackConferenceJoin(conferenceId: string, matchId: number, conferenceSid: string): Promise<void> {
    await conferenceRepository.upsertActive(matchId, conferenceId, conferenceSid);
  }

  /**
   * Track participant leaving a conference
   */
  async trackConferenceLeave(conferenceSid: string): Promise<void> {
    // If conference now empty, mark ended
    const participants = await this.client
      .conferences(conferenceSid)
      .participants.list();
    if (participants.length === 0) {
      await conferenceRepository.markEnded(conferenceSid);
    }
  }

  /**
   * Mark a conference ended without requiring participant context
   */
  async markConferenceEnded(conferenceSid: string): Promise<void> {
    await conferenceRepository.markEnded(conferenceSid);
  }

  /**
   * Get phone number from call SID
   */
  async getPhoneNumberFromCallSid(callSid: string): Promise<string | null> {
    const phoneFromLogs = await callLogRepository.findPhoneByCallSid(callSid);
    if (phoneFromLogs) return phoneFromLogs;

    // Fallback to Twilio lookup
    try {
      const call = await this.client.calls(callSid).fetch();
      return normalizePhoneNumber(call.from);
    } catch {
      return null;
    }
  }

  /**
   * Get number of participants in a conference
   */
  async getConferenceParticipantCount(conferenceSid: string): Promise<number> {
    const participants = await this.client
      .conferences(conferenceSid)
      .participants.list();
    return participants.length;
  }

  /**
   * End a conference
   */
  async endConference(conferenceSid: string): Promise<void> {
    try {
      await this.client.conferences(conferenceSid).update({ status: 'completed' });
      await conferenceRepository.markEnded(conferenceSid);
    } catch (error) {
      console.error(`Failed to end conference ${conferenceSid}:`, error);
      throw error;
    }
  }

  /**
   * Get Twilio client
   */
  getClient(): twilio.Twilio {
    return this.client;
  }
}

// Singleton instance
let twilioServiceInstance: TwilioService | null = null;

export function getTwilioService(): TwilioService {
  if (!twilioServiceInstance) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const maxWaitTime = parseInt(process.env.MAX_WAIT_TIME_MINUTES || '20', 10);
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

    if (!accountSid || !authToken) {
      throw new Error('Missing required Twilio environment variables');
    }

    twilioServiceInstance = new TwilioService(
      accountSid,
      authToken,
      maxWaitTime,
      webhookBaseUrl
    );
  }
  return twilioServiceInstance;
}
