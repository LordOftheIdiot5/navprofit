# NavProfit — Roadmap

---

## Phase 1 — Working prototype ✅ DONE
- [x] Dashboard with live P&L simulation
- [x] Global vessel map
- [x] Bunker price table (6 global ports)
- [x] Voyage planner with cost estimator
- [x] Fleet management (add/edit/remove vessels)
- [x] Alert system with notification log
- [x] Multi-currency support
- [x] Mobile responsive layout
- [x] Invoice list with AI extraction concept

---

## Phase 2 — Real data connections (NEXT)

### Priority 1 — AIS connection
- [ ] Connect aisstream.io WebSocket
- [ ] Real vessel positions on map
- [ ] Live speed, heading, destination updates
- [ ] Vessel arrival/departure detection
- [ ] Norwegian coast as first region

### Priority 2 — Live fuel prices
- [ ] Connect OilPriceAPI
- [ ] Auto-refresh every 4 hours
- [ ] Price change alerts trigger automatically
- [ ] Historical price chart per port

### Priority 3 — AI invoice extraction
- [ ] Email forwarding address (operator forwards invoice → auto-extracted)
- [ ] PDF upload in UI
- [ ] Claude API extracts: amount, vendor, port, vessel, category
- [ ] One-click confirm before logging
- [ ] Anomaly detection (price above market rate)

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
- [ ] Route cost comparison
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

- Replace SVG map with Mapbox or Leaflet for real vessel plotting
- Add proper error handling on all API calls
- Add loading states throughout UI
- Rate limiting and caching for API calls
- Proper TypeScript types if moving to TS

---

## First milestone to validate

**Goal:** Get 1 real Norwegian operator using it for 30 days.

What that requires:
1. Real AIS data for their specific vessels (MMSI numbers)
2. Manual voyage setup with their real routes and rates
3. Simple way for them to log costs (email forward or manual entry)
4. Dashboard they can check on their phone

That's Phase 2 Priority 1 + Priority 3 basics.
Timeline estimate: 2-3 weeks of focused work.
