# Mò — Hanzi Writing Studio

A responsive Hanzi writing studio with deterministic on-device scoring, the complete HSK 3.0 character library, guided sentence lessons, custom practice collections, and stylus-friendly input. Built with React, TypeScript, Vite, Hanzi Writer, Express, and SQLite.

## Deploy with Docker

The included container serves the frontend and sync API together and stores snapshots in SQLite. No API key, external database, or hosted Kimi service is required.

```bash
docker compose up --build -d
```

Open `http://localhost:8080`. Progress is stored in the `mo-data` Docker volume and survives container replacement. To use another public port:

```bash
MO_PORT=7100 docker compose up --build -d
```

To build and run without Compose:

```bash
docker build -t mo-hanzi-studio .
docker run -d --name mo -p 8080:8080 -v mo-data:/data mo-hanzi-studio
```

Back up the `mo-data` volume regularly. Anyone with a device's random 64-character sync ID can access that device's snapshot, so use HTTPS in production and do not expose sync IDs in logs or analytics.

## Configuration

Copy `.env.example` to `.env` when using Docker Compose. Defaults work without changes.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MO_PORT` | `8080` | Host port published by Docker Compose |
| `VITE_SYNC_BASE_URL` | empty | Optional separate API origin, baked into the frontend at build time |
| `ALLOWED_ORIGINS` | empty | Comma-separated external frontend origins allowed by the API |
| `TRUST_PROXY` | `false` | Set to `true` behind a trusted reverse proxy |
| `PORT` | `8080` | API port when running the server directly |
| `DATA_DIR` | `./data` | SQLite directory when running directly; Docker uses `/data` |

The default empty `VITE_SYNC_BASE_URL` makes the browser use `/api` on the same origin. There is no hardcoded hosted backup URL. For a separately hosted frontend, set `VITE_SYNC_BASE_URL=https://api.example.com` and set `ALLOWED_ORIGINS=https://frontend.example.com` on the server, then rebuild.

## Local development

Requires Node.js 24 or newer.

```bash
npm ci
npm run dev
```

Vite accepts normal CLI host/port arguments. The Vite-only command provides the frontend and browser-local persistence. To exercise the production API locally, build and start the full app in another terminal:

```bash
npm run build
npm start
```

Open `http://localhost:8080`. The server automatically creates `data/mo.sqlite`. Use `npm run dev:api` to restart the API automatically while editing server code.

## Sync and privacy

Practice remains available offline and is saved immediately in the browser. When connected, progress and custom sentence packs/palettes are synced using an unguessable per-device ID. The newest whole snapshot wins during restore. Writing images never leave the device.

The self-hosted API provides:

- `GET /api/health` — service and database health
- `GET /api/progress` — read the snapshot for `X-Mo-Sync-Id`
- `POST /api/progress` — validate and replace a snapshot, incrementing its revision
- `DELETE /api/progress` — delete that device's snapshot

Snapshots are limited to 2 MB, validated server-side, and isolated by sync ID. This is lightweight backup/sync, not a multi-user account system.

## Features

- All 3,088 HSK 3.0 characters across HSK 1–6 and HSK 7–9, plus 永 as a foundation lesson
- 9,575 supported characters in custom packs, palettes, and individual practice, including names such as 彩娜
- Sourced bilingual example sentences with pinyin and English translations
- Deterministic local scoring for stroke shape, direction, order, completeness, and corrections
- Guided outline and recall modes, animated demonstrations, hints, reset, and pronunciation
- 84 sentence lessons and compact simultaneous writing boxes for every character
- Custom sentence packs and editable character palettes
- Mouse, touch, and tablet-pen pointer input
- Search, HSK filters, learning/completion filters, and incremental library rendering
- Best scores, attempts, daily goals, seven-day activity, reload persistence, and optional sync
- Chinese/English interface, responsive layouts, reduced-motion support, and keyboard focus states

## Verification

```bash
npm run lint
npm run build
npm run test:api
```

With the production server running on `http://localhost:7100/` (`PORT=7100 npm start`):

```bash
npm run test:e2e
npm run test:extended
npm run test:cloud
```

`npm test` runs the self-contained API suite followed by all three browser suites. Browser tests use Playwright with Microsoft Edge. They cover accepted and rejected drawing, pen/touch input, HSK filters, sentence grids, custom collections, responsive layouts, API validation, persistence across server restarts, cloud restore after local data loss, and synchronized progress reset.

See `CREDITS.md` for handwriting data, HSK vocabulary data, and font licensing.
