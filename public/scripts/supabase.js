// Initialize Supabase client
if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    console.error('Missing Supabase configuration. Make sure SUPABASE_URL and SUPABASE_KEY are set.');
}

export const supabase = window.supabase.createClient(
    window.SUPABASE_URL || '',
    window.SUPABASE_KEY || ''
);
