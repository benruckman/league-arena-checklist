# Arena Wins Checklist

Track League of Legends Arena first-place wins by champion — for champ select and anvil picks. Progress lives in your browser; optional Riot sync pulls real Arena match history.

See [docs/arena-wins-checklist.md](docs/arena-wins-checklist.md) for the full design.

## Quick start

1. Copy env and add a [Riot API key](https://developer.riotgames.com):

```bash
cp .env.example .env
# edit .env → RIOT_API_KEY=RGAPI-...
```

2. Install and run (API on `:3001`, web on `:5173` with `/api` proxied):

```bash
npm install
npm run dev:api
# other terminal
npm run dev:web
```

Open http://localhost:5173

Without a Riot key, the checklist still works (manual toggles). Sync needs `RIOT_API_KEY`.

## Tests

```bash
npm test
```

API unit tests (Vitest) cover Arena first-place detection and queue mode defaults.
Default sync is **current Arena season** (since 2026-04-28 / patch 26.09) across **all formats** (`queues=all`). That matches Season Journey. Pass `seasonOnly=false` for all-time history, or `queues=trios` / `queues=duos` to narrow.

Important: in Arena match-v5, `win: true` means **top half**, not first place. First place is `placement === 1`.

## Scripts

| Command | What |
|--------|------|
| `npm run dev:web` | Vite frontend |
| `npm run dev:api` | Hono Riot proxy |
| `npm run build` | Build web + API |
| `npm start` | Run built API |

## Deploy (Railway)

**Single service (simplest):**

1. Connect this repo to Railway
2. Build command:
   ```bash
   npm install && npm run build --workspace=@league-arena/web
   ```
3. Start command:
   ```bash
   npm run start --workspace=@league-arena/api
   ```
4. Set env vars: `RIOT_API_KEY`, `PORT` (Railway sets this), optional `CORS_ORIGIN`
5. The API serves `apps/web/dist` when present, so one URL hosts UI + `/api`

**Split services:** API as above without relying on static files; host `apps/web/dist` on a static host and set `CORS_ORIGIN` to that origin. Point the Vite app at the API via a reverse proxy or relative `/api` path.

Personal Riot keys expire daily and are rate-limited (~100 req / 2 min). Deep sync pages through history slowly. Apply for a production key for a public site.

## API

- `GET /api/health`
- `GET /api/arena-wins?gameName=&tagLine=&region=&start=0&count=20&queues=all&seasonOnly=true` — default: current season + all Arena queues. `seasonOnly=false` for all-time; `queues=trios` / `duos` to narrow. Returns champion IDs with `placement === 1`.
