import { createEvents, EventAttributes } from 'ics';
import { sendEmail } from '../../email.js';
import { supabaseAdmin } from '@db/supabase.js';
import { format, addMinutes, parseISO } from 'date-fns';

export interface CalendarEventOptions {
  title: string;
  description: string;
  startTime: Date;
  durationMinutes: number;
  attendeeEmail: string;
  attendeeName: string;
  profileId: string;
  timezoneOffset?: string; // Format: "-05:00" for EST, "-04:00" for EDT
  event_id?: string;
}

export async function generateIcsContent(options: CalendarEventOptions): Promise<string | null> {
  try {
 
    // Parse the timezone offset if provided
    let tzOffsetMinutes = 0;
    if (options.timezoneOffset) {
      const [hours, minutes] = options.timezoneOffset.split(':').map(Number);
      tzOffsetMinutes = (Math.abs(hours) * 60 + minutes) * (hours < 0 ? -1 : 1);
    }
    
    // Create a date object that respects the specified timezone offset
    const startDate = new Date(options.startTime);
    const systemOffset = startDate.getTimezoneOffset();
    const offsetDiff = systemOffset + tzOffsetMinutes;
    
    // Adjust the date to account for the difference between system timezone and specified timezone
    const adjustedDate = new Date(startDate.getTime() + offsetDiff * 60000);
        
    const event: EventAttributes = {
      start: [
        adjustedDate.getFullYear(),
        adjustedDate.getMonth() + 1,
        adjustedDate.getDate(),
        adjustedDate.getHours(),
        adjustedDate.getMinutes()
      ],
      startInputType: 'local',
      startOutputType: 'local',
      duration: { minutes: options.durationMinutes },
      title: options.title,
      description: options.description,
      location: 'Phone Call',
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      method: 'REQUEST',
      organizer: { name: 'Maximo Team', email: 'team@meetmaximo.com' },
      attendees: [
        { name: options.attendeeName, email: options.attendeeEmail, rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' },
        { name: 'Maximo Team', email: 'team@meetmaximo.com', rsvp: true, partstat: 'ACCEPTED', role: 'CHAIR' }
      ],
      uid: options.event_id // Set the event_id as the UID
    };

    return new Promise((resolve, reject) => {
      createEvents([event], (error, value) => {
        if (error) {
          console.error('❌ Error generating calendar event:', error);
          reject(error);
          return;
        }
        
        console.log('✅ Calendar event generated successfully');
        resolve(value);
      });
    });
  } catch (error) {
    console.error('❌ Error in generateIcsContent:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Simple event ID generator
function generateSimpleEventID(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function sendCalendarInvite(options: CalendarEventOptions): Promise<boolean> {
  try {
    // Generate or retrieve the event ID for the event
    const event_id = generateSimpleEventID();

    const icsContent = await generateIcsContent({ ...options, event_id });
    if (!icsContent) {
      console.error('❌ DEBUG: Failed to generate calendar content');
      return false;
    }
    
    // Use the specified timezone offset or get it from the date
    const timezoneName = options.timezoneOffset === '-05:00' ? 'EST' : 
                        options.timezoneOffset === '-04:00' ? 'EDT' : 
                        new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
                        
    
    // Create a date object that respects the specified timezone offset
    const startDate = new Date(options.startTime);
    if (options.timezoneOffset) {
      const [hours, minutes] = options.timezoneOffset.split(':').map(Number);
      const tzOffsetMinutes = (Math.abs(hours) * 60 + minutes) * (hours < 0 ? -1 : 1);
      const systemOffset = startDate.getTimezoneOffset();
      const offsetDiff = systemOffset + tzOffsetMinutes;
      startDate.setTime(startDate.getTime() + offsetDiff * 60000);
    }
    
    // Format times using the adjusted date
    const startTime = format(startDate, "h:mm a");
    const endTime = format(addMinutes(startDate, options.durationMinutes), "h:mm a");
    const formattedDate = format(startDate, "EEE MMM d, yyyy");
    
    const emailSubject = `INVITATION: ${options.title} @ ${formattedDate} ${startTime} - ${endTime} ${timezoneName}`;

    const emailText = `
      Hi ${options.attendeeName},

      Your call with Maximo is scheduled for ${formattedDate} at ${startTime} ${timezoneName}.

      Best regards,
      Maximo Team
          `;

          const emailHtml = `
      <p>Hi ${options.attendeeName},</p>

      <p>Your call with Maximo is scheduled for ${formattedDate} at ${startTime} ${timezoneName}.</p>

      <p>Best regards,<br>
      Maximo Team</p>
    `;

    const result = await sendEmail({
      to: options.attendeeEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      attachments: [
        {
          filename: 'invitation.ics',
          content: icsContent,
          contentType: 'text/calendar; method=REQUEST'
        }
      ]
    });

    if (result) {
      // Store the calendar invite sent status and event ID in the database
      await storeCalendarInviteSent(options.profileId, startDate, event_id);
    } else {
      console.error('❌ DEBUG: Email sending failed');
    }

    return result;
  } catch (error) {
    console.error('❌ DEBUG: Error sending calendar invite:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack available');
    return false;
  }
}

export async function rescheduleCalendarInvite(options: CalendarEventOptions): Promise<boolean> {
  try {
    // Retrieve the existing event ID for the event
    const { data: calls, error: fetchError } = await supabaseAdmin
      .from('scheduled_calls')
      .select('event_id')
      .eq('profile_id', options.profileId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('❌ Error fetching scheduled call:', fetchError);
      return false;
    }

    if (!calls || calls.length === 0 || !calls[0].event_id) {
      console.error('❌ No scheduled calls found or event ID missing for profile:', options.profileId);
      return false;
    }

    const event_id = calls[0].event_id;
    
    // Generate the ICS content with the existing event ID
    const icsContent = await generateIcsContent({ ...options, event_id });
    if (!icsContent) {
      console.error('❌ DEBUG: Failed to generate calendar content');
      return false;
    }

    // Use the specified timezone offset or get it from the date
    const timezoneName = options.timezoneOffset === '-05:00' ? 'EST' : 
                        options.timezoneOffset === '-04:00' ? 'EDT' : 
                        new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();

    // Create a date object that respects the specified timezone offset
    const startDate = new Date(options.startTime);
    if (options.timezoneOffset) {
      const [hours, minutes] = options.timezoneOffset.split(':').map(Number);
      const tzOffsetMinutes = (Math.abs(hours) * 60 + minutes) * (hours < 0 ? -1 : 1);
      const systemOffset = startDate.getTimezoneOffset();
      const offsetDiff = systemOffset + tzOffsetMinutes;
      startDate.setTime(startDate.getTime() + offsetDiff * 60000);
    }

    // Format times using the adjusted date
    const startTime = format(startDate, "h:mm a");
    const endTime = format(addMinutes(startDate, options.durationMinutes), "h:mm a");
    const formattedDate = format(startDate, "EEE MMM d, yyyy");

    const emailSubject = `UPDATED INVITATION: ${options.title} @ ${formattedDate} ${startTime} - ${endTime} ${timezoneName}`;

    const emailText = `
      Hi ${options.attendeeName},

      Your call with Maximo is rescheduled for ${formattedDate} at ${startTime} ${timezoneName}.

      Best regards,
      Maximo Team
    `;

    const emailHtml = `
      <p>Hi ${options.attendeeName},</p>

      <p>Your call with Maximo is rescheduled for ${formattedDate} at ${startTime} ${timezoneName}.</p>

      <p>Best regards,<br>
      Maximo Team</p>
    `;

    const result = await sendEmail({
      to: options.attendeeEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      attachments: [
        {
          filename: 'invitation.ics',
          content: icsContent,
          contentType: 'text/calendar; method=REQUEST'
        }
      ]
    });

    if (result) {
      // Store the calendar invite sent status in the database
      await storeCalendarInviteSent(options.profileId, startDate, event_id);
    } else {
      console.error('❌ DEBUG: Email sending failed');
    }

    return result;
  } catch (error) {
    console.error('❌ DEBUG: Error rescheduling calendar invite:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack available');
    return false;
  }
}

async function storeCalendarInviteSent(profileId: string, scheduledTime: Date, event_id: string): Promise<void> {
  try {        
    // Get the most recent scheduled call for this profile
    const { data: calls, error: fetchError } = await supabaseAdmin
      .from('scheduled_calls')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (fetchError) {
      console.error('❌ Error fetching scheduled call:', fetchError);
      return;
    }
    
    if (!calls || calls.length === 0) {
      console.error('❌ No scheduled calls found for profile:', profileId);
      return;
    }
    
    // Update the calendar_invite_sent status and event ID
    const { error } = await supabaseAdmin
      .from('scheduled_calls')
      .update({ calendar_invite_sent: true, event_id })
      .eq('id', calls[0].id);

    if (error) {
      console.error('❌ Error updating calendar invite sent status:', error);
    } else {
      console.log('✅ Calendar invite sent status and event ID updated successfully for call ID:', calls[0].id);
    }
  } catch (error) {
    console.error('❌ Error in storeCalendarInviteSent:', error instanceof Error ? error.message : 'Unknown error');
  }
} 