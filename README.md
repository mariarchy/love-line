# ♡ ✿ love line ✿ ♡

Twilio-based phone matching: connect pre-matched pairs for blind phone dates (e.g. Valentine’s Day).

## Stack

- **TypeScript** + **Express** — webhook server
- **PostgreSQL** + **Kysely** — participants, matches, conferences, call logs
- **Twilio** — voice & conference
- **Sentry** (optional) — error reporting
- **pnpm** — package manager

## Setup

### Prerequisites

- Node.js 18+ (engines: Node 24.x, pnpm 10.x)
- Twilio account + phone number
- PostgreSQL (local or Docker); optional: ngrok for local webhooks

### Install & configure

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `DATABASE_URL` (e.g. `postgresql://loveline:loveline@localhost:5432/loveline`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD` (match `DATABASE_URL`)
- `WEBHOOK_BASE_URL` in production

### Database

Postgres not running? Script will try Docker Compose:

```bash
pnpm run db:ensure
```

### Participant data (seed)

- **Local:** Create `data/participants.json` (see structure below) or set `SEED_FILE` to its path.
- **Production:** Set `SEED_DATA` to a JSON string (never commit real data).

Each item: `phoneNumber` (E.164), `name`, `match: { name, phoneNumber }`. Pairs must reference each other.

```bash
pnpm run db:seed
```

(`db:seed` is skipped if participants already exist. Use `pnpm run db:reset` to wipe and re-seed.)

### Run

```bash
pnpm run dev
```

Build: `pnpm run build` → `pnpm start`

## Twilio webhooks

- **A CALL COMES IN:** `POST` → `{WEBHOOK_BASE_URL}/voice/incoming`
- **STATUS CALLBACK URL:** `{WEBHOOK_BASE_URL}/voice/conference-status`

Local: use ngrok (`ngrok http 3000`) and set Twilio URLs to the ngrok HTTPS host.

## API

- `POST /voice/incoming` — incoming call → lookup, welcome, conference dial
- `POST /voice/wait-music` — hold music while waiting for match
- `POST /voice/conference-status` — conference events (join/leave, exit notification)
- `GET /health` — health check

## Call flow

1. Caller dials → Twilio → `/voice/incoming`
2. Lookup by phone → if found: welcome + join conference; if not: reject
3. First caller hears hold music; when match joins, both are connected
4. When one leaves, the other gets exit message and call ends

## Scripts

| Script        | Purpose                          |
|---------------|----------------------------------|
| `pnpm run dev`| db:ensure + ngrok + dev server   |
| `pnpm run db:ensure` | Create DB / start Postgres (Docker) |
| `pnpm run db:seed`   | Seed from SEED_FILE or SEED_DATA |
| `pnpm run db:seed:prod` | Seed in production (after build) |
| `pnpm run db:reset`  | Reset DB and re-run migrations   |

## Logs

JSON logs → `logs/calls.log` (timestamps, events, participant/match, errors).

## Deploy

Set env (e.g. Railway/DigitalOcean): `TWILIO_*`, `DATABASE_URL`, `WEBHOOK_BASE_URL`, optional `SENTRY_DSN`. Point Twilio webhooks to production URL. For seed, set `SEED_DATA` in host secrets and run `pnpm run db:seed:prod` after deploy if needed.

---

**♡ ✿ love line ✿ ♡ —— .✧ before your date ✧. ——**
