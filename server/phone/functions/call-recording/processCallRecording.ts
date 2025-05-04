/**
 * Process Module
 * 
 * Handles the processing of recordings, including downloading from Twilio
 * and storing in Supabase.
 */

import { supabaseAdmin } from '@db/supabase.js';
import twilio from 'twilio';
import axios from 'axios';
import { updateConversationTranscription } from '../transcription.js';

interface RecordingDetails {
  sid: string;
  status: string;
  duration: string;
  channels: number;
  source: string;
  mediaUrl: string;
}

/**
 * Downloads a recording from Twilio with retry logic
 */
async function downloadRecording(recordingUrl: string): Promise<Buffer | null> {
  const maxRetries = 3; // Maximum number of retries
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await axios.get(recordingUrl, {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID as string,
          password: process.env.TWILIO_AUTH_TOKEN as string
        },
        responseType: 'arraybuffer'
      });
      
      console.log('🎙️✅ Recording downloaded successfully');
      return Buffer.from(response.data);
    } catch (error: any) {
      attempt++;
      console.error(`❌ Download failed (attempt ${attempt}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      // If the maximum number of attempts has been reached, return null
      if (attempt === maxRetries) {
        console.error('❌ Max retries reached. Unable to download recording.');
        return null;
      }

      // Wait before retrying (e.g., 5 second)
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return null; // Fallback return
}

/**
 * Generates a permanent public URL for a file in Supabase storage
 */
async function generatePublicUrl(filename: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('call-recordings')
      .createSignedUrl(filename, 315576000000); // 10 years in milliseconds

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('❌ URL generation error:', error);
    return null;
  }
}

/**
 * Stores recording in Supabase and updates conversation
 */
async function storeRecording(
  conversationId: string,
  callSid: string,
  recordingBuffer: Buffer
): Promise<boolean> {
  const filename = `${callSid}.wav`;
  
  try {
    // Store file in Supabase storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('call-recordings')
      .upload(filename, recordingBuffer, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Generate permanent public URL
    const publicUrl = await generatePublicUrl(filename);
    if (!publicUrl) throw new Error('Failed to generate public URL');

    // Update conversation record with public URL
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({ call_recording: publicUrl })
      .eq('id', conversationId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('❌ Storage error:', error);
    return false;
  }
}

/**
 * Fetches recording details from Twilio
 */
async function getRecordingDetails(callSid: string): Promise<RecordingDetails | null> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID as string, process.env.TWILIO_AUTH_TOKEN as string);
  const recordings = await client.recordings.list({ callSid });
  
  if (!recordings.length) {
    console.log('No recording found for call:', callSid);
    return null;
  }

  return recordings[0];
}

/**
 * Deletes a recording from Twilio
 */
async function deleteRecordingFromTwilio(recordingSid: string): Promise<boolean> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID as string, process.env.TWILIO_AUTH_TOKEN as string);
  
  try {
    await client.recordings(recordingSid).remove();
    console.log('🎙️✅ Recording deleted from Twilio successfully');
    return true;
  } catch (error) {
    console.error('❌ Error deleting recording from Twilio:', error);
    return false;
  }
}

/**
 * Main function to process a call recording
 */
export async function processRecording(callSid: string, conversationId: string, elevenlabsConversationId: string) {
  try {
    console.log('🎙️ Processing recording...');

    // Allow time for Twilio to process the recording
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const recording = await getRecordingDetails(callSid);
    if (!recording) {
      console.log('☢️☢️☢️❌❌❌ No recording found for call');
      return null;
    }

    const recordingBuffer = await downloadRecording(recording.mediaUrl);
    if (!recordingBuffer) {
      console.log('☢️☢️☢️❌❌❌ Error downloading recording');
      return null;
    }

    const storeSuccess = await storeRecording(conversationId, callSid, recordingBuffer);
    if (!storeSuccess) {
      console.log('☢️☢️☢️❌❌❌ Error storing recording');
      return null;
    }
    
    // Use the new transcription method that fetches from ElevenLabs API
    const transcription = await updateConversationTranscription(conversationId, elevenlabsConversationId);

    // Delete the recording from Twilio after successful processing
    await deleteRecordingFromTwilio(recording.sid);
    
    console.log('🎙️✅ Recording processed successfully');
    return transcription;
  } catch (error) {
    console.error('❌ Recording process error:', error);
    throw error;
  }
}
