// ─── Activity Log Helper ────────────────────────────────────────────────────
// Grava ações no activity_log sem bloquear o fluxo principal
export async function logActivity(supabase, { org_id, actor_id, entity_type, entity_id, action, module, metadata = {} }) {
  try {
    await supabase.from('activity_log').insert({
      org_id, actor_id, entity_type, entity_id,
      action, module,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Silencioso — log não deve quebrar fluxo principal
    console.warn('[ActivityLog]', err.message)
  }
}
