import twilio from 'twilio';
import { WebSocketServer } from 'ws';
import express, { Request, Response, Router } from 'express';
import { Server } from 'http';
import getProfileData from './functions/profile-data/getProfileData.js';
import createSystemPrompt, { UPDATE_INTERVALS } from './functions/system-prompt/createSystemPrompt.js';
import { createSarahUnscheduledCallPrompt } from './functions/system-prompt/sarah.js';
import {
  initializeElevenLabsWebSocket,
  handleAudioBuffer,
  updateSystemPrompt,
  closeConnection,
  type ConnectionState
} from './elevenlabs.js';
import { storeConversation } from './supabase.js';
import { handlePostCallFlow, sendSignupMessagePostCall } from './functions/post-call.js';
import lookupCallTypeAndSchedule from './functions/system-prompt/utils.js';
import { supabaseAdmin } from '@db/supabase.js';
import { sendSMS } from './messages/services/sms.service.js';

let systemPrompt = '';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_MESSAGING_SERVICE_SID) {
  throw new Error('Missing Twilio configuration. Make sure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID are set.');
}

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function initiateOutboundCall(to: string): Promise<string | null> {
  try {
    if (!process.env.TWILIO_WEBHOOK_URL || !process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('Missing required environment variables');
    }
    
    const baseUrl = process.env.TWILIO_WEBHOOK_URL.split('/').slice(0, 3).join('/');
    
    const call = await twilioClient.calls.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${baseUrl}/incoming-call?isOutbound=true&recipientPhone=${encodeURIComponent(to)}`,
      statusCallback: `${baseUrl}/call-status-callback`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
      machineDetection: 'Enable',
      machineDetectionTimeout: 30,
      asyncAmd: 'true',
      asyncAmdStatusCallback: `${baseUrl}/amd-status-callback?phone=${encodeURIComponent(to)}`
    });
    
    return call.sid;
  } catch (error) {
    console.error('Error initiating outbound call:', error);
    return null;
  }
}

export function validateTwilioRequest(headers: Record<string, string>, body: any): boolean {
  try {
    const twilioSignature = headers['x-twilio-signature'];
    if (!twilioSignature || !process.env.TWILIO_WEBHOOK_URL) {
      console.error('Missing Twilio signature or webhook URL');
      return false;
    }

    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      twilioSignature,
      process.env.TWILIO_WEBHOOK_URL,
      body
    );

    return isValid;
  } catch (error) {
    console.error('Webhook validation error:', error);
    return false;
  }
}

export function createVoiceRouter(httpServer: Server): Router {
  const router = express.Router();
  const wss = new WebSocketServer({ server: httpServer });
  const pendingCalls = new Map<string, { 
    prompt: string; 
    isAuthorized: boolean; 
    isScheduled: boolean; 
    maxCallNumber: number;
    callSid?: string;
  }>();

  router.all('/incoming-call', async (req: Request, res: Response) => {
    const isOutbound = req.query.isOutbound === 'true';
    const recipientPhone = isOutbound ? req.query.recipientPhone as string : undefined;
    const phoneToLookup = isOutbound ? recipientPhone : (req.body.From || req.query.From);
    
    console.log('Call details:', {
      isOutbound,
      recipientPhone,
      from: req.body.From || req.query.From,
      to: req.body.To || req.query.To,
      phoneToLookup
    });
    
    if (phoneToLookup) {
      const profile = await getProfileData(phoneToLookup);
      const isAuthorized = !!profile;
      
      let prompt = '';
      
      if (profile) {
        const { isScheduled, maxCallNumber } = await lookupCallTypeAndSchedule(profile.id);
        console.log(`Call with ${phoneToLookup} is ${isScheduled ? 'scheduled 📅' : 'not scheduled 🚫'}`);
        console.log(`👀 Max call number: ${maxCallNumber} 👀`);

        if (isScheduled) {
          prompt = await createSystemPrompt(phoneToLookup, 0, maxCallNumber) || '';
        } else {
          prompt = await createSarahUnscheduledCallPrompt(profile.id) || '';
        }
        
        pendingCalls.set(phoneToLookup, { prompt, isAuthorized, isScheduled, maxCallNumber });
      } else {
        prompt = await createSystemPrompt(phoneToLookup, 0, 0) || '';
        pendingCalls.set(phoneToLookup, { prompt, isAuthorized, isScheduled: false, maxCallNumber: 0 });
      }
      
      systemPrompt = prompt;
      console.log('🔄 System prompt:', systemPrompt);
    }

    const twimlResponse = new twilio.twiml.VoiceResponse();
    const connect = twimlResponse.connect();
    connect.stream({ url: `wss://${req.headers.host}/media-stream` });

    res.type('text/xml').send(twimlResponse.toString());
  });

  wss.on('connection', (connection) => {
    const state: ConnectionState = {
      streamSid: null,
      latestMediaTimestamp: 0,
      lastAssistantItem: null,
      markQueue: [],
      responseStartTimestampTwilio: null,
      elevenLabsWs: null,
      currentCallProfileId: null,
      currentConversationId: null,
      elevenLabsConversationId: null,
      from: null,
      callStartTime: null,
      promptUpdateIntervals: [],
      isScheduled: false,
      maxCallNumber: 0,
      callSid: null,
      profile: null,
      wentToVoicemail: false,
    };

    (connection as any).state = state;

    connection.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        switch (data.event) {
          case 'media':
            if (data.media) {
              state.latestMediaTimestamp = data.media.timestamp || 0;
              handleAudioBuffer(state, data.media.payload);
            }
            break;

          case 'start':
            if (data.start) {
              state.streamSid = data.start.streamSid;
              state.callSid = data.start.callSid;
              state.callStartTime = Date.now();
              console.log('📞 Call started:', {
                streamSid: state.streamSid,
                callSid: state.callSid,
                wentToVoicemail: state.wentToVoicemail,
                existingProfileId: state.currentCallProfileId,
                existingFrom: state.from
              });
              
              try {
                const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
                await client.calls(data.start.callSid).recordings.create({
                  recordingChannels: 'dual',
                  recordingStatusCallback: `${process.env.TWILIO_WEBHOOK_URL}/recording-callback`,
                  trim: 'trim-silence'
                });
              } catch (error) {
                console.error('Error starting call recording:', error);
              }
              
              for (const [phone, callInfo] of Array.from(pendingCalls.entries())) {
                if (callInfo.callSid && callInfo.callSid !== data.start.callSid) {
                  continue;
                }
                
                const profile = await getProfileData(phone);
                state.from = phone;
                
                if (profile) {
                  state.currentCallProfileId = profile.id;
                  state.isScheduled = callInfo.isScheduled;
                  state.maxCallNumber = callInfo.maxCallNumber;
                  state.profile = {
                    id: profile.id,
                    first_name: profile.first_name,
                    last_name: profile.last_name
                  };
                  systemPrompt = callInfo.prompt;
                  
                  callInfo.callSid = data.start.callSid;
                  state.callSid = data.start.callSid;
                  
                  console.log('📱 Set current call profile ID:', state.currentCallProfileId);
                  console.log(`📅 Call is ${state.isScheduled ? 'scheduled' : 'not scheduled'}`);
                  console.log(`👋 Is discovery call: ${state.maxCallNumber === 0}`);
                  console.log(`👋 Is first coaching call: ${state.maxCallNumber === 1}`);
                  console.log(`👋 Is second coaching call: ${state.maxCallNumber === 2}`);
                  
                  // Create conversation entry in Supabase BEFORE connecting to Eleven Labs
                  try {
                    const conversationId = await storeConversation(
                      state.currentCallProfileId,
                      state.isScheduled
                    );
                    if (conversationId) {
                      state.currentConversationId = conversationId;
                    }
                  } catch (error) {
                    console.error('Error creating conversation in Supabase:', error);
                  }
                  
                  // Add detailed logging before initializing ElevenLabs WebSocket
                  console.log('🔄 Initializing ElevenLabs WebSocket with params:', {
                    isScheduled: state.isScheduled,
                    maxCallNumber: state.maxCallNumber,
                    from: state.from,
                    callSid: state.callSid,
                    promptLength: systemPrompt.length
                  });
                  
                  // Schedule prompt updates every N minutes if needed
                  state.promptUpdateIntervals = [];
                  if (state.isScheduled && UPDATE_INTERVALS.length > 0) {
                    for (const interval of UPDATE_INTERVALS) {
                      const timeoutId = setTimeout(async () => {
                        const newPrompt = await createSystemPrompt(state.from!, state.callStartTime || 0, state.maxCallNumber);
                        if (newPrompt) {
                          updateSystemPrompt(state, newPrompt);
                        }
                      }, interval);
                      
                      state.promptUpdateIntervals.push(timeoutId);
                    }
                  }
                  
                  initializeElevenLabsWebSocket(
                    connection, 
                    state, 
                    systemPrompt, 
                    state.isScheduled,
                    profile.first_name
                  );
                  
                  break;
                }
              }
            }
            break;

          case 'stop':
            console.log('📞 Call ended with state:', {
              profileId: state.currentCallProfileId,
              phone: state.from,
              callSid: state.callSid,
              wentToVoicemail: state.wentToVoicemail
            });
            
            // Log current state for debugging
            console.log('DEBUG: Call ended with state:', {
              callSid: state.callSid,
              profileId: state.currentCallProfileId,
              from: state.from,
              conversationId: state.currentConversationId
            });
            
            // Close ElevenLabs connection
            closeConnection(state);
            
            // Handle post-call actions
            if (state.currentCallProfileId) {
              try {
                if (state.currentConversationId && !state.wentToVoicemail && state.profile?.first_name) {
                  await handlePostCallFlow(state, state.profile.first_name);
                } else if (state.wentToVoicemail && state.from && state.currentCallProfileId) {
                  await sendSMS(
                    state.from,
                    'I just tried to call you but you didn\'t answer. No worries, just call me when you are ready.',
                    state.currentCallProfileId
                  );
                }
              } catch (error) {
                console.error('Error during post-call processing:', error);
              }
            }
            
            for (const [phone, info] of pendingCalls.entries()) {
              if (info.callSid === state.callSid) {
                pendingCalls.delete(phone);
              }
            }
            
            state.streamSid = null;
            state.latestMediaTimestamp = 0;
            state.lastAssistantItem = null;
            state.markQueue = [];
            state.responseStartTimestampTwilio = null;
            state.elevenLabsWs = null;
            state.currentCallProfileId = null;
            state.currentConversationId = null;
            state.from = null;
            state.callStartTime = null;
            state.isScheduled = false;
            state.maxCallNumber = 0;
            state.callSid = null;
            state.profile = null;
            state.wentToVoicemail = false;
            
            state.promptUpdateIntervals.forEach(interval => clearTimeout(interval));
            state.promptUpdateIntervals = [];
            
            break;

          case 'mark':
            if (data.mark && data.mark.name) {
              state.markQueue.push(data.mark.name);
            }
            break;

          default:
            console.log(`Unhandled event type: ${data.event}`);
        }
      } catch (error) {
        console.error('Error processing Twilio WebSocket message:', error);
      }
    });

    connection.on('close', () => {
      console.log('🔌 Twilio WebSocket connection closed');
      
      // Close ElevenLabs connection if still open
      closeConnection(state);
      state.promptUpdateIntervals.forEach((interval: NodeJS.Timeout) => clearTimeout(interval));
      state.promptUpdateIntervals = [];
    });
  });

  router.post('/amd-status-callback', async (req: Request, res: Response) => {
    const callSid = req.body.CallSid;
    const answeredBy = req.body.AnsweredBy;
    const phone = req.query.phone as string;
    
    try {
      if (answeredBy === 'machine_start') {
        const profile = await getProfileData(phone);
        if (!profile) {
          return;
        }

        const { data: conversations, error } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('Error fetching conversation:', error);
        } else if (conversations && conversations.length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('conversations')
            .update({ voicemail: true })
            .eq('id', conversations[0].id);
          
          if (updateError) {
            console.error('Error updating voicemail status:', updateError);
          }
        }

        wss.clients.forEach((client) => {
          const state = (client as any).state as ConnectionState;
          if (state && state.callSid === callSid) {
            state.wentToVoicemail = true;
          }
        });
        
        await twilioClient.calls(callSid)
          .update({
            twiml: `
              <?xml version="1.0" encoding="UTF-8"?>
              <Response>
                <Hangup/>
              </Response>
            `
          });
      }
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling AMD callback:', error);
      res.status(500).send('Error processing AMD result');
    }
  });

  router.post('/api/tools/hang-up', async (req: Request, res: Response) => {
    const elevenLabsConversationId = req.body.conversation_id;
    
    if (!elevenLabsConversationId) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    try {
      let callSid: string | null = null;
      let foundConnection = false;

      // Find the corresponding Twilio CallSid from WebSocket state
      wss.clients.forEach((client) => {
        const state = (client as any).state as ConnectionState;
        if (state && state.elevenLabsConversationId === elevenLabsConversationId) {
          foundConnection = true;
          callSid = state.callSid;
          if (state.elevenLabsWs) {
            closeConnection(state);
          }
        }
      });

      if (!foundConnection) {
        return res.status(404).json({ error: 'No active call found for this conversation' });
      }

      if (!callSid) {
        return res.status(404).json({ error: 'No CallSid found for this conversation' });
      }

      // End the Twilio call
      await twilioClient.calls(callSid)
        .update({status: 'completed'})
        .then(call => console.log("🔌 Call ended successfully", call.to))
        .catch((error) => {
          console.error('Error ending call:', error);
        });

      res.status(200).json({ message: 'Call ended successfully' });
    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({ error: 'Failed to end call' });
    }
  });

  return router;
} 