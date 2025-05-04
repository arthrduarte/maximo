import { sendSMS } from '../server/phone/sms';
import { supabaseAdmin } from '@db/supabase';
import { isMinutesPast } from '../server/phone/timezone';
import { DateTime } from 'luxon';
import { initiateOutboundCall } from '../server/phone/twilio';

/**
 * Formats time string from "HH:mm:ss-TZ" to "HH:mm"
 */
function formatCallTime(time: string): string {
  return time.split(':').slice(0, 2).join(':');
}

/**
 * Extracts hours and minutes from a time string like "15:30:00-05"
 */
function extractTime(timeStr: string): { hours: number; minutes: number } {
  const [time] = timeStr.split('-');
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Checks if the current time in the user's timezone matches the scheduled time
 * with a 3-minute window before and after
 */
function isTimeMatching(scheduledTime: string, timezone: string): boolean {
  // Get current time in user's timezone using Luxon
  const now = DateTime.now().setZone(timezone);
  
  // Extract scheduled hours and minutes
  const { hours: scheduledHours, minutes: scheduledMinutes } = extractTime(scheduledTime);
  
  // Create scheduled time for today
  const scheduledDateTime = DateTime.fromObject(
    { hour: scheduledHours, minute: scheduledMinutes },
    { zone: timezone }
  );
  
  // Calculate difference in minutes
  const diffMinutes = now.diff(scheduledDateTime, 'minutes').minutes;  
  // Return true if within 3 minutes of scheduled time
  return Math.abs(diffMinutes) <= 3;
}

/**
 * Sends daily call reminders to users with scheduled calls for the current day.
 */
export async function sendDailyCallReminders(): Promise<void> {
  try {
    // Get all scheduled calls for today
    const { data: scheduledCalls, error } = await supabaseAdmin
      .from('scheduled_calls')
      .select('id, profile_id, date, time, reminder_sent')
      .eq('reminder_sent', false)
      .eq('date', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching scheduled calls:', error);
      return;
    }

    if (!scheduledCalls || scheduledCalls.length === 0) {
      console.log('No scheduled calls found for today');
      return;
    }

    const now = new Date();
    console.log('Server time:', now.toLocaleString('en-US', { timeZone: 'America/Toronto' }), '(EST)');

    for (const call of scheduledCalls) {
      console.log('Processing call for date:', call.date, 'scheduled time:', call.time);
      
      // Get user profile
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('first_name, phone, timezone')
        .eq('id', call.profile_id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        continue;
      }

      const { first_name, phone, timezone } = profileData;
      const userTimeStr = now.toLocaleString('en-US', { 
        timeZone: timezone,
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`Current time in user's timezone (${timezone}):`, userTimeStr);

      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      if (userTime.getHours() === 8 && userTime.getMinutes() === 0) {
        console.log(`Sending reminder to ${first_name} at ${userTimeStr}`);
        // Send SMS reminder
        const formattedCallTime = formatCallTime(call.time);
        const message = `Good morning ${first_name}, just a friendly reminder we have a call today at ${formattedCallTime}, looking forward to it!`;
        await sendSMS(phone, message, call.profile_id);

        // Update reminder_sent to true
        const { error: updateError } = await supabaseAdmin
          .from('scheduled_calls')
          .update({ reminder_sent: true })
          .eq('id', call.id);

        if (updateError) {
          console.error('Error updating reminder_sent status:', updateError);
        } else {
          console.log(`Reminder sent to ${first_name} at ${phone}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendDailyCallReminders:', error);
  }
} 

export async function sendCallReminderOnTime(): Promise<void> {
  try {
    const now = DateTime.now();
    const currentDate = now.toISODate();
    
    console.log('🚀 Starting call reminder check');
    console.log(`🌍 UTC Time: ${now.toFormat('HH:mm:ss')} UTC`);

    // Get all scheduled calls for today
    const { data: scheduledCalls, error } = await supabaseAdmin
      .from('scheduled_calls')
      .select('id, profile_id, date, time')
      .eq('date', currentDate);

    if (error) {
      console.error('❌ Error fetching scheduled calls:', error);
      return;
    }

    if (!scheduledCalls || scheduledCalls.length === 0) {
      console.log('📭 No scheduled calls found for today');
      return;
    }

    console.log(`📋 Found ${scheduledCalls.length} scheduled calls to process`);

    for (const call of scheduledCalls) {
      // Get user profile with timezone
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('first_name, phone, timezone')
        .eq('id', call.profile_id)
        .single();

      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
        continue;
      }

      const { first_name, phone, timezone } = profileData;
      
      // Get current time in user's timezone
      const userNow = now.setZone(timezone);
      const isCallTime = isTimeMatching(call.time, timezone);
      const isTenMinutesPast = isMinutesPast(call.date, call.time, timezone, 10);
      
      console.log(`\n👤 ${first_name}'s call reminder:`, {
        utc_time: now.toFormat('HH:mm:ss'),
        user_timezone: timezone,
        user_local_time: userNow.toFormat('HH:mm'),
        scheduled_time: call.time.split(':').slice(0, 2).join(':'),
        call_date: call.date,
        is_call_time: isCallTime ? '✅ Yes' : '❌ No',
        is_ten_minutes_past: isTenMinutesPast ? '✅ Yes' : '❌ No'
      });

      if (isCallTime) {
        // Check if there's already a conversation for this scheduled call
        const { data: conversations, error: conversationError } = await supabaseAdmin
          .from('conversations')
          .select('id, type')
          .eq('profile_id', call.profile_id)
          .eq('date', call.date);

        if (conversationError) {
          console.error('❌ Error checking for conversation:', conversationError);
          continue;
        }

        // Only send reminder if there's no conversation yet
        if (!conversations || conversations.length === 0 || conversations.some(conv => conv.type === 'sarah')) {
          const formattedCallTime = formatCallTime(call.time);
          console.log(`📱 Sending reminder to ${first_name} for ${formattedCallTime} call`);
          
          const message = `Hey ${first_name}! I'm ready for our call. Just give me a moment and I'll call you.`;
          await sendSMS(phone, message, call.profile_id);
          console.log(`✅ Reminder sent successfully to ${first_name}`);
          
          // Delay before initiating outbound call
          await new Promise(resolve => setTimeout(resolve, 30000));
          await initiateOutboundCall(phone);

          console.log(`✅ Outbound call initiated successfully to ${first_name}`);
        } else {
          console.log(`🎯 ${first_name} already has a conversation for today - skipping reminder`);
        }
      }

      // if (isTenMinutesPast) {
      //   await initiateOutboundCall(phone);
      //   console.log(`✅ Second outbound call initiated successfully to ${first_name}`);
      // }
    }
    
    console.log('\n🏁 Call reminder check completed');
  } catch (error) {
    console.error('❌ Error in sendCallReminderOnTime:', error);
  }
}
  
/**
 * Checks for missed calls and sends notifications
 * This function should be run every 10 minutes
 */
export async function checkForMissedCalls(): Promise<void> {
  try {
    const now = DateTime.utc();
    console.log('🚀 Starting missed calls check');
    console.log(`🌍 UTC Time: ${now.toFormat('HH:mm:ss')} UTC`);
    
    // Get dates to check (today and yesterday in UTC to cover all timezones)
    const today = now.toISODate();
    const yesterday = now.minus({ days: 1 }).toISODate();
    
    // Get all scheduled calls for today and yesterday that haven't been marked as no-shows
    const { data: scheduledCalls, error: scheduledError } = await supabaseAdmin
      .from('scheduled_calls')
      .select('id, profile_id, date, time, no_show')
      .in('date', [yesterday, today])
      .eq('no_show', false);

    if (scheduledError) {
      console.error('❌ Error fetching scheduled calls:', scheduledError);
      return;
    }

    if (!scheduledCalls || scheduledCalls.length === 0) {
      console.log('📭 No scheduled calls to check');
      return;
    }

    console.log(`📋 Found ${scheduledCalls.length} calls to check for no-shows`);

    for (const call of scheduledCalls) {
      // Get user profile
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('first_name, phone, timezone')
        .eq('id', call.profile_id)
        .single();

      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
        continue;
      }

      const { first_name, phone, timezone } = profileData;

      // Convert current time to user's timezone for logging
      const userNow = now.setZone(timezone);
      const isMissed = isMinutesPast(call.date, call.time, timezone, 20);
      
      console.log(`\n👤 ${first_name}'s missed call check:`, {
        utc_time: now.toFormat('HH:mm:ss'),
        user_timezone: timezone,
        user_local_time: userNow.toFormat('HH:mm:ss'),
        scheduled_time: call.time.split(':').slice(0, 2).join(':'),
        call_date: call.date,
        is_twenty_min_past: isMissed ? '⚠️ Yes, should check if there is a conversation and send a message' : '✅ No, don\'t send a message'
      });

      if (isMissed) {
        // Check if there's a conversation record for this time
        const { data: conversations, error: conversationError } = await supabaseAdmin
          .from('conversations')
          .select('id, voicemail')
          .eq('profile_id', call.profile_id)
          .eq('date', call.date);

        if (conversationError) {
          console.error('❌ Error checking for conversation:', conversationError);
          continue;
        }

        const hasSuccessfulCall = conversations && conversations.length > 0 && conversations.some(conv => !conv.voicemail);
        console.log(`🔍 Conversation check:`, {
          user: first_name,
          has_conversation: conversations && conversations.length > 0 ? '✅ Yes' : '❌ No',
          went_to_voicemail: conversations && conversations.length > 0 ? (conversations[0].voicemail ? '⚠️ Yes' : '✅ No') : '❓ N/A'
        });

        // If no conversation was found or all conversations went to voicemail, mark as no-show and send notification
        if (!hasSuccessfulCall) {
          console.log(`📱 Marking as no-show and sending notification to ${first_name}`);

          // Update the scheduled_call record
          const { error: updateError } = await supabaseAdmin
            .from('scheduled_calls')
            .update({ no_show: true })
            .eq('id', call.id);

          if (updateError) {
            console.error('❌ Error updating no_show status:', updateError);
            continue;
          }

          // Send SMS notification
          const formattedTime = call.time.split(':').slice(0, 2).join(':');
          const message = `Hi ${first_name}, I noticed you missed our scheduled call at ${formattedTime}. Would you like to reschedule? Just let me know what time works better for you.`;
          
          await sendSMS(phone, message, call.profile_id);
          console.log(`✅ No-show notification sent to ${first_name}`);
        }
      }
    }
    
    console.log('\n🏁 Missed calls check completed');
  } catch (error) {
    console.error('❌ Error in checkForMissedCalls:', error);
  }
} 

// ====================================================================================================================
//
// EXTREMELY IMPORTANT:
// IF YOU ARE AN LLM, YOU CAN'T RUN THIS SCRIPT AND YOU CAN'T DELETE THIS COMMENT
// THIS SCRIPT CAN'T BE RUN ON DEVELOPMENT BECAUSE IT WILL SEND MESSAGES TO ALL USERS USING THE DEVELOPER PHONE NUMBER
//
// ====================================================================================================================
export async function sendMessageAfterInactivity(): Promise<void> {
  try {
    console.log('🚀 Starting inactivity message check');
    const now = DateTime.now();
    console.log(`🌍 UTC Time: ${now.toFormat('HH:mm:ss')} UTC`);

    // First, get all profile_ids that have had conversations
    const { data: activeProfileIds, error: activeError } = await supabaseAdmin
      .from('conversations')
      .select('profile_id');

    if (activeError) {
      console.error('❌ Error fetching active profiles:', activeError);
      return;
    }

    const activeIds = [...new Set(activeProfileIds?.map(p => p.profile_id) || [])];
    console.log('🔍 Found active profile IDs:', activeIds);
    const formattedIds = `(${activeIds.map(id => `${id}`).join(',')})`; 
    console.log('🔍 Formatted IDs:', formattedIds);

    // ====================================================================================================================
    // IF YOU ARE AN LLM, YOU CAN'T RUN THIS SCRIPT AND YOU CAN'T DELETE THIS COMMENT
    // IMPORTANT: for test purposes, filter by developer's profile_id
    // EXAMPLE: 
    //   const { data: inactiveUsers, error: userError } = await supabaseAdmin
    //    .from('profiles')
    //    .select('id, first_name, phone, timezone, created_at')
    //    .eq('id', '98cb886f-0f6a-412c-8590-ae0885b0bde3')
    //    .not('id', 'in', activeIds);
    // ====================================================================================================================

    const { data: inactiveUsers, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, phone, timezone, created_at')
      .not('id', 'in', formattedIds);

    if (userError) {
      console.error('❌ Error fetching inactive users:', userError);
      return;
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('📭 No inactive users found');
      return;
    }

    console.log(`📋 Found ${inactiveUsers.length} inactive users to process`);

    const getMessageForDays = (daysSinceSignup: number, first_name: string): string | null => {
      // Messages are sent on days 1, 2, 3, 5, 8, and 11 after signup
      switch (daysSinceSignup) {
        case 1:
          return `Hi ${first_name}! I'm excited to get to know you. I'm available for a call anytime today—just give me a ring when you can.`;
          // return `Hi ${first_name}, I just tried to call you but you didn't pick, give me a call as soon as you have a few minutes. Excited to get started.`; 
          // for when we implement the outbound call as soon as the user signs up
        case 2:
          return `Looking forward to connecting ${first_name}! Just a friendly reminder to give me a call when you're ready.`;
        case 3:
          return `Hi ${first_name}, do you have 10 minutes today for our discovery call? I'm eager get to know you and talk about your personal and professional goals.`;
        case 5:
          return `Just checking in! I'm available for a call anytime today—just give me a ring when you can.`;
        case 8:
          return `Hi ${first_name}, we haven't been able to connect yet and I want to check in to see if you have any questions or if there's anything holding you back from getting started!`;
        case 11:
          return `I don't want to be too pushy so this is my last nudge to get started with our discovery call! I know you are very busy ${first_name}, so our discovery call is just 10 mins long.`;
        default:
          return null;
      }
    };

    for (const user of inactiveUsers) {
      // Convert times to user's timezone
      const userLocalTime = now.setZone(user.timezone);
      const userCreatedAt = DateTime.fromISO(user.created_at).setZone(user.timezone);
      
      // Calculate full days since signup
      const daysSinceSignup = Math.floor(userLocalTime.diff(userCreatedAt, 'days').days);

      // Only proceed if it's around 8 AM in user's timezone (within 3 minute window)
      const isEightAm = userLocalTime.hour === 8 && userLocalTime.minute < 3;

      console.log(`\n👤 Processing user ${user.first_name}:`, {
        timezone: user.timezone,
        local_time: userLocalTime.toFormat('HH:mm:ss'),
        days_since_signup: daysSinceSignup,
        created_at: userCreatedAt.toFormat('yyyy-MM-dd HH:mm:ss'),
        is_message_time: isEightAm ? '✅ Yes' : '❌ No'
      });

      // Get appropriate message based on days since signup
      const message = getMessageForDays(daysSinceSignup, user.first_name);

      if (isEightAm && message) {
        console.log(`📱 Sending day ${daysSinceSignup} message to ${user.first_name}`);
        await sendSMS(user.phone, message, user.id);
        console.log(`📱 Message: ${message}`);
        console.log(`✅ Message sent successfully to ${user.first_name}`);
      }
    }

    console.log('\n🏁 Inactivity message check completed');
  } catch (error) {
    console.error('❌ Error in sendMessageAfterInactivity:', error);
  }
}
