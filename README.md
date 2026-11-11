# Prila Admin

Vite + React + TypeScript + Tailwind ops panel.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Default API base: `/api/v1` (proxied to `http://127.0.0.1:4000` in Vite).

Login uses backend `ADMIN_LOGINS` (see `prila-backend/.env.example`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local UI |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production bundle |
