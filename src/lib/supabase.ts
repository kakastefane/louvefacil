import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isConfigured } from './env'

let client: SupabaseClient | null = null

/** Client único do Supabase; `null` quando o projeto não está configurado. */
export function getSupabase(): SupabaseClient | null {
  if (!isConfigured) return null
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

/** Como `getSupabase`, mas lança se não configurado (uso em mutações). */
export function requireSupabase(): SupabaseClient {
  const c = getSupabase()
  if (!c) throw new Error('not_configured')
  return c
}
