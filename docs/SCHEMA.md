# 🗄️ SCHEMA.md — Supabase do BX Hub v3

**Project**: `uvgkypmlrfxytknyvfdj`
**URL**: `https://uvgkypmlrfxytknyvfdj.supabase.co`
**Total de tabelas**: 47 (todas com `org_id` para multi-tenancy)

## Tabelas principais (com rows reais validados)

### `profiles` (10 rows)
```
id, org_id, full_name, initials, avatar_color, role, email, location
```
⚠️ **Não tem `created_at`**. Ordenar por `full_name`.
**Roles reais**: `owner`, `Gerente` (PT, G maiúsculo), `analyst`

### `companies` (4 rows)
```
id, org_id, name, trading_name, cnpj, segment, city, state,
contact_name, contact_email, contact_phone, status, criticality,
color, powerbi_link, label_ids
```
**Criticality values**: `baixo`, `medio`, `alto`, `critico`
**Empresas reais**: KIMBERLIT, Grupo Andrade, LogiSul, Rede Bella

### `projects` (6 rows)
```
id, org_id, name, type, status, progress, priority, deadline,
analyst_id, executive_id, company_id
```
⚠️ **Status mix sujo**: `active`, `Em andamento`, `Planejamento`
**Priority**: `Alta`, `Média` (PT)

### `tasks` (8 rows)
```
id, org_id, project_id, title, column_id, priority, assigned_to,
due_date, hours_logged, created_at, updated_at, deleted_at
```
**column_id**: `todo`, `doing`, `done`
**priority**: `high`, `medium`, `urgent`
Sempre filtrar `.is('deleted_at', null)` para não pegar soft-deleted.

### `proposals` (1 row)
```
id, org_id, company_id, title, value, status, service_type,
contact_name, sent_date, notes, loss_reason
```
⚠️ **`status` em PT**: `rascunho`, `enviada`, `negociando`, `aceita`, `perdida`
⚠️ **`service_type` em snake_case**: `finance_ma`, `diagnostico`, `rj`, `bpo`, `certificado_digital`

### `pipeline_items` (3 rows)
```
id, org_id, name, stage, value, probability, entity_name, institution_name,
contact_name, next_action, last_contact, expected_close, assigned_to,
cover_color, is_archived, status, company_id
```
⚠️ **`stage` em PT**: `indicacao`, `comite`, `liberado`
Sempre filtrar `.eq('is_archived', false)`.

**Deals reais**:
1. BX Outsourcing / LogiSul
2. BX Certified / KIMBERLIT
3. BX Finance / Grupo Andrade

### `client_interactions` (**NÃO** `crm_interactions`!)
```
id, org_id, company_id, type, content, contact_name, date, created_by, created_at
```

### `institutions` (3 rows)
```
id, org_id, name, type, is_active, contact_name, contact_email
```
**Instituições reais**:
- **Bradesco** — Banco Comercial
- **BNDES** — Fomento
- **Itaú BBA** — Banco de Investimento

### `activity_log` (33 rows)
```
id, org_id, entity_type, entity_id, actor_id, action, metadata,
created_at, module, details, project_id
```
`action` é texto livre ("Movido para backlog", "Movido para doing", etc.) — categorizar por heurística no client.

### `check_ins` (7 rows)
```
id, user_id, org_id, location, client_name, activity, status,
check_in_time, check_out_time, date, latitude, longitude, notes
```
⚠️ **`status`** é o tipo do check-in: `escritorio` (sem acento), `cliente`, `remoto`, `viagem`
⚠️ **`location`** é o endereço completo (string), NÃO o tipo.

### `routines` (4 rows)
```
id, org_id, assigned_to, title, frequency, is_active, project_id
```
**frequency**: `diaria`, `semanal`, `mensal`

### `routine_completions`
```
id, routine_id, completed_by, reference_date, completed_at, org_id
```

### `notes` (9 rows)
```
id, org_id, title, content, type, company_id, project_id, created_by, created_at
```

### `notifications` (27 rows)
```
id, org_id, user_id, type, title, message, read, created_at
```

### `expense_reports` (1 row)
```
id, org_id, user_id, title, status, total_value, created_at
```
**Status**: `submetido` (PT)

### `expense_items` (3 rows)
```
id, expense_report_id, category, value, description, date
```
**Category**: `material`, `refeicao`, `transporte`

## Tabelas auxiliares (sem rows ou pouco usadas)

- `kudos` — sistema de reconhecimento (vazio, mas usado pelo Time.jsx)
- `labels` — etiquetas/tags para projetos e tarefas
- `events` — eventos de calendário (usado pelo Calendar.jsx)
- `automation_rules` — regras de automação (usado pelo Automations.jsx)
- `audit_log` — auditoria de segurança (criada no Round 1, vazia, reservada)
- `integrations` — conectores externos (criada no Round 1, vazia, reservada)
- `api_tokens` — tokens de API (criada no Round 1, vazia, reservada)
- `intakes` — captação de demandas (vazio, schema rico, usado pelo Intakes.jsx)
- `time_entries` — horas registradas por user/task

## 🚨 Armadilhas do schema (que já me morderam)

1. **`profiles.created_at` NÃO EXISTE**. Ordenar por `full_name`.
2. **Role "Gerente" case-sensitive**. "gerente" não bate.
3. **`proposals.status` NÃO `stage`**. `service_type` NÃO `type`.
4. **`client_interactions` NÃO `crm_interactions`**.
5. **`check_ins.status` = tipo**, `check_ins.location` = endereço.
6. **`companies.criticality` NÃO `health`**.
7. **`pipeline_items.stage` em PT**: `comite/indicacao/liberado`.
8. **`projects.status` com mix sujo**: normalize client-side.
9. **RLS em todas as tabelas**: INSERT precisa bater `org_id = auth.uid()'s org` + `user_id = auth.uid()` quando aplicável.

## Políticas RLS conhecidas

- `check_ins` INSERT precisa `user_id = auth.uid()` E `org_id = profile.org_id`
- `profiles` UPDATE só do próprio usuário (exceto owner/Gerente)
- `activity_log` INSERT via trigger (não client direto)

### `chat_channels` (1 row real)
```
id, org_id, name, icon, description, is_general, project_id, created_at
```
Canal "Grupro Essere" existe. Criar canais adicionais via modal no Chat.

### `chat_messages` (rows reais)
```
id, org_id, channel_id, sender_id, content, reactions (jsonb),
reply_to, is_pinned, mentions (array uuid), read_by (array uuid),
created_at, updated_at
```
**Atenção:** tabela é `chat_messages`, NÃO `project_messages`.
`reactions` = { "emoji": [user_id, ...] }
