import { anthropic, MODEL as ANTHROPIC_MODEL, extractTextFromMessage } from '../../claude.js';
import { callOpenAiStructured, openai } from '../../openai.js';
import { supabaseAdmin } from '@db/supabase.js';
import { sendCalendarInvitation, SchedulingCalendarInfo } from './sendCalendarInvitation.js';
import { sendSMS } from '../../messages/services/sms.service.js';
import { DateTime } from 'luxon';

interface Message {
  text: string;
  sender: string;
  timestamp: number;
}

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

// Interface for the scheduling information extracted from a conversation
export interface ExtractedSchedulingInfo {
  date?: string; // YYYY-MM-DD format
  time?: string; // HH:MM:SS±HH:MM format with timezone
  formattedDateTime?: string; // Human-readable date and time
  rescheduling?: boolean;
  success: boolean; // Indicates if scheduling was successful
}

// Extracts scheduling information from a conversation
export async function extractSchedulingInfoFromTranscription(
  profileId: string | null,
  transcription: Transcription[]
): Promise<ExtractedSchedulingInfo | null> {
  try {
    if (!profileId) {
      console.log('❌ No profile ID provided for scheduling extraction');
      return null;
    }

    // Get user's timezone from profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('timezone')
      .eq('id', profileId)
      .single();

    if (profileError || !profileData) {
      console.error('❌ Error fetching profile timezone:', profileError);
      return null;
    }

    const { data: lastCallData, error: lastCallError } = await supabaseAdmin
      .from('scheduled_calls')
      .select('date, time')
      .eq('profile_id', profileId)
      .order('created_at')
      .single();

    if (lastCallError) {
      console.error('❌ Error fetching last scheduled call:', lastCallError);
      return null;
    }

    const userTimezone = profileData.timezone || 'UTC';    

    if (!transcription || transcription.length === 0) {
      console.error('❌ No transcription data available');
      return null;
    }

    // Get current date and time information
    const now = DateTime.now().setZone(userTimezone);
    const currentDate = now.toFormat('yyyy-MM-dd'); // YYYY-MM-DD
    const currentTime = now.toFormat('HH:mm:ss'); // HH:MM:SS
    const currentYear = now.year;
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayOfWeek = daysOfWeek[now.weekday];
    
    console.log(`🗓️ Date and time information to pass to extractSchedulingInfo:`, {
      now: now,
      currentDate: currentDate,
      currentTime: currentTime,
      currentYear: currentYear,
      currentDayOfWeek: currentDayOfWeek,
      userTimezone: userTimezone,
      lastCallDate: lastCallData.date,
      lastCallTime: lastCallData.time
    });
    
    const prompt = `
    You are an AI assistant analyzing a conversation between an executive coach (Max) and a client.
    The conversation may sometimes involve Maximo's assistant (Sarah) picking up the phone and confirming 
    or reminding the client about a scheduled appointment. Your task is to extract scheduling information 
    based on the conversation. If the conversation with Maximo doesn't include any scheduling information,
    the scheduling info should be next week at the same day and time as the last scheduled call. If Sarah is just confirming an already
    scheduled call or reminding the client of an existing appointment, do not interpret it as scheduling a
    new session or rescheduling.
    
    IMPORTANT CONTEXT:
    - Today's date is: ${currentDate} (${currentDayOfWeek})
    - Current time is: ${currentTime}
    - Current year is: ${currentYear}
    - The user's timezone is: ${userTimezone}
    ${lastCallData ? `- The last scheduled call was on: ${lastCallData.date} at ${lastCallData.time}` : ''}
    
    RULES FOR INTERPRETING DATES:
    - When interpreting relative dates like "next Wednesday" or "this Friday", use the current date above as reference.
    - "This [day]" refers to the upcoming occurrence of that day in the current week.
    - "Next [day]" refers to the occurrence of that day in the following week.
    - If today is Wednesday and they say "next Wednesday", that would be Wednesday of NEXT week, not today.
    - If they mention a date without a year, assume the current year unless it would result in a past date.
    - All extracted dates MUST be in the future, not the past.
    - When there's no mention of a date assume today's date
    - If a time is provided without a day, interpret it as a request to reschedule for today.
    - If a time is provided without AM or PM, use your judgement based on the current time to determine if the time is AM or PM. 
    - If this conversation is with the assistant Sarah, only extract scheduling information if the user explicitly agrees to a new appointment or requests to schedule one. 
    - If Sarah is simply confirming an existing appointment or reminding the client, do not extract any scheduling information.
    - If the last scheduled call was Friday at 10AM, and the current call had no scheduling information, the next call should also be Friday at 10AM.

    Extract the following information in JSON format:
    1. scheduled_date: The date of the next call in YYYY-MM-DD format
    2. scheduled_time: The time of the next call in HH:MM:SS±HH:MM format (including timezone offset)
    3. formatted_date_time: A human-readable representation of the date and time
    4. rescheduling: Determine if the scheduling is a rescheduling or a new or next call. Return true for rescheduling and false for new or next call.
    
    If Sarah is just telling the user they already have a scheduled call,return:
    { 
      "scheduled": false, 
      "reason": "explanation of why no scheduling information was found"
    }
    
    If scheduling information is found, return:
    { 
      "scheduled": true, 
      "scheduled_date": "YYYY-MM-DD", 
      "scheduled_time": "HH:MM:SS±HH:MM",   
      "formatted_date_time": "Human readable date and time",
      "rescheduling": true/false
    }
    
    Conversation:
    ${transcription.map(entry => `${entry.speaker}: ${entry.text}`).join('\n')}
    `;

    const systemPrompt = "You are an AI assistant that extracts scheduling information from conversations. You must respond with valid JSON that matches the specified schema.";

    let result = null;
    
  try {
    result = await callOpenAiStructured(systemPrompt, prompt, 0, 1000);
    
  } catch (error) {
      console.error('❌ Error with OpenAI API:', error instanceof Error ? error.message : 'Unknown error');
      console.log('🔄 Falling back to Anthropic...');
    
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        temperature: 0.0,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      result = extractTextFromMessage(response.content);
    }
    
    if (!result) {
      console.error('❌ Failed to get a response from both OpenAI and Anthropic');
      return null;
    }
    
    try {
      if (!result.scheduled) {
        console.log(`🗓️❌ No scheduling information found: ${result.reason}`);
        return {
          success: false
        };
      }
      
      // Validate the extracted date and time
      if (!result.scheduled_date || !result.scheduled_time) {
        console.log('🗓️❌ Incomplete scheduling information extracted');
        return {
          success: false
        };
      }
      
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(result.scheduled_date)) {
        console.log(`🗓️❌ Invalid date format: ${result.scheduled_date}`);
        return {
          success: false
        };
      }
      
      // Validate time format (HH:MM:SS±HH:MM)
      const timeRegex = /^\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
      if (!timeRegex.test(result.scheduled_time)) {
        console.log(`🗓️❌ Invalid time format: ${result.scheduled_time}`);
        return {
          success: false
        };
      }
      
      // Validate that the extracted date
      try {
        const timeWithoutTz = result.scheduled_time.split(/[+-]/)[0];
        const extractedDateTime = new Date(`${result.scheduled_date}T${timeWithoutTz}`);
        const now = new Date();
        
        if (isNaN(extractedDateTime.getTime())) {
          console.log('🗓️❌ Invalid date/time combination');
          return {
            success: false
          };
        }
      } catch (dateError) {
        console.error('❌ Error validating date/time:', dateError);
        return {
          success: false
        };
      }
      
      console.log(`✅ Successfully extracted scheduling information: ${result.formatted_date_time}`);
      console.log(`📅 Extracted Date: ${result.scheduled_date}`);
      console.log(`🕒 Extracted Time: ${result.scheduled_time}`);
      console.log(`🔄 Extracted Rescheduling?: ${result.rescheduling}`);
      
      return {
        date: result.scheduled_date,
        time: result.scheduled_time,
        formattedDateTime: result.formatted_date_time,
        rescheduling: result.rescheduling,
        success: true
      };
    } catch (parseError) {
      console.error('❌ Error parsing Claude response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('❌ Error in extractSchedulingInfo:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Extracts scheduling information from a conversation
export async function extractSchedulingInfoFromMessages(
  profileId: string | null,
  message: string
): Promise<ExtractedSchedulingInfo | null> {
  try {
    if (!profileId) {
      console.log('❌ No profile ID provided for scheduling extraction');
      return null;
    }

    // Get user's timezone from profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('timezone, phone')
      .eq('id', profileId)
      .single();

    if (profileError || !profileData) {
      console.error('❌ Error fetching profile timezone:', profileError);
      return null;
    }

    const userTimezone = profileData.timezone || 'UTC';    

    if (!message) {
      console.error('❌ No message available');
      return null;
    }

    // Get current date and time information
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const currentYear = now.getFullYear();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayOfWeek = daysOfWeek[now.getDay()];
    
    console.log(`🗓️ Today is ${currentDayOfWeek}, ${currentDate} and the current time is ${currentTime}`);
    
    const prompt = `
    You are an AI assistant analyzing a conversation between an executive coach (Max) and a client.
    Your task is to extract the date and time when the client and coach agreed to schedule their next call.
    
    IMPORTANT CONTEXT:
    - Today's date is: ${currentDate} (${currentDayOfWeek})
    - Current time is: ${currentTime}
    - Current year is: ${currentYear}
    - The user's timezone is: ${userTimezone}
    
    RULES FOR INTERPRETING DATES:
    - When interpreting relative dates like "next Wednesday" or "this Friday", use the current date above as reference.
    - "This [day]" refers to the upcoming occurrence of that day in the current week.
    - "Next [day]" refers to the occurrence of that day in the following week.
    - If today is Wednesday and they say "next Wednesday", that would be Wednesday of NEXT week, not today.
    - If they mention a date without a year, assume the current year unless it would result in a past date.
    - All extracted dates MUST be in the future, not the past.
    - When there's no mention of a date assume today's date
    - If a time is provided without a day, interpret it as a request to reschedule for today.
    - If a time is provided without AM or PM, use your judgement based on the current time to determine if the time is AM or PM. 
    
    Extract the following information in JSON format:
    1. scheduled_date: The date of the next call in YYYY-MM-DD format
    2. scheduled_time: The time of the next call in HH:MM:SS±HH:MM format (including timezone offset)
    3. formatted_date_time: A human-readable representation of the date and time
    4. rescheduling: Determine if the scheduling is a rescheduling or a new or next call. Return true for rescheduling and false for new or next call.
    
    If no scheduling information is found, return:
    { "scheduled": false, "reason": "explanation of why no scheduling information was found" }
    
    If scheduling information is found, return:
    { 
      "scheduled": true, 
      "scheduled_date": "YYYY-MM-DD", 
      "scheduled_time": "HH:MM:SS±HH:MM", 
      "formatted_date_time": "Human readable date and time",
      "rescheduling": true/false
    }
    
    Message:
    ${message}
    `;

    const systemPrompt = "You are an AI assistant that extracts scheduling information from conversations. You must respond with valid JSON that matches the specified schema.";

    let result = null;
    
  try {
    result = await callOpenAiStructured(systemPrompt, prompt, 0, 1000);
    
  } catch (error) {
      console.error('❌ Error with OpenAI API:', error instanceof Error ? error.message : 'Unknown error');
      console.log('🔄 Falling back to Anthropic...');
    
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        temperature: 0.0,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      result = extractTextFromMessage(response.content);
    }
    
    if (!result) {
      console.error('❌ Failed to get a response from both OpenAI and Anthropic');
      return null;
    }
    
    try {
      if (!result.scheduled) {
        console.log(`🗓️❌ No scheduling information found: ${result.reason}`);
        sendSMS(profileData.phone, `Sorry, I'm having trouble understanding your scheduling request. Can you send the date and time you'd like to reschedule to in the next message (E.g. "Reschedule to March 17th at 10:00 AM")? Thank you!`, profileId);
        return {
          success: false
        };
      }
      
      // Validate the extracted date and time
      if (!result.scheduled_date || !result.scheduled_time) {
        console.log('🗓️❌ Incomplete scheduling information extracted');
        return {
          success: false
        };
      }
      
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(result.scheduled_date)) {
        console.log(`🗓️❌ Invalid date format: ${result.scheduled_date}`);
        return {
          success: false
        };
      }
      
      // Validate time format (HH:MM:SS±HH:MM)
      const timeRegex = /^\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
      if (!timeRegex.test(result.scheduled_time)) {
        console.log(`🗓️❌ Invalid time format: ${result.scheduled_time}`);
        return {
          success: false
        };
      }
      
      // Validate that the extracted date
      try {
        const timeWithoutTz = result.scheduled_time.split(/[+-]/)[0];
        const extractedDateTime = new Date(`${result.scheduled_date}T${timeWithoutTz}`);
        const now = new Date();
        
        if (isNaN(extractedDateTime.getTime())) {
          console.log('🗓️❌ Invalid date/time combination');
          return {
            success: false
          };
        }

      } catch (dateError) {
        console.error('❌ Error validating date/time:', dateError);
        return {
          success: false
        };
      }
      
      console.log(`✅ Successfully extracted scheduling information: ${result.formatted_date_time}`);
      console.log(`📅 Extracted Date: ${result.scheduled_date}`);
      console.log(`🕒 Extracted Time: ${result.scheduled_time}`);
      console.log(`🔄 Extracted Rescheduling?: ${result.rescheduling}`);
      
      return {
        date: result.scheduled_date,
        time: result.scheduled_time,
        formattedDateTime: result.formatted_date_time,
        rescheduling: result.rescheduling,
        success: true
      };
    } catch (parseError) {
      console.error('❌ Error parsing Claude response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('❌ Error in extractSchedulingInfo:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// After we extract the scheduling info, we need to handle it by sending a calendar invite and storing the call in the database
export async function handleExtractedSchedulingInfo(
  schedulingInfo: ExtractedSchedulingInfo,
  profileId: string,
  isScheduled: boolean
): Promise<void> {
  try {
    if (!schedulingInfo.date || !schedulingInfo.time || !schedulingInfo.formattedDateTime) {
      console.log('🗓️❌ No valid scheduling information to process');
      return;
    }

    let isUserRescheduling = schedulingInfo.rescheduling || false;
    
    // Store in database
    console.log('💾 Storing scheduled call in database...');
    const { data: scheduledCall, error: insertError } = await supabaseAdmin
      .from('scheduled_calls')
      .insert({
        profile_id: profileId,
        date: schedulingInfo.date,
        time: schedulingInfo.time,
        calendar_invite_sent: false, // Will be updated after sending invite
        reminder_sent: false,
        no_show: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error storing scheduled call:', insertError);
      throw insertError;
    }

    console.log('✅ Successfully stored scheduled call:', scheduledCall);
    
    const calendarInfo: SchedulingCalendarInfo = {
      date: schedulingInfo.date,
      time: schedulingInfo.time,
      formattedDateTime: schedulingInfo.formattedDateTime
    };

    // Send calendar invitation
    await sendCalendarInvitation(profileId, calendarInfo, isUserRescheduling, isScheduled);
    
    // Update the calendar_invite_sent flag
    const { error: updateError } = await supabaseAdmin
      .from('scheduled_calls')
      .update({ calendar_invite_sent: true })
      .eq('id', scheduledCall.id);

    if (updateError) {
      console.error('❌ Error updating calendar_invite_sent flag:', updateError);
      // Don't throw here as the main functionality (scheduling) was successful
    }
    
    return;
  } catch (error) {
    console.error('❌ Error in processSchedulingInfo:', error instanceof Error ? error.message : 'Unknown error');
    return;
  }
} 