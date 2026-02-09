import * as fs from 'fs';
import * as path from 'path';
import { Participant } from '../types';
import { normalizePhoneNumber } from '../utils/conference';

/**
 * Simple JSON file-based database for participant storage
 * Suitable for small groups (<50 people)
 * For production with larger groups, consider PostgreSQL or MongoDB
 */
export class ParticipantDatabase {
  private dataPath: string;
  private participants: Map<string, Participant> = new Map();

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(__dirname, '../../data/participants.json');
    this.loadParticipants();
  }

  /**
   * Load participants from JSON file
   */
  private loadParticipants(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const fileContent = fs.readFileSync(this.dataPath, 'utf-8');
        const participantsArray: Participant[] = JSON.parse(fileContent);
        
        // Index by normalized phone number for fast lookup
        this.participants.clear();
        participantsArray.forEach(participant => {
          const normalizedPhone = normalizePhoneNumber(participant.phoneNumber);
          this.participants.set(normalizedPhone, {
            ...participant,
            phoneNumber: normalizedPhone,
            match: {
              ...participant.match,
              phoneNumber: normalizePhoneNumber(participant.match.phoneNumber)
            }
          });
        });

        console.log(`Loaded ${this.participants.size} participants from database`);
      } else {
        console.warn(`Database file not found at ${this.dataPath}. Creating empty database.`);
        this.saveParticipants(); // Create empty file
      }
    } catch (error) {
      console.error('Error loading participants:', error);
      throw new Error('Failed to load participant database');
    }
  }

  /**
   * Save participants to JSON file
   */
  private saveParticipants(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const participantsArray = Array.from(this.participants.values());
      fs.writeFileSync(
        this.dataPath,
        JSON.stringify(participantsArray, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving participants:', error);
      throw new Error('Failed to save participant database');
    }
  }

  /**
   * Find participant by phone number
   */
  public findParticipant(phoneNumber: string): Participant | null {
    const normalized = normalizePhoneNumber(phoneNumber);
    return this.participants.get(normalized) || null;
  }

  /**
   * Add a new participant
   */
  public addParticipant(participant: Participant): void {
    const normalized = normalizePhoneNumber(participant.phoneNumber);
    this.participants.set(normalized, {
      ...participant,
      phoneNumber: normalized,
      match: {
        ...participant.match,
        phoneNumber: normalizePhoneNumber(participant.match.phoneNumber)
      }
    });
    this.saveParticipants();
  }

  /**
   * Get all participants (for admin/debugging)
   */
  public getAllParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Reload participants from file (useful for hot-reloading during development)
   */
  public reload(): void {
    this.loadParticipants();
  }
}

// Singleton instance
let databaseInstance: ParticipantDatabase | null = null;

export function getDatabase(): ParticipantDatabase {
  if (!databaseInstance) {
    databaseInstance = new ParticipantDatabase();
  }
  return databaseInstance;
}
