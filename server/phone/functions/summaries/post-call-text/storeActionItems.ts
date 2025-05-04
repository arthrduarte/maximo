import { supabaseAdmin } from '@db/supabase.js';
import { anthropic, MODEL, extractTextFromMessage } from '../../../claude.js';

export default async function storeActionItems(
  profileId: string,
  conversationId: string,
  summary: string
): Promise<void> {
  try {
    if (!summary) {
      console.log('No summary provided to extract action items from');
      return;
    }

    const prompt = `
    Extract all action items from this coaching summary. Return ONLY the action items, one per line. If there's only one action item, return it as a single line.
    If there are no action items, return "NO_ACTION_ITEMS".
    Do not include any other text, explanations, or formatting.

    Example output:
    Schedule meeting with marketing team
    Review Q4 budget proposal
    Send follow-up email to John

    Summary:
    ${summary}
    `;

    const response = await anthropic.messages.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 1000,
      system: "You are an AI that extracts action items from coaching summaries. Return only the action items, one per line, with no additional text.",
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const result = extractTextFromMessage(response.content);
    
    if (!result || result === 'NO_ACTION_ITEMS') {
      console.log('No action items found in summary');
      return;
    }

    const actionItems = result
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (!actionItems.length) {
      console.log('No action items to store after processing');
      return;
    }

    const actionItemsToInsert = actionItems.map(content => ({
      profile_id: profileId,
      conversation_id: conversationId,
      content,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabaseAdmin
      .from('action_items')
      .insert(actionItemsToInsert);

    if (error) {
      console.error('❌ Error storing action items:', error);
      throw error;
    }

    console.log('✅ Stored action items successfully');
  } catch (error) {
    console.error('❌ Error in storeActionItems:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
} 