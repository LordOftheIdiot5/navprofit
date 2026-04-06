# NavProfit

**Maritime voyage financial intelligence platform**

Real-time P&L tracking, bunker price monitoring, voyage planning and fleet management for ship operators worldwide.

---

## What it does

- Live vessel tracking via AIS
- Real-time bunker fuel prices across global ports
- Voyage P&L calculated live — revenue vs fuel, port dues, agent fees
- Voyage estimator before committing to a charter
- AI invoice extraction from emails and PDFs
- Fleet management — add, edit, track any vessel
- Multi-currency support (NOK, USD, EUR, GBP, SGD)
- Alert system — fuel price spikes, margin drops, arrivals

---

## Project structure

```
navprofit/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── TopBar.js
│   │   ├── VesselCard.js
│   │   ├── MetricCard.js
│   │   ├── FuelTable.js
│   │   └── AlertRow.js
│   ├── pages/            # Full page views
│   │   ├── Dashboard.js
│   │   ├── Fleet.js
│   │   ├── VoyagePlanner.js
│   │   └── Alerts.js
│   ├── services/         # API integrations
│   │   ├── ais.js        # AISstream.io websocket
│   │   ├── fuel.js       # OilPriceAPI / Tideform
│   │   ├── invoices.js   # AI invoice extraction
│   │   └── currency.js   # Exchange rates
│   ├── hooks/            # React hooks
│   │   ├── useVessels.js
│   │   ├── useFuelPrices.js
│   │   └── useAlerts.js
│   └── utils/
│       ├── voyage.js     # P&L calculations
│       ├── distances.js  # Port distance table
│       └── format.js     # Currency, number formatting
├── public/
│   └── index.html
├── docs/
│   ├── API_SETUP.md      # How to connect real APIs
│   ├── ROADMAP.md        # What to build next
│   └── BUSINESS.md       # Business model notes
├── index.html            # Standalone prototype (no build needed)
├── package.json
└── README.md
```

---

## Quick start

### Option 1 — Open directly (no install)
Just open `index.html` in a browser. The prototype runs with simulated data.

### Option 2 — With real APIs
1. Get API keys (see `docs/API_SETUP.md`)
2. `npm install`
3. Add keys to `.env`
4. `npm start`

---

## Data sources

| Data | Provider | Cost |
|------|----------|------|
| Vessel positions (AIS) | aisstream.io | Free tier available |
| Bunker prices | OilPriceAPI or Tideform | ~$50-200/month |
| Exchange rates | exchangerate-api.com | Free tier available |
| Invoice extraction | Anthropic Claude API | Pay per use |

---

## Tech stack

- **Frontend**: Vanilla JS / React (your choice)
- **Styling**: CSS custom properties, no framework dependency
- **Charts**: Chart.js
- **Maps**: SVG (prototype) → Mapbox or Leaflet (production)
- **AI**: Anthropic Claude API for invoice parsing
- **Backend** (when needed): Node.js + Express

---

## Status

🟡 Prototype — simulated data, full UI working  
🔴 Real AIS connection — not yet connected  
🔴 Real fuel prices — not yet connected  
🔴 AI invoice extraction — not yet connected  
🔴 User accounts / database — not yet built  
