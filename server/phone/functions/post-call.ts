import { ConnectionState } from '../elevenlabs.js';
import { handleCallEnding } from './wellbeing-message/wellbeing.js';
import checkForEntities from './entities/checkForEntities.js';
import storeSummaries from './summaries/storeSummaries.js';
import sendPostCallMessage from './summaries/post-call-text/sendPostCallMessage.js';
import { sendSMS } from '../messages/services/sms.service.js';
import { processRecording } from './call-recording/processCallRecording.js';
import handleScheduling from './scheduled-calls/handleScheduling.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

/**
 * Handles post-call processing for authorized users
 * @param state The current connection state
 * @returns Promise that resolves when all post-call processing is complete
 */
export async function handlePostCallFlow(state: ConnectionState, profileName: string): Promise<void> {
  const profileId = state.currentCallProfileId;
  const phone = state.from;
  const conversationId = state.currentConversationId;
  const elevenlabsConversationId = state.elevenLabsConversationId;

  if (!profileId || !phone) {
    console.log('⚠️ Missing profile ID or phone number, skipping authorized post-call processing');
    return;
  }

  if (!conversationId) {
    console.error('❌ Missing conversation ID, cannot process post-call actions. Ensure a conversation was created at call start.');
    return;
  }

  if (!elevenlabsConversationId) {
    console.error('❌ Missing ElevenLabs conversation ID, cannot process transcription.');
    return;
  }

  console.log(`🔄 Processing post-call flow for conversation: ${conversationId} with ElevenLabs ID: ${elevenlabsConversationId}`);

  try {
    // Process call recording if callSid is available
    let transcription: Transcription[] | null = null;
    if (state.callSid && conversationId) {
      let result = await processRecording(state.callSid, conversationId, elevenlabsConversationId);
      while (result === null || result.length === 0) {
        console.log('Transcription is null or empty, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await processRecording(state.callSid, conversationId, elevenlabsConversationId);
      }
      
      transcription = result
    }

    // If the call is scheduled OR it's a discovery call (maxCallNumber = 0), perform full post-call processing
    // Only skip post-call processing for unscheduled non-discovery calls (Sarah)
    if ((state.isScheduled || state.maxCallNumber === 0) && conversationId) {
      const wasNormalEnding = await handleCallEnding(profileId, phone, transcription);

      if (transcription) {
        await checkForEntities(profileId, conversationId, transcription);
        await storeSummaries(profileId, conversationId, transcription);
      }

      // Send post-call message (aka summaries all the women love) only if the call ended normally (will execute after 120 seconds)
      if (wasNormalEnding && transcription) {
        sendPostCallMessage(profileId, conversationId, phone, transcription);
      } else {
        console.log('✅ Call ended abruptly. Skipping post-call message');
      }
    } else {
      console.log('✅ Skipping entity extraction and summary generation for unscheduled call (Sarah)');
    }

    // Process scheduling information and send calendar invitation
    if (conversationId && transcription) {
      try {
        await handleScheduling(profileId, transcription, state.isScheduled);
     
      } catch (schedulingError) {
        console.error('❌ Error processing post-call scheduling:', schedulingError instanceof Error ? schedulingError.message : 'Unknown error');
      }
    }
    console.log('✅ All post-call functions completed');
  } catch (error: unknown) {
    console.error('❌ Error in post-call functions:', error);
  }
}

// Unauthorized post-call === user has no account
export async function sendSignupMessagePostCall(phone: string): Promise<void> {
  if (!phone) {
    console.log('⚠️ Missing phone number, skipping unauthorized post-call processing');
    return;
  }

  try {
    await sendSMS(
      phone,
      "Thanks for calling! Here's the link to register and talk to Maximo: www.meetmaximo.com.",
    );

  } catch (error: unknown) {
    console.error('❌ Error sending signup message:', error);
  }
}
