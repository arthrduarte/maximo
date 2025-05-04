import { supabaseAdmin } from "@db/supabase.js";

export default async function getProfileSummaries(profileId: string) {
  try {
    // Fetch short summaries
    const { data: shortSummaries, error: shortError } = await supabaseAdmin
      .from('summaries_short')
      .select('id, profile_id, conversation_id, content, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    // Fetch detailed summaries
    const { data: detailedSummaries, error: detailedError } = await supabaseAdmin
      .from('summaries_detailed')
      .select('id, profile_id, conversation_id, content, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (shortError) {
      console.error('❌ Error fetching short summaries:', shortError);
    }

    if (detailedError) {
      console.error('❌ Error fetching detailed summaries:', detailedError);
    }

    // If both queries failed, return empty array
    if (shortError && detailedError) {
      return [];
    }

    // Create a map to combine summaries by conversation_id
    const summariesMap = new Map();
    
    // Process short summaries
    if (shortSummaries) {
      shortSummaries.forEach(summary => {
        summariesMap.set(summary.conversation_id, {
          id: summary.id,
          profile_id: summary.profile_id,
          conversation_id: summary.conversation_id,
          short: summary.content,
          detailed: null,
          created_at: summary.created_at
        });
      });
    }
    
    // Process detailed summaries and merge with short summaries
    if (detailedSummaries) {
      detailedSummaries.forEach(summary => {
        const existing = summariesMap.get(summary.conversation_id);
        if (existing) {
          existing.detailed = summary.content;
        } else {
          summariesMap.set(summary.conversation_id, {
            id: summary.id,
            profile_id: summary.profile_id,
            conversation_id: summary.conversation_id,
            short: null,
            detailed: summary.content,
            created_at: summary.created_at
          });
        }
      });
    }
    
    // Convert map to array and sort by created_at
    const combinedSummaries = Array.from(summariesMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return combinedSummaries;
  } catch (error) {
    console.error('❌ Error in getProfileSummaries:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}