import * as crypto from 'crypto';
import { Participant } from '../types';

/**
 * Generates a consistent conference room ID for a matched pair
 * Uses hash of sorted phone numbers to ensure both participants
 * always join the same room regardless of who calls first
 */
export function generateConferenceRoomId(participant: Participant): string {
  const phoneNumbers = [
    participant.phoneNumber,
    participant.match.phoneNumber
  ].sort(); // Sort to ensure consistency

  const hash = crypto
    .createHash('sha256')
    .update(phoneNumbers.join('|'))
    .digest('hex')
    .substring(0, 8); // Use first 8 characters for shorter room name

  return `match_${hash}`;
}

/**
 * Normalizes phone number to E.164 format
 * Handles common variations and ensures consistent format
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, '');

  // If it doesn't start with +, assume US number and add +1
  if (!normalized.startsWith('+')) {
    if (normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    }
  }

  return normalized;
}
