import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { startSlaBackgroundWorker } from './services/slaService.js';
import { startReminderBackgroundWorker } from './services/reminderService.js';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  CrowdCity Server running in production-ready mode`);
  console.log(`  Local Address: http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===================================================`);
  
  // Start automatic SLA breach & escalation background processor
  startSlaBackgroundWorker();

  // Start automatic due-reminder email delivery background processor (Asia/Kolkata IST)
  startReminderBackgroundWorker();
});

// Handle graceful shutdowns & unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully...');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
