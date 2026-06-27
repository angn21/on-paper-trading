# On Paper — Investing Playground

A personal paper-trading web app inspired by the discontinued iOS app **On Paper – Investing Playground**. Practice investing with **$100,000 in virtual cash** against real US stock prices to learn and experiment.

> Paper trading for education only. **Not real investing or financial advice.**

Each visitor's portfolio is saved in their **browser only** (localStorage) — no accounts, no server-side user data.

## Features

- Buy & sell stocks with virtual cash, positions, P/L, and transaction history
- Interactive price charts (D / W / M / Y) and portfolio value chart
- Watchlist with starred tickers
- Simulated options trading (Black-Scholes model — not live option quotes)
- Finnhub live US stock data via a **server-side proxy** (API key never exposed to browsers)

## Local development

### Prerequisites

Node.js 18+ and npm — check with `node --version` and `npm --version`.

### Setup

```powershell
cd "C:\Users\Anmol\Desktop\code\on-paper-trading"
npm install
copy .env.example .env
```

Edit `.env` and add your Finnhub key:

```
FINNHUB_API_KEY=your_actual_key_here
```

Get a free key at [https://finnhub.io/register](https://finnhub.io/register)

### Run locally

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

The dev server proxies market data through `/api/finnhub` so your key stays on the server side even locally.

### Build

```powershell
npm run build
```

---

## Deploy for friends (Vercel — recommended)

This hosts the app at a public URL like `https://on-paper-trading.vercel.app` so friends can use it. Each person gets their own portfolio in their browser.

### Step 1 — Put the code on GitHub

1. Create a free account at [https://github.com](https://github.com) if you don't have one
2. Create a new repository (e.g. `on-paper-trading`)
3. In your project folder, run:

```powershell
cd "C:\Users\Anmol\Desktop\code\on-paper-trading"
git init
git add .
git commit -m "Initial commit — On Paper trading app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/on-paper-trading.git
git push -u origin main
```

> `.env` is gitignored — your key will **not** be pushed to GitHub.

### Step 2 — Deploy on Vercel

1. Sign up at [https://vercel.com](https://vercel.com) (use "Continue with GitHub")
2. Click **Add New → Project**
3. Import your `on-paper-trading` repository
4. Vercel auto-detects Vite — leave settings as default
5. Before clicking Deploy, expand **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `FINNHUB_API_KEY` | your Finnhub API key |

6. Click **Deploy**

After ~1 minute you'll get a live URL. Share that link with friends.

### Step 3 — Verify production

Visit your URL — the simulated-price banner should **not** appear. Search for `AAPL` and confirm a real price loads.

### Updating the live site

After you change code locally:

```powershell
git add .
git commit -m "Describe your change"
git push
```

Vercel redeploys automatically on every push to `main`.

---

## How the architecture works

```text
Friend's browser                    Your Vercel site
     │                                    │
     │  GET /api/finnhub/quote?symbol=AAPL│
     │ ─────────────────────────────────► │
     │                                    │  adds FINNHUB_API_KEY (secret)
     │                                    │ ──────────────────────► Finnhub
     │  ◄─────────────────────────────────│
     │         JSON price data            │

Portfolio data never leaves the browser (localStorage).
```

## Project structure

```
api/                    # Vercel serverless functions (production proxy)
server/                 # Shared proxy logic + Vite dev middleware
src/marketData/         # Provider-agnostic data layer (calls /api/finnhub)
src/context/            # Portfolio state + localStorage
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Simulated-price banner on live site | Add `FINNHUB_API_KEY` in Vercel → Project → Settings → Environment Variables, then redeploy |
| Simulated-price banner locally | Ensure `.env` has `FINNHUB_API_KEY=...` and restart `npm run dev` |
| Symbol not found | Free Finnhub tier is US stocks only |
| Friend lost their portfolio | Browser data was cleared — expected with no accounts |
| Rate limits | Free tier is ~60 calls/min shared across all visitors |

## Tech stack

Vite · React · React Router · Recharts · Vercel serverless API
