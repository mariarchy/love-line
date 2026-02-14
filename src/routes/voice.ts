import path from 'path';
import express, { Request, Response, Router } from 'express';
import { TwilioIncomingCall, ConferenceStatusEvent } from '../types';
import { CallHandler } from '../services/call-handler';
import { getTwilioService } from '../services/twilio';
import { normalizePhoneNumber } from '../utils/conference';
import { Logger } from '../services/logger';
import { reportError } from '../services/error-reporter';
import { participantRepository } from '../db/participant-repo';

const router: Router = express.Router();
const welcomeAudioPath = path.join(process.cwd(), 'hotline-welcome.mp3');
const waitMusicAudioPath = path.join(process.cwd(), 'romantic-jazz-waiting.mp3');

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
    const callerPhone = normalizePhoneNumber(req.body.From || 'unknown');
    const callSid = req.body.CallSid;
    const participant = await participantRepository.findByPhone(callerPhone).catch(() => null);
    reportError(error, {
      phase: 'incoming',
      participantId: participant?.id,
      participantPhone: callerPhone,
      callSid,
    });
    logger.logError(
      'error',
      callerPhone,
      error instanceof Error ? error.message : 'Unknown error',
      { callSid }
    );
    res.type('text/xml').send(twilioService.error());
  }
});

/**
 * GET /voice/welcome-audio
 * Serves the welcome message audio for incoming calls (Twilio fetches this URL).
 */
router.get('/welcome-audio', (_req: Request, res: Response) => {
  res.type('audio/mpeg').sendFile(welcomeAudioPath, (err) => {
    if (err) {
      console.error('Failed to send welcome audio:', err);
      res.status(500).end();
    }
  });
});

/**
 * GET /voice/wait-music-audio
 * Serves hold music while the caller waits for their match
 */
router.get('/wait-music-audio', (_req: Request, res: Response) => {
  res.type('audio/mpeg').sendFile(waitMusicAudioPath, (err) => {
    if (err) {
      console.error('Failed to send wait music audio:', err);
      res.status(500).end();
    }
  });
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
    const participantPhone = req.body.Caller || 'unknown';
    const participant = participantPhone !== 'unknown'
      ? await participantRepository.findByPhone(normalizePhoneNumber(participantPhone)).catch(() => null)
      : null;
    reportError(error, {
      phase: 'conference_status',
      participantId: participant?.id,
      participantPhone,
      callSid: req.body.CallSid,
      conferenceSid: req.body.ConferenceSid,
    });
    logger.logError(
      'error',
      participantPhone,
      error instanceof Error ? error.message : 'Unknown error',
      { callSid: req.body.CallSid, conferenceSid: req.body.ConferenceSid }
    );
    res.status(200).send('OK'); // Always return 200 to prevent Twilio retries
  }
});

export default router;
