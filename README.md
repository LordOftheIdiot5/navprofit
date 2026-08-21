# NavProfit

**Maritime voyage financial intelligence**

Live AIS tracking, voyage P&L estimates, bunker comparison and fleet management for small operators.

---

## Quick start

```
npm install
npm start
```

Open http://localhost:3000

1. **Sign in** (top right) to sync this browser to your account, or keep working locally.
2. Settings → paste **your** keys if you want them:
   - aisstream.io for the live map
   - OilPriceAPI for live bunker prices (optional)
   - Anthropic for invoice extract (optional)
3. Click a ship → **Add to fleet** → Voyage planner → **Create voyage**.

NavProfit does not ship a shared OilPrice or Claude key. Each user brings their own, or skips those features. A key in `.env` is only an optional fallback for the installer.

---

## What is live

| Data | How |
|------|-----|
| Vessel positions | Your aisstream.io key in Settings (browser WebSocket) |
| Bunker VLSFO | Your OilPriceAPI key in Settings (optional; otherwise indicative) |
| FX | Server → open.er-api.com (no key) |
| Invoice AI | Your Anthropic key in Settings (optional) |
| Accounts + sync | Email/password on this server (`data/`) |

Your OilPrice and Anthropic keys are sent to this NavProfit server only to proxy the vendor APIs (browsers block those calls directly). If you sign in, they are stored on your account on this machine — not shared with other users.

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
🟢 Bunker prices live when *you* add an OilPriceAPI key in Settings  
🟢 Invoice AI when *you* add an Anthropic key in Settings  
🟢 Sign-in syncs fleet/voyages/invoices/alerts on this server  
🟡 Hosted multi-tenant database (Postgres / Appwrite) — not yet  
