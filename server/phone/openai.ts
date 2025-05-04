import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key');
}

export const MODEL = 'gpt-4o-mini';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Call OpenAI with the given prompt and system prompt
 * @param prompt The user prompt
 * @param systemPrompt The system prompt
 * @param temperature The temperature for the model (0-1)
 * @param maxTokens The maximum number of tokens to generate
 * @returns The generated text or null if there was an error
 */
export async function callOpenAI(
  prompt: string, 
  systemPrompt: string,
  temperature: number = 0,
  maxTokens: number = 1000
): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('❌ Error calling OpenAI:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
} 

export async function callOpenAiWebSearch(prompt: string): Promise<any> {
  try{
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: [{
        "role": "user",
        "content": prompt
      }],
    });

    console.log("🔍 Search results:", response.choices[0]?.message?.content || null);
    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('❌ Error calling OpenAI:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function callOpenAiStructured(
  prompt: string, 
  systemPrompt: string,
  temperature: number = 0,
  maxTokens: number = 1000
): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch (error) {
    console.error('❌ Error calling OpenAI:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
} 