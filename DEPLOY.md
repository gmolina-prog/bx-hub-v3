# 🚀 DEPLOY.md — BX Hub v3

## Pré-requisitos

- Node.js 18+
- Conta Vercel (já configurada como `gmolina-prog`)
- Repo GitHub `gmolina-prog/bx-hub-v3` (já criado)
- Supabase anon key (project `uvgkypmlrfxytknyvfdj`)

## Passo 1 — Configurar local

```bash
cp -r /mnt/user-data/outputs/bx-hub-v3-master ~/bx-hub-v3
cd ~/bx-hub-v3
cp .env.example .env
# Editar .env e colocar o VITE_SUPABASE_ANON_KEY real
```

## Passo 2 — Testar local

```bash
npm install
npm run dev    # http://localhost:5173
```

Validar:
- [ ] Login page carrega
- [ ] Login funciona (usar conta real do Supabase)
- [ ] Sidebar aparece com 5 seções e 21 itens
- [ ] Navegação entre rotas funciona
- [ ] Rotas reais (Admin, CRM, Produtividade, BI, etc.) carregam dados do Supabase
- [ ] Placeholders aparecem com mensagem "Em desenvolvimento"

## Passo 3 — Build

```bash
npm run build  # Gera dist/
npm run preview # Testa build de produção em http://localhost:4173
```

Saída esperada:
```
✓ 1570 modules transformed.
dist/index.html                   ~0.6 kB
dist/assets/index-XXX.css        ~28 kB
dist/assets/index-XXX.js        ~622 kB
✓ built in ~18s
```

## Passo 4 — Git init e push

```bash
git init
git branch -M main
git remote add origin https://github.com/gmolina-prog/bx-hub-v3.git
git add .
git commit -m "feat: BX Hub v3 consolidado — 22 rotas, 11 módulos reais + placeholders

- Infraestrutura Vite + React 18 + Tailwind + Supabase
- Rounds 1-5 integrados (Admin, CRM, Cadastro, Calendar, Logs, Automations,
  Produtividade, Time, BI, Captacao, Intakes)
- 11 placeholders funcionais para Round 6
- Sidebar com 5 seções e 21 itens (incluindo CONFIGURAÇÃO)
- Auth via Supabase + DataContext
- Build validado (1570 modules, 0 errors)
"
git push -u origin main --force  # force porque o repo atual só tem README
```

## Passo 5 — Conectar Vercel ao repo

1. Acessar https://vercel.com/gmolina-prog/bx-hub-v3/settings/git
2. "Connect Git Repository" → selecionar `gmolina-prog/bx-hub-v3`
3. Configurar variáveis de ambiente no Vercel:
   - `VITE_SUPABASE_URL` = `https://uvgkypmlrfxytknyvfdj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (o anon key real)
4. Deploy automático acontece a cada push na `main`

⚠️ **IMPORTANTE**: Gabriel explicitamente rejeitou `vercel deploy --prod` direto via CLI (foi o que causou a perda do source code original). Sempre deploy via Git → Vercel auto-deploy.

## Passo 6 — Validar produção

Após deploy, acessar https://bx-hub-v3.vercel.app e validar:

- [ ] Login funciona
- [ ] Todas as 22 rotas acessíveis via menu
- [ ] Módulos reais carregam dados
- [ ] Nenhum erro 400 no console
- [ ] Nenhum erro de CORS
- [ ] Sidebar preserva seções e ordem correta

## 🐛 Troubleshooting

### Build falha com erro de lucide-react
Verifique se `lucide-react` está instalado: `npm ls lucide-react`

### Supabase retorna 401
O `VITE_SUPABASE_ANON_KEY` não está configurado ou está errado. Verifique `.env` local e env vars do Vercel.

### Rotas dão 404 em produção
Adicionar `vercel.json` na raiz:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Avatar color não aparece
A coluna `avatar_color` está no `profiles` mas alguns users podem ter `NULL`. Componentes já tratam fallback pra gradiente violet padrão.
