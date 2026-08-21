# NavProfit

**Maritime voyage financial intelligence**

Live AIS tracking, voyage P&L estimates, bunker comparison and fleet management for small operators.

---

## What works today

- Live vessel tracking via aisstream.io (your API key, stored in the browser)
- Fleet as the source of truth — add from the map or by hand
- Voyage planner using that vessel’s speed and fuel burn
- Persisted voyages, invoices and alerts (browser localStorage)
- Fuel / margin / arrival alerts that actually evaluate
- Multi-currency display (amounts stored in USD)
- Light / dark theme, home port, AIS region

Still indicative (not a live feed): global bunker prices. Still not built: user accounts, invoice AI, accounting export.

---

## Quick start

Open `index.html` in a browser, or:

```
npm start
```

Then:

1. Settings → paste an [aisstream.io](https://aisstream.io) API key → Save & connect
2. Click a ship on the map → **Add to fleet**
3. Voyage planner → estimate and **Create voyage**
4. Overview KPIs and P&L rail update from that voyage

Optional: Settings → **Sample data** loads a demo fleet without touching your own records.

---

## Project structure

```
navprofit/
├── index.html            # UI shell
├── src/app.js            # Operational app (fleet, voyages, AIS, alerts)
├── src/services/         # Future API adapters (fuel, invoices, AIS helper)
├── src/utils/            # Shared estimate / format helpers
├── ais-test.html         # Standalone AIS map playground
├── docs/
│   ├── API_SETUP.md
│   ├── ROADMAP.md
│   └── BUSINESS.md
└── package.json
```

---

## Data sources

| Data | Status | Provider |
|------|--------|----------|
| Vessel positions | Live when connected | aisstream.io |
| Fleet / voyages / invoices / alerts | Local, persisted | Browser |
| Bunker prices | Indicative table | Static (OilPriceAPI next) |
| Exchange rates | Static vs USD | Update in `src/app.js` |

---

## Tech stack

- Vanilla JS, CSS custom properties
- Leaflet + CARTO tiles
- Chart.js
- No build step required

---

## Status

🟢 Live AIS map and fleet  
🟢 Voyage estimates persisted to the dashboard  
🟢 Manual invoice log and evaluating alerts  
🟡 Bunker prices — indicative table  
🔴 AI invoice extraction — not connected  
🔴 User accounts / database — not built  
