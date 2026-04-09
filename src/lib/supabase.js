import { createClient } from '@supabase/supabase-js'

// Credenciais do projeto uvgkypmlrfxytknyvfdj
// Fallback hardcoded garante que o client sempre funciona
const SUPABASE_URL = 'https://uvgkypmlrfxytknyvfdj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Z2t5cG1scmZ4eXRrbnl2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTE1MjQsImV4cCI6MjA5MDI4NzUyNH0.G2Zt-1WsGKl8GGdS-mC37EhCh9XnnlqO-lwhvPcNAno'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
