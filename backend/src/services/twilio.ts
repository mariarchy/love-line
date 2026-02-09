import twilio from 'twilio';
import { Participant } from '../types';
import { generateConferenceRoomId } from '../utils/conference';
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
  private activeConferences: Map<string, Set<string>> = new Map();
  private callSidToPhoneNumber: Map<string, string> = new Map();
  private webhookBaseUrl: string;

  constructor(
    accountSid: string,
    authToken: string,
    private phoneNumber: string,
    private maxWaitTimeMinutes: number = 20,
    webhookBaseUrl?: string
  ) {
    this.client = twilio(accountSid, authToken);
    this.webhookBaseUrl = webhookBaseUrl || process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
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
   * Generate TwiML for duplicate call rejection
   */
  duplicateCall(): string {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      'You\'re already in an active call. Please hang up your other line first. Goodbye.'
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
   * Generate TwiML for system error
   */
  error(): string {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Google.en-US-Neural2-F' },
      'We\'re experiencing technical difficulties. Please try again later. Goodbye.'
    );
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Check if phone number is in an active conference
   */
  isPhoneNumberInActiveConference(phoneNumber: string): boolean {
    for (const phoneNumbers of this.activeConferences.values()) {
      if (phoneNumbers.has(phoneNumber)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Track participant joining a conference
   */
  trackConferenceJoin(conferenceSid: string, phoneNumber: string, callSid?: string): void {
    if (!this.activeConferences.has(conferenceSid)) {
      this.activeConferences.set(conferenceSid, new Set());
    }
    this.activeConferences.get(conferenceSid)!.add(phoneNumber);
    if (callSid) {
      this.callSidToPhoneNumber.set(callSid, phoneNumber);
    }
  }

  /**
   * Track participant leaving a conference
   */
  trackConferenceLeave(conferenceSid: string, phoneNumber: string): void {
    const participants = this.activeConferences.get(conferenceSid);
    if (participants) {
      participants.delete(phoneNumber);
      if (participants.size === 0) {
        this.activeConferences.delete(conferenceSid);
      }
    }
  }

  /**
   * Get phone number from call SID
   */
  getPhoneNumberFromCallSid(callSid: string): string | null {
    return this.callSidToPhoneNumber.get(callSid) || null;
  }

  /**
   * Get number of participants in a conference
   */
  getConferenceParticipantCount(conferenceSid: string): number {
    return this.activeConferences.get(conferenceSid)?.size || 0;
  }

  /**
   * End a conference
   */
  async endConference(conferenceSid: string): Promise<void> {
    try {
      await this.client.conferences(conferenceSid).update({ status: 'completed' });
      this.activeConferences.delete(conferenceSid);
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
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const maxWaitTime = parseInt(process.env.MAX_WAIT_TIME_MINUTES || '20', 10);
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;

    if (!accountSid || !authToken || !phoneNumber) {
      throw new Error('Missing required Twilio environment variables');
    }

    twilioServiceInstance = new TwilioService(
      accountSid,
      authToken,
      phoneNumber,
      maxWaitTime,
      webhookBaseUrl
    );
  }
  return twilioServiceInstance;
}
