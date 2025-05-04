import { callOpenAiStructured } from '../../openai.js';
import { handleSmsScheduling } from '../../functions/scheduled-calls/handleScheduling.js';
import { RescheduleAnalysis } from '../types';

// Store rescheduling users in memory
const reschedulingUsers: { [key: string]: boolean } = {};

export function isUserRescheduling(phone: string): boolean {
    return !!reschedulingUsers[phone];
}

export function setUserRescheduling(phone: string, value: boolean): void {
    if (value) {
        reschedulingUsers[phone] = true;
    } else {
        delete reschedulingUsers[phone];
    }
}

export async function analyzeRescheduleRequest(message: string): Promise<RescheduleAnalysis> {
    try {
        console.log('⌛ Analyzing if user wants to reschedule...');
        console.log('Message:', message);

        const reschedulePrompt = `
      Analyze this message and determine if the user is requesting to reschedule their call or schedule a new one.
      If the user is requesting to reschedule, extract the new call time from the message.
      If the user is requesting to schedule a new call, extract the new call time from the message.
      If the user is not requesting to reschedule or schedule a new call, respond with false and null for newCallTime.
      Answer ONLY with a JSON object: { "wantsToReschedule": true/false, "newCallTime": string }

      The new call time should be just how the user says it, example: { "wantsToReschedule": true, "newCallTime": "Next Thursday at 3pm" }

      Message: "${message}"
      `;

        const systemPrompt = "You are an AI assistant analyzing messages to detect rescheduling requests. Respond with valid JSON only.";

        const completion = await callOpenAiStructured(reschedulePrompt, systemPrompt);

        console.log('✅ Analyzed:', completion);

        return {
            wantsToReschedule: completion.wantsToReschedule,
            newCallTime: completion.newCallTime
        };
    } catch (error) {
        console.error('❌ Error in analyzeRescheduleCall:', error instanceof Error ? error.message : 'Unknown error');
        return {
            wantsToReschedule: false
        };
    }
}

export async function handleRescheduling(profileId: string, message: string, isReschedule: boolean = true) {
    return handleSmsScheduling(profileId, message, isReschedule);
} 