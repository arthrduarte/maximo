import type { Router } from "express";
import express from 'express';
import { createVoiceRouter } from './twilio.js';
import type { Server } from "http";
import createMessagesRouter from './messages/routes.js';

export function createPhoneRouter(httpServer: Server): Router {
  const router = express.Router();

  // Setup voice routes with the HTTP server
  router.use(createVoiceRouter(httpServer));

  router.use(createMessagesRouter());

  // Recording status callback endpoint
  router.post('/recording-callback', async (req, res) => {
    try {
      console.log('📝 Received recording status callback:', {
        body: req.body,
        status: req.body.RecordingStatus,
        recordingSid: req.body.RecordingSid,
        callSid: req.body.CallSid,
        recordingUrl: req.body.RecordingUrl
      });
      
      // Always return a 200 response to Twilio
      res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('❌ Error handling recording callback:', error);
      res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  });

  // Call status callback endpoint
  router.post('/call-status-callback', async (req, res) => {
    try {
      console.log('📞 Received call status callback:', {
        callStatus: req.body.CallStatus,
        callSid: req.body.CallSid,
        from: req.body.From,
        to: req.body.To
      });
      
      // Always return a 200 response to Twilio
      res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('❌ Error handling call status callback:', error);
      res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  });

  return router;
} 