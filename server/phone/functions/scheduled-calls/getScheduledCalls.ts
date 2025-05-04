import { supabaseAdmin } from "@db/supabase.js";
import { DateTime } from 'luxon';

/**
 * Retrieves all scheduled calls for a user
 * @param profileId The profile ID to get scheduled calls for
 * @returns An array of scheduled call information with formatted date/time
 */
export default async function getScheduledCalls(profileId: string) {
  try {
    if (!profileId) {
      console.log('❌ No profile ID provided for retrieving scheduled calls');
      return null;
    }

    console.log(`🔍 Retrieving scheduled calls for profile ${profileId}`);

    const now = DateTime.utc();
    
    const { data: scheduledCalls, error } = await supabaseAdmin
      .from('scheduled_calls')
      .select('*')
      .eq('profile_id', profileId)

    if (error) {
      console.error('❌ Error fetching scheduled calls:', error);
      return null;
    }

    console.log('scheduledCalls', scheduledCalls);

    if (!scheduledCalls || scheduledCalls.length === 0) {
      console.log('ℹ️ No scheduled calls found for this user');
      return null;
    }

    // Format the date and time with proper timezone handling
    const call = scheduledCalls[0];
    
    // Parse the time string to extract the timezone offset
    const timeMatch = call.time.match(/(\d{2}:\d{2}:\d{2})([-+]\d{2})/);
    if (!timeMatch) {
      console.error('❌ Invalid time format:', call.time);
      return null;
    }
    
    const [_, timeStr, offsetHours] = timeMatch;
    const offset = `${offsetHours}:00`; // Convert -04 to -04:00 format
    
    // Create DateTime object with the correct timezone
    const dateTime = DateTime.fromISO(`${call.date}T${timeStr}`, {
      zone: `UTC${offset}`
    });

    // Check if the call is in the past
    if (dateTime < now) {
      console.log('ℹ️ Call is in the past, considering as no scheduled calls');
      return null;
    }

    // Format with timezone abbreviation (e.g., "March 19 at 6:00 PM")
    const formattedDateTime = dateTime.toFormat('MMMM d \'at\' h:mm a');

    return {
      ...call,
      formatted_datetime: formattedDateTime
    };
  } catch (error) {
    console.error('❌ Error in getScheduledCalls:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
} 