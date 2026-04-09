-- ═══════════════════════════════════════════════════════════════════════════
-- BX HUB v3 — ROW LEVEL SECURITY POLICIES
-- Gerado em: 2026-04-09
-- 
-- INSTRUÇÃO: Abrir Supabase Dashboard → SQL Editor → colar tudo → Run
-- URL: https://supabase.com/dashboard/project/uvgkypmlrfxytknyvfdj/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- ── HELPER: função que retorna o org_id do usuário logado ─────────────────
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 1. HABILITAR RLS ───────────────────────────────────────────────────────
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE intakes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log        ENABLE ROW LEVEL SECURITY;

-- ── 2. LIMPAR POLICIES EXISTENTES (se houver) ─────────────────────────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname
           FROM pg_policies
           WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── 3. POLICIES POR TABELA ────────────────────────────────────────────────
-- Padrão: usuário logado só vê/altera dados da própria org_id
-- Para profiles: pode ver todos da mesma org; só altera o próprio

-- tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  USING (org_id = auth_org_id());

-- companies
CREATE POLICY "companies_select" ON companies FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "companies_insert" ON companies FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "companies_update" ON companies FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "companies_delete" ON companies FOR DELETE
  USING (org_id = auth_org_id());

-- projects
CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (org_id = auth_org_id());

-- profiles: ver toda a equipe, mas só alterar o próprio perfil (ou ser owner/Gerente)
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (
    org_id = auth_org_id() AND (
      id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles p2
        WHERE p2.id = auth.uid()
          AND p2.role IN ('owner', 'Gerente')
      )
    )
  );
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (
    org_id = auth_org_id() AND
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'owner'
    )
  );

-- pipeline_items
CREATE POLICY "pipeline_items_select" ON pipeline_items FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "pipeline_items_insert" ON pipeline_items FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "pipeline_items_update" ON pipeline_items FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "pipeline_items_delete" ON pipeline_items FOR DELETE
  USING (org_id = auth_org_id());

-- notes
CREATE POLICY "notes_select" ON notes FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "notes_insert" ON notes FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "notes_update" ON notes FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "notes_delete" ON notes FOR DELETE
  USING (org_id = auth_org_id());

-- risks
CREATE POLICY "risks_select" ON risks FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "risks_insert" ON risks FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "risks_update" ON risks FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "risks_delete" ON risks FOR DELETE
  USING (org_id = auth_org_id());

-- expense_reports
CREATE POLICY "expense_reports_select" ON expense_reports FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "expense_reports_insert" ON expense_reports FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "expense_reports_update" ON expense_reports FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "expense_reports_delete" ON expense_reports FOR DELETE
  USING (org_id = auth_org_id());

-- expense_items (sem org_id direto — join via expense_reports)
CREATE POLICY "expense_items_select" ON expense_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM expense_reports r
            WHERE r.id = expense_items.report_id
              AND r.org_id = auth_org_id())
  );
CREATE POLICY "expense_items_insert" ON expense_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM expense_reports r
            WHERE r.id = expense_items.report_id
              AND r.org_id = auth_org_id())
  );
CREATE POLICY "expense_items_update" ON expense_items FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM expense_reports r
            WHERE r.id = expense_items.report_id
              AND r.org_id = auth_org_id())
  );
CREATE POLICY "expense_items_delete" ON expense_items FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM expense_reports r
            WHERE r.id = expense_items.report_id
              AND r.org_id = auth_org_id())
  );

-- notifications: ver só as próprias
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (org_id = auth_org_id() AND user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (org_id = auth_org_id() AND user_id = auth.uid());
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  USING (org_id = auth_org_id() AND user_id = auth.uid());

-- routines
CREATE POLICY "routines_select" ON routines FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "routines_insert" ON routines FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "routines_update" ON routines FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "routines_delete" ON routines FOR DELETE
  USING (org_id = auth_org_id());

-- routine_completions
CREATE POLICY "routine_completions_select" ON routine_completions FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "routine_completions_insert" ON routine_completions FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "routine_completions_update" ON routine_completions FOR UPDATE
  USING (org_id = auth_org_id());
CREATE POLICY "routine_completions_delete" ON routine_completions FOR DELETE
  USING (org_id = auth_org_id() AND completed_by = auth.uid());

-- chat_channels
CREATE POLICY "chat_channels_select" ON chat_channels FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "chat_channels_insert" ON chat_channels FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "chat_channels_update" ON chat_channels FOR UPDATE
  USING (org_id = auth_org_id());
CREATE POLICY "chat_channels_delete" ON chat_channels FOR DELETE
  USING (org_id = auth_org_id());

-- chat_messages
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "chat_messages_update" ON chat_messages FOR UPDATE
  USING (org_id = auth_org_id() AND sender_id = auth.uid());
CREATE POLICY "chat_messages_delete" ON chat_messages FOR DELETE
  USING (org_id = auth_org_id() AND sender_id = auth.uid());

-- intakes
CREATE POLICY "intakes_select" ON intakes FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "intakes_insert" ON intakes FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "intakes_update" ON intakes FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "intakes_delete" ON intakes FOR DELETE
  USING (org_id = auth_org_id());

-- automation_rules
CREATE POLICY "automation_rules_select" ON automation_rules FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "automation_rules_insert" ON automation_rules FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "automation_rules_update" ON automation_rules FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "automation_rules_delete" ON automation_rules FOR DELETE
  USING (org_id = auth_org_id());

-- client_interactions
CREATE POLICY "client_interactions_select" ON client_interactions FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "client_interactions_insert" ON client_interactions FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "client_interactions_update" ON client_interactions FOR UPDATE
  USING (org_id = auth_org_id());
CREATE POLICY "client_interactions_delete" ON client_interactions FOR DELETE
  USING (org_id = auth_org_id());

-- proposals
CREATE POLICY "proposals_select" ON proposals FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "proposals_insert" ON proposals FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "proposals_update" ON proposals FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "proposals_delete" ON proposals FOR DELETE
  USING (org_id = auth_org_id());

-- check_ins
CREATE POLICY "check_ins_select" ON check_ins FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "check_ins_insert" ON check_ins FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "check_ins_update" ON check_ins FOR UPDATE
  USING (org_id = auth_org_id() AND user_id = auth.uid());
CREATE POLICY "check_ins_delete" ON check_ins FOR DELETE
  USING (org_id = auth_org_id() AND user_id = auth.uid());

-- kudos
CREATE POLICY "kudos_select" ON kudos FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "kudos_insert" ON kudos FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "kudos_delete" ON kudos FOR DELETE
  USING (org_id = auth_org_id() AND from_user = auth.uid());

-- events
CREATE POLICY "events_select" ON events FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "events_update" ON events FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY "events_delete" ON events FOR DELETE
  USING (org_id = auth_org_id());

-- activity_log (append-only por usuários, leitura da org)
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());

-- ── FIM ────────────────────────────────────────────────────────────────────
SELECT 'RLS policies aplicadas com sucesso: ' || count(*) || ' policies'
FROM pg_policies WHERE schemaname = 'public';
