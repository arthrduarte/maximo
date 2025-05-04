import { supabaseAdmin } from '@db/supabase.js';
import { sendCalendarInvite, CalendarEventOptions, rescheduleCalendarInvite } from '../calendar/calendar.js';
import { parseISO, format } from 'date-fns';
import { sendSMS } from '../../messages/services/sms.service.js';

export interface SchedulingCalendarInfo {
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM:SS±HH:MM format with timezone
  formattedDateTime: string; // Human-readable date and time
}

// Sends a calendar invitation to the user
export async function sendCalendarInvitation(
  profileId: string,
  schedulingInfo: SchedulingCalendarInfo,
  isUserRescheduling: boolean,
  isScheduled: boolean
): Promise<void> {
  try {
    if (!profileId || !schedulingInfo.date || !schedulingInfo.time) {
      console.log('❌ Missing profile ID or scheduling information for calendar invitation');
      return;
    }

    console.log(`🗓️✉️ Sending calendar invitation`);

    // Get user's profile information
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name, timezone, phone')
      .eq('id', profileId)
      .single();

    if (profileError || !profileData || !profileData.email) {
      console.error('❌ Error fetching user profile data:', profileError);
      return;
    }

    const userEmail = profileData.email;
    const firstName = profileData.first_name || '';
    const lastName = profileData.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || userEmail;
    const userTimezone = profileData.timezone || 'UTC';
    const userPhone = profileData.phone;


    // Parse the date and time from the scheduling information
    // The time string format is expected to be "HH:MM:SS±HH:MM"
    try {
      // Combine date and time into ISO format
      // First, extract just the time part without timezone
      const timeWithoutTz = schedulingInfo.time.split(/[+-]/)[0];
      
      // Extract timezone offset if present
      let tzOffset = '+00:00'; // Default to UTC
      const tzMatch = schedulingInfo.time.match(/([+-]\d{2}:\d{2})$/);
      if (tzMatch) {
        tzOffset = tzMatch[1];
      }
      
      // Combine into ISO format
      const isoDateTime = `${schedulingInfo.date}T${timeWithoutTz}${tzOffset}`;
      
      // Parse the ISO string to a Date object
      const scheduledDate = parseISO(isoDateTime);
      
      if (isNaN(scheduledDate.getTime())) {
        throw new Error(`Invalid date time: ${isoDateTime}`);
      }
      
      console.log(`📅 Scheduled date object: ${scheduledDate.toISOString()}`);

      // Create calendar event options
      const calendarOptions: CalendarEventOptions = {
        title: 'Call with Maximo',
        description: 'Scheduled call with Maximo, your AI executive coach. Simply call the same number you used previously.',
        startTime: scheduledDate,
        durationMinutes: 30,
        attendeeEmail: userEmail,
        attendeeName: fullName,
        profileId: profileId,
        timezoneOffset: tzOffset
      };

      if (isUserRescheduling) {
        await rescheduleCalendarInvite(calendarOptions);
      } else {
        await sendCalendarInvite(calendarOptions);
      }


      if (userPhone && isScheduled) {
        setTimeout(async () => {
          await sendSMS(
            userPhone,
            `I just emailed you a calendar invite for our next call.`,
            profileId
          );
          console.log('✅ Scheduling confirmation SMS sent successfully');
        }, 10000);
      } 
      
      if (userPhone && !isScheduled) {
        setTimeout(async () => {
          await sendSMS(
            userPhone,
            `${firstName}, You are now scheduled at ${schedulingInfo.formattedDateTime}. You should've just received a calendar invitation by email.`,
            profileId
          );
          console.log('✅ Scheduling confirmation SMS sent successfully');
        }, 10000);
      }
      
      return;
    } catch (parseError) {
      console.error('❌ Error parsing date and time:', parseError);
      return;
    }
  } catch (error) {
    console.error('❌ Error in sendCalendarInvitation:', error instanceof Error ? error.message : 'Unknown error');
    return;
  }
}