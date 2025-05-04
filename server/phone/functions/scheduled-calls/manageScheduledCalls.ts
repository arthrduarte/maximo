import { supabaseAdmin } from "@db/supabase.js";

/**
 * Manages scheduled calls for a user by keeping only the most recent one
 * This function is called at the end of a call to ensure we don't have multiple
 * scheduled calls for the same user
 * 
 * @param profileId The profile ID to manage scheduled calls for
 * @returns An object indicating success and how many calls were removed
 */
export default async function manageScheduledCalls(profileId: string): Promise<{ 
  success: boolean; 
  callsRemoved: number;
  error?: string;
}> {
  try {
    if (!profileId) {
      console.log('❌ No profile ID provided for scheduled call management');
      return { success: false, callsRemoved: 0, error: 'No profile ID provided' };
    }

    console.log(`🔍 Managing scheduled calls for profile ${profileId}`);

    // Get all scheduled calls for this user, ordered by creation date (newest first)
    const { data: scheduledCalls, error } = await supabaseAdmin
      .from('scheduled_calls')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching scheduled calls:', error);
      return { 
        success: false, 
        callsRemoved: 0, 
        error: `Error fetching scheduled calls: ${error.message}` 
      };
    }

    // If there are 0 or 1 scheduled calls, no action needed
    if (!scheduledCalls || scheduledCalls.length <= 1) {
      console.log(`✅ No action needed - user has ${scheduledCalls?.length || 0} scheduled calls`);
      return { success: true, callsRemoved: 0 };
    }

    // Keep the most recent call (index 0) and delete the rest
    const callsToRemove = scheduledCalls.slice(1);
    const callIdsToRemove = callsToRemove.map(call => call.id);
    
    console.log(`🗑️ Removing ${callIdsToRemove.length} older scheduled calls`);
    console.log(`📅 Keeping most recent call scheduled for ${scheduledCalls[0].date} at ${scheduledCalls[0].time}`);

    // Delete the older scheduled calls
    const { error: deleteError } = await supabaseAdmin
      .from('scheduled_calls')
      .delete()
      .in('id', callIdsToRemove);

    if (deleteError) {
      console.error('❌ Error deleting older scheduled calls:', deleteError);
      return { 
        success: false, 
        callsRemoved: 0, 
        error: `Error deleting older scheduled calls: ${deleteError.message}` 
      };
    }

    console.log(`✅ Successfully removed ${callIdsToRemove.length} older scheduled calls`);
    return { success: true, callsRemoved: callIdsToRemove.length };
  } catch (error) {
    console.error('❌ Error in manageScheduledCalls:', error instanceof Error ? error.message : 'Unknown error');
    return { 
      success: false, 
      callsRemoved: 0, 
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
} 