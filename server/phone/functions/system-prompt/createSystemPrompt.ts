import getProfileData from "../profile-data/getProfileData.js";
import getProfileEntities from "../profile-data/getProfileEntities.js";
import getProfileSummaries from "../profile-data/getProfileSummaries.js";
import getProfileMaxConversations from "../profile-data/getProfileConversations.js";
import getProfileSmsSummaries from "../profile-data/getProfileSmsSummaries.js";
import { discoveryCallPrompt } from "./discoveryCall.js";
import { createSarahUnauthorizedPrompt } from "./sarah.js";
import { getFirstCoachingCallPrompt } from "./firstCoachingCall.js";
import { getSecondCoachingCallPrompt } from "./secondCoachingCall.js";
import { DateTime } from "luxon";

// Define the time intervals for prompt updates (in milliseconds)
export const UPDATE_INTERVALS = [
  // 120000,  // 2 minutes
  // 180000,  // 3 minutes
  // 480000,  // 8 minutes
  720000,  // 12 minutes
];

// Core personality traits that remain constant
export const MAXIMO_BASE_PERSONALITY = `
  -- IMPORTANT PERSONALITY INSTRUCTIONS --
  You are an experienced AI executive coach named Maximo but you encourage users to call you Max.
  Your style is friendly and brief, you let the user do most of the talking.
  When asking a question, only ask one question at a time.
  Do not give specific advice, but rather help the user find their own solutions by asking them questions and encouraging them to reflect on their own experiences.
  Don't overwhelm the user with too many questions at once, only ask one question at a time and give them time to think and respond, if they respond but need more time to think and forumalte their thoughts and response, just say take your time.
  If the user says something that is not related to the conversation, just say "Sorry, I didn't catch that."
`;

// Get the appropriate personality based on time elapsed
function getTimeBasedPersonality(elapsedTimeMs: number, timezone: string): string {
  if (elapsedTimeMs > 720000) { // After 12 minutes
    return `
      - You are now nearing the end of the call.
      - Make sure the user has at least 1 action item to take away from the call, otherwise ask the user to suggest an action item that they can accomplish before your next call.
      - Then gently transition the conversation to scheduling the next session.
      - The user's timezone is ${timezone}
      - Ask the user if the same time next week works for them.
      - If the same time next week does not work, ask them to suggest a day and time that works for them.
      - When the user has decided on a day and time, tell them that you will send them a calendar invite for that time and day and make sure to repeat the time and day the user mentioned to confirm it.
      - Thank them for their time and say goodbye.
    `;
  }
  if (elapsedTimeMs > 480000) { // 8-12 minutes (Action Planning)
    return `${MAXIMO_BASE_PERSONALITY}
      You are in the action planning phase of the coaching call:
      - Focus on creating concrete, actionable steps
      - Help them define SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
      - Ask questions about specific actions and timelines
      - Help them identify potential obstacles and solutions
      - Be concise, use a maximum of 2 sentences.
      Example questions:
      - "What specific action will you take first?"
      - "When exactly will you start?"
      - "How will you measure your progress?"
      IMPORTANT: ALWAYS use the user's local timezone when discussing times or scheduling. NEVER use UTC time unless specifically asked.
    `;
  }
  if (elapsedTimeMs > 180000) { // 3-8 minutes (Solution Finding)
    return `${MAXIMO_BASE_PERSONALITY}
      You are in the solution discovery phase of the coaching call:
      - Guide them to discover their own solutions
      - Use "what" and "how" questions to promote insight
      - Help them explore different perspectives
      - Never give direct advice
      - Be concise, use a maximum of 2 sentences.
      Example questions:
      - "What solutions have you considered?"
      - "How might this look from a different perspective?"
      - "What has worked for you in similar situations?"

    `;
  }
  if (elapsedTimeMs > 120000) { // 2-3 minutes (Assessment)
  return `
      You are in the assessment phase of the coaching call, this is when you and the user determine what you will focus on this session.
      - Focus on understanding their core challenge
      - Use open-ended questions to explore the situation
      - Let them do most of the talking
      - Show empathy and understanding
      - Be concise, use a maximum of 2 sentences.
      Example questions:
      - "What's the main challenge you're facing?"
      - "How is this affecting you?"
      - "Could you give me a specific example?"
      - "What aspects of your role would you like to focus on in our coaching sessions?"
    `;
  }
  // 0-2 minutes (Introduction)
  return ``;
}

export default async function createSystemPrompt(
    phone: string, 
    elapsedTimeMs: number = 0,
    maxCallNumber?: number
): Promise<string> {
    const profile = await getProfileData(phone);
    if (!profile) {
        console.error('No profile data available for session initialization');
        return createSarahUnauthorizedPrompt();
    }
    
    const now = DateTime.utc().setZone(profile.timezone);
    const date = now.toFormat('yyyy-MM-dd');
    const time = now.toFormat('HH:mm:ss');

    const dateTimeSection = `\nCurrent time is ${time} on ${date} and the user's timezone is ${profile.timezone}. Always schedule calls in the user's timezone.\n`;

    // make this only for max calls
    const maxCalls = await getProfileMaxConversations(profile.id);
    const maxCallCount = maxCalls.length;

    // if call number is 0, use discovery call prompt
    if (maxCallNumber === 0) {
        // Get SMS summaries for discovery call
        const smsSummaries = await getProfileSmsSummaries(profile.id);
        const smsSummariesSection = smsSummaries.length > 0
            ? `\n== PREVIOUS SMS CONVERSATION SUMMARIES: ==\n${smsSummaries.map(summary => `- ${summary}`).join('\n')}\n`
            : '';

        return `${MAXIMO_BASE_PERSONALITY}${dateTimeSection}
        This is your first call with ${profile.first_name}. 
        ${smsSummariesSection}
        ${discoveryCallPrompt(profile.timezone)}`;
    }

    const timeBasedPersonality = getTimeBasedPersonality(elapsedTimeMs, profile.timezone);

    let coachingCallPrompt = '';
    if (maxCallNumber === 1) coachingCallPrompt = getFirstCoachingCallPrompt();
    if (maxCallNumber === 2) coachingCallPrompt = getSecondCoachingCallPrompt();
    if (maxCallNumber === 3) coachingCallPrompt = getSecondCoachingCallPrompt();
    if (maxCallNumber === 4) coachingCallPrompt = getSecondCoachingCallPrompt();

    // Get all data for returning callers
    const entities = await getProfileEntities(profile.id);
    const summaries = await getProfileSummaries(profile.id);
    const smsSummaries = await getProfileSmsSummaries(profile.id);

    const callCountSection = `\nThis is call number ${maxCallCount} with ${profile.first_name}.\n`;

    const entitiesSection = entities.length > 0 
        ? `\n== KEY INFORMATION ABOUT ${profile.first_name.toUpperCase()}: ==\n${entities.join('\n')}\n`
        : '';
        
    const smsSummariesSection = smsSummaries.length > 0
        ? `\n== SMS CONVERSATION SUMMARIES: ==\n${smsSummaries.map(summary => `- ${summary}`).join('\n')}\n`
        : '';

    const previousSummaries = summaries.slice(0, -1).map(s => s.short).filter(Boolean);
    
    const shortSummariesSection = previousSummaries.length > 0
        ? `\n== PREVIOUS CONVERSATIONS SUMMARY: ==\n${previousSummaries.join('\n')}\n`
        : '';

    const lastSummary = summaries[0];
    const lastDetailedSection = lastSummary && lastSummary.detailed 
        ? `\n== LAST CONVERSATION DETAILED SUMMARY: ==\n${lastSummary.detailed}\n`
        : '';

    const functionCallingInstructions = `\n== FUNCTION CALLING INSTRUCTIONS: ==\n\n
        Every time before answering the user, you MUST use one of the functions available to you. These are tools that enhance your ability to coach the user effectively, so you MUST use them.
        Be aware that you must be brief in your answers, so never use more than 2 sentences. The idea is to make the user talk more than you do.
    `;
        
    return `
      ${timeBasedPersonality}
      ${coachingCallPrompt}
      ${dateTimeSection}
      ${callCountSection}
      ${entitiesSection}
      ${smsSummariesSection}
      ${shortSummariesSection}
      ${lastDetailedSection}
      ${functionCallingInstructions}
    `;
}
