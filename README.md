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

## CI

Pull requests and pushes to `main` run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`npm test` + `npm run build`).

## Deploy (Railway + GitHub Actions)

Pushes to `main` run tests, then deploy via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### One-time Railway setup

1. Create a project at [railway.app](https://railway.app) (Empty project → Add service → Empty service is fine; the first Actions deploy will upload code).
2. In the service **Settings**:
   - Confirm build/start come from [`railway.toml`](railway.toml) (or set them to match)
   - **Networking** → generate a public domain
3. In the service **Variables**, set:
   - `RIOT_API_KEY` = your Riot key
   - `PORT` is set by Railway automatically — don't override unless needed
4. Create a **Project Token**: Project Settings → Tokens → create for the production environment.
5. In GitHub → repo **Settings → Secrets and variables → Actions**, add:
   - `RAILWAY_TOKEN` = that project token

Then push to `main` (or run the **Deploy to Railway** workflow manually). The API serves the built web app, so one URL is enough for UI + `/api`.

Personal Riot keys expire daily and are rate-limited (~100 req / 2 min). Apply for a production key for a public site.

## API

- `GET /api/health`
- `GET /api/arena-wins?gameName=&tagLine=&region=&start=0&count=20&queues=all&seasonOnly=true` — default: current season + all Arena queues. `seasonOnly=false` for all-time; `queues=trios` / `duos` to narrow. Returns champion IDs with `placement === 1`.
