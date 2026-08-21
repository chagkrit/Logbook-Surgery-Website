import { createClient } from "@supabase/supabase-js";

// The publishable key is intentionally safe for browser use; database access is
// enforced by Supabase Row Level Security policies in the migration directory.
// Do not provide a fallback project here: a missing environment variable must
// fail closed instead of silently connecting this app to another department.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const retiredSharedProjectRef = "daiamyswpjkkgbrmovgl";

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing Surgery Logbook Supabase environment variables");
}

if (supabaseUrl.includes(retiredSharedProjectRef)) {
  throw new Error("Surgery Logbook cannot use the Breast Surgery Supabase project");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
