# NavProfit

**Maritime voyage financial intelligence**

Live AIS tracking, voyage P&L estimates, bunker comparison and fleet management for small operators.

---

## Quick start

```
cp .env.example .env
# add OIL_PRICE_API_KEY and ANTHROPIC_API_KEY if you have them
npm install
npm start
```

Open http://localhost:3000

1. **Sign in** (top right) to sync fleet/voyages to this server, or keep working locally.
2. Settings → paste an [aisstream.io](https://aisstream.io) key → Save & connect.
3. Click a ship → **Add to fleet** → Voyage planner → **Create voyage**.
4. Log invoice → paste text or PDF → **Extract with AI** (needs `ANTHROPIC_API_KEY`) → Confirm & save.

Without API keys the app still runs: bunker prices stay indicative, invoice extract shows a clear error, accounts still work on this machine.

---

## What is live

| Data | How |
|------|-----|
| Vessel positions | Browser WebSocket to aisstream.io |
| Bunker VLSFO | Server → OilPriceAPI (`OIL_PRICE_API_KEY`) |
| FX | Server → open.er-api.com (no key) |
| Invoice AI | Server → Claude (`ANTHROPIC_API_KEY`) |
| Accounts + sync | Email/password on this server (`data/`) |

AIS keys stay in the browser. OilPrice and Claude keys stay in `.env` and are never sent to the client.

---

## Project structure

```
navprofit/
├── server.js             # Express: APIs, auth, static files
├── index.html            # UI shell
├── src/app.js            # Client app
├── data/                 # Local users + synced stores (gitignored)
├── docs/
└── .env.example
```

---

## Status

🟢 Live AIS map and fleet  
🟢 Voyage estimates persisted to the dashboard  
🟢 Bunker prices live when OilPriceAPI key is set  
🟢 Invoice AI extract when Anthropic key is set  
🟢 Sign-in syncs fleet/voyages/invoices/alerts on this server  
🟡 Hosted multi-tenant database (Postgres / Appwrite) — not yet  
