import { supabaseAdmin } from '@db/supabase.js';


// Store new conversation in Supabase
export async function storeConversation(profileId: string, isScheduled: boolean): Promise<string | null> {
  try {
    const now = new Date();
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        profile_id: profileId,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString(),
        type: isScheduled ? 'max' : 'sarah'  // Set type based on whether call is scheduled
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }
    
    console.log(`✅ Created new conversation entry with type: ${isScheduled ? 'max' : 'sarah'}`);
    return data.id;
  } catch (error) {
    console.error('❌ Error creating conversation:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}