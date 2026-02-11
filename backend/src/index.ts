import 'dotenv/config';
import express from 'express';
import voiceRoutes from './routes/voice';
import { ensureMigrations } from './db/connection';

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env file');
  process.exit(1);
}

// Initialize Twilio service singleton to validate config on startup
import { getTwilioService } from './services/twilio';
getTwilioService(); // Initialize to validate config

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/voice', voiceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'love-line-backend'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Love Line Backend API',
    endpoints: {
      health: '/health',
      incomingCall: 'POST /voice/incoming',
      waitMusic: 'POST /voice/wait-music',
      conferenceStatus: 'POST /voice/conference-status'
    }
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server (run migrations first)
const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `http://localhost:${PORT}`;
ensureMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`♡ ✿ Love Line Backend ✿ ♡`);
      console.log(`Server running on port ${PORT}`);
      console.log(`Webhook Base URL: ${webhookBaseUrl}`);
      console.log(`\nConfigure your Twilio phone number webhook to: ${webhookBaseUrl}/voice/incoming`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('Failed to run migrations:', err);
    process.exit(1);
  });
