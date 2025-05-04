import { supabaseAdmin } from '@db/supabase.js';
import createLongSummary from './createLongSummary.js';
import createShortSummary from './createShortSummary.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

export default async function storeSummaries(
  profileId: string | null,
  conversationId: string | null,
  transcription: Transcription[]
): Promise<boolean> {
  try {
    if (!profileId || !conversationId) {
      console.log('❌ No profile ID or conversation ID provided');
      return false;
    }

    if (!transcription || transcription.length < 4) {
      console.log('❌ Conversation is too short to summarize');
      return false;
    }

    // Generate both summaries
    const [shortSummary, detailedSummary] = await Promise.all([
      createShortSummary(conversationId, transcription),
      createLongSummary(conversationId, transcription)
    ]);

    if (!shortSummary || !detailedSummary) {
      console.log('❌ Failed to generate one or both summaries');
      return false;
    }

    // Store summaries in separate tables
    const [shortResult, detailedResult] = await Promise.all([
      // Store short summary
      supabaseAdmin
        .from('summaries_short')
        .insert({
          profile_id: profileId,
          conversation_id: conversationId,
          content: shortSummary
        }),
      
      // Store detailed summary
      supabaseAdmin
        .from('summaries_detailed')
        .insert({
          profile_id: profileId,
          conversation_id: conversationId,
          content: detailedSummary
        })
    ]);

    if (shortResult.error) {
      console.error('❌ Error storing short summary:', shortResult.error);
      return false;
    }

    if (detailedResult.error) {
      console.error('❌ Error storing detailed summary:', detailedResult.error);
      return false;
    }

    console.log('✅ Successfully stored summaries');
    return true;
  } catch (error) {
    console.error('❌ Error in storeSummaries:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}
