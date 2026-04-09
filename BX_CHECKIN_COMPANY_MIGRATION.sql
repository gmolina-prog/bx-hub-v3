-- ═══════════════════════════════════════════════════════════════════════════
-- BX HUB v3 — check_ins: adicionar company_id
-- Aplicar no Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

-- Índice para queries por empresa
CREATE INDEX IF NOT EXISTS idx_check_ins_company_id ON check_ins(company_id);

SELECT 'check_ins.company_id adicionado com sucesso' as result;
