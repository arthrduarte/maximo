import { anthropic, MODEL, extractTextFromMessage } from '../../claude.js';
import getProfileEntities from '../profile-data/getProfileEntities.js';
import { callOpenAI } from '../../openai.js';
import { supabaseAdmin } from '@/db/supabase.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

// Orchestrates the entity extraction process
export default async function checkForEntities(
  profileId: string | null,
  conversationId: string | null,
  transcription: Transcription[]
): Promise<string | null> {
  try {
    if (!profileId || !conversationId) {
      console.log('❌ No profile ID or conversation ID provided');
      return null;
    }

    if (!transcription || transcription.length < 4) {
      console.log('❌ Conversation is too short to extract entities');
      return null;
    }

    console.log('✨ Checking if call had new key information (entities)...');

    let previousEntities: string[] = [];
    previousEntities = await getProfileEntities(profileId);

    const prompt = `
    You are an executive coach reviewing your own coaching conversations to note down key information about your client. 
    Extract any important personal or professional information mentioned, such as:
    - Names of people (family, colleagues, etc.)
    - Locations (city, country, etc.)
    - Company details
    - Financial information
    - Personal goals
    - Professional challenges
    - Key dates or timelines
    - Any other important information

    ${previousEntities.length > 0 ? `Here are previously known facts about the user that you should NOT repeat:
    ${previousEntities.join('\n')}

    Please ONLY extract NEW information that is not mentioned above.` : ''}

    IMPORTANT:
    - If no new information is found, return null
    - Do not include phrases like "no new information" or "nothing to report"
    - Only return actual information about the user.
    - After each key information, add a period.
    - Always use the name of the user in the information.
    - Do not include next session scheduling information.

    You must return ONLY the information in natural language without any additional text. Perfect example:
    "John Doe is Paul's best friend. Paul lives in San Francisco. Company XYZ is a competitor of Paul's company. Paul is trying to raise $100,000 from investors."

    Conversation:
    ${transcription.map(entry => `${entry.speaker}: ${entry.text}`).join('\n')}`;

    const systemPrompt = `You are an executive coach reviewing your own coaching conversations to note down key information about your client.
      Be precise and only include information explicitly mentioned in the conversation. 
      Only return new information not previously known. 
      If no new information is found, return null.`;

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

    if (result && result.trim() !== '' && result.toLowerCase() !== 'null') {
      const sentences = result
        .split('.')
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0)
        .map(sentence => `${sentence}.`); // Add the period back
      
      await storeEntities(profileId, sentences);
      console.log('✨✅ Stored new entities');
    } else {
      console.log('✨✅ Call had no new information');
    }

    return result;
  } catch (error) {
    console.error('❌ Error checking for entities:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}


async function storeEntities(profileId: string, sentences: string[]) {
  try {
    // Create an array of objects for batch insert
    const entities = sentences.map(sentence => ({
      profile_id: profileId,
      content: sentence,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabaseAdmin
      .from('entities')
      .insert(entities);

    if (error) {
      throw error;
    }
      } catch (error) {
    console.error('✨❌ Error storing entities:', error instanceof Error ? error.message : 'Unknown error');
  }
}