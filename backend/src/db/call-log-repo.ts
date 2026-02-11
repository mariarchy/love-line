import { Insertable } from 'kysely';
import { db } from './connection';
import { CallLogsTable } from './schema';

export type CallLogInsert = Insertable<CallLogsTable>;

export class CallLogRepository {
  async logEvent(event: CallLogInsert): Promise<void> {
    await db.insertInto('call_logs').values(event).execute();
  }
}

export const callLogRepository = new CallLogRepository();

