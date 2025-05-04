import { supabaseAdmin } from '@db/supabase.js';
import { handleSupabaseError } from '@db/supabase.js';
import twilio from 'twilio';
import { anthropic, MODEL, extractTextFromMessage } from '../../claude.js';
import { callOpenAI } from '../../openai.js';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_MESSAGING_SERVICE_SID) {
    throw new Error('Missing Twilio configuration. Make sure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID are set.');
}

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function storeMessage(profile_id: string, content: string): Promise<void> {
    const { error: insertError } = await supabaseAdmin
        .from('messages')
        .insert({
            profile_id,
            sender: 'ai',
            content,
            created_at: new Date().toISOString()
        });

    if (insertError) {
        console.error('Error storing message:', insertError);
        handleSupabaseError(insertError);
    }
}

export async function sendSMS(to: string, message: string, profile_id?: string): Promise<void> {
    try {
        // Always normalize the phone number before sending
        const normalizedPhone = normalizePhoneNumber(to);
        console.log('⌛ Sending message to:', normalizedPhone);

        const response = await client.messages.create({
            body: message,
            to: normalizedPhone,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID
        });
        console.log('✅ Message sent successfully');

        // Store the message in Supabase after successful sending
        if (profile_id) {
            await storeMessage(profile_id, message);
        }
    } catch (error: any) {
        console.error('Twilio SMS error:', error);
        throw new Error(`Failed to send SMS: ${error.message}`);
    }
}

export function normalizePhoneNumber(phone: string): string {
    console.log('Normalizing phone number:', phone);

    if (!phone || typeof phone !== 'string') {
        throw new Error('Invalid phone number input');
    }

    if (phone.startsWith('+') && /^\+[1-9]\d{1,14}$/.test(phone)) {
        return phone;
    }

    const cleaned = phone.replace(/[^\d+]/g, '');

    if (/^\d{1,4}/.test(cleaned)) {
        const formatted = `+${cleaned}`;
        if (!/^\+[1-9]\d{1,14}$/.test(formatted)) {
            throw new Error('Invalid phone number format after normalization');
        }
        return formatted;
    }

    console.warn('Phone number without country code detected, defaulting to +1:', phone);
    const withCountryCode = `+1${cleaned}`;

    if (!/^\+[1-9]\d{1,14}$/.test(withCountryCode)) {
        throw new Error('Invalid phone number format after adding country code');
    }

    return withCountryCode;
}

export async function analyzeCallRequest(message: string): Promise<boolean> {
    try {
        const prompt =
            `Analyze this message and determine if the user is requesting an immediate phone call.
        Answer ONLY with YES if the user is clearly requesting to have a call with you (now, right now, asap, etc.) or NO if not.
        Do not explain your reasoning, just answer YES or NO.

        Message: "${message}"`;

        const systemPrompt = "You are a message analyzer. You must respond with ONLY 'YES' or 'NO', with no additional text.";

        let answer = null;

        try {
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
            console.log('📝 Analyzed call request with Anthropic');
        } catch (anthropicError) {
            console.error('❌ Error with Anthropic API:', anthropicError instanceof Error ? anthropicError.message : 'Unknown error');
            console.log('🔄 Falling back to OpenAI...');

            answer = await callOpenAI(prompt, systemPrompt, 0, 1);
            console.log('📝 Analyzed call request with OpenAI fallback');
        }

        return answer?.trim() === 'YES';
    } catch (error) {
        console.error('❌ Error in analyzeCallRequest:', error);
        return false;
    }
}

export async function getUserProfile(phone: string) {
    const normalizedPhone = normalizePhoneNumber(phone);
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select()
        .eq('phone', normalizedPhone)
        .single();

    if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error finding profile:', profileError);
        handleSupabaseError(profileError);
    }

    return profile;
}

export async function getUserHistory(profileId: string) {
    const [messageHistory, conversationHistory, smsSummaries] = await Promise.all([
        supabaseAdmin
            .from('messages')
            .select()
            .eq('profile_id', profileId)
            .order('created_at', { ascending: true }),
        supabaseAdmin
            .from('conversations')
            .select('id, transcription, created_at')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: true }),
        supabaseAdmin
            .from('summaries_sms')
            .select()
            .eq('profile_id', profileId)
            .order('created_at', { ascending: true })
    ]);

    return {
        messageHistory: messageHistory.data || [],
        conversationHistory: conversationHistory.data || [],
        smsSummaries: smsSummaries.data || []
    };
} 