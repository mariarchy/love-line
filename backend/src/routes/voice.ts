import express, { Request, Response, Router } from 'express';
import { TwilioIncomingCall, ConferenceStatusEvent } from '../types';
import { CallHandler } from '../services/call-handler';
import { getTwilioService } from '../services/twilio';
import { normalizePhoneNumber } from '../utils/conference';
import { Logger } from '../services/logger';

const router: Router = express.Router();

/**
 * POST /voice/incoming
 * Twilio webhook for incoming calls
 */
router.post('/incoming', async (req: Request, res: Response) => {
  const twilioService = getTwilioService();
  const logger = new Logger();

  try {
    const callData: TwilioIncomingCall = {
      from: req.body.From,
      to: req.body.To,
      callSid: req.body.CallSid
    };

    const twiml = await CallHandler.handleIncomingCall(callData);
    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error handling incoming call:', error);
    const callerPhone = normalizePhoneNumber(req.body.From || 'unknown');
    logger.logError(
      'error',
      callerPhone,
      `Error processing incoming call: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    res.type('text/xml').send(twilioService.error());
  }
});

/**
 * POST /voice/wait-music
 * Provides hold music while waiting for match
 */
router.post('/wait-music', (_req: Request, res: Response) => {
  const twilioService = getTwilioService();
  res.type('text/xml').send(twilioService.waitMusic());
});

/**
 * POST /voice/conference-status
 * Webhook for conference status events
 */
router.post('/conference-status', async (req: Request, res: Response) => {
  const logger = new Logger();

  try {
    const event: ConferenceStatusEvent = {
      conferenceSid: req.body.ConferenceSid,
      friendlyName: req.body.FriendlyName,
      status: req.body.Status,
      conferenceStatus: req.body.StatusCallbackEvent,
      participantSid: req.body.ParticipantSid,
      participantStatus: req.body.ParticipantStatus,
      callSid: req.body.CallSid,
      callStatus: req.body.ParticipantCallStatus
    };
    console.log({ event: req.body });

    await CallHandler.handleConferenceStatus(event);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling conference status:', error);
    logger.logError(
      'error',
      req.body.Caller || 'unknown',
      `Error processing conference status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    res.status(200).send('OK'); // Always return 200 to prevent Twilio retries
  }
});

export default router;
