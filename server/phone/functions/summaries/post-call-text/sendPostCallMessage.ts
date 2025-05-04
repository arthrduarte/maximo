import { sendSMS } from '../../../messages/services/sms.service.js';
import createPostCallMessage from './createPostCallMessage.js';
import extractActionItems from './extractActionItems.js';
import { supabaseAdmin } from '@db/supabase.js';

interface Transcription {
  text: string;
  speaker: string;
  timestamp: number;
}

// Orchestrate the post-call message (aka summaries all the women love)
export default async function sendPostCallMessage(
  profileId: string,
  conversationId: string,
  phone: string,
  transcription: Transcription[]
): Promise<void> {
  try {   
    console.log('💧 Sending post-call message');

    const actionItems = await extractActionItems(conversationId, profileId, transcription);
    const summary = await createPostCallMessage(transcription, actionItems);
    
    if (!summary) {
      console.error('❌ Failed to generate summary');
      return;
    }

    // Split the summary into sections
    const [firstSection, secondSection] = summary.split('===').map(section => section.trim());
    
    if (!firstSection || !secondSection) {
      console.error('❌ Summary sections not properly formatted');
      return;
    }

    // Send the messages with a small delay between them
    await sendSMS(phone, firstSection, profileId);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between messages
    await sendSMS(phone, secondSection, profileId);
    
    console.log('💧✅ Sent post-call messages successfully');

  } catch (error) {
    console.error('💧❌ Error in sendPostCallMessage:', error instanceof Error ? error.message : 'Unknown error');
  }
} 