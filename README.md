# Lifeline

A real-time co-op zombie adventure for two players on two iPads. The design is in [GAME.md](GAME.md).

## Run it

```sh
npm install
npm run dev        # Worker on :8787 and Vite on :5173 (Vite proxies /api)
```

Open `http://localhost:5173`:
- **Host a room** on one device, then **Join** with the 4-letter code on the other.
- **Both players on this device** runs a local game with no server: WASD + Space, and a gamepad or the arrow keys + Enter.
- Shortcuts: `?local`, `?auto=host`, `?auto=join&room=ABCD`.

## Check it

```sh
npm run typecheck
npm test           # Vitest: sim and protocol
npm run test:e2e   # Playwright: two iPad-sized clients through the local Worker
```

## Deploy

```sh
CLOUDFLARE_API_TOKEN=... npm run deploy
```

This builds the client and deploys one Worker (`lifeline`) that serves the client and the room relay.

## Layout

```
apps/client/        Vite + TypeScript + Three.js: rendering, input, UI, net client
apps/server/        Cloudflare Worker + Durable Object: rooms, relay, saves
packages/sim/       Pure TypeScript simulation, runs on the host
packages/protocol/  Control messages and binary input/snapshot codecs
packages/content/   Level data and content types
tests/e2e/          Playwright two-client test
```
