# Love Line Backend

A Twilio-based phone matching service that connects pre-matched pairs of participants on Valentine's Day for blind phone dates.

## Architecture Decisions

### TypeScript
- **Why TypeScript?** Type safety catches errors at compile-time, improves IDE support, and makes the codebase more maintainable. Given the complexity of handling phone numbers, conference management, and webhook callbacks, type safety is crucial.

### Express.js
- **Why Express?** Express is the most mature and widely-used Node.js web framework with excellent Twilio integration examples. It's lightweight, flexible, and has a large ecosystem. Perfect for handling webhook endpoints.

### JSON File Database
- **Why JSON file?** For small groups (<50 participants), a JSON file is simple, requires no additional infrastructure, and is easy to manage. For production with larger groups, the code is structured to easily swap in PostgreSQL or MongoDB.

### Conference Room Naming
- **Hash-based naming:** Using a hash of sorted phone numbers ensures both participants always join the same room regardless of who calls first, without requiring external coordination.

## Setup

### Prerequisites

- Node.js 18+ installed
- Twilio account with a phone number
- (Optional) ngrok for local development webhook testing

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` with your Twilio credentials:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+14155559999
PORT=3000
MAX_WAIT_TIME_MINUTES=20
```

4. Set up participant data:
```bash
cp data/participants.example.json data/participants.json
```

Edit `data/participants.json` with your actual participant matches. Each participant must have:
- `phoneNumber`: E.164 format (e.g., "+14155551234")
- `name`: Participant's name
- `match`: Object with `name` and `phoneNumber` of their match

**Important:** Both participants in a pair must be listed, and their `match` fields must reference each other.

### Development

Run in development mode with hot-reloading:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

## Twilio Configuration

### Webhook Setup

1. Log into your Twilio Console
2. Go to Phone Numbers → Manage → Active Numbers
3. Click on your phone number
4. Under "Voice & Fax", set:
   - **A CALL COMES IN**: `POST` → `https://your-domain.com/voice/incoming`
   - **STATUS CALLBACK URL**: `https://your-domain.com/voice/conference-status`

### Local Development with ngrok

For local testing, use ngrok to expose your local server:

```bash
ngrok http 3000
```

Then update your Twilio webhook URLs to use the ngrok URL (e.g., `https://abc123.ngrok.io/voice/incoming`).

**Note:** ngrok URLs change on free tier restarts. For production, deploy to a service like Heroku, Railway, or DigitalOcean.

## API Endpoints

### POST /voice/incoming
Twilio webhook for incoming calls. Handles participant lookup, validation, and conference routing.

### POST /voice/wait-music
Provides hold music while participants wait for their match to join.

### POST /voice/conference-status
Webhook for conference status events (participant join/leave, conference start/end).

### GET /health
Health check endpoint for monitoring.

## Call Flow

1. **Participant calls** → Twilio forwards to `/voice/incoming`
2. **System looks up** participant by phone number
3. **If found:** Welcome message → Join conference room
4. **If not found:** Rejection message → End call
5. **First participant** waits with hold music
6. **Second participant joins** → Both connected
7. **One leaves** → Remaining participant gets exit message → Call ends

## Features

- ✅ Participant lookup and validation
- ✅ Conference room management with consistent naming
- ✅ Duplicate call prevention
- ✅ Hold music while waiting
- ✅ Exit notifications when match leaves
- ✅ Comprehensive logging
- ✅ Error handling for edge cases
- ✅ Unknown number rejection

## Monitoring

Logs are written to `logs/calls.log` in JSON format. Each log entry includes:
- Timestamp
- Event type (call_started, call_ended, participant_joined, etc.)
- Participant phone number and name
- Match information
- Conference details
- Error messages (if applicable)

## Testing

### Pre-Launch Checklist

- [ ] Participant data loaded and validated
- [ ] Twilio phone number configured with webhook URLs
- [ ] Environment variables set correctly
- [ ] Test calls completed successfully
- [ ] Unknown number rejection tested
- [ ] Duplicate call prevention tested
- [ ] Exit notification tested
- [ ] Logging verified

### Test Scenarios

1. **Known participant calls:** Should receive welcome and join conference
2. **Unknown number calls:** Should receive rejection message
3. **Both participants call:** Should connect to same conference
4. **One hangs up:** Other should receive exit notification
5. **Duplicate call:** Should be rejected with clear message

## Deployment

### Recommended Platforms

- **Heroku:** Easy deployment, free tier available
- **Railway:** Simple setup, good for Node.js apps
- **DigitalOcean App Platform:** Reliable, scalable
- **AWS Elastic Beanstalk:** Enterprise-grade

### Environment Variables

Make sure to set all required environment variables in your deployment platform:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `PORT` (usually auto-set by platform)
- `MAX_WAIT_TIME_MINUTES`
- `WEBHOOK_BASE_URL` (your production URL)

### Post-Deployment

1. Update Twilio webhook URLs to your production domain
2. Test with a real phone call
3. Monitor logs for any issues
4. Have backup plan ready for Valentine's Day

## Cost Estimation

For 20 matched pairs (40 participants) with 2-hour average calls:
- **Per call:** ~$3.00 (inbound + conference minutes)
- **Total:** ~$120 + phone number fees

See the technical specification for detailed cost breakdown.

## Troubleshooting

### Calls not connecting
- Check Twilio webhook URLs are correct
- Verify environment variables are set
- Check server logs for errors
- Ensure participant data is loaded correctly

### Participants can't find each other
- Verify both participants are in `participants.json`
- Check that phone numbers are in E.164 format
- Ensure match fields reference each other correctly

### Conference issues
- Check Twilio account has conference capabilities enabled
- Verify webhook URLs are accessible (HTTPS required)
- Check logs for conference status events

## License

MIT
