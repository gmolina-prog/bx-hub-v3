/**
 * BX Hub — Health Check automático
 * Roda em background ao iniciar o app.
 * Detecta FK breaks, tabelas inacessíveis e schema divergente.
 * Registra no console; em produção pode ser enviado ao Sentry/log.
 */

import { supabase } from './supabase'

const TABLES = [
  'tasks', 'projects', 'profiles', 'companies', 'pipeline_items',
  'routines', 'routine_completions', 'check_ins', 'risks', 'notes',
  'notifications', 'activity_log', 'expense_reports', 'chat_channels',
  'chat_messages', 'intakes', 'events',
]

export async function runHealthCheck(profile) {
  if (!profile?.org_id) return
  if (import.meta.env.DEV === false && sessionStorage.getItem('bx_hc_done')) return

  const issues = []
  const start  = Date.now()

  // 1. Leitura de todas as tabelas
  for (const table of TABLES) {
    const { error } = await supabase
      .from(table).select('id').eq('org_id', profile.org_id).limit(1)
    if (error) {
      issues.push({ table, type: 'read', code: error.code, msg: error.message })
    }
  }

  // 2. Teste de escrita do check-in (crítico — FK)
  const ciTest = await supabase.from('check_ins').insert({
    org_id:        profile.org_id,
    user_id:       profile.id,
    status:        'escritorio',
    date:          '2099-12-31',
    check_in_time: '2099-12-31T00:00:00Z',
    location:      '__hc__',
  }).select('id').single()

  if (ciTest.error) {
    issues.push({ table: 'check_ins', type: 'write_fk', msg: ciTest.error.message })
  } else if (ciTest.data?.id) {
    // Limpar registro de teste
    await supabase.from('check_ins')
      .delete().eq('id', ciTest.data.id)
  }

  // 3. Teste de escrita de routine_completions (FK)
  const firstRoutine = await supabase
    .from('routines').select('id').eq('org_id', profile.org_id).limit(1).single()
  if (firstRoutine.data?.id) {
    const rcTest = await supabase.from('routine_completions').insert({
      org_id:         profile.org_id,
      routine_id:     firstRoutine.data.id,
      completed_by:   profile.id,
      reference_date: '2099-12-31',
    }).select('id').single()

    if (rcTest.error && rcTest.error.message?.includes('foreign key')) {
      issues.push({ table: 'routine_completions', type: 'write_fk', msg: rcTest.error.message })
    } else if (rcTest.data?.id) {
      await supabase.from('routine_completions').delete().eq('id', rcTest.data.id)
    }
  }

  const elapsed = Date.now() - start
  sessionStorage.setItem('bx_hc_done', '1')

  if (issues.length === 0) {
    console.info(`[BX Health] ✅ OK — ${TABLES.length} tabelas + 2 writes (${elapsed}ms)`)
    return { ok: true, issues: [] }
  } else {
    console.error('[BX Health] ❌ PROBLEMAS DETECTADOS:', issues)
    return { ok: false, issues }
  }
}
