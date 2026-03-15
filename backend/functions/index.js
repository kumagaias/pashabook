const functions = require('@google-cloud/functions-framework');
const express = require('express');

// Import routes (these will be compiled from TypeScript)
const uploadRoutes = require('../dist/routes/upload.js');
const statusRoutes = require('../dist/routes/status.js');
const videoRoutes = require('../dist/routes/video.js');

// Upload function
functions.http('upload', (req, res) => {
  const app = express();
  app.use(express.json());
  app.use('/api/upload', uploadRoutes.default);
  app(req, res);
});

// Status function
functions.http('status', (req, res) => {
  const app = express();
  app.use(express.json());
  app.use('/api/status', statusRoutes.default);
  app(req, res);
});

// Video function
functions.http('video', (req, res) => {
  const app = express();
  app.use(express.json());
  app.use('/api/video', videoRoutes.default);
  app(req, res);
});
