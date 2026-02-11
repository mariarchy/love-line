import { TwilioIncomingCall, ConferenceStatusEvent } from '../types';
import { participantRepository } from '../db/participant-repo';
import { matchRepository } from '../db/match-repo';
import { callLogRepository } from '../db/call-log-repo';
import { getTwilioService } from './twilio';
import { normalizePhoneNumber } from '../utils/conference';
import { generateConferenceRoomId } from '../utils/conference';

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
    if (await twilioService.isPhoneNumberInActiveConference(callerPhone)) {
      return twilioService.duplicateCall();
    }

    // Look up participant
    const participant = await participantRepository.findByPhone(callerPhone);
    if (!participant) {
      return twilioService.unknownNumber();
    }

    // Log call start
    const match = participant.matchParticipantId
      ? await matchRepository.findByParticipantId(participant.id)
      : null;
    if (!match) {
      // Data inconsistency: participant has no match row
      return twilioService.error();
    }
    const matchParticipant = await participantRepository.findByIdBang(match.matchParticipantId);
    const callDetails = {
      name: participant.name,
      phoneNumber: participant.phone,
      match: {
        name: matchParticipant.name,
        phoneNumber: matchParticipant.phone,
      }
    };
    const conferenceRoomId = generateConferenceRoomId(callDetails);

    // Track call for conference events
    await twilioService.trackConferenceJoin(conferenceRoomId, callData.CallSid, match.id);

    await callLogRepository.logEvent({
      matchId: match.id,
      status: 'started',
      participantId: participant.id,
      conferenceSid: conferenceRoomId,
      callSid: callData.CallSid,
      startedAt: new Date().toISOString(),
      endedAt: null
    });

    return twilioService.incomingCall(
      callDetails,
      webhookBaseUrl
    );
  }

  /**
   * Handle conference status events
   */
  static async handleConferenceStatus(event: ConferenceStatusEvent): Promise<void> {
    const twilioService = getTwilioService();
    
    // TODO: Conference status callbacks are not setup yet. Instead, 
    // we're sent call status updates which look like this
    /* {
      event: {
        ConferenceSid: undefined,
        FriendlyName: undefined,
        Status: undefined,
        ConferenceStatusCallbackEvent: undefined,
        ParticipantSid: undefined,
        ParticipantStatus: undefined,
        CallSid: 'CA5ecf061702bfbffe9494a06cfa4e980e',
        CallStatus: 'completed'
      }
    }
    */
    const { ConferenceStatusCallbackEvent: eventType, ConferenceSid: conferenceSid, CallSid: callSid } = event;
    
    console.log(`Conference event: ${eventType} for ${conferenceSid}`);

    switch (eventType) {
      case 'participant-join':
        await CallHandler.handleParticipantJoin(conferenceSid, callSid);
        break;
      case 'participant-leave':
      case 'completed':
        await CallHandler.handleParticipantLeave(conferenceSid, callSid);
        break;
      case 'conference-start':
        console.log(`Conference started: ${conferenceSid}`);
        break;
      case 'conference-end':
        console.log(`Conference ended: ${conferenceSid}`);
        await twilioService.markConferenceEnded(conferenceSid);
        break;
    }
  }

  private static async handleParticipantJoin(conferenceSid: string, callSid?: string): Promise<void> {
    if (!callSid) return;

    const twilioService = getTwilioService();

    const participantPhone = await twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;
    
    const participant = await participantRepository.findByPhone(participantPhone);
    // TODO: Error if participant not found
    if (participant === null) {
      twilioService.error();
      return;
    }
    const match = await matchRepository.findByParticipantId(participant.id);
    if (!match) return;

    await callLogRepository.logEvent({
      matchId: match.id,
      status: 'participant_joined',
      participantId: participant.id,
      conferenceSid,
      callSid,
      startedAt: new Date().toISOString(),
      endedAt: null
    });
  }

  private static async handleParticipantLeave(conferenceSid: string, callSid?: string): Promise<void> {
    if (!callSid) return;

    const twilioService = getTwilioService();

    const participantPhone = await twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;

    await twilioService.trackConferenceLeave(conferenceSid);
    
    const participant = await participantRepository.findByPhone(participantPhone);
    // TODO: Error if participant not found
    if (participant === null) {
      twilioService.error();
      return;
    }
    const match = await matchRepository.findByParticipantId(participant.id);
    if (!match) return;

    await callLogRepository.logEvent({
      matchId: match.id,
      status: 'participant_left',
      participantId: participant.id,
      conferenceSid,
      callSid,
      startedAt: null,
      endedAt: new Date().toISOString()
    });

    // If one participant remains, notify them and end conference
    const remainingCount = await twilioService.getConferenceParticipantCount(conferenceSid);
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
      const remainingPhone = await twilioService.getPhoneNumberFromCallSid(remainingCallSid) ||
        normalizePhoneNumber(remainingParticipant.callSid || '');
      
      const remainingParticipantData = await participantRepository.findByPhone(remainingPhone);
      if (remainingParticipantData && leavingParticipant) {
        const match = await matchRepository.findByParticipantId(remainingParticipantData.id);
        if (!match) return;
        await callLogRepository.logEvent({
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
