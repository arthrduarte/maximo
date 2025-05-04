import WebSocket from 'ws';
import { 
  usePowerfulQuestions,
  useActiveListening,
  useSilenceForThinking,
  useReframePerspective,
  handleWhatShouldIDo
} from './functions/function-calling/getCoachingTechnique.js';

const { ELEVENLABS_API_KEY } = process.env;

if (!ELEVENLABS_API_KEY) {
  throw new Error("Missing ELEVENLABS_API_KEY environment variable");
}

// Event types to log
const LOG_EVENT_TYPES = [
  'error',
  'user_transcript',
  'agent_response',
  'audio',
  'internal_vad_score',
  'internal_turn_probability',
];

// Agent IDs for different personas
// These will need to be configured with your actual ElevenLabs agent IDs
const AGENT_IDS = {
  MAX: process.env.ELEVENLABS_MAX_AGENT_ID || '',  // For scheduled coaching calls
  SARAH: process.env.ELEVENLABS_SARAH_AGENT_ID || '' // For unscheduled calls
};

export interface ConnectionState {
  streamSid: string | null;
  latestMediaTimestamp: number;
  lastAssistantItem: string | null;
  markQueue: string[];
  responseStartTimestampTwilio: number | null;
  elevenLabsWs: WebSocket | null;
  currentCallProfileId: string | null;
  currentConversationId: string | null;
  elevenLabsConversationId: string | null;
  from: string | null;
  callStartTime: number | null;
  promptUpdateIntervals: NodeJS.Timeout[];
  isScheduled: boolean;
  maxCallNumber: number;
  callSid: string | null;
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  scheduledCallInfo?: {
    date: string;
    time: string;
    formattedDateTime: string;
    calendarInviteSent?: boolean;
  }; // Store scheduled call information
  wentToVoicemail?: boolean; // Track if the call went to voicemail
  isNonInterruptible?: boolean; // Whether we're in a non-interruptible period
  nonInterruptibleStartTime?: number; // When the non-interruptible period started
  nonInterruptibleDuration?: number; // Duration of the non-interruptible period in ms
  nonInterruptibleTimer?: NodeJS.Timeout; // Timer to exit non-interruptible state
}

// Handle audio buffer append
export function handleAudioBuffer(state: ConnectionState, audioData: any) {
  // If we're in the non-interruptible period, don't process any audio input
  if (state.isNonInterruptible) {
    return;
  }

  if (state.elevenLabsWs?.readyState === WebSocket.OPEN) {
    // Format the audio chunk message according to Eleven Labs WebSocket protocol
    const audioChunk = {
      user_audio_chunk: audioData
    };
    state.elevenLabsWs.send(JSON.stringify(audioChunk));
  }
}

// Initialize the Eleven Labs WebSocket for a conversation
export function initializeElevenLabsWebSocket(
  connection: WebSocket,
  state: ConnectionState,
  systemPrompt: string,
  isScheduled: boolean = true,
  userName?: string
) {
  // Determine which agent to use based on whether this is a scheduled call
  const agentId = isScheduled ? AGENT_IDS.MAX : AGENT_IDS.SARAH;
  
  if (!agentId) {
    throw new Error(`Missing agent ID for ${isScheduled ? 'MAX' : 'SARAH'}`);
  }

  // Get a signed URL for the WebSocket connection
  getSignedWebSocketUrl(agentId).then(signedUrl => {
    const elevenLabsWs = new WebSocket(signedUrl);
    
    console.log('🔄 Attempting to connect to ElevenLabs WebSocket...');
    
    state.elevenLabsWs = elevenLabsWs;
    
    // Handle WebSocket open event
    elevenLabsWs.on('open', async () => {
      console.log('🟢 ElevenLabs Connected');
      console.log('🔍 Connection details:', {
        readyState: elevenLabsWs.readyState,
        url: elevenLabsWs.url
      });
      
      // Initialize the conversation with configuration
      initializeConversation(elevenLabsWs, systemPrompt, userName, state);
    });
    
    // Handle WebSocket messages
    elevenLabsWs.on('message', async (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        // Only log specific event types
        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log(`📝 Event: ${response.type}`);
        }
        
        // Handle different message types
        switch (response.type) {
          case 'conversation_initiation_metadata':
            handleConversationInitiation(response, state);
            break;
            
          case 'user_transcript':
            handleUserTranscript(response, state, connection);
            break;
            
          case 'agent_response':
            handleAgentResponse(response, state, connection);
            break;
            
          case 'audio':
            handleAudioResponse(response, state, connection);
            break;
            
          case 'ping':
            handlePing(response, elevenLabsWs);
            break;
            
          case 'error':
            handleError(response);
            break;
          
          case 'interruption':
            console.log('🔴 Interruption detected');
            handleInterruption(response, state, connection);
            break;

          case 'internal_vad_score':
          case 'internal_turn_probability':
          case 'internal_tentative_agent_response':
            // These are informational events, we can log them but don't need special handling
            break;
            
          default:
            console.log(`Unhandled event type: ${response.type}`, response);
        }
      } catch (err) {
        console.error('❌ Error processing WebSocket message:', err);
      }
    });
    
    // Handle WebSocket error
    elevenLabsWs.on('error', (error) => {
      console.error('❌ ElevenLabs WebSocket error:', error);
    });
    
    // Handle WebSocket close
    elevenLabsWs.on('close', (code, reason) => {
      console.log(`🔴 ElevenLabs WebSocket closed with code ${code}:`, reason.toString());
    });
  }).catch(error => {
    console.error('❌ Failed to get signed WebSocket URL:', error);
  });
}

// Helper function to get a signed WebSocket URL
async function getSignedWebSocketUrl(agentId: string): Promise<string> {
  try {
    // In production, you should use a server endpoint to get the signed URL
    // For now, we'll construct the URL directly (not secure for production)
    return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
    
    // Production implementation would look something like this:
    /*
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.signed_url;
    */
  } catch (error) {
    console.error('Error getting signed WebSocket URL:', error);
    throw error;
  }
}

// Initialize the conversation with configuration overrides
function initializeConversation(
  ws: WebSocket, 
  systemPrompt: string, 
  userName?: string,
  state?: ConnectionState
) {
  const greeting = state?.isScheduled 
    ? `Hi ${userName}, this is Max. How are you doing today?`
    : `Hi${userName ? ` ${userName}` : ''}, this is Sarah, Maximo's assistant. How can I help you today?`;

  const initMessage = {
    type: 'conversation_initiation_client_data',
    conversation_config_override: {
      agent: {
        prompt: {
          prompt: systemPrompt
        },
        first_message: greeting
      }
    },
    // Add dynamic variables if needed
    dynamic_variables: userName ? { user_name: userName } : undefined
  };
  
  console.log('🚀 Initializing conversation with ElevenLabs...');
  ws.send(JSON.stringify(initMessage));
}

// Handle conversation initiation metadata
function handleConversationInitiation(response: any, state: ConnectionState) {
  const metadata = response.conversation_initiation_metadata_event;
  
  if (metadata && metadata.conversation_id) {
    console.log(`📝 Eleven Labs conversation initiated with ID: ${metadata.conversation_id}`);
    state.elevenLabsConversationId = metadata.conversation_id;
    
    // Log audio format information
    console.log(`🔊 Agent output audio format: ${metadata.agent_output_audio_format}`);
    console.log(`🎤 User input audio format: ${metadata.user_input_audio_format}`);
  }
}

// Handle user transcript events
function handleUserTranscript(response: any, state: ConnectionState, connection: WebSocket) {
  const transcript = response.user_transcription_event?.user_transcript;
  
  if (transcript) {
    console.log(`👤 User said: ${transcript}`);
    
    // Here you could relay this to your client or store it
    // Similar to how you handle the transcripts in the current implementation
  }
}

// Handle agent response events
function handleAgentResponse(response: any, state: ConnectionState, connection: WebSocket) {
  const agentResponse = response.agent_response_event?.agent_response;
  
  if (agentResponse) {
    console.log(`🤖 Agent response: ${agentResponse}`);
    state.lastAssistantItem = agentResponse;
    
    // Start the non-interruptible period if configured
    if (state.nonInterruptibleDuration) {
      startNonInterruptiblePeriod(state);
    }
  }
}

// Handle audio response events
function handleAudioResponse(response: any, state: ConnectionState, connection: WebSocket) {
  if (response.audio_event?.audio_base_64) {
    // Convert the base64 audio to the format expected by Twilio
    const audioBuffer = Buffer.from(response.audio_event.audio_base_64, 'base64');
    
    // Send the audio to the Twilio connection
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({
        event: 'media',
        streamSid: state.streamSid,
        media: {
          payload: audioBuffer.toString('base64')
        }
      }));
    }
  }
}

// Handle ping events
function handlePing(response: any, ws: WebSocket) {
  if (response.ping_event?.event_id) {
    // Respond with a pong to maintain the connection
    const pong = {
      type: 'pong',
      event_id: response.ping_event.event_id
    };
    
    ws.send(JSON.stringify(pong));
  }
}

// Handle error events
function handleError(response: any) {
  console.error('❌ ElevenLabs error:', response.error || response);
}

// Handle interruption events
function handleInterruption(response: any, state: ConnectionState, connection: WebSocket) {
  console.log('🔄 Handling user interruption');
  
  // Send clear event if we have a valid streamSid
  if (state.streamSid && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify({
      event: 'clear',
      streamSid: state.streamSid
    }));
    console.log('🔇 Sent clear event to stop current audio');
  }
}

// Start a non-interruptible period
export function startNonInterruptiblePeriod(state: ConnectionState) {
  state.isNonInterruptible = true;
  state.nonInterruptibleStartTime = Date.now();
  
  console.log(`🔇 Starting non-interruptible period for ${state.nonInterruptibleDuration}ms`);
  
  // Clear any existing timer
  if (state.nonInterruptibleTimer) {
    clearTimeout(state.nonInterruptibleTimer);
  }
  
  // Set a timer to end the non-interruptible period
  state.nonInterruptibleTimer = setTimeout(() => {
    console.log('🔊 Ending non-interruptible period');
    state.isNonInterruptible = false;
    state.nonInterruptibleTimer = undefined;
  }, state.nonInterruptibleDuration);
}

// Update system prompt mid-conversation
export function updateSystemPrompt(state: ConnectionState, newPrompt: string): boolean {
  if (!state.elevenLabsWs || state.elevenLabsWs.readyState !== WebSocket.OPEN) {
    console.error('❌ Cannot update system prompt: WebSocket not connected');
    return false;
  }
  
  try {
    // Note: ElevenLabs may have a different way to update the prompt mid-conversation
    // This is a placeholder - check ElevenLabs documentation for the correct approach
    const updateMessage = {
      type: 'conversation_config_override',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: newPrompt
          }
        }
      }
    };
    
    state.elevenLabsWs.send(JSON.stringify(updateMessage));
    console.log('✅ System prompt updated');
    return true;
  } catch (error) {
    console.error('❌ Error updating system prompt:', error);
    return false;
  }
}

// Close the WebSocket connection gracefully
export function closeConnection(state: ConnectionState) {
  if (state.elevenLabsWs) {
    if (state.elevenLabsWs.readyState === WebSocket.OPEN) {
      state.elevenLabsWs.close(1000, 'Session ended normally');
    }
    state.elevenLabsWs = null;
  }
  
  // Clear any non-interruptible timer
  if (state.nonInterruptibleTimer) {
    clearTimeout(state.nonInterruptibleTimer);
    state.nonInterruptibleTimer = undefined;
  }
  
  // Clear prompt update intervals
  state.promptUpdateIntervals.forEach(interval => clearInterval(interval));
  state.promptUpdateIntervals = [];
}