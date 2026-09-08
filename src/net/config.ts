/** Supabase project (publishable key: safe to ship in the client). */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://uzzjudrpppnohpocttjn.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_WkJFs_0EwRjuJRq6zACfbA_pJKBcIwz';
export const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/potty`;

export const CLAIM_RADIUS_M = 50;
export const DWELL_SECONDS = 20;
