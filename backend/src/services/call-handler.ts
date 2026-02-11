import { TwilioIncomingCall, ConferenceStatusEvent } from '../types';
import { participantRepository } from './participant-repo';
import { matchRepository } from './match-repo';
import { callLogRepository } from './call-log-repo';
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
    
    const callerPhone = normalizePhoneNumber(callData.From);
    
    console.log(`Incoming call from ${callerPhone}`);

    // Check for duplicate calls
    if (twilioService.isPhoneNumberInActiveConference(callerPhone)) {
      return twilioService.duplicateCall();
    }

    // Look up participant
    const participant = participantRepository.findByPhone(callerPhone);
    if (!participant) {
      return twilioService.unknownNumber();
    }

    // Track call for conference events
    twilioService.trackConferenceJoin('pending', callerPhone, callData.CallSid);

    // Log call start
    const match = participant.matchParticipantId
      ? matchRepository.findByParticipantId(participant.id)
      : null;
    if (!match) {
      // Data inconsistency: participant has no match row
      return twilioService.error();
    }
    const matchParticipant = participantRepository.findMatchForParticipant(participant.id);

    callLogRepository.logEvent({
      matchId: match.id,
      status: 'started',
      participantId: participant.id,
      conferenceSid: null,
      callSid: callData.CallSid,
      startedAt: new Date().toISOString(),
      endedAt: null
    });

    return twilioService.incomingCall(
      {
        name: participant.name,
        phoneNumber: participant.phone,
        match: {
          name: matchParticipant?.name || '',
          phoneNumber: matchParticipant?.phone || ''
        }
      },
      webhookBaseUrl
    );
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

    const participantPhone = twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;

    twilioService.trackConferenceJoin(conferenceSid, participantPhone, callSid);
    
    const participant = participantRepository.findByPhone(participantPhone);
    const match = participant ? matchRepository.findByParticipantId(participant.id) : null;
    if (!match) return;

    callLogRepository.logEvent({
      matchId: match.id,
      status: 'participant_joined',
      participantId: participant?.id || null,
      conferenceSid,
      callSid: callSid || null,
      startedAt: new Date().toISOString(),
      endedAt: null
    });
  }

  private static async handleParticipantLeave(conferenceSid: string, callSid?: string): Promise<void> {
    if (!callSid) return;

    const twilioService = getTwilioService();

    const participantPhone = twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;

    twilioService.trackConferenceLeave(conferenceSid, participantPhone);
    
    const participant = participantRepository.findByPhone(participantPhone);
    const match = participant ? matchRepository.findByParticipantId(participant.id) : null;
    if (!match) return;

    callLogRepository.logEvent({
      matchId: match.id,
      status: 'participant_left',
      participantId: participant?.id || null,
      conferenceSid,
      callSid: callSid || null,
      startedAt: null,
      endedAt: new Date().toISOString()
    });

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
      
      const remainingParticipantData = participantRepository.findByPhone(remainingPhone);
      if (remainingParticipantData && leavingParticipant) {
        const match = matchRepository.findByParticipantId(remainingParticipantData.id);
        if (!match) return;
        callLogRepository.logEvent({
          matchId: match.id,
          status: 'ended',
          participantId: remainingParticipantData.id,
          conferenceSid,
          callSid: remainingCallSid,
          startedAt: null,
          endedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error handling participant leave:', error);
    }
  }
}
