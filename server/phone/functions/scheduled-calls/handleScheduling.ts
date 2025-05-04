import { extractSchedulingInfoFromTranscription, handleExtractedSchedulingInfo, extractSchedulingInfoFromMessages } from './extractSchedulingInfo.js';
import manageScheduledCalls from './manageScheduledCalls.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

// Orchestrates the post-call scheduling process
export default async function handleScheduling(
  profileId: string,
  transcription: Transcription[],
  isScheduled: boolean
): Promise<void> {
  try {
    console.log(`🗓️ Starting post-call scheduling process`);

    // Step 1: Extract scheduling information from the conversation
    const schedulingInfo = await extractSchedulingInfoFromTranscription(profileId, transcription);
    
    if (!schedulingInfo) {
      console.log(`⚠️ No scheduling information found`);
      return;
    }
    
    console.log(`✅ Successfully extracted scheduling information: ${schedulingInfo.formattedDateTime}`);

    // Step 2: Process the extracted scheduling information
    await handleExtractedSchedulingInfo(schedulingInfo, profileId, isScheduled);

    // Step 3: Manage scheduled calls to ensure only one exists
    console.log('📝 Managing scheduled calls...');
    const managementResult = await manageScheduledCalls(profileId);
    
    if (!managementResult.success) {
      console.log(`⚠️ Warning: Failed to manage scheduled calls: ${managementResult.error}`);
      // Don't fail the whole process if management fails
    } else {
      console.log(`✅ Successfully managed scheduled calls. Removed ${managementResult.callsRemoved} older calls.`);
    }

    return;
  } catch (error) {
    console.error('❌ Error in processPostCallScheduling:', error instanceof Error ? error.message : 'Unknown error');
    return;
  }
}

// Orchestrates the SMS scheduling process
export async function handleSmsScheduling(
  profileId: string,
  message: string,
  isRescheduling: boolean
): Promise<{ success: boolean }> {
  try {
    console.log(`🗓️ Starting SMS scheduling process`);


    // Step 1: Extract scheduling information from the message
    const schedulingInfo = await extractSchedulingInfoFromMessages(profileId, message);
    
    if (!schedulingInfo || !schedulingInfo.success) {
      console.log(`⚠️ No valid scheduling information found in SMS`);
      return { success: false };
    }
    
    console.log(`✅ Successfully extracted scheduling information: ${schedulingInfo.formattedDateTime}`);

    // Step 2: Process the extracted scheduling information
    await handleExtractedSchedulingInfo(schedulingInfo, profileId, !isRescheduling);

    // Step 3: Manage scheduled calls to ensure only one exists
    console.log('📝 Managing scheduled calls...');
    const managementResult = await manageScheduledCalls(profileId);
    
    if (!managementResult.success) {
      console.log(`⚠️ Warning: Failed to manage scheduled calls: ${managementResult.error}`);
      // Don't fail the whole process if management fails
    } else {
      console.log(`✅ Successfully managed scheduled calls. Removed ${managementResult.callsRemoved} older calls.`);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error in handleSmsScheduling:', error instanceof Error ? error.message : 'Unknown error');
    return { success: false };
  }
} 