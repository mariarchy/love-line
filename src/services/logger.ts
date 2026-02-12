import * as fs from 'fs';
import * as path from 'path';
import { CallEvent } from '../types';

/**
 * Simple file-based logging system
 * Logs call events for monitoring and debugging
 */
export class Logger {
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath || path.join(__dirname, '../../logs/calls.log');
    
    // Ensure log directory exists
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Log a call event
   */
  public logEvent(event: CallEvent): void {
    const logEntry = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(this.logPath, logLine, 'utf-8');
      console.log(`[LOG] ${event.eventType}: ${event.participantPhone}`);
    } catch (error) {
      console.error('Failed to write log entry:', error);
    }
  }

  /**
   * Log error with context
   */
  public logError(
    eventType: CallEvent['eventType'],
    participantPhone: string,
    errorMessage: string,
    context?: Record<string, any>
  ): void {
    this.logEvent({
      timestamp: new Date().toISOString(),
      eventType,
      participantPhone,
      errorMessage,
      ...context
    });
  }

  /**
   * Log call start
   */
  public logCallStart(
    participantPhone: string,
    participantName: string,
    matchName: string,
    conferenceSid: string
  ): void {
    this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: 'call_started',
      participantPhone,
      participantName,
      matchName,
      conferenceSid
    });
  }

  /**
   * Log call end
   */
  public logCallEnd(
    participantPhone: string,
    participantName: string,
    matchName: string,
    conferenceSid: string,
    callDuration: number
  ): void {
    this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: 'call_ended',
      participantPhone,
      participantName,
      matchName,
      conferenceSid,
      callDuration
    });
  }

  /**
   * Log participant join/leave
   */
  public logParticipantEvent(
    eventType: 'participant_joined' | 'participant_left',
    participantPhone: string,
    conferenceSid: string,
    participantName?: string
  ): void {
    this.logEvent({
      timestamp: new Date().toISOString(),
      eventType,
      participantPhone,
      participantName,
      conferenceSid
    });
  }
}
