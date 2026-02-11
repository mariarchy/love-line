import { TwilioIncomingCall, ConferenceStatusEvent } from '../types';
import { participantRepository } from '../db/participant-repo';
import { matchRepository } from '../db/match-repo';
import { callLogRepository } from '../db/call-log-repo';
import { conferenceRepository } from '../db/conference-repo';
import { getTwilioService } from './twilio';
import { normalizePhoneNumber } from '../utils/conference';
import { generateConferenceRoomId } from '../utils/conference';
import { reportError } from './error-reporter';
import { Logger } from './logger';

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
  ): Promise<string> {
    const twilioService = getTwilioService();
    
    const callerPhone = normalizePhoneNumber(callData.from);
    
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
      // Handle error
      reportError(new Error('Match not found'), { phase: 'incoming', callSid: callData.callSid });
      const logger = new Logger();
      logger.logError(
        'error',
        callerPhone,
        'Match not found',
        { callSid: callData.callSid }
      );
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
    // Bug: 
    const conferenceRoomId = generateConferenceRoomId(callDetails);

    await callLogRepository.logEvent({
      matchId: match.id,
      status: 'started',
      participantId: participant.id,
      conferenceId: conferenceRoomId,
      conferenceSid: null,
      callSid: callData.callSid,
      startedAt: new Date().toISOString(),
      endedAt: null
    });

    return twilioService.incomingCall(callDetails);
  }

  /**
   * Handle conference status events
   */
  static async handleConferenceStatus(event: ConferenceStatusEvent): Promise<void> {
    const twilioService = getTwilioService();
    const { conferenceStatus: eventType, conferenceSid } = event;
    
    if (event.conferenceSid && event.friendlyName) {
      await conferenceRepository.setConferenceSid(event.friendlyName, event.conferenceSid);
    }

    console.log(`Conference event: ${eventType} for ${conferenceSid}`);

    switch (eventType) {
      case 'participant-join':
        await CallHandler.handleParticipantJoin(event);
        break;
      case 'participant-leave':
      case 'completed':
        await CallHandler.handleParticipantLeave(event);
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

  private static async handleParticipantJoin(event: ConferenceStatusEvent): Promise<void> {
    const { conferenceSid, friendlyName: conferenceId, callSid } = event;
    if (!callSid) return;

    const twilioService = getTwilioService();

    const participantPhone = await twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;
    
    const participant = await participantRepository.findByPhone(participantPhone);
    if (participant === null) {
      reportError(new Error('Participant not found on join'), {
        phase: 'participant_join',
        participantPhone,
        callSid,
        conferenceSid,
      });
      if (callSid) {
        try {
          await twilioService.playErrorAndHangup(callSid);
        } catch (e) {
          reportError(e, { phase: 'participant_join', callSid });
        }
      }
      return;
    }
    const match = await matchRepository.findByParticipantId(participant.id);
    if (!match) return;

    // Set conference to active if it doesn't exist
    const conferenceRecord = await conferenceRepository.findByConferenceSid(conferenceSid);
    if (!conferenceRecord || conferenceRecord.status !== 'active') {
      await twilioService.trackConferenceJoin(conferenceId, match.id, conferenceSid);
    }

    await callLogRepository.logEvent({
      matchId: match.id,
      status: 'participant_joined',
      participantId: participant.id,
      conferenceId,
      conferenceSid,
      callSid,
      startedAt: new Date().toISOString(),
      endedAt: null
    });
  }

  private static async handleParticipantLeave(event: ConferenceStatusEvent): Promise<void> {
    const { conferenceSid, friendlyName: conferenceId, callSid } = event;
    if (!callSid) return;

    const twilioService = getTwilioService();

    const participantPhone = await twilioService.getPhoneNumberFromCallSid(callSid);
    if (!participantPhone) return;

    await twilioService.trackConferenceLeave(conferenceSid);
    
    const participant = await participantRepository.findByPhone(participantPhone);
    if (participant === null) {
      reportError(new Error('Participant not found on leave'), {
        phase: 'participant_leave',
        participantPhone,
        callSid,
        conferenceSid,
      });
      if (callSid) {
        try {
          await twilioService.playErrorAndHangup(callSid);
        } catch (e) {
          reportError(e, { phase: 'participant_leave', callSid });
        }
      }
      return;
    }
    const match = await matchRepository.findByParticipantId(participant.id);
    if (!match) return;

    const conferenceRecord = await conferenceRepository.findByConferenceSid(conferenceSid);
    const resolvedConferenceId = conferenceRecord?.conferenceId || conferenceId || null;

    await callLogRepository.logEvent({
      matchId: match.id,
      status: 'participant_left',
      participantId: participant.id,
      conferenceId: resolvedConferenceId,
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
    const conferenceRecord = await conferenceRepository.findByConferenceSid(conferenceSid);
    const conferenceId = conferenceRecord?.conferenceId || null;

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
          conferenceId,
          conferenceSid,
          callSid: remainingCallSid,
          startedAt: null,
          endedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      reportError(error, {
        phase: 'notify_remaining',
        conferenceSid,
      });
      try {
        const participants = await getTwilioService().getClient().conferences(conferenceSid).participants.list();
        if (participants.length === 1 && participants[0].callSid) {
          await getTwilioService().playErrorAndHangup(participants[0].callSid);
        }
      } catch (_) {
        // Best effort; already reported
      }
    }
  }
}
