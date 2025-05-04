import { anthropic, MODEL, extractTextFromMessage } from '../../claude.js';
import { callOpenAI } from '../../openai.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

export default async function createLongSummary(
  conversationId: string | null,
  transcription: Transcription[]
): Promise<string | null> {
  try {
    if (!conversationId) {
      console.log('❌ No conversation ID provided');
      return null;
    }

    if (!transcription || transcription.length < 4) {
      console.log('❌ Conversation is too short to summarize');
      return null;
    }

    const prompt = `
    You are an executive coach reviewing your own coaching conversations with clients to summarize them and have better insights for next calls. 
    Create a detailed, insightful summary that capture both the content of and the transformational aspects of the conversation.
    Use natural language and a professional tone. Organize the information in a logical flow, but don't use headers or bullet points.

    Conversation:
    ${transcription.map((t) => `${t.speaker}: ${t.text}`).join('\n')}
    
    IMPORTANT: Return only your summary, as if you are writing a document for yourself.
    `;

    const systemPrompt = "You are an executive coach reviewing your own coaching conversations to summarize them. Create detailed, insightful summaries that capture both the content and the transformational aspects of coaching conversations. Use natural language and a professional tone.";

    let result = null;
    
    try {
      // First try with Anthropic
      const response = await anthropic.messages.create({
        model: MODEL,
        temperature: 0.0,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      result = extractTextFromMessage(response.content);
      console.log('📝 Generated long summary with Anthropic');
    } catch (anthropicError) {
      console.error('❌ Error with Anthropic API:', anthropicError instanceof Error ? anthropicError.message : 'Unknown error');
      console.log('🔄 Falling back to OpenAI...');
      
      // Fallback to OpenAI
      result = await callOpenAI(prompt, systemPrompt, 0.0, 2000);
      console.log('📝 Generated long summary with OpenAI fallback');
    }

    return result;
  } catch (error) {
    console.error('❌ Error creating long summary:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
