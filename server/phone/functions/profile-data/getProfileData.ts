import { supabaseAdmin } from "@db/supabase.js";
import { Database } from "@db/types.js";  


// Get profile data from Supabase
export default async function getProfileData(phone: string): Promise<Database['profiles'] | null> {
  try {
    // Normalize the phone number to E.164 format
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    
    // Get user's profile info with all available metadata
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError.message);
      return null;
    }

    if (!profile) {
      console.warn('⚠️ No profile found for phone:', normalizedPhone);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('❌ Error fetching profile data:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}