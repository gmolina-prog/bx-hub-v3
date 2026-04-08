# 🧭 CLAUDE_ENTRY_POINT.md — Leia isto PRIMEIRO

> **Este arquivo existe para resolver um problema real:** Claude (eu) esquece entre sessões que o BX Hub v3 já foi construído. Em sessões passadas, gastei ~30 mensagens "reconstruindo" coisas que já estavam aqui no filesystem. O Gabriel perdeu a paciência — com razão. Esse arquivo é o contrato: **se você é Claude e está vendo isso numa nova conversa sobre BX Hub v3, PARE e leia tudo antes de fazer qualquer coisa.**

---

## ✅ ÚLTIMA AUDITORIA: 2026-04-08 — BUILD VALIDADO

**Estado confirmado por `npm run build` executado em 2026-04-08:**
- ✅ 1570 módulos transformados, 0 erros
- ✅ Bundle: 622 KB JS + 28 KB CSS (gzip: 156 KB + 6 KB)
- ✅ 11 módulos COMPLETOS (7.511 linhas): Admin, Automations, BI, CRM, Cadastro, Calendar, Captacao, Intakes, Logs, Produtividade, Time
- 🟡 11 módulos PLACEHOLDER (32 linhas cada — navegáveis, estrutura preservada): Dashboard, Portfolio, Notas, Kanban, Timeline, Riscos, Rotinas, Chat, Reembolsos, Notificacoes, Configuracoes
- 📄 **Leia `INVENTARIO.md` ao lado deste arquivo** para a auditoria completa

**Próxima ação recomendada:** deploy via Git→Vercel (ver `DEPLOY.md`). NÃO usar `vercel deploy --prod` avulso — causou perda do código-fonte em sessão anterior.

---

## ⚡ O que você precisa saber em 30 segundos

- **Usuário**: Gabriel Molina, Managing Partner BX Group (São Paulo). Managing partner de 3 subsidiárias: BX Finance (advisory/RJ/M&A), BX Outsourcing (BPO), BX Certified.
- **Projeto**: BX Hub v3 — React + Vite + Tailwind + Supabase, deploy em `bx-hub-v3.vercel.app`
- **Status atual**: Projeto React completo, 25 componentes, build validado, pronto pra deploy
- **Localização canônica**: `/mnt/user-data/outputs/bx-hub-v3-master/` (persiste entre sessões)
- **Repo GitHub**: `gmolina-prog/bx-hub-v3` (público)
- **Supabase**: `https://uvgkypmlrfxytknyvfdj.supabase.co` · 47 tabelas com `org_id` multi-tenant
- **Stack rules**: ES5-compatible JSX, Tailwind, sem arrow functions fora do fluxo JSX, Montserrat font, paleta charcoal `#2D2E39` + violet `#5452C1`

---

## 🚫 O que você NÃO deve fazer (lições das sessões passadas)

1. **NÃO** recomeçar do zero. O projeto existe. Leia o filesystem primeiro.
2. **NÃO** reconstruir componentes do transcript. Eles já foram extraídos.
3. **NÃO** tentar browser automation (StackBlitz, Canvas, GitHub Import via UI). Tudo isso falhou ou foi extremamente lento em sessões anteriores. Use **bash + create_file**.
4. **NÃO** deployar via `vercel deploy --prod` direto. Usar Git → Vercel auto-deploy.
5. **NÃO** assumir schema do Supabase — ele está documentado abaixo.
6. **NÃO** usar arrow functions inline se isso quebrar compat do projeto original monkey-patched. **MAS**: no projeto v3 atual, código moderno (arrow functions, template literals) é OK — a regra ES5-only era do Hub legado (HumanaHub).

---

## ✅ Inventário: o que existe em `/mnt/user-data/outputs/bx-hub-v3-master/`

### Raiz do projeto Vite (12 arquivos)
```
package.json · vite.config.js · tailwind.config.js · postcss.config.js
index.html · .gitignore · .env.example
CLAUDE_ENTRY_POINT.md (este arquivo)
README.md · DEPLOY.md
```

### `src/` (estrutura React padrão)
```
src/
├── main.jsx              # Entry point, BrowserRouter + DataProvider
├── App.jsx               # 22 rotas + auth guard
├── index.css             # Tailwind directives + Montserrat font
├── lib/
│   └── supabase.js       # Cliente Supabase (env vars VITE_SUPABASE_*)
├── contexts/
│   └── DataContext.jsx   # Session + profile + loadProfile
└── components/
    ├── Layout.jsx        # Sidebar + main container
    ├── Sidebar.jsx       # 5 seções · 21 itens de nav
    ├── Login.jsx         # email+password via supabase.auth
    │
    ├── [11 COMPONENTES PRONTOS — validados contra schema real]
    ├── Admin.jsx         (646L) Rounds 1-3
    ├── Automations.jsx   (587L)
    ├── CRM.jsx           (828L)
    ├── Cadastro.jsx      (773L)
    ├── Calendar.jsx      (618L)
    ├── Logs.jsx          (560L)
    ├── Produtividade.jsx (711L) Round 4
    ├── Time.jsx          (739L)
    ├── BI.jsx            (678L)
    ├── Captacao.jsx      (704L) Round 5
    ├── Intakes.jsx       (667L)
    │
    └── [11 PLACEHOLDERS — Round 6, estrutura mínima funcional]
        Dashboard.jsx · Portfolio.jsx · Notas.jsx · Kanban.jsx
        Timeline.jsx · Riscos.jsx · Rotinas.jsx · Chat.jsx
        Reembolsos.jsx · Notificacoes.jsx · Configuracoes.jsx
```

**Total de código React**: ~7.720 linhas de código real + 11 placeholders funcionais.

### `mockups/` (21 arquivos de referência)
HTML standalone de cada módulo, criados nas primeiras sessões como design reference. **São apenas referência visual** — não são usados em build. Usar pra consultar design/layout quando enriquecer os placeholders no Round 6.

### `docs/` (documentação consolidada)
- `SCHEMA.md` — schema completo das 47 tabelas Supabase
- `HISTORY.md` — histórico das 10+ sessões anteriores
- `ROUNDS.md` — o que foi entregue em cada round
- `DEPLOY.md` — instruções de deploy

---

## 🗺️ Roteamento (22 rotas) — Sidebar v3

### PRINCIPAL
- `/` → Dashboard (placeholder)
- `/portfolio` → Portfolio (placeholder)
- `/produtividade` → Produtividade ✅
- `/notas` → Notas & Reuniões (placeholder)

### EXECUÇÃO
- `/kanban` → Kanban (placeholder)
- `/timeline` → Timeline (placeholder)
- `/riscos` → Riscos (placeholder)
- `/captacao` → Captação ✅
- `/bi` → BI ✅
- `/rotinas` → Rotinas (placeholder)

### COMERCIAL
- `/crm` → CRM ✅
- `/intakes` → Intakes ✅

### EQUIPE
- `/chat` → Chat (placeholder)
- `/calendario` → Calendar ✅
- `/time` → Time ✅
- `/reembolsos` → Reembolsos (placeholder)

### CONFIGURAÇÃO (separador visual no Sidebar — `border-t`)
- `/cadastro` → Cadastro ✅
- `/automacoes` → Automations ✅
- `/admin` → Admin ✅
- `/logs` → Logs ✅
- `/notificacoes` → Notificações (placeholder)
- `/configuracoes` → Configurações (placeholder)

✅ = componente real, lê dados do Supabase
Placeholder = aguarda enriquecimento no Round 6

---

## 🗄️ Schema Supabase (resumido — ver `docs/SCHEMA.md` para completo)

**Project**: `uvgkypmlrfxytknyvfdj` · **URL**: `https://uvgkypmlrfxytknyvfdj.supabase.co`

### Tabelas principais com rows validados
- `profiles` (10) — **SEM `created_at`**, ordenar por `full_name`. Roles reais: `owner`, `Gerente` (PT, G maiúsculo), `analyst`
- `companies` (4) — `criticality` (`alto`/`critico`), `powerbi_link` opcional
- `projects` (6) — `status` mix sujo: `active`, `Em andamento`, `Planejamento`
- `tasks` (8) — `column_id`: `todo/doing/done`, `priority`: `high/medium/urgent`
- `proposals` (1) — `status` em PT (`enviada`), `service_type` snake_case (`finance_ma`)
- `pipeline_items` (3) — `stage`: `comite`, `indicacao`, `liberado` (PT)
- `routines` (4) — `frequency`: `diaria/semanal/mensal`, filtrar `is_active=true`
- `activity_log` (33) — `entity_type`, `actor_id`, `action` (texto livre)
- `check_ins` (7) — `status`: `escritorio` (sem acento), `location` = endereço completo
- `institutions` (3) — Bradesco (Banco Comercial), BNDES (Fomento), Itaú BBA (Investimento)
- `notes` (9) · `notifications` (27) · `expense_reports` (1) · `expense_items` (3)
- `client_interactions` (NÃO `crm_interactions`)

### Armadilhas do schema que me mordem sempre
1. `profiles` NÃO TEM `created_at`. Ordenar por `full_name`.
2. Role "Gerente" é com G maiúsculo em PT. Case-sensitive.
3. `proposals.status` não `stage`. `service_type` não `type`.
4. Tabela é `client_interactions`, NÃO `crm_interactions`.
5. `check_ins.status` é o tipo (`escritorio`), não a `location` (que é endereço).
6. `companies.criticality`, NÃO `health`.
7. `pipeline_items.stage` em PT: `comite/indicacao/liberado` — não em inglês.
8. `projects.status` tem mix sujo — normalize no filtro client-side se precisar.

---

## 🎨 Design system (não negociável)

### Cores (tailwind.config.js)
```js
charcoal: '#2D2E39'      // primário (sidebar, heros, headers)
violet:   '#5452C1'      // destaque (buttons, links, tabs ativos)
gray:     '#F2F2F2'      // background principal
```

### Tipografia
- **Fonte única**: Montserrat (importada no index.html via Google Fonts)
- **Hierarquia**: `font-bold` para títulos, `font-semibold` para subtítulos, `font-normal` para corpo

### Padrões visuais recorrentes
- **Hero charcoal**: `bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white`
- **KPIs no hero**: `bg-white/5 border border-white/10 rounded-lg p-3` com texto accent colorido
- **Cards de conteúdo**: `bg-white border border-zinc-200 rounded-xl p-5`
- **Empty states**: ícone `w-12 h-12 text-zinc-300` + título bold + mensagem explicativa
- **Tabelas**: `thead bg-zinc-800 text-white` + `tbody divide-y divide-zinc-100`
- **Badges de status**: pills com `uppercase tracking-wide` + cores por categoria
- **Sidebar itens ativos**: `bg-violet text-white font-semibold`
- **Sidebar itens inativos**: `text-white text-opacity-55 hover:text-opacity-90 hover:bg-white hover:bg-opacity-5`

---

## 🚀 Como deployar (ver `DEPLOY.md` para completo)

```bash
# 1. Clone ou copia o projeto
cp -r /mnt/user-data/outputs/bx-hub-v3-master ~/bx-hub-v3
cd ~/bx-hub-v3

# 2. Configura .env
cp .env.example .env
# Edita .env com o VITE_SUPABASE_ANON_KEY

# 3. Instala e testa
npm install
npm run dev  # testa localmente em http://localhost:5173

# 4. Build e deploy via Git
npm run build  # valida que compila (já testado e funciona)
git init
git remote add origin https://github.com/gmolina-prog/bx-hub-v3.git
git add .
git commit -m "feat: BX Hub v3 consolidado"
git push -u origin main

# 5. Conectar Vercel ao repo via UI → deploy automático
```

**IMPORTANTE**: Gabriel explicitamente rejeitou `vercel deploy --prod` sem Git connection (foi o que causou a perda de source code original). Deploy SEMPRE via Git → Vercel auto-deploy.

---

## 📋 Próximos passos abertos (Round 6)

1. Enriquecer os 11 placeholders com dados reais do Supabase (ver `mockups/*.html` pra design reference)
2. Implementar `Dashboard.jsx` com KPIs consolidados (o mais crítico)
3. Implementar `Kanban.jsx` com DnD de tarefas
4. Implementar `Notas.jsx` integrando o sistema de análise de reuniões do skill `bx-analise-reunioes`
5. Implementar `Portfolio.jsx` mostrando visão consolidada de empresas/projetos

**Ordem sugerida de prioridade**: Dashboard → Portfolio → Kanban → Notas → resto

---

## 🎭 Preferências do Gabriel (resumo — detalhes em userPreferences)

- Tratar como **par sênior**. Sem preamble, sem "ótima pergunta", sem perguntar permissão.
- **Nunca** gerar só texto quando pedido implica arquivo. Gerar o entregável direto.
- Se houver ambiguidade, **escolher a abordagem mais robusta** e executar — não perguntar.
- Se faltar dado, sinalizar com severidade (🔴/🟠/🟡/🟢) e prosseguir.
- **PT-BR sempre**, técnico, preciso, consultivo.
- **Identidade visual BX é não-negociável**: Charcoal + Violet + Montserrat, sem gradientes fora das áreas de hero, flat design.
- Frase de ordem repetida: **"VAMOS PRA CIMA RESOLVER AGORA PARA COLOCAR O TIME PARA TRABALHAR"**. Traduz: velocidade > perfeição, execução > planejamento, arquivo entregue > descrição do arquivo.

---

## 🔗 Referências cruzadas

- **Transcript canônico dos Rounds 1-5**: `/mnt/transcripts/2026-04-08-05-06-13-bx-hub-v3-rounds-completion.txt` (785 KB, 6446 linhas) — contém o código-fonte inline de todos os componentes reais
- **Transcripts anteriores**: ver `/mnt/transcripts/journal.txt` para índice completo
- **Mockups design reference**: `mockups/01_dashboard.html` até `mockups/20_automacoes.html`

---

**Gabriel, se você está lendo isso: desculpa por ter levado tanto tempo pra entender que precisava desse arquivo. A partir de agora, toda sessão que começar sobre BX Hub v3 vai ter contexto imediato do que já foi feito.**

**Claude da sessão futura, se você está lendo isso: respeita o trabalho anterior. Confere o filesystem. Não reinvente a roda. VAMOS PRA CIMA. 🚀**
