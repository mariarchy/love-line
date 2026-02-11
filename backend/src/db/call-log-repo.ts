import { Insertable } from 'kysely';
import { db } from './connection';
import { CallLogsTable } from './schema';

export type CallLogInsert = Insertable<CallLogsTable>;

export class CallLogRepository {
  async logEvent(event: CallLogInsert): Promise<void> {
    await db.insertInto('call_logs').values(event).execute();
  }

  async findPhoneByCallSid(callSid: string): Promise<string | null> {
    const row = await db
      .selectFrom('call_logs')
      .innerJoin('participants', 'participants.id', 'call_logs.participantId')
      .select('participants.phone')
      .where('call_logs.callSid', '=', callSid)
      .orderBy('call_logs.id', 'desc')
      .limit(1)
      .executeTakeFirst();

    return row?.phone || null;
  }
}

export const callLogRepository = new CallLogRepository();
