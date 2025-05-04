import { anthropic, MODEL, extractTextFromMessage } from '../../claude.js';
import { callOpenAI } from '../../openai.js';
import { sendSMS } from '../../messages/services/sms.service.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

// Orchestrates the call ending analysis and wellbeing message sending
export async function handleCallEnding(profileId: string, phone: string, transcription: Transcription[] | null): Promise<boolean> {
  try {
    const wasCorrectEnding = await analyzeCallEnding(profileId, transcription);
    if (!wasCorrectEnding) {
      await sendWellbeingSMS(profileId, phone);
    }
    return wasCorrectEnding;
  } catch (error) {
    console.error('❌ Error handling call ending:', error);
    return true; // Assume correct ending on error
  }
}

// Analyzes if the call ended normally or abruptly
async function analyzeCallEnding(profileId: string, transcription: Transcription[] | null): Promise<boolean> {
  try {
    console.log('⌛ Analyzing how the call ended');

    if (!profileId) {
      console.log('❌ No profile ID provided');
      return true; 
    }

    if (!transcription || transcription.length < 4) {
      console.log('❌ Conversation is too short to send wellbeing message');
      return true;
    }

    const formattedEntries = transcription
      .slice(-3)
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n');

    const prompt = 
      `Analyze these last 3 conversation entries and determine if the call ended normally or abruptly. 
      Answer ONLY with YES if the call ended normally (with proper goodbyes or natural conclusion) or NO if it seems to have ended abruptly.
      Do not explain your reasoning, just answer YES or NO.

      Conversation entries: 
      ${formattedEntries}`;

    const systemPrompt = "You are a conversation analyzer. You must respond with ONLY 'YES' or 'NO', with no additional text.";

    let answer = null;
    
    try {
      // First try with Anthropic
      const response = await anthropic.messages.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 1,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      answer = extractTextFromMessage(response.content);
    } catch (anthropicError) {
      console.error('❌ Error with Anthropic API:', anthropicError instanceof Error ? anthropicError.message : 'Unknown error');
      console.log('🔄 Falling back to OpenAI...');
      
      answer = await callOpenAI(prompt, systemPrompt, 0, 1);
    }
    
    console.log('✅ Analyzed how the call ended');
    return answer?.trim() === 'YES';
  } catch (error) {
    console.error('❌ Error in analyzeCallEnding:', error);
    return true; // Assume normal ending on error
  }
}


// Sends a wellbeing SMS to check on the user
async function sendWellbeingSMS(profileId: string, phone: string) {
  try {
    if (!phone || !profileId) {
      console.error('❌ No phone or profile ID provided');
      return;
    }

    const messagesOptions = [
      "Hey, our call dropped. Everything okay?",
      "Looks like we lost connection! No worries, just hit me up if you wanna continue.",
      "It seems our call was disconnected. Please let me know if you'd like to resume at your convenience.",
      "Hey, I noticed our call ended suddenly. Just wanted to check in and make sure you're alright. Let me know if you need anything!",
      "Lost you! You good?",
      "Our call got cut off. Just checking in—are you okay?",
      "You didn't just hang up on me, did you? 😉 Let me know if you wanna finish our chat!",
      "No worries about the dropped call! Just let me know when you're ready to continue.",
      "Technology strikes again! Our call ended unexpectedly—just wanted to make sure you're okay. Let me know if you need anything!",
      "Guess we got disconnected. No rush, just hit me up when you can!",
      "I think we lost the call. I'll be here if you need to talk again, no pressure at all.",
      "Hey, our call ended. Wanna call me back?",
      "Gotta love technology, right? Our call cut off—let me know if you want to reconnect!",
      "Hey, I just wanted to check in since our call got off. Hope everything's okay—just let me know if you need to chat again!",
      "Lost you there! Everything good? No rush, just let me know if you wanna continue.",
      "Hey, just checking in. Our call ended, and I want to make sure everything's alright!",
      "Call dropped. You good?"
    ];

    const randomMessage = messagesOptions[Math.floor(Math.random() * messagesOptions.length)];
    await sendSMS(phone, randomMessage, profileId);
    console.log('✅ Sent wellbeing SMS to user');
  } catch (error) {
    console.error('❌ Error sending wellbeing SMS:', error);
  }
} 