import { supabaseAdmin } from "@db/supabase.js";

export default async function getProfileMaxConversations(profileId: string) {
  try {
      const { data: previousMaxConversations, error } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('profile_id', profileId)
      .eq('type', 'max')
      .eq('voicemail', false);
  
    if (error) throw error;

    return previousMaxConversations;
  } catch (error) {
    console.error('Error in getProfileMaxConversations:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}