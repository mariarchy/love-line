# Quick Start Guide

Get your Love Line backend running in 5 minutes!

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Twilio credentials:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+14155559999
```

## Step 3: Set Up Participant Data

```bash
cp data/participants.example.json data/participants.json
```

Edit `data/participants.json` with your actual matches. Each participant needs:
- `phoneNumber`: E.164 format (e.g., "+14155551234")
- `name`: Their name
- `match`: Object with their match's `name` and `phoneNumber`

**Important:** Both people in a pair must be listed, and their `match` fields must reference each other.

## Step 4: Validate Data

```bash
npm run validate
```

This checks that:
- All phone numbers are valid
- Matches are bidirectional (Alice matches Bob, Bob matches Alice)
- No duplicate phone numbers
- All required fields are present

## Step 5: Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

## Step 6: Expose with ngrok (for local testing)

In a new terminal:
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

## Step 7: Configure Twilio Webhooks

1. Go to [Twilio Console](https://console.twilio.com) → Phone Numbers
2. Click your phone number
3. Under "Voice & Fax", set:
   - **A CALL COMES IN**: `POST` → `https://your-ngrok-url.ngrok.io/voice/incoming`
   - **STATUS CALLBACK URL**: `https://your-ngrok-url.ngrok.io/voice/conference-status`

## Step 8: Test!

Call your Twilio number from a registered participant phone number. You should:
1. Hear the welcome message
2. Be placed in a conference room
3. If your match calls, you'll both be connected!

## Troubleshooting

### "Phone number not recognized"
- Check that the phone number in `participants.json` matches exactly (including country code)
- Run `npm run validate` to check for formatting issues

### "Webhook not receiving calls"
- Make sure ngrok is running and URL is correct
- Check Twilio webhook URLs are set correctly
- Look at server logs for incoming requests

### "Participants can't connect"
- Verify both participants are in `participants.json`
- Check that their `match` fields reference each other correctly
- Run `npm run validate` to check for match mismatches

## Next Steps

- Read [README.md](./README.md) for detailed documentation
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
- Deploy to production (Heroku/Railway/DigitalOcean) for Valentine's Day!
