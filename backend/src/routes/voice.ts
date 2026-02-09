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
      From: req.body.From,
      To: req.body.To,
      CallSid: req.body.CallSid
    };

    // Get webhook base URL from environment or request
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 
      `${req.protocol}://${req.get('host')}`;

    const twiml = await CallHandler.handleIncomingCall(callData, webhookBaseUrl);
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
      ConferenceSid: req.body.ConferenceSid,
      FriendlyName: req.body.FriendlyName,
      Status: req.body.Status,
      ConferenceStatusCallbackEvent: req.body.ConferenceStatusCallbackEvent,
      ParticipantSid: req.body.ParticipantSid,
      ParticipantStatus: req.body.ParticipantStatus,
      CallSid: req.body.CallSid,
      CallStatus: req.body.CallStatus
    };

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
