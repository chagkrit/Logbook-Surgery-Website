import { createClient } from "@supabase/supabase-js";

// The publishable key is intentionally safe for browser use; database access is
// enforced by Supabase Row Level Security policies in the migration directory.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://daiamyswpjkkgbrmovgl.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_T3VyrBrK6N71sjOGUQeJAg_Zx4tv5uI";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
