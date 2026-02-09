# Architecture & Technical Decisions

## Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Express server entry point
│   ├── routes/
│   │   └── voice.ts            # Twilio webhook routes
│   ├── services/
│   │   ├── database.ts         # Participant data management
│   │   ├── logger.ts           # Call event logging
│   │   └── twilio.ts           # Twilio API integration
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   └── utils/
│       ├── conference.ts        # Conference room ID generation
│       └── validate-participants.ts  # Data validation utility
├── data/
│   ├── participants.json       # Participant database (gitignored)
│   └── participants.example.json  # Example data structure
├── logs/                        # Call logs directory
├── dist/                        # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Technical Decisions

### 1. TypeScript

**Decision:** Use TypeScript for the entire backend.

**Rationale:**
- **Type Safety:** Phone numbers, webhook payloads, and conference management involve complex data structures. TypeScript catches errors at compile-time.
- **Maintainability:** Self-documenting code with interfaces makes the codebase easier to understand and modify.
- **IDE Support:** Better autocomplete and refactoring capabilities.
- **Team Collaboration:** Clear contracts between modules reduce integration issues.

### 2. Express.js Framework

**Decision:** Use Express.js as the web framework.

**Rationale:**
- **Maturity:** Most established Node.js framework with extensive documentation and community support.
- **Twilio Integration:** Excellent examples and middleware support for Twilio webhooks.
- **Lightweight:** Minimal overhead, perfect for webhook endpoints.
- **Flexibility:** Easy to add middleware, error handling, and additional routes.
- **Ecosystem:** Large package ecosystem for future enhancements.

### 3. JSON File Database

**Decision:** Start with JSON file storage, designed for easy migration to PostgreSQL/MongoDB.

**Rationale:**
- **Simplicity:** No database setup required for small groups (<50 participants).
- **Easy Management:** Non-technical users can edit JSON files directly.
- **Zero Infrastructure:** No database server to maintain or configure.
- **Migration Path:** Code is structured with a `ParticipantDatabase` class that can be swapped for a real database adapter.
- **Development Speed:** Faster iteration without database migrations.

**Future Migration:** The `ParticipantDatabase` class can be replaced with a PostgreSQL/MongoDB implementation without changing the rest of the codebase.

### 4. Conference Room Naming Strategy

**Decision:** Use hash of sorted phone numbers: `match_{hash}`.

**Rationale:**
- **Consistency:** Sorting ensures both participants generate the same room ID regardless of who calls first.
- **No Coordination:** No need for external state or coordination between participants.
- **Deterministic:** Same pair always gets the same room ID.
- **Short Names:** 8-character hash keeps room names concise for Twilio.

**Implementation:**
```typescript
const phoneNumbers = [participant.phoneNumber, participant.match.phoneNumber].sort();
const hash = crypto.createHash('sha256').update(phoneNumbers.join('|')).digest('hex').substring(0, 8);
return `match_${hash}`;
```

### 5. Call SID Tracking

**Decision:** Track CallSid → PhoneNumber mapping for conference event handling.

**Rationale:**
- **Twilio Limitation:** Conference status callbacks don't always include caller phone numbers directly.
- **Reliability:** Mapping CallSid (available in all events) to phone numbers ensures accurate participant tracking.
- **State Management:** Enables duplicate call detection and proper exit notifications.

### 6. Error Handling Strategy

**Decision:** Comprehensive error handling with graceful degradation.

**Rationale:**
- **User Experience:** Always return valid TwiML responses, even on errors.
- **Logging:** Log all errors for debugging while providing user-friendly messages.
- **Resilience:** System continues operating even if individual calls fail.
- **Monitoring:** Structured logging enables post-mortem analysis.

### 7. Logging System

**Decision:** JSON file-based logging with structured events.

**Rationale:**
- **Structured Data:** JSON format enables easy parsing and analysis.
- **File-based:** Simple, no external dependencies.
- **Event Types:** Categorized events (call_started, participant_joined, etc.) for filtering.
- **Future Enhancement:** Can easily add log aggregation service (Datadog, Loggly) later.

### 8. Phone Number Normalization

**Decision:** Normalize all phone numbers to E.164 format.

**Rationale:**
- **Consistency:** Ensures reliable lookups regardless of input format.
- **Twilio Requirement:** Twilio expects E.164 format.
- **International Support:** Handles US numbers automatically, extensible for international.

**Implementation:**
- Removes non-digit characters except `+`
- Adds `+1` prefix for 10-digit US numbers
- Preserves existing `+` prefix for international numbers

### 9. Duplicate Call Prevention

**Decision:** Track active conferences and reject duplicate calls.

**Rationale:**
- **User Confusion:** Prevents participants from accidentally being in multiple calls.
- **Resource Management:** Avoids unnecessary Twilio charges.
- **Clear Messaging:** Provides explicit instruction to hang up existing call.

### 10. Exit Notification Strategy

**Decision:** When one participant leaves, notify remaining participant and end conference.

**Rationale:**
- **User Experience:** Prevents remaining participant from waiting indefinitely.
- **Clear Communication:** Explains why the call ended.
- **Resource Cleanup:** Properly terminates Twilio conference resources.

**Implementation:**
- Uses Twilio API to update remaining participant's call with exit message TwiML
- Ends conference to free resources
- Logs call completion for analytics

## API Design

### Webhook Endpoints

All endpoints return TwiML (Twilio Markup Language) XML responses.

1. **POST /voice/incoming** - Entry point for all calls
   - Validates participant
   - Generates conference room ID
   - Returns TwiML with welcome message and conference dial

2. **POST /voice/wait-music** - Provides hold music
   - Looped audio while waiting for match
   - Called automatically by Twilio during conference wait

3. **POST /voice/conference-status** - Conference event webhook
   - Handles participant join/leave events
   - Manages exit notifications
   - Tracks conference state

### Error Responses

All errors return valid TwiML with user-friendly messages:
- Unknown number → Rejection message
- Duplicate call → Instruction to hang up
- System error → Generic error message
- Always ends with `<Hangup/>` for clean termination

## Security Considerations

1. **Phone Number Verification:** Only registered numbers can access the system
2. **No Recording:** Privacy-first design, no call recording
3. **Environment Variables:** Sensitive credentials stored in `.env`
4. **HTTPS Required:** Twilio webhooks require HTTPS (use ngrok for local dev)
5. **Input Validation:** All phone numbers normalized and validated
6. **Error Messages:** Generic error messages prevent information leakage

## Scalability Considerations

### Current Design (Small Scale)
- JSON file database suitable for <50 participants
- In-memory conference tracking
- Single server deployment

### Future Enhancements (Large Scale)
- **Database Migration:** Replace JSON with PostgreSQL/MongoDB
- **Redis:** Use Redis for active conference tracking (distributed systems)
- **Load Balancing:** Multiple server instances with shared database
- **Queue System:** Use message queue for async conference management
- **Monitoring:** Add Datadog/New Relic for production monitoring
- **Rate Limiting:** Add rate limiting middleware for abuse prevention

## Testing Strategy

### Unit Tests (Future)
- Conference room ID generation
- Phone number normalization
- Participant lookup logic
- TwiML generation

### Integration Tests (Future)
- End-to-end call flow simulation
- Conference event handling
- Error scenarios

### Manual Testing (Current)
- Test calls from known numbers
- Unknown number rejection
- Duplicate call prevention
- Exit notification flow

## Deployment Considerations

### Development
- Use `ngrok` to expose local server
- Update Twilio webhooks to ngrok URL
- Test with real phone calls

### Production
- Deploy to Heroku/Railway/DigitalOcean
- Set `WEBHOOK_BASE_URL` environment variable
- Update Twilio webhook URLs to production domain
- Enable HTTPS (required by Twilio)
- Set up monitoring and alerting
- Have backup plan for Valentine's Day

## Future Enhancements

1. **Post-call contact exchange** - Opt-in contact sharing
2. **SMS notifications** - Reminders and match details
3. **Web dashboard** - Real-time call monitoring
4. **Multiple rounds** - Support for multiple match sessions
5. **International numbers** - Toll-free numbers for international participants
6. **Analytics** - Call duration, success rates, no-shows
