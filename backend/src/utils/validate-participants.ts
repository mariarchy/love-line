import * as fs from 'fs';
import * as path from 'path';
import { Participant } from '../types';
import { normalizePhoneNumber } from './conference';

/**
 * Validates participant data structure and match consistency
 * Useful for pre-launch validation
 */
export function validateParticipants(dataPath: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!fs.existsSync(dataPath)) {
      errors.push(`Participant data file not found: ${dataPath}`);
      return { valid: false, errors, warnings };
    }

    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    const participants: Participant[] = JSON.parse(fileContent);

    if (!Array.isArray(participants)) {
      errors.push('Participant data must be an array');
      return { valid: false, errors, warnings };
    }

    if (participants.length === 0) {
      warnings.push('No participants found in data file');
    }

    // Check for duplicate phone numbers
    const phoneNumbers = new Set<string>();
    const participantsByPhone = new Map<string, Participant>();

    participants.forEach((participant, index) => {
      const line = `Participant ${index + 1}`;

      // Validate required fields
      if (!participant.phoneNumber) {
        errors.push(`${line}: Missing phoneNumber`);
      } else {
        const normalized = normalizePhoneNumber(participant.phoneNumber);
        if (phoneNumbers.has(normalized)) {
          errors.push(`${line}: Duplicate phone number: ${participant.phoneNumber}`);
        } else {
          phoneNumbers.add(normalized);
          participantsByPhone.set(normalized, participant);
        }
      }

      if (!participant.name || participant.name.trim() === '') {
        errors.push(`${line}: Missing or empty name`);
      }

      if (!participant.match) {
        errors.push(`${line}: Missing match object`);
      } else {
        if (!participant.match.phoneNumber) {
          errors.push(`${line}: Missing match.phoneNumber`);
        } else {
          const matchNormalized = normalizePhoneNumber(participant.match.phoneNumber);
          if (!participantsByPhone.has(matchNormalized)) {
            warnings.push(`${line}: Match phone number ${participant.match.phoneNumber} not found in participant list`);
          }
        }

        if (!participant.match.name || participant.match.name.trim() === '') {
          errors.push(`${line}: Missing or empty match.name`);
        }
      }
    });

    // Validate bidirectional matches
    participants.forEach((participant, index) => {
      const line = `Participant ${index + 1}`;
      const normalizedPhone = normalizePhoneNumber(participant.phoneNumber);
      const matchNormalized = normalizePhoneNumber(participant.match.phoneNumber);
      const matchParticipant = participantsByPhone.get(matchNormalized);

      if (matchParticipant) {
        const matchMatchNormalized = normalizePhoneNumber(matchParticipant.match.phoneNumber);
        if (matchMatchNormalized !== normalizedPhone) {
          errors.push(
            `${line}: Match mismatch - ${participant.name} matches ${participant.match.name}, ` +
            `but ${participant.match.name} matches ${matchParticipant.match.name}`
          );
        }

        if (matchParticipant.match.name !== participant.name) {
          warnings.push(
            `${line}: Name mismatch - ${participant.name} matches ${participant.match.name}, ` +
            `but ${participant.match.name} matches ${matchParticipant.match.name}`
          );
        }
      }
    });

    // Check for odd number of participants (should be even for pairs)
    if (participants.length % 2 !== 0) {
      warnings.push(`Odd number of participants (${participants.length}). Expected even number for matched pairs.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    errors.push(`Failed to parse participant data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, errors, warnings };
  }
}

// CLI usage
if (require.main === module) {
  const dataPath = process.argv[2] || path.join(__dirname, '../../data/participants.json');
  const result = validateParticipants(dataPath);

  console.log('\n=== Participant Data Validation ===\n');

  if (result.errors.length > 0) {
    console.log('❌ ERRORS:');
    result.errors.forEach(error => console.log(`  - ${error}`));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
    console.log('');
  }

  if (result.valid) {
    console.log('✅ Participant data is valid!\n');
    process.exit(0);
  } else {
    console.log('❌ Validation failed. Please fix the errors above.\n');
    process.exit(1);
  }
}
