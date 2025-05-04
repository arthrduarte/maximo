import { supabaseAdmin } from '@db/supabase.js';
import createSmsSummary from './createSmsSummary.js';

export default async function storeSmsSummary(
  profileId: string
): Promise<boolean> {
  try {
    console.log('🔍 storeSmsSummary called for profile:', profileId);
    
    if (!profileId) {
      console.log('❌ No profile ID provided');
      return false;
    }

    // Get total count of messages for this profile
    console.log('📊 Counting messages for profile:', profileId);
    const { count, error: countError } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId);

    if (countError) {
      console.error('❌ Error counting messages:', countError);
      return false;
    }

    console.log(`📊 Found ${count || 0} messages for profile:`, profileId);

    if (!count || count < 10) {
      console.log(`❌ Not enough messages to summarize (${count || 0} < 10)`);
      return false;
    }

    // Get count of existing summaries for this profile
    console.log('📊 Counting existing SMS summaries for profile:', profileId);
    const { count: summaryCount, error: summaryCountError } = await supabaseAdmin
      .from('summaries_sms')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId);

    if (summaryCountError) {
      console.error('❌ Error counting summaries:', summaryCountError);
      return false;
    }

    const existingSummaries = summaryCount || 0;
    console.log(`📊 Found ${existingSummaries} existing SMS summaries for profile:`, profileId);
    
    const messagesPerSummary = 10;
    
    // Calculate how many new summaries we need to create
    const totalSummariesNeeded = Math.floor(count / messagesPerSummary);
    const newSummariesNeeded = totalSummariesNeeded - existingSummaries;
    
    console.log(`📊 Calculation: Total summaries needed = ${totalSummariesNeeded}, New summaries needed = ${newSummariesNeeded}`);

    if (newSummariesNeeded <= 0) {
      console.log('✅ No new summaries needed');
      return true;
    }

    console.log(`📊 Creating ${newSummariesNeeded} new SMS summaries`);

    // Create each new summary
    for (let i = 0; i < newSummariesNeeded; i++) {
      const startIndex = existingSummaries * messagesPerSummary;
      const endIndex = startIndex + messagesPerSummary - 1;
      
      console.log(`📝 Generating summary ${i+1}/${newSummariesNeeded} for messages ${startIndex}-${endIndex}`);

      // Generate summary for this batch of messages
      const summary = await createSmsSummary(
        profileId,
        startIndex,
        endIndex
      );

      if (!summary) {
        console.error(`❌ Failed to generate summary for messages ${startIndex}-${endIndex}`);
        continue;
      }
      
      console.log(`📝 Successfully generated summary: "${summary.substring(0, 50)}..."`);

      // Store the summary
      console.log(`💾 Storing SMS summary in database for profile:`, profileId);
      const { error: insertError } = await supabaseAdmin
        .from('summaries_sms')
        .insert({
          profile_id: profileId,
          content: summary
        });

      if (insertError) {
        console.error('❌ Error storing SMS summary:', insertError);
        return false;
      }
      
      console.log(`✅ Successfully stored SMS summary ${i+1}/${newSummariesNeeded}`);
    }

    console.log('✅ Successfully stored all SMS summaries');
    return true;
  } catch (error) {
    console.error('❌ Error in storeSmsSummary:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack available');
    return false;
  }
} 