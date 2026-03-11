import express from 'express';
import { initializeFirebase } from './config/firebase';
import { config, validateConfig } from './config/gcp';
import { apiRateLimiter, statusPollingLimiter } from './middleware/rate-limit';
import userRoutes from './routes/user';
import uploadRoutes from './routes/upload';
import statusRoutes from './routes/status';
import videoRoutes from './routes/video';
import processRoutes from './routes/process';

const app = express();
const port = process.env.PORT || 8080;

// Initialize Firebase
initializeFirebase();

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

// Middleware
app.use(express.json());

// Rate limiting middleware
app.use('/api', apiRateLimiter);

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pashabook-worker',
    version: '1.0.0',
  });
});

// User routes
app.use('/api/user', userRoutes);

// Upload routes
app.use('/api/upload', uploadRoutes);

// Status routes (with stricter rate limiting)
app.use('/api/status', statusPollingLimiter, statusRoutes);

// Video routes
app.use('/api/video', videoRoutes);

// Process routes (triggered by Cloud Tasks)
app.use('/process', processRoutes);

app.post('/cleanup', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(port, () => {
  console.log(`Pashabook worker listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Project ID: ${config.projectId}`);
});

export default app;
