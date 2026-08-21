# NavProfit — Roadmap

---

## Phase 1 — Working prototype ✅ DONE
- [x] Dashboard with live P&L simulation
- [x] Global vessel map (Leaflet)
- [x] Bunker price table (indicative)
- [x] Voyage planner with cost estimator
- [x] Fleet management (add/edit/remove vessels)
- [x] Alert system with notification log
- [x] Multi-currency support
- [x] Mobile responsive layout

---

## Phase 2 — Make it operational (IN PROGRESS)

### Done
- [x] Connect aisstream.io WebSocket
- [x] Real vessel positions on map
- [x] Live speed, heading, destination updates
- [x] Fleet as source of truth for Overview / Voyage planner
- [x] Persist voyages, invoices, alerts in the browser
- [x] Alerts evaluate fuel / margin / AIS arrival
- [x] Sample data is opt-in, not the default dashboard

### Next
- [ ] Arrival/departure detection against destination port
- [ ] Connect OilPriceAPI for live bunker prices
- [ ] Auto-refresh fuel every 4 hours
- [ ] Historical price chart per port
- [ ] PDF / email invoice extraction (Claude API)
- [ ] One-click confirm before logging extracted invoices

---

## Phase 3 — User accounts & persistence

- [ ] User registration / login
- [ ] Each operator has their own fleet and data
- [ ] Database (PostgreSQL recommended)
- [ ] Voyage history stored permanently
- [ ] Invoice archive
- [ ] Export to CSV / Excel

---

## Phase 4 — Mobile app

- [ ] React Native or PWA
- [ ] Captain view — simplified, phone-friendly
- [ ] Photo receipt capture → AI extraction
- [ ] Push notifications for alerts
- [ ] Offline mode for vessels at sea

---

## Phase 5 — Intelligence layer

- [ ] Voyage profitability forecasting
- [ ] Optimal bunkering port recommendations
- [ ] Route cost comparison (real routing, not a port table)
- [ ] Market freight rate benchmarking
- [ ] Cash flow forecasting (30/60/90 days)
- [ ] Anomaly detection on all costs

---

## Phase 6 — Growth features

- [ ] Multi-user (owner + captain + accountant roles)
- [ ] Integrations (accounting software: Tripletex, Visma)
- [ ] API for operators to push data from existing systems
- [ ] White-label option for ship management companies
- [ ] Aggregated anonymized market data product

---

## Technical debt to address

- Split remaining UI chrome out of `index.html`
- Proper error handling and reconnect backoff on AIS
- Rate limiting and caching for bunker APIs
- TypeScript if the app grows past a single JS file

---

## First milestone to validate

**Goal:** Get 1 real Norwegian operator using it for 30 days.

What that requires:
1. Real AIS data for their specific vessels (MMSI numbers)
2. Manual voyage setup with their real routes and rates
3. Simple way for them to log costs (manual entry now; email later)
4. Dashboard they can check on their phone

That's this operational slice + live bunker prices.
