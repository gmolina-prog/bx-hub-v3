-- ═══════════════════════════════════════════════════════════════════════════
-- BX HUB v3 — FIX FK CONSTRAINTS
-- Problema: profiles.id foi inserido manualmente com UUIDs arbitrários.
--           Algumas tabelas têm FK para auth.users(id), não para profiles(id).
--           Resultado: check-in e completions de rotinas falham para todos
--           exceto Gabriel (único com profile.id = auth.uid()).
--
-- INSTRUÇÃO: Supabase Dashboard → SQL Editor → colar tudo → Run
-- URL: https://supabase.com/dashboard/project/uvgkypmlrfxytknyvfdj/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CHECK_INS: user_id → auth.users ────────────────────────────────────
-- Remove FK que exige user_id ∈ auth.users
ALTER TABLE check_ins
  DROP CONSTRAINT IF EXISTS check_ins_user_id_fkey;

-- Adiciona FK para profiles(id) — garante integridade sem depender de auth.uid()
ALTER TABLE check_ins
  ADD CONSTRAINT check_ins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── 2. ROUTINE_COMPLETIONS: completed_by → auth.users ─────────────────────
ALTER TABLE routine_completions
  DROP CONSTRAINT IF EXISTS routine_completions_completed_by_fkey;

ALTER TABLE routine_completions
  ADD CONSTRAINT routine_completions_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 3. KUDOS: from_user / to_user → auth.users (se existirem) ─────────────
ALTER TABLE kudos
  DROP CONSTRAINT IF EXISTS kudos_from_user_fkey;
ALTER TABLE kudos
  DROP CONSTRAINT IF EXISTS kudos_to_user_fkey;

ALTER TABLE kudos
  ADD CONSTRAINT kudos_from_user_fkey
  FOREIGN KEY (from_user) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE kudos
  ADD CONSTRAINT kudos_to_user_fkey
  FOREIGN KEY (to_user) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── 4. NOTIFICATIONS: verificar e corrigir se necessário ──────────────────
-- (notificações já funcionam — manter como está)

-- ── 5. ATUALIZAR função auth_org_id para suportar email fallback ───────────
-- A função atual usa id = auth.uid(). Se profile.id ≠ auth.uid(),
-- retorna NULL e toda a RLS falha. Corrigir para buscar também por email.
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM profiles
  WHERE id = auth.uid()
     OR email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1)
  LIMIT 1;
$$;

-- ── 6. VERIFICAÇÃO FINAL ───────────────────────────────────────────────────
SELECT
  tc.table_name,
  tc.constraint_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name IN ('users', 'profiles')
ORDER BY tc.table_name;
