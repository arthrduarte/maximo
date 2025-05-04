import { supabaseAdmin } from "@db/supabase.js";

export default async function getProfileEntities(profileId: string): Promise<string[]> {
  try {
    const { data: entities, error } = await supabaseAdmin
      .from('entities')
      .select('content')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching previous entities:', error);
      return [];
    }

    return entities.map(entity => entity.content);
  } catch (error) {
    console.error('❌ Error in getProfileEntities:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

