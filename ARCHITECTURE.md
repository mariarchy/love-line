# ♡ ✿ love line ✿ ♡

## Architecture overview

```
├── src/
│   ├── index.ts              # Express entry, Sentry, migrations on boot
│   ├── routes/
│   │   └── voice.ts          # /voice/incoming, wait-music, conference-status
│   ├── services/
│   │   ├── call-handler.ts   # Incoming call → lookup, TwiML, conference
│   │   ├── twilio.ts         # Twilio client, TwiML helpers
│   │   ├── logger.ts         # JSON call logging
│   │   └── error-reporter.ts # Sentry + fallback reporting
│   ├── db/
│   │   ├── connection.ts     # Kysely + migrations
│   │   ├── schema.ts         # participants, matches, call_logs, conferences
│   │   ├── participant-repo.ts
│   │   ├── match-repo.ts
│   │   ├── conference-repo.ts
│   │   ├── call-log-repo.ts
│   │   ├── seed.ts           # Load SEED_FILE/SEED_DATA → participants + matches
│   │   └── reset.ts          # Drop + re-migrate
│   ├── types/
│   │   └── index.ts          # Twilio payloads, etc.
│   └── utils/
│       └── conference.ts     # Room ID hash, phone normalization
├── scripts/
│   └── ensure-db.ts          # Create DB if missing; start Postgres via Docker if needed
├── docker-compose.yml        # Optional Postgres 16
├── package.json
├── tsconfig.json
└── .env.example
```

## Decisions (concise)

- **TypeScript** — Type safety for webhooks, phone numbers, and DB.
- **Express** — Simple, well-supported for Twilio webhooks.
- **PostgreSQL + Kysely** — Participants, matches, active conferences, and call logs in one DB; migrations in code.
- **Conference room ID** — Hash of sorted pair phone numbers so both callers join the same room without coordination.
- **Call SID → participant** — Map Twilio CallSid to participant for status callbacks and duplicate-call handling.
- **Errors** — Always return valid TwiML; log and report (Sentry when `SENTRY_DSN` set).
- **Phone numbers** — Normalized to E.164; duplicate calls rejected with clear TwiML.
- **Exit behavior** — When one leaves, other gets exit TwiML and conference ends.

## API (TwiML)

- **POST /voice/incoming** — Validate caller, create/find conference, return dial + wait URL.
- **POST /voice/wait-music** — Hold music loop.
- **POST /voice/conference-status** — Join/leave events; trigger exit TwiML when one participant leaves.

## Security

- Only registered (DB) numbers get through; others get rejection TwiML.
- No recording; credentials in env; HTTPS for webhooks; generic error messages to callers.

## Scale

- Current: single app, one Postgres; fine for small events.
- Later: same DB from multiple instances; optional Redis for conference state; add rate limiting and monitoring.

---

**♡ ✿ love line ✿ ♡**
