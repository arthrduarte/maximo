import { anthropic, MODEL, extractTextFromMessage } from '../../claude.js';
import { callOpenAI } from '../../openai.js';
import { supabaseAdmin } from '@db/supabase.js';

interface Message {
  sender: string;
  content: string;
  created_at: string;
}

export default async function createSmsSummary(
  profileId: string,
  startMessageIndex: number,
  endMessageIndex: number
): Promise<string | null> {
  try {
    console.log(`🔍 createSmsSummary called for profile: ${profileId}, range: ${startMessageIndex}-${endMessageIndex}`);
    
    if (!profileId) {
      console.log('❌ No profile ID provided');
      return null;
    }

    // Get messages for the specified range
    console.log(`📥 Fetching messages for range ${startMessageIndex}-${endMessageIndex}`);
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('sender, content, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true })
      .range(startMessageIndex, endMessageIndex);

    if (error) {
      console.error('❌ Error fetching messages:', error);
      return null;
    }

    console.log(`📊 Retrieved ${messages?.length || 0} messages for summary`);

    if (!messages || messages.length < 10) {
      console.log(`❌ Not enough messages to summarize (${messages?.length || 0} < 10)`);
      return null;
    }

    console.log('📝 Preparing prompt for AI...');
    const prompt = `
    You are an executive coach reviewing text message exchanges with a client to create a very brief summary.
    Create an extremely concise summary (2-3 sentences maximum) that captures only the most essential points of the conversation.
    
    Text message exchange:
    ${messages.map((message: Message) => `${message.sender}: ${message.content}`).join('\n')}
    
    IMPORTANT: Return only your summary, keeping it extremely brief. This is just for internal reference.
    `;

    const systemPrompt = "You are an executive coach creating extremely concise summaries of text message exchanges with clients. Keep summaries to 2-3 sentences maximum, focusing only on the most essential information.";

    let result = null;
    
    try {
      // First try with Anthropic
      console.log('🤖 Calling Claude API for summary generation...');
      const response = await anthropic.messages.create({
        model: MODEL,
        temperature: 0.0,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      result = extractTextFromMessage(response.content);
      console.log(`📝 Generated SMS summary with Anthropic: "${result?.substring(0, 100)}..."`);
    } catch (anthropicError) {
      console.error('❌ Error with Anthropic API:', anthropicError instanceof Error ? anthropicError.message : 'Unknown error');
      console.log('🔄 Falling back to OpenAI...');
      
      // Fallback to OpenAI
      console.log('🤖 Calling OpenAI API for summary generation...');
      result = await callOpenAI(prompt, systemPrompt, 0.0, 300);
      console.log(`📝 Generated SMS summary with OpenAI fallback: "${result?.substring(0, 100)}..."`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error creating SMS summary:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack available');
    return null;
  }
} 