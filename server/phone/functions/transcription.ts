import { ElevenLabsClient } from 'elevenlabs';
import { supabaseAdmin } from '@db/supabase.js';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY as string,
});

// New interface based on ElevenLabs API response
export interface TranscriptMessage {
  role: string;
  time_in_call_secs: number;
  message: string;
}

export interface ProcessedSentence {
  text: string;
  speaker: string;
  timestamp: number;
}

export default async function getTranscription(elevenlabsConversationId: string): Promise<ProcessedSentence[]> {
  try {
    console.log('Fetching transcription from ElevenLabs API');

    // Make a GET request to the ElevenLabs conversation API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${elevenlabsConversationId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY as string,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    console.log('Transcript data:', data);
    // Convert the ElevenLabs transcript format to our application's format
    const processedSentences = convertToProcessedSentences(data.transcript);
    console.log('Processed sentences:', processedSentences);
    return processedSentences;
  } catch (error) {
    console.error('Error fetching transcription from ElevenLabs:', error);
    throw error;
  }
}

export async function updateConversationTranscription(conversationId: string, elevenlabsConversationId: string): Promise<ProcessedSentence[]> {
  try {
    // Get transcription from ElevenLabs
    const processedSentences = await getTranscription(elevenlabsConversationId);

    // Update the Supabase database with the processed transcription
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ transcription: processedSentences })
      .eq('id', conversationId);

    if (error) throw error;
    console.log('Transcription updated successfully');
    return processedSentences;
  } catch (error) {
    console.error('Transcription update failed:', error);
    throw error;
  }
}

function convertToProcessedSentences(transcript: TranscriptMessage[]): ProcessedSentence[] {
  return transcript.map(item => ({
    text: item.message,
    speaker: item.role === 'user' ? 'User' : 'Maximo',
    timestamp: item.time_in_call_secs
  }));
} 