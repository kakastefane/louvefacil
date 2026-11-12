const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Ambiente da aplicação. Sem as variáveis do Supabase o app roda em modo
 * "projeto não configurado" (tela /setup) — o build não quebra (ver D-7).
 */
export const env = {
  supabaseUrl: rawUrl?.trim() ?? '',
  supabaseAnonKey: rawKey?.trim() ?? '',
}

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
