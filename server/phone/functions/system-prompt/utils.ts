import { supabaseAdmin } from "@db/supabase.js";

export default async function lookupCallTypeAndSchedule(profileId: string): Promise<{ isScheduled: boolean; maxCallNumber: number }> {
  try {
    if (!profileId) {
      console.log('❌ No profile ID provided for scheduled call check');
      return { isScheduled: false, maxCallNumber: 0 };
    }

    // First check if user has any previous conversations with max (scheduled calls)
    const { data: previousMaxConversations, error: historyError } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('profile_id', profileId)
      .eq('type', 'max') // Only count conversations with max
      .eq('voicemail', false);  // Only count conversations that were not voicemail

    if (historyError) {
      console.error('❌ Error checking conversation history:', historyError);
      return { isScheduled: false, maxCallNumber: 0 };
    }

    // Calculate the maxCallNumber based on previous conversations
    const maxCallNumber = previousMaxConversations?.length || 0;
    
    // If it's a discovery call (no previous max conversations), always allow it
    if (maxCallNumber === 0) {
      console.log('✅ Discovery call - treating as scheduled Max call');
      return { isScheduled: true, maxCallNumber: 0 };
    }

    // For all other calls (after discovery), check if there's a scheduled call for today
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log(`🔍 Checking for scheduled calls for profile ${profileId}`);
    console.log(`📅 Date filter: ${currentDate}`);
    console.log(`📊 Previous max conversations: ${maxCallNumber}`);

    // Query for scheduled calls on current date
    const { data: scheduledCalls, error } = await supabaseAdmin
      .from('scheduled_calls')
      .select('*')
      .eq('profile_id', profileId)
      .eq('date', currentDate);

    if (error) {
      console.error('❌ Error checking for scheduled calls:', error);
      return { isScheduled: false, maxCallNumber };
    }
    
    console.log('📊 Query results:', JSON.stringify(scheduledCalls, null, 2));

    const isScheduled = scheduledCalls && scheduledCalls.length > 0;
    console.log(`${isScheduled ? '✅' : '❌'} Call ${isScheduled ? 'is' : 'is not'} scheduled for today`);
    
    return { isScheduled, maxCallNumber };
  } catch (error) {
    console.error('❌ Error in isCallScheduled:', error instanceof Error ? error.message : 'Unknown error');
    return { isScheduled: false, maxCallNumber: 0 };
  }
} 