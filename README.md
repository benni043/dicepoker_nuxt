# Dice Poker

Multiplayer dice poker (Würfelpoker) for 2–8 players: lobbies with password, 3D dice, Google login, stats.

Nuxt 4 · socket.io · three.js + cannon-es · Postgres (Drizzle ORM) · nuxt-auth-utils · @nuxtjs/i18n (de/en)

## Setup

1. Copy `.env.example` to `.env` and fill it in:
   - `NUXT_SESSION_PASSWORD`: at least 32 random characters (`openssl rand -base64 32`)
   - `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `NUXT_OAUTH_GOOGLE_CLIENT_SECRET`: create an OAuth client
     ("Web application") at https://console.cloud.google.com/apis/credentials and add
     `http://localhost:3000/api/auth/callback/google` (plus your production URL) as an authorized redirect URI.
2. Install dependencies: `pnpm install`

## Development

```bash
pnpm db:up   # starts Postgres in Docker (docker compose up -d db)
pnpm dev     # http://localhost:3000, migrations run automatically on startup
```

In development the login page also offers a **test login without Google**, which is handy for
playing against yourself in several browser windows. It does not exist in production builds.

After changing `server/db/schema.ts`, generate a migration with `pnpm db:generate`.

## Linting

```bash
pnpm lint:fix    # Biome: format + lint with auto-fixes
pnpm lint:full   # Biome check + nuxi typecheck
```

## Hosting with Docker

```bash
docker compose up -d --build
```

Starts Postgres and the app on port 3101. To use another port, set it in the `.env` next to
`compose.yaml` on the server (Compose reads it automatically):

```bash
APP_PORT=8080
```

Behind a reverse proxy, set `NUXT_OAUTH_GOOGLE_REDIRECT_URL=https://your-domain/api/auth/callback/google`
and make sure the proxy forwards WebSockets (`/api/socket.io`).

## Rules

The rule set is chosen per lobby. Each turn: up to 3 rolls, hold dice in between, then enter the
result in any free field of one of your columns (a 0 strikes the field). Highest total over all
columns wins. Rules live in `shared/game.ts`.

### Würfelpoker

"Served" means thrown with the first roll of a turn.

| Field | Points | Served |
|---|---|---|
| 1–6 | count × face | – |
| Full house | 20 | 25 |
| Straight | 30 | 35 |
| Poker (4 of a kind) | 40 | 45 |
| Grande (5 of a kind) | 50 | 100 |
| Double grande | – (only served) | 100 |

### Kniffel

| Field | Points |
|---|---|
| 1–6 | count × face; +30 bonus if 1–6 add up to at least 60 |
| Three / four of a kind | sum of all dice |
| Full house | 25 |
| Small straight (4 in a row) | 30 |
| Large straight (5 in a row) | 40 |
| Grande (5 of a kind) | 50 |
| Chance | sum of all dice |

## Structure

- `app/`: pages (home, lobby/game, stats, settings, login), components (3D scene, score sheet, lobby parts)
- `server/game/`: lobby & game logic, physics simulation, socket setup, persistence
- `server/db/`: Drizzle schema and SQL migrations
- `shared/`: rules and types used by both client and server
- `i18n/locales/`: translations
