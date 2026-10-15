export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
export const HAS_BACKEND = Boolean(SUPABASE_URL && SUPABASE_KEY);
