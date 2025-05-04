import { anthropic, MODEL, extractTextFromMessage } from '../../../claude.js';
import { callOpenAI } from '../../../openai.js';
import { supabaseAdmin } from '@db/supabase.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

export default async function extractActionItems(
  conversationId: string,
  profileId: string,
  transcription: Transcription[]
): Promise<string[]> {
  try {

    console.log('👊 Extracting action items from transcription');

    if(transcription.length < 4) {
      console.log('❌ Conversation is too short to extract action items');
      return [];
    }

    const prompt = `
    Analyze this coaching conversation and extract ONLY the specific action items that the client explicitly agreed to do.
    
    Important guidelines:
    - Only include actions the client clearly committed to doing
    - If they changed their mind later in the conversation, only include the final version
    - Do not infer or suggest actions they didn't explicitly agree to
    - Return each action item on a new line
    - If no clear action items were committed to, return "NO_ACTION_ITEMS"
    - Do not include any explanatory text, only the action items themselves
    
    Example output:
    Schedule meeting with marketing team by Friday
    Send progress report to mentor
    Practice meditation for 10 minutes daily

    Conversation:
    ${transcription.map((msg: Transcription) => `${msg.speaker}: ${msg.text}`).join('\n')}
    `;

    const systemPrompt = "You are an AI that extracts explicitly agreed upon action items from coaching conversations. Only return items the client clearly committed to doing.";

    let result = null;
    
    try {
      // First try with Anthropic
      const response = await anthropic.messages.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 1000,
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
      
      result = await callOpenAI(prompt, systemPrompt, 0, 1000);
    }

    console.log('👊✅ Extracted action items');
    
    if (!result || result === 'NO_ACTION_ITEMS') {
      console.log('👊✅ The conversation had no action items');
      return [];
    }

    // Split the result into multiple action items to store in the database
    const actionItems = result
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    const actionItemsToInsert = actionItems.map(content => ({
      profile_id: profileId,
      conversation_id: conversationId,
      content,
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabaseAdmin
      .from('action_items')
      .insert(actionItemsToInsert);

    if (insertError) {
      console.error('👊❌ Error storing action items:', insertError);
      return [];
    }

    console.log('👊✅ Stored action items successfully:', actionItems);
    return actionItems;
  } catch (error) {
    console.error('👊❌ Error in extractActionItems:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
} 