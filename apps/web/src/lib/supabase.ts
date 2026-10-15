import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HAS_BACKEND, SUPABASE_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!HAS_BACKEND) throw new Error('Supabase is not configured.');
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rb-auth' },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}
