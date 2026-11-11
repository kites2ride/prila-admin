# Prila Admin Panel — Claude Code instructions

Vite + React + TypeScript + Tailwind ops panel for Prila.

Shared workspace rules (single source of truth):

@../.cursor/rules/00-prila-core.mdc
@../.cursor/rules/01-server-driven.mdc
@../.cursor/rules/30-admin.mdc
@../.cursor/rules/40-ride-domain.mdc

Docs: `../docs/ARCHITECTURE.md`, `../docs/API_CONTRACT.md`, `../docs/CONFIG_KEYS.md`, `../docs/UI_REFERENCE.md`, `../docs/DECISIONS.md`

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

Single production-oriented setup for now (no staging/dev flavors). Proxy `/api` → `http://127.0.0.1:4000`.

Never commit `.env` or secrets. Commit `.env.example` instead. Only the restricted Google Maps JS key may live in frontend env.
