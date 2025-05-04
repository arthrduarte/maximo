import express from 'express';
import { handleWelcomeMessage, handleSmsWebhook } from '../controllers/index.js';
import { smsRateLimiter } from '../lib/utils.js';

export const router = express.Router();

// Welcome message endpoint
router.post('/api/sms/welcome', handleWelcomeMessage);

// Twilio webhook for incoming messages
router.post('/api/sms/webhook', smsRateLimiter(), handleSmsWebhook); 