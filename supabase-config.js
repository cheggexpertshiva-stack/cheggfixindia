// ONLYUSLABS admin authentication configuration.
// This browser-side key is intended for public client use.
export const SUPABASE_URL = "https://jifyycqzulissjekigdy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_lC7BsJzxYpl2Fiw4PgF5Sg_IamEWlP-";
export const ADMIN_EMAIL = "cheggexpertshiva@gmail.com";

export const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 30 &&
  SUPABASE_ANON_KEY.startsWith("sb_publishable_");
