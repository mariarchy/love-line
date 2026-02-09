# Love Line Project Structure

This project consists of two separate components:

## 1. Frontend Website (`/`)
- **Location:** Root directory
- **Files:** `index.html`, `styles.css`, `assets/`
- **Purpose:** Marketing/landing page for the Love Line service
- **Technology:** Static HTML/CSS
- **Status:** Existing, unchanged

## 2. Backend API (`/backend`)
- **Location:** `backend/` directory
- **Purpose:** Twilio phone matching service backend
- **Technology:** TypeScript + Express.js + Twilio
- **Status:** Newly created

### Backend Structure

```
backend/
├── src/
│   ├── index.ts                    # Express server & entry point
│   ├── routes/
│   │   └── voice.ts               # Twilio webhook endpoints
│   ├── services/
│   │   ├── database.ts            # Participant data management
│   │   ├── logger.ts              # Call event logging
│   │   └── twilio.ts              # Twilio API integration
│   ├── types/
│   │   └── index.ts               # TypeScript definitions
│   └── utils/
│       ├── conference.ts           # Conference room ID generation
│       └── validate-participants.ts # Data validation utility
├── data/
│   ├── participants.json          # Participant database (gitignored)
│   └── participants.example.json  # Example structure
├── logs/                           # Call logs (gitignored)
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── README.md                       # Full documentation
├── QUICKSTART.md                   # Quick setup guide
└── ARCHITECTURE.md                 # Technical decisions & architecture

```

## Key Features Implemented

✅ **Participant Management**
- JSON file-based database (easily migratable to PostgreSQL/MongoDB)
- Phone number normalization (E.164 format)
- Bidirectional match validation

✅ **Call Flow**
- Incoming call handling with participant lookup
- Unknown number rejection
- Duplicate call prevention
- Welcome messages personalized by name

✅ **Conference Management**
- Consistent room ID generation (hash-based)
- Hold music while waiting
- Automatic connection when match joins
- Exit notifications when match leaves

✅ **Error Handling**
- Graceful error responses (always valid TwiML)
- Comprehensive logging
- User-friendly error messages

✅ **Monitoring**
- Structured JSON logging
- Call event tracking
- Health check endpoint

## Getting Started

1. **Frontend:** Already set up, no changes needed
2. **Backend:** See `backend/QUICKSTART.md` for setup instructions

## Documentation

- **Quick Start:** `backend/QUICKSTART.md`
- **Full Documentation:** `backend/README.md`
- **Architecture:** `backend/ARCHITECTURE.md`

## Next Steps

1. Install backend dependencies: `cd backend && npm install`
2. Configure Twilio credentials in `.env`
3. Add participant data to `data/participants.json`
4. Run validation: `npm run validate`
5. Start server: `npm run dev`
6. Set up ngrok for local testing
7. Configure Twilio webhooks
8. Test with real phone calls
9. Deploy to production for Valentine's Day!
