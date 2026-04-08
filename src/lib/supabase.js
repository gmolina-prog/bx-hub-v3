import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uvgkypmlrfxytknyvfdj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  console.warn('[BX Hub] VITE_SUPABASE_ANON_KEY não configurado. Configure o arquivo .env baseado em .env.example')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder')
