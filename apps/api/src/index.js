const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const committeeRoutes = require('./routes/committee.routes');
const meetingRoutes = require('./routes/meeting.routes');
const documentRoutes = require('./routes/document.routes');
const notificationRoutes = require('./routes/notification.routes');
const storageRoutes = require('./routes/storage.routes');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin file uploads
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'self'", "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"], // Allow embedding in frontend iframes
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding resources from different origins
}));

// CORS - configure for your frontend URLs
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:5174', // Vite alternate port
    'http://localhost:3000', // Alternative
  ],
  credentials: true,
  exposedHeaders: ['ETag'], // Expose ETag for local storage uploads
}));

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/committees', committeeRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/storage', storageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🚀 BoardMate API running on port ${config.port}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
});

module.exports = app;
