import { supabaseAdmin } from "@db/supabase.js";

export default async function getProfileSmsSummaries(profileId: string): Promise<string[]> {
  try {
    const { data: smsSummaries, error } = await supabaseAdmin
      .from('summaries_sms')
      .select('content, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching SMS summaries:', error);
      return [];
    }

    return (smsSummaries || []).map(summary => summary.content);
  } catch (error) {
    console.error('❌ Error in getProfileSmsSummaries:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
} 