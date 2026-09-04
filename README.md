# Universo Kosmos

Client onboarding platform for **Kosmos Inteligência Digital**.

```bash
npm install
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
npm run db:migrate
npm run db:seed
npm run dev            # api :3333 · web :5173
```

- `packages/api` — Express 5 + Prisma 7 + PostgreSQL
- `packages/web` — Vite + React 19 + Tailwind 4 + shadcn/ui

See **[CLAUDE.md](./CLAUDE.md)** for architecture, decisions taken, database
guarantees, and infrastructure requirements.
