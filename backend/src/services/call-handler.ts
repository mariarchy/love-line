import { TwilioIncomingCall, ConferenceStatusEvent } from '../types';
import { getDatabase } from './database';
import { Logger } from './logger';
import { getTwilioService } from './twilio';
import { normalizePhoneNumber } from '../utils/conference';

/**
 * Handles call processing business logic
 * Separates business logic from route handlers
 */
export class CallHandler {
  /**
   * Handle incoming call
   */
  static async handleIncomingCall(
    callData: TwilioIncomingCall,
    webhookBaseUrl: string
  ): Promise<string> {
    const twilioService = getTwilioService();
    const db = getDatabase();
    const logger = new Logger();
    
    const callerPhone = normalizePhoneNumber(callData.From);
    
    console.log(`Incoming call from ${callerPhone}`);

    // Check for duplicate calls
    if (twilioService.isPhoneNumberInActiveConference(callerPhone)) {
      logger.logError('error', callerPhone, 'Duplicate call attempt');
      return twilioService.duplicateCall();
    }

    // Look up participant
    const participant = db.findParticipant(callerPhone);
    if (!participant) {
      logger.logError('unknown_number', callerPhone, 'Phone number not found');
      return twilioService.unknownNumber();
    }

    // Track call for conference events
    twilioService.trackConferenceJoin('pending', callerPhone, callData.CallSid);

    // Log call start
    logger.logCallStart(
      callerPhone,
      participant.name,
      participant.match.name,
      callData.CallSid
    );

    return twilioService.incomingCall(participant, webhookBaseUrl);
  }

  /**
   * Handle conference status events
   */
  static async handleConferenceStatus(event: ConferenceStatusEvent): Promise<void> {
    const twilioService = getTwilioService();
    
    const { ConferenceStatusCallbackEvent: eventType, ConferenceSid: conferenceSid, CallSid: callSid } = event;
    
    console.log(`Conference event: ${eventType} for ${conferenceSid}`);

    switch (eventType) {
      case 'participant-join':
        await CallHandler.handleParticipantJoin(conferenceSid, callSid);
        break;
      case 'participant-leave':
        await CallHandler.handleParticipantLeave(conferenceSid, callSid);
        break;
      case 'conference-start':
        console.log(`Conference started: ${conferenceSid}`);
        break;
      case 'conference-end':
        console.log(`Conference ended: ${conferenceSid}`);
        twilioService.trackConferenceLeave(conferenceSid, '');
        break;
    }
  }

  private static async handleParticipantJoin(conferenceSid: string, callSid?: string): Promise<void> {
    if (!callSid) return;

    const twilioService = getTwilioService();
    const db = getDatabase();
    const logger = new Logger();

    const participantPhone = twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;

    twilioService.trackConferenceJoin(conferenceSid, participantPhone, callSid);
    
    const participant = db.findParticipant(participantPhone);
    logger.logParticipantEvent(
      'participant_joined',
      participantPhone,
      conferenceSid,
      participant?.name
    );
  }

  private static async handleParticipantLeave(conferenceSid: string, callSid?: string): Promise<void> {
    if (!callSid) return;

    const twilioService = getTwilioService();
    const db = getDatabase();
    const logger = new Logger();

    const participantPhone = twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;

    twilioService.trackConferenceLeave(conferenceSid, participantPhone);
    
    const participant = db.findParticipant(participantPhone);
    logger.logParticipantEvent(
      'participant_left',
      participantPhone,
      conferenceSid,
      participant?.name
    );

    // If one participant remains, notify them and end conference
    const remainingCount = twilioService.getConferenceParticipantCount(conferenceSid);
    if (remainingCount === 1) {
      await CallHandler.notifyRemainingParticipant(conferenceSid, participant);
    }
  }

  private static async notifyRemainingParticipant(
    conferenceSid: string,
    leavingParticipant: { name: string } | null
  ): Promise<void> {
    const twilioService = getTwilioService();
    const db = getDatabase();
    const logger = new Logger();

    try {
      const twilioClient = twilioService.getClient();
      const participants = await twilioClient
        .conferences(conferenceSid)
        .participants
        .list();

      if (participants.length !== 1) return;

      const remainingParticipant = participants[0];
      const remainingCallSid = remainingParticipant.callSid;
      
      // Update call to play exit message
      await twilioClient.calls(remainingCallSid).update({
        twiml: twilioService.matchExit()
      });

      // End conference
      await twilioService.endConference(conferenceSid);

      // Log call end
      const remainingPhone = twilioService.getPhoneNumberFromCallSid(remainingCallSid) ||
        normalizePhoneNumber(remainingParticipant.callSid || '');
      
      const remainingParticipantData = db.findParticipant(remainingPhone);
      if (remainingParticipantData && leavingParticipant) {
        logger.logCallEnd(
          remainingPhone,
          remainingParticipantData.name,
          leavingParticipant.name,
          conferenceSid,
          0
        );
      }
    } catch (error) {
      console.error('Error handling participant leave:', error);
    }
  }
}
