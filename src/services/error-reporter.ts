/**
 * Central error reporting: console + Sentry when SENTRY_DSN is set.
 * Use for any user-facing or system error so you get real-time alerts.
 */

import * as Sentry from '@sentry/node';

export type ErrorContext = {
  /** Where in the call flow the error happened */
  phase?: 'incoming' | 'conference_status' | 'participant_join' | 'participant_leave' | 'notify_remaining' | 'unknown';
  /** Prefer this over participantPhone when sending to Sentry (no PII) */
  participantId?: number;
  participantPhone?: string;
  callSid?: string;
  conferenceSid?: string;
  /** Extra key-value context (avoid PII in production) */
  [key: string]: unknown;
};

/**
 * Report an error: always to console, and to Sentry when SENTRY_DSN is set.
 * Sentry will create Issues and you can configure real-time alerts (Slack, email, PagerDuty).
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message;

  console.error(
    `[ERROR] ${message}`,
    context.phase ? `(phase: ${context.phase})` : '',
    context.callSid ? `callSid=${context.callSid}` : ''
  );

  if (typeof process.env.SENTRY_DSN === 'string' && process.env.SENTRY_DSN.trim() !== '') {
    Sentry.withScope((scope) => {
      scope.setContext('call', {
        phase: context.phase,
        callSid: context.callSid ?? null,
        conferenceSid: context.conferenceSid ?? null,
        participantId: context.participantId ?? null,
      });
      if (context.phase) scope.setTag('phase', context.phase);
      Sentry.captureException(err);
    });
  }
}
