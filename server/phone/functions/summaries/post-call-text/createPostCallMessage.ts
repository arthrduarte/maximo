import { anthropic, MODEL, extractTextFromMessage } from '../../../claude.js';
import { callOpenAI } from '../../../openai.js';
import { supabaseAdmin } from '@db/supabase.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

export default async function createPostCallMessage(
  transcription: Transcription[],
  actionItems: string[]
): Promise< string | null> {
  try {

    console.log('✍️ Creating post-call message');

    if (!transcription || transcription.length < 4) {
      console.log('❌ Conversation is too short to summarize');
      return null;
    }

    const prompt = `
    You are an executive coach sending a follow-up text message to a client 2 minutes after your coaching call ended.
    Create a message in TWO distinct sections, separated by exactly "===". The sections should be:

    SECTION 1:
    - Acknowledge or show appreciation for the call that just ended without greeting the user
    - Key insights and realizations they had during the call
    
    SECTION 2:
    ${actionItems.length > 0 ? '- Include these exact action items the client committed to:\n' + actionItems.map(item => `  ${item}`).join('\n') : '- Skip the action items part as none were committed to'}
    - A motivational closing that references their strengths shown in the conversation

    If in this conversation you scheduled a next call with the user, mention it in the closing section.

    The message should be personal, encouraging, and specific to what was discussed.
    Use natural language and a professional tone suitable for SMS.
    Keep each section concise as these will be sent as separate text messages.

    Conversation:
    ${transcription.map((msg: Transcription) => `${msg.speaker}: ${msg.text}`).join('\n')}
    `;

    const systemPrompt = "You are an executive coach creating personalized follow-up messages after coaching calls. Focus on being encouraging, specific, and action-oriented. Structure your response in two sections separated by ===";

    let result = null;
    
    try {
      // First try with Anthropic
      const response = await anthropic.messages.create({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      result = extractTextFromMessage(response.content);

    } catch (anthropicError) {
      console.error('❌ Error with Anthropic API:', anthropicError instanceof Error ? anthropicError.message : 'Unknown error');
      console.log('🔄 Falling back to OpenAI...');
      
      result = await callOpenAI(prompt, systemPrompt, 0.5, 2000);
    }

    console.log('✍️✅ Created post-call message');
    
    return result;
  } catch (error) {
    console.error('✍️❌ Error creating post-call message:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}