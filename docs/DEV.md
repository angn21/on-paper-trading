# Dev tooling

Quick reference for debugging **On Paper** locally and in production.

## Database scripts (Supabase)

Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`, with `.env.local` overrides (e.g. from `vercel env pull`).

```powershell
cd on-paper-trading

npm run db:health              # ping Supabase
npm run db:users               # list accounts
npm run db:recent              # who's active + last save
npm run db:inspect -- anmol    # summary view
npm run db:portfolio -- anmol  # full JSON dump
```

### Superadmin (local `.env` service role only)

```powershell
npm run db:create-user -- friend 1234              # default $100k
npm run db:create-user -- friend 1234 250000        # custom starting cash
npm run db:grant-cash -- anmol 50000          # add cash
npm run db:set-cash -- anmol 250000           # set exact cash
npm run db:grant-shares -- anmol AAPL 10 150  # add shares (no cash deducted)
npm run db:reset-portfolio -- anmol --yes       # back to $100k empty slate
npm run db:delete-user -- testuser --yes        # delete account
npm run db:export -- anmol                      # → backups/anmol-<timestamp>.json
npm run db:import -- anmol backups/file.json --yes
```

Destructive commands require `--yes`. Users pick up changes on next sync (~15s) or **Account → Sync now**.

## Vercel CLI

Install once:

```powershell
npm i -g vercel
vercel login
```

Link this repo (one time, from project root):

```powershell
vercel link
```

Common commands:

```powershell
vercel env pull .env.local     # copy prod env vars locally (optional)
vercel logs --follow           # tail /api/* server logs (JSON lines)
vercel logs on-paper-trading.vercel.app --since 1h
```

API routes log structured JSON via `server/log.js`. Search logs for `"scope":"portfolio"` after sync issues.

Set log verbosity on Vercel (optional): `LOG_LEVEL=debug`

## Supabase CLI (optional)

Install: `npm i -g supabase`

```powershell
supabase login
supabase link --project-ref jnhtwgyxxffrdfkvtpzj
```

Handy commands:

```powershell
supabase db pull               # refresh schema from dashboard
```

For ad-hoc SQL, the dashboard **SQL Editor** is usually faster for this project’s two-table schema.

## Local dev

```powershell
npm run dev
```

Auth + portfolio API routes are proxied through Vite using the same handlers as Vercel (`server/authMiddleware.js`).

## Sync debugging checklist

1. **Laptop:** Account → Sync now → confirm “Last cloud save” updates
2. **CLI:** `npm run db:portfolio -- yourusername` → verify `watchlist` / `positions` in JSON
3. **Vercel:** `vercel logs --follow` → look for `"message":"portfolio saved"`
4. **Phone:** hard refresh → Account → Sync now (pulls latest when no local edits pending)

## What not to log

Never commit or print: PINs, session cookies, `SUPABASE_SERVICE_ROLE_KEY`, full `.env` files.
