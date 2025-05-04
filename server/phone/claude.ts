import { Anthropic } from '@anthropic-ai/sdk';
import getProfileData from './functions/profile-data/getProfileData.js';
import getProfileEntities from './functions/profile-data/getProfileEntities.js';
import getProfileSummaries from './functions/profile-data/getProfileSummaries.js';
import { callOpenAI } from './openai.js';
import { DateTime } from 'luxon';
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing Anthropic API key');
}

export const MODEL = 'claude-3-5-sonnet-20241022';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface CoachingResponse {
  message: string;
  nextAction?: string;
  tags?: string[];
}

export function extractTextFromMessage(content: any[]): string {
  if (!content || !Array.isArray(content)) return '';
  return content
    .filter(block => block && typeof block.text === 'string')
    .map(block => block.text)
    .join('');
}

// Base personality for the coaching assistant
const BASE_PERSONALITY = `You are Maximo, an experienced AI executive coach.
Your communication style is friendly, conversational, and focused on helping clients make better decisions.
Keep responses concise (under 160 characters for SMS) yet insightful, always providing actionable advice.
If they have a scheduled call with you, they can call you on the day scheduled.
You have the ability to call the user if they ask you to.

General Guidelines:
- Ask open-ended questions to encourage reflection and deeper thinking.
- Never give direct advice—help the user find their own solutions.
- Use concise responses (160 characters or less) to keep the conversation engaging.
- Maintain a coaching structure while allowing flexibility based on the user's needs.
- When discussing time or scheduling, always use the user's local timezone.
- If user is rescheduling or scheduling a call, always confirm the date and time with them. Don't say things like "in about 1 hour" or "Would you like me to call you?".

`;

// Format conversation history for Claude
function formatConversationHistory(history: string[]): string {
  if (!history || history.length === 0) return '';
  
  return history.map((message, index) => {
    return `Message ${index + 1}: ${message}`;
  }).join('\n\n');
}

// Create a system prompt with user context
async function createSystemPromptWithContext(
  phone: string,
  userHistory: string[]
): Promise<string> {
  // Get user profile data
  const profile = await getProfileData(phone);
  if (!profile) {
    console.error('No profile data available for user');
    return BASE_PERSONALITY;
  }

  const now = DateTime.utc().setZone(profile.timezone);
  const date = now.toFormat('yyyy-MM-dd');
  const time = now.toFormat('HH:mm:ss');

  // Get current date and time
  const dateTimeSection = `\nToday is ${date} at ${time}. User's timezone is ${profile.timezone}.\n`;

  // Get user entities (key information)
  const entities = await getProfileEntities(profile.id);
  const entitiesSection = entities.length > 0 
    ? `\n== KEY INFORMATION ABOUT ${profile.first_name.toUpperCase()}: ==\n${entities.join('\n')}\n`
    : '';

  // Get conversation summaries
  const summaries = await getProfileSummaries(profile.id);
  
  // Format previous conversation summaries
  const previousSummaries = summaries.slice(0, -1).map(s => s.short).filter(Boolean);
  const shortSummariesSection = previousSummaries.length > 0
    ? `\n== PREVIOUS CONVERSATIONS SUMMARY: ==\n${previousSummaries.join('\n')}\n`
    : '';

  // Get detailed summary of the last conversation
  const lastSummary = summaries[0];
  const lastDetailedSection = lastSummary && lastSummary.detailed 
    ? `\n== LAST CONVERSATION DETAILED SUMMARY: ==\n${lastSummary.detailed}\n`
    : '';

  // Combine all sections into the final system prompt
  return `${BASE_PERSONALITY}${dateTimeSection}${entitiesSection}${shortSummariesSection}${lastDetailedSection}`;
}

export async function generateCoachingResponse(
  context: {
    userHistory: string[];
    currentTopic?: string;
    exerciseContent?: string;
    phone: string; // Added phone parameter to identify the user
  }
): Promise<CoachingResponse> {
  // Create system prompt with user context
  const systemPrompt = await createSystemPromptWithContext(context.phone, context.userHistory);
  // Format conversation history
  const formattedHistory = formatConversationHistory(context.userHistory.slice(0, -1));
  
  // Get the current message
  const currentMessage = context.userHistory[context.userHistory.length - 1];
  
  const prompt = `${formattedHistory}\n\nCurrent message: ${currentMessage}`;

  try {
    try {
      // First try with Anthropic
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      });

      const content = extractTextFromMessage(response.content);
      if (!content) {
        throw new Error('Empty response from Claude API');
      }

      console.log('📝 Generated coaching response with Anthropic');
      return {
        message: content,
        nextAction: 'wait_for_response',
        tags: ['coaching', 'business_advice']
      };
    } catch (anthropicError) {
      console.error('❌ Error with Anthropic API:', anthropicError instanceof Error ? anthropicError.message : 'Unknown error');
      console.log('🔄 Falling back to OpenAI...');
      
      // Fallback to OpenAI
      const content = await callOpenAI(prompt, systemPrompt, 0.7, 1000);
      if (!content) {
        throw new Error('Empty response from OpenAI API');
      }
      
      console.log('📝 Generated coaching response with OpenAI fallback');
      return {
        message: content,
        nextAction: 'wait_for_response',
        tags: ['coaching', 'business_advice']
      };
    }
  } catch (error) {
    console.error('AI API error:', error);
    throw new Error('Failed to generate coaching response');
  }
}