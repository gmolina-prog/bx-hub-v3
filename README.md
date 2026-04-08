# BX Hub v3

> Sistema interno BX Group — React + Vite + Tailwind + Supabase

## 🎯 O que é

BX Hub v3 é o sistema interno do BX Group (São Paulo), consolidando a operação das 3 subsidiárias:
- **BX Finance** — advisory, RJ, M&A, reestruturação
- **BX Outsourcing** — BPO contábil/fiscal/trabalhista/financeiro
- **BX Certified** — certificados digitais e-CPF/e-CNPJ

## 📊 Status

- **22 rotas** mapeadas no roteamento
- **11 módulos** production-ready com integração Supabase real
- **11 módulos** como placeholders funcionais (Round 6)
- **Build validado** com Vite (1.570 módulos transformados, 0 erros)
- **~7.720 linhas** de código React real

## 🏗️ Arquitetura

```
React 18 + Vite 5 + Tailwind 3 + Supabase 2
React Router 6 para roteamento
Lucide React para ícones
Montserrat como fonte única
Paleta: Charcoal #2D2E39 + Violet #5452C1
```

## 🚀 Quick start

```bash
npm install
cp .env.example .env  # Editar com VITE_SUPABASE_ANON_KEY
npm run dev           # http://localhost:5173
```

## 📚 Documentação

- **[CLAUDE_ENTRY_POINT.md](./CLAUDE_ENTRY_POINT.md)** — Leitura obrigatória para Claude em sessões futuras
- **[DEPLOY.md](./DEPLOY.md)** — Instruções de deploy
- **[docs/SCHEMA.md](./docs/SCHEMA.md)** — Schema Supabase completo
- **[docs/ROUNDS.md](./docs/ROUNDS.md)** — Histórico dos rounds de desenvolvimento

## 📦 Estrutura

```
bx-hub-v3-master/
├── src/
│   ├── components/     # 22 componentes (11 reais + 11 placeholders + Layout/Sidebar/Login)
│   ├── contexts/       # DataContext (auth + profile)
│   ├── lib/            # Supabase client
│   ├── App.jsx         # Rotas principais
│   └── main.jsx        # Entry point
├── mockups/            # 21 HTMLs de design reference
├── docs/               # Documentação técnica
└── public/             # Assets estáticos
```

## 🎨 Identidade visual

- **Charcoal** `#2D2E39` — primário (sidebar, heros)
- **Violet** `#5452C1` — destaque (buttons, tabs ativos)
- **Cinza** `#F2F2F2` — background principal
- **Branco** `#FFFFFF` — cards
- **Fonte**: Montserrat (400, 500, 600, 700, 800)

## 🔗 Links

- **Deploy**: https://bx-hub-v3.vercel.app
- **Repo**: https://github.com/gmolina-prog/bx-hub-v3
- **Supabase**: https://uvgkypmlrfxytknyvfdj.supabase.co

---

**Gabriel Molina** · Managing Partner BX Group · São Paulo
