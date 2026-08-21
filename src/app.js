'use strict';

// ════════════════════════════════════════════════════
// STORAGE KEYS & CONSTANTS
// ════════════════════════════════════════════════════
var KEY_AIS = 'navprofit_ais_key';
var KEY_FLEET = 'navprofit_fleet';
var KEY_SETTINGS = 'navprofit_settings';
var KEY_VOYAGES = 'navprofit_voyages';
var KEY_INVOICES = 'navprofit_invoices';
var KEY_ALERTS = 'navprofit_alerts';
var KEY_NOTIFS = 'navprofit_notifs';
var MAX_VESSELS = 1500;

var FX = {
  NOK: { r: 10.8, s: 'kr' },
  USD: { r: 1, s: '$' },
  EUR: { r: 0.92, s: '€' },
  GBP: { r: 0.79, s: '£' },
  SGD: { r: 1.35, s: 'S$' }
};

var DIST = {
  Bergen: { Rotterdam: 612, Singapore: 10940, Dubai: 6240, Istanbul: 2840, Houston: 8200, Tokyo: 11800, 'New York': 6100 },
  Rotterdam: { Bergen: 612, Singapore: 10640, Dubai: 6640, Istanbul: 2180, Houston: 7600, Tokyo: 11200, 'New York': 5550 },
  Singapore: { Bergen: 10940, Rotterdam: 10640, Dubai: 3640, Istanbul: 8200, Houston: 13200, Tokyo: 3300, 'New York': 15600 },
  Dubai: { Bergen: 6240, Rotterdam: 6640, Singapore: 3640, Istanbul: 3620, Houston: 9800, Tokyo: 5900, 'New York': 11200 },
  Istanbul: { Bergen: 2840, Rotterdam: 2180, Singapore: 8200, Dubai: 3620, Houston: 9200, Tokyo: 9800, 'New York': 8100 },
  Houston: { Bergen: 8200, Rotterdam: 7600, Singapore: 13200, Dubai: 9800, Istanbul: 9200, Tokyo: 9800, 'New York': 1600 },
  Tokyo: { Bergen: 11800, Rotterdam: 11200, Singapore: 3300, Dubai: 5900, Istanbul: 9800, Houston: 9800, 'New York': 10300 },
  'New York': { Bergen: 6100, Rotterdam: 5550, Singapore: 15600, Dubai: 11200, Istanbul: 8100, Houston: 1600, Tokyo: 10300 }
};

var BUNK = {
  Bergen: 618, Rotterdam: 602, Singapore: 625, Dubai: 614, Istanbul: 619,
  Houston: 608, Tokyo: 631, 'New York': 622, Fujairah: 614, Stavanger: 641
};

var PORT_FLAG = {
  Bergen: '🇳🇴', Rotterdam: '🇳🇱', Singapore: '🇸🇬', Dubai: '🇦🇪', Istanbul: '🇹🇷',
  Houston: '🇺🇸', Tokyo: '🇯🇵', 'New York': '🇺🇸', Fujairah: '🇦🇪', Stavanger: '🇳🇴'
};

var HOME_PORTS = {
  'Bergen, Norway': [60.39, 5.32],
  'Stavanger, Norway': [58.97, 5.73],
  'Trondheim, Norway': [63.43, 10.40],
  'Tromsø, Norway': [69.65, 18.96],
  'Oslo, Norway': [59.91, 10.75],
  'Rotterdam, Netherlands': [51.92, 4.48],
  'Hamburg, Germany': [53.55, 9.99],
  Singapore: [1.26, 103.85],
  'Dubai, UAE': [25.27, 55.30],
  'Houston, USA': [29.73, -95.27],
  'Tokyo, Japan': [35.63, 139.80],
  'New York, USA': [40.68, -74.04]
};

var REGIONS = {
  norway: [[56, 3], [72, 32]],
  north_sea: [[50, -5], [62, 13]],
  baltic: [[53, 9], [65, 31]],
  mediterranean: [[30, -6], [46, 37]],
  global: [[-90, -180], [90, 180]]
};

var DEFAULT_SETTINGS = {
  theme: 'dark',
  currency: 'NOK',
  homePort: 'Bergen, Norway',
  region: 'norway',
  sample: false,
  notify: { bunker: true, margin: true, arrival: true, invoice: false, stale: true }
};

// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════
var settings = loadSettings();
var isDark = settings.theme !== 'light';
var cur = settings.currency || 'NOK';
var selMmsi = '';
var alertType = 'fuel';
var lastEstimate = null;
var lastFleetSync = 0;

var aisSocket = null, aisConnected = false, aisKey = '', aisMsgCount = 0;
var dashMap = null, darkTile = null, lightTile = null;
var dashVessels = {}, dashMarkers = {}, fleetMarkers = {};
var bboxTimer = null, pnlChart = null;

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function lsGet(key, def) {
  try { var v = localStorage.getItem(key); return v != null ? JSON.parse(v) : def; } catch (e) { return def; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }
function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function $(id) { return document.getElementById(id); }

function loadSettings() {
  var s = lsGet(KEY_SETTINGS, null) || {};
  var out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  Object.keys(s).forEach(function (k) {
    if (k === 'notify' && s.notify) Object.assign(out.notify, s.notify);
    else if (k in out) out[k] = s[k];
  });
  return out;
}
function saveSettingsData() { lsSet(KEY_SETTINGS, settings); }

function getFleet() { return lsGet(KEY_FLEET, []); }
function saveFleetData(fleet) { lsSet(KEY_FLEET, fleet); }
function getVoyages() { return lsGet(KEY_VOYAGES, []); }
function saveVoyages(list) { lsSet(KEY_VOYAGES, list); }
function getInvoices() { return lsGet(KEY_INVOICES, []); }
function saveInvoices(list) { lsSet(KEY_INVOICES, list); }
function getAlerts() { return lsGet(KEY_ALERTS, []); }
function saveAlerts(list) { lsSet(KEY_ALERTS, list); }
function getNotifs() { return lsGet(KEY_NOTIFS, []); }
function saveNotifs(list) { lsSet(KEY_NOTIFS, list.slice(0, 80)); }

function findVessel(mmsi) {
  return getFleet().find(function (f) { return String(f.mmsi) === String(mmsi); }) || null;
}
function isFleetMmsi(mmsi) { return !!findVessel(mmsi); }
function voyageFor(mmsi) {
  return getVoyages().find(function (v) { return v.status === 'active' && String(v.vesselMmsi) === String(mmsi); }) || null;
}
function money(usd, showSign) {
  var f = FX[cur] || FX.USD;
  var n = Math.round((Number(usd) || 0) * f.r);
  var sign = n < 0 ? '-' : (showSign && n > 0 ? '+' : '');
  return sign + f.s + Math.abs(n).toLocaleString();
}
function utcNow() {
  var n = new Date();
  return [n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()]
    .map(function (v) { return String(v).padStart(2, '0'); }).join(':') + ' UTC';
}
function shortDate(iso) {
  var d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getDistance(from, to) {
  if (from === to) return 0;
  return (DIST[from] && DIST[from][to]) || (DIST[to] && DIST[to][from]) || null;
}

function estimateVoyage(from, to, cargoMT, rateUSD, speedKnots, fuelPerDay) {
  if (!from || !to || from === to) return null;
  var d = getDistance(from, to);
  if (!d) return null;
  var spd = speedKnots > 0 ? speedKnots : 14;
  var burn = fuelPerDay > 0 ? fuelPerDay : 28;
  var days = d / spd / 24;
  var bp = BUNK[from] || 620;
  var fuelUsd = Math.round(days * burn * bp);
  var portUsd = Math.round(d * 8 + 12000);
  var agentUsd = Math.round(8000 + d * 1.5);
  var revUsd = Math.round(cargoMT * rateUSD);
  var costUsd = fuelUsd + portUsd + agentUsd;
  var profitUsd = revUsd - costUsd;
  var margin = revUsd > 0 ? Math.round((profitUsd / revUsd) * 100) : 0;
  return {
    from: from, to: to, distanceNM: d, voyageDays: days,
    durationLabel: Math.floor(days) + 'd ' + Math.round((days % 1) * 24) + 'h',
    speedKnots: spd, fuelPerDay: burn, bunkerPriceUSD: bp,
    fuelTons: Math.round(days * burn),
    fuelCostUSD: fuelUsd, portDuesUSD: portUsd, agentFeesUSD: agentUsd,
    totalCostUSD: costUsd, revenueUSD: revUsd, profitUSD: profitUsd,
    marginPct: margin, cargoMT: cargoMT, freightRateUSD: rateUSD
  };
}

function statusPill(status) {
  if (status === 'underway') return { cls: 'pill-g', txt: 'Underway' };
  if (status === 'anchored') return { cls: 'pill-a', txt: 'Anchored' };
  return { cls: 'pill-b', txt: 'In port' };
}

function liveStatus(v) {
  var live = v && v.mmsi ? dashVessels[String(v.mmsi)] : null;
  if (!live) return v && v.status ? v.status : 'in port';
  if ((live.speedKnots || 0) > 1) return 'underway';
  if (live.navStatus === 1 || live.navStatus === 6) return 'anchored';
  return 'in port';
}

function setToggle(el, on) {
  if (!el) return;
  el.classList.toggle('on', !!on);
  el.classList.toggle('off', !on);
}

// ════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════
function gotoPage(id, btn) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.tnav').forEach(function (b) { b.classList.remove('active'); });
  $('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  else {
    var map = { dashboard: 0, fleet: 1, voyage: 2, alerts: 3, settings: 4 };
    var navs = document.querySelectorAll('.tnav');
    if (navs[map[id]]) navs[map[id]].classList.add('active');
  }
  if (id === 'voyage') { renderVoyageVessels(); setTimeout(calcEst, 50); }
  if (id === 'fleet') renderFleet();
  if (id === 'settings') renderSettings();
  if (id === 'alerts') { renderAlertVesselSelect(); renderAlerts(); renderNotifs(); }
  if (id === 'dashboard' && dashMap) setTimeout(function () { dashMap.invalidateSize(); }, 150);
  refreshDashboard();
}

// ════════════════════════════════════════════════════
// THEME & CURRENCY
// ════════════════════════════════════════════════════
function setTheme(theme) {
  isDark = theme === 'dark';
  settings.theme = theme;
  saveSettingsData();
  document.documentElement.setAttribute('data-theme', theme);
  var tb = $('themebtn');
  if (tb) tb.textContent = isDark ? '☀' : '🌙';
  var db = $('theme-dark-btn'), lb = $('theme-light-btn');
  if (db) { db.style.borderColor = isDark ? 'var(--cyan)' : 'var(--border)'; db.style.color = isDark ? 'var(--cyan)' : 'var(--muted)'; }
  if (lb) { lb.style.borderColor = !isDark ? 'var(--cyan)' : 'var(--border)'; lb.style.color = !isDark ? 'var(--cyan)' : 'var(--muted)'; }
  if (dashMap) {
    if (isDark) { if (lightTile) lightTile.remove(); if (darkTile) darkTile.addTo(dashMap); }
    else { if (darkTile) darkTile.remove(); if (lightTile) lightTile.addTo(dashMap); }
  }
  setTimeout(buildChart, 80);
}

function toggleTheme() { setTheme(isDark ? 'light' : 'dark'); }

function setCurrency(c) {
  cur = c;
  settings.currency = c;
  saveSettingsData();
  var sel = $('curr-sel');
  if (sel) sel.value = c;
  var ssel = $('settings-currency');
  if (ssel) ssel.value = c;
  refreshDashboard();
  calcEst();
}

// ════════════════════════════════════════════════════
// MAP
// ════════════════════════════════════════════════════
function initMap() {
  var home = HOME_PORTS[settings.homePort] || [62, 10];
  dashMap = L.map('dashboard-map', {
    center: home, zoom: 5, preferCanvas: true, zoomControl: true,
    scrollWheelZoom: true, doubleClickZoom: true, dragging: true, touchZoom: true, boxZoom: true
  });
  darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  });
  lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  });
  (isDark ? darkTile : lightTile).addTo(dashMap);
  dashMap.on('moveend zoomend', function () {
    clearTimeout(bboxTimer);
    bboxTimer = setTimeout(resubscribeAIS, 1500);
  });
  window.addEventListener('resize', function () { if (dashMap) dashMap.invalidateSize(); });
  setTimeout(function () { if (dashMap) dashMap.invalidateSize(); }, 200);
}

function flyHome() {
  var pt = HOME_PORTS[settings.homePort];
  if (dashMap && pt) dashMap.setView(pt, 6);
}

// ════════════════════════════════════════════════════
// AIS
// ════════════════════════════════════════════════════
function promptAISConnect() {
  var saved = lsGet(KEY_AIS, '');
  if (saved) connectAIS(saved);
  else gotoPage('settings');
}

function connectAIS(key) {
  if (!key) return;
  aisKey = key;
  lsSet(KEY_AIS, key);
  if (aisSocket) { aisSocket.onclose = null; aisSocket.close(); aisSocket = null; }
  setAISStatus('connecting');
  aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');
  aisSocket.onopen = function () {
    aisSocket.send(JSON.stringify({
      APIKey: key,
      BoundingBoxes: [getBBox()],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData']
    }));
    aisConnected = true;
    setAISStatus('connected');
    $('map-overlay').style.display = 'none';
    $('ais-bar-btn').textContent = 'Disconnect';
    $('ais-bar-btn').onclick = disconnectAIS;
  };
  aisSocket.onmessage = function (e) {
    aisMsgCount++;
    var d = e.data;
    if (d instanceof Blob) {
      var r = new FileReader();
      r.onload = function () { try { handleAISMsg(JSON.parse(r.result)); } catch (ex) {} };
      r.readAsText(d);
    } else { try { handleAISMsg(JSON.parse(d)); } catch (ex) {} }
  };
  aisSocket.onerror = function () { setAISStatus('error'); };
  aisSocket.onclose = function () {
    if (aisConnected) {
      aisConnected = false;
      setAISStatus('offline');
      $('ais-bar-btn').textContent = 'Reconnect';
      $('ais-bar-btn').onclick = function () { connectAIS(aisKey); };
    }
  };
}

function disconnectAIS() {
  aisConnected = false;
  if (aisSocket) { aisSocket.onclose = null; aisSocket.close(); aisSocket = null; }
  setAISStatus('offline');
  $('ais-bar-btn').textContent = 'Connect';
  $('ais-bar-btn').onclick = promptAISConnect;
}

function getBBox() {
  if (dashMap) {
    var b = dashMap.getBounds();
    return [[b.getSouthWest().lat, b.getSouthWest().lng], [b.getNorthEast().lat, b.getNorthEast().lng]];
  }
  return REGIONS[settings.region] || REGIONS.norway;
}

function resubscribeAIS() {
  if (!aisConnected || !aisSocket || aisSocket.readyState !== WebSocket.OPEN) return;
  aisSocket.send(JSON.stringify({
    APIKey: aisKey,
    BoundingBoxes: [getBBox()],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
  }));
  updateAISBarArea();
}

function updateAISBarArea() {
  if (!dashMap) return;
  var c = dashMap.getCenter();
  $('ais-bar-area').textContent = c.lat.toFixed(1) + '°  ' + c.lng.toFixed(1) + '°  zoom ' + dashMap.getZoom();
}

function setAISStatus(state) {
  var pill = $('ais-pill'), dot = $('ais-dot'), txt = $('ais-status-txt');
  var bDot = $('ais-bar-dot'), bTxt = $('ais-bar-status'), vSub = $('kpi-vsub');
  if (state === 'connected') {
    pill.classList.add('on'); dot.classList.add('blink'); txt.textContent = 'AIS live';
    bDot.classList.add('live'); bTxt.textContent = 'Connected — streaming';
    updateAISBarArea();
  } else if (state === 'connecting') {
    pill.classList.remove('on'); dot.classList.remove('blink'); txt.textContent = 'Connecting...';
    bDot.classList.remove('live'); bTxt.textContent = 'Connecting...';
  } else if (state === 'error') {
    pill.classList.remove('on'); dot.classList.remove('blink'); txt.textContent = 'AIS error';
    bDot.classList.remove('live'); bTxt.textContent = 'Connection error';
  } else {
    pill.classList.remove('on'); dot.classList.remove('blink'); txt.textContent = 'AIS offline';
    bDot.classList.remove('live'); bTxt.textContent = 'Not connected';
    $('ais-bar-area').textContent = '';
    $('ais-bar-count').textContent = '';
  }
  renderKPIs();
}

function shipTypeName(code) {
  var t = { 30: 'Fishing', 31: 'Towing', 36: 'Sailing', 37: 'Pleasure craft', 50: 'Pilot', 51: 'SAR', 52: 'Tug', 60: 'Passenger', 69: 'Passenger', 70: 'Cargo', 79: 'Cargo', 80: 'Tanker', 89: 'Tanker', 90: 'Other' };
  return t[code] || t[Math.floor((code || 0) / 10) * 10] || 'Unknown';
}
function navName(code) {
  return { 0: 'Underway', 1: 'At anchor', 2: 'Not under command', 3: 'Restricted', 5: 'Moored', 6: 'Aground' }[code] || 'Unknown';
}
function vColor(v) {
  var t = v.shipType || 0;
  if (t >= 60 && t < 70) return isDark ? '#a78bfa' : '#7c3aed';
  if (t >= 70 && t < 80) return isDark ? '#38b2d8' : '#0369a1';
  if (t >= 80 && t < 90) return isDark ? '#f5a623' : '#b45309';
  if (t === 30) return isDark ? '#2dd4a0' : '#047857';
  if (t === 52 || t === 31 || t === 32) return '#c2410c';
  if ((v.speedKnots || 0) > 1) return isDark ? '#2dd4a0' : '#047857';
  return '#64748b';
}
function makeVIcon(v, sel) {
  var c = vColor(v), h = v.headingDeg || 0, sz = sel ? 14 : 9;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (sz * 3) + '" height="' + (sz * 3) + '" viewBox="-15 -15 30 30">'
    + '<g transform="rotate(' + h + ')">'
    + '<polygon points="0,-10 6,7 0,4 -6,7" fill="white" stroke="white" stroke-width="3" stroke-linejoin="round"/>'
    + '<polygon points="0,-10 6,7 0,4 -6,7" fill="' + c + '" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>'
    + '</g>' + (sel ? '<circle r="13" fill="none" stroke="' + c + '" stroke-width="2" opacity="0.6"/>' : '') + '</svg>';
  return L.divIcon({ html: svg, className: '', iconSize: [sz * 3, sz * 3], iconAnchor: [sz * 1.5, sz * 1.5] });
}
function makePopup(v) {
  var inFleet = isFleetMmsi(v.mmsi);
  return '<div class="pname">' + esc(v.name || ('MMSI ' + v.mmsi)) + '</div>'
    + '<div class="prow"><span class="plbl">Speed</span><span class="pval">' + (v.speedKnots || 0).toFixed(1) + ' kn</span></div>'
    + '<div class="prow"><span class="plbl">MMSI</span><span class="pval">' + esc(v.mmsi) + '</span></div>'
    + '<div class="prow"><span class="plbl">Destination</span><span class="pval">' + esc(v.destination || '—') + '</span></div>'
    + '<div class="prow"><span class="plbl">Status</span><span class="pval">' + esc(navName(v.navStatus)) + '</span></div>'
    + '<div style="margin-top:10px;display:flex;gap:6px;">'
    + (inFleet
      ? '<button onclick="showVessel(\'' + esc(v.mmsi) + '\')" style="flex:1;background:var(--cyan);border:none;border-radius:6px;color:#fff;padding:7px;font-size:12px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;">View in fleet</button>'
      : '<button onclick="addVesselFromAIS(\'' + esc(v.mmsi) + '\')" style="flex:1;background:var(--cyan);border:none;border-radius:6px;color:#fff;padding:7px;font-size:12px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;">+ Add to fleet</button>')
    + '<button onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + esc(v.mmsi) + '\')" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text2);padding:7px 10px;font-size:12px;cursor:pointer;">Copy MMSI</button>'
    + '</div>';
}

function handleAISMsg(msg) {
  var meta = msg.MetaData || {};
  var mmsi = String(meta.MMSI || '');
  if (!mmsi) return;
  if (!dashVessels[mmsi] && Object.keys(dashVessels).length >= MAX_VESSELS) return;

  if (msg.MessageType === 'PositionReport') {
    var pos = msg.Message.PositionReport;
    if (!pos || (pos.Latitude === 0 && pos.Longitude === 0)) return;
    if (Math.abs(pos.Latitude || 0) > 90 || Math.abs(pos.Longitude || 0) > 180) return;
    if (!dashVessels[mmsi]) dashVessels[mmsi] = { mmsi: mmsi };
    dashVessels[mmsi] = Object.assign({}, dashVessels[mmsi], {
      mmsi: mmsi,
      name: (meta.ShipName && meta.ShipName.trim()) || dashVessels[mmsi].name || ('MMSI ' + mmsi),
      lat: pos.Latitude, lon: pos.Longitude,
      speedKnots: pos.Sog || 0,
      headingDeg: (pos.TrueHeading > 0 && pos.TrueHeading < 360) ? pos.TrueHeading : (pos.Cog || 0),
      navStatus: pos.NavigationalStatus,
      updated: new Date()
    });
    updateDashMarker(mmsi);
    var cnt = Object.keys(dashVessels).length;
    $('map-count').textContent = cnt + ' AIS targets';
    $('ais-bar-count').textContent = cnt + ' targets';
    maybeSyncFleetFromAIS();
  }

  if (msg.MessageType === 'ShipStaticData') {
    var s = msg.Message.ShipStaticData;
    if (!dashVessels[mmsi]) dashVessels[mmsi] = { mmsi: mmsi };
    dashVessels[mmsi] = Object.assign({}, dashVessels[mmsi], {
      name: (s.Name && s.Name.trim()) || dashVessels[mmsi].name || ('MMSI ' + mmsi),
      callSign: s.CallSign && s.CallSign.trim(),
      destination: s.Destination && s.Destination.trim(),
      imo: s.ImoNumber, shipType: s.Type
    });
    if (dashMarkers[mmsi]) updateDashMarker(mmsi);
  }
}

function updateDashMarker(mmsi) {
  var v = dashVessels[mmsi];
  if (!v || !v.lat || !dashMap) return;
  if (fleetMarkers[mmsi]) { dashMap.removeLayer(fleetMarkers[mmsi]); delete fleetMarkers[mmsi]; }
  var icon = makeVIcon(v, isFleetMmsi(mmsi) || selMmsi === mmsi);
  var popup = makePopup(v);
  if (dashMarkers[mmsi]) {
    dashMarkers[mmsi].setLatLng([v.lat, v.lon]).setIcon(icon);
    if (dashMarkers[mmsi].isPopupOpen()) dashMarkers[mmsi].setPopupContent(popup);
  } else {
    dashMarkers[mmsi] = L.marker([v.lat, v.lon], { icon: icon })
      .bindPopup(popup, { maxWidth: 240 })
      .bindTooltip(v.name || mmsi, { className: 'vtt', direction: 'top', offset: [0, -8] })
      .addTo(dashMap);
  }
}

function maybeSyncFleetFromAIS() {
  var now = Date.now();
  if (now - lastFleetSync < 5000) return;
  lastFleetSync = now;
  var fleet = getFleet();
  var changed = false;
  fleet.forEach(function (f) {
    var live = dashVessels[String(f.mmsi)];
    if (!live || !live.lat) return;
    var spd = (live.speedKnots || 0).toFixed(1);
    var st = liveStatus(f);
    if (f.speed !== spd || f.status !== st || f.lat !== live.lat) {
      f.speed = spd; f.status = st; f.lat = live.lat; f.lon = live.lon;
      if (live.destination) f.destination = live.destination;
      if (live.name && live.name.indexOf('MMSI') !== 0) f.name = live.name;
      changed = true;
    }
  });
  if (changed) {
    saveFleetData(fleet);
    var page = document.querySelector('.page.active');
    if (page && page.id === 'page-fleet') renderFleet();
    if (page && page.id === 'page-dashboard') renderPnlRail();
    evaluateAlerts();
  }
}

setInterval(function () {
  if (!aisConnected || !settings.notify.stale) return;
  var now = new Date();
  Object.keys(dashVessels).forEach(function (mmsi) {
    var v = dashVessels[mmsi];
    if (v.updated && (now - v.updated) > 15 * 60 * 1000) {
      if (dashMarkers[mmsi]) { dashMap.removeLayer(dashMarkers[mmsi]); delete dashMarkers[mmsi]; }
      delete dashVessels[mmsi];
    }
  });
}, 60000);

function plotFleetOnMap() {
  if (!dashMap) return;
  getFleet().forEach(function (v) {
    var mmsi = String(v.mmsi || '');
    if (!mmsi) return;
    if (dashVessels[mmsi] && dashVessels[mmsi].lat) return;
    if (!v.lat || !v.lon) return;
    var fake = { mmsi: mmsi, name: v.name, lat: v.lat, lon: v.lon, speedKnots: parseFloat(v.speed) || 0, headingDeg: v.headingDeg || 0, shipType: v.shipTypeCode || 70, destination: v.destination || '', navStatus: v.status === 'underway' ? 0 : 5 };
    var icon = makeVIcon(fake, true);
    if (fleetMarkers[mmsi]) {
      fleetMarkers[mmsi].setLatLng([v.lat, v.lon]).setIcon(icon);
    } else {
      fleetMarkers[mmsi] = L.marker([v.lat, v.lon], { icon: icon })
        .bindPopup('<div class="pname">' + esc(v.name) + '</div><div class="prow"><span class="plbl">Fleet</span><span class="pval">Registered</span></div>', { maxWidth: 220 })
        .bindTooltip(v.name, { className: 'vtt', direction: 'top', offset: [0, -8] })
        .addTo(dashMap);
    }
  });
}

// ════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════
function refreshDashboard() {
  renderKPIs();
  renderInsight();
  renderPnlRail();
  renderBunkerTable();
  renderInvoices();
  buildChart();
  plotFleetOnMap();
  renderAlertBadge();
}

function renderKPIs() {
  var fleet = getFleet();
  var vos = getVoyages().filter(function (v) { return v.status === 'active'; });
  var inv = getInvoices().filter(function (i) { return i.status === 'pending'; });
  var triggered = getAlerts().filter(function (a) { return a.enabled !== false && a.triggered; });
  var liveCount = fleet.filter(function (f) { return dashVessels[String(f.mmsi)]; }).length;

  var pnl = vos.reduce(function (s, v) { return s + (v.profitUSD || 0); }, 0);
  var el = $('kpi-pnl');
  if (vos.length) {
    el.textContent = money(pnl, true);
    el.className = 'kpi-val ' + (pnl >= 0 ? 'g' : 'r');
    $('kpi-curr').textContent = cur + ' · ' + vos.length + ' active voyage' + (vos.length === 1 ? '' : 's');
  } else {
    el.textContent = '—';
    el.className = 'kpi-val';
    $('kpi-curr').textContent = 'No voyages yet';
  }

  var nm = vos.reduce(function (s, v) { return s + (v.distanceNM || 0); }, 0);
  var fuel = vos.reduce(function (s, v) { return s + (v.fuelCostUSD || 0); }, 0);
  if (nm > 0) {
    var per = fuel / nm;
    $('kpi-bunker').textContent = money(per);
    $('kpi-bunker').className = 'kpi-val a';
    $('kpi-bunker-sub').textContent = cur + '/nm · ' + vos.length + ' voyage' + (vos.length === 1 ? '' : 's');
  } else {
    $('kpi-bunker').textContent = '—';
    $('kpi-bunker-sub').textContent = 'From active voyages';
  }

  var pendingUsd = inv.reduce(function (s, i) { return s + (i.amountUSD || 0); }, 0);
  $('kpi-inv').textContent = inv.length ? money(pendingUsd) : '—';
  $('kpi-inv').className = 'kpi-val c';
  $('kpi-inv-sub').textContent = inv.length + ' open';

  $('kpi-vessels').textContent = fleet.length;
  if (aisConnected) $('kpi-vsub').textContent = liveCount + ' live on AIS · ' + Object.keys(dashVessels).length + ' in view';
  else $('kpi-vsub').textContent = fleet.length ? 'AIS offline' : 'None registered';

  $('kpi-alerts').textContent = triggered.length;
  $('kpi-alerts').className = 'kpi-val' + (triggered.length ? ' r' : '');
  $('kpi-alerts-sub').textContent = triggered.length ? 'triggered now' : 'none triggered';
}

function renderInsight() {
  var el = $('insight-text');
  var fleet = getFleet();
  var vos = getVoyages().filter(function (v) { return v.status === 'active'; });
  if (!fleet.length) {
    el.innerHTML = '<strong>Get started —</strong> Connect AIS and add a vessel, or add one manually in Fleet. <a href="#" onclick="event.preventDefault();loadSample();" style="color:var(--cyan)">Load sample data</a> to preview the full dashboard.';
    return;
  }
  if (!vos.length) {
    el.innerHTML = '<strong>' + fleet.length + ' vessel' + (fleet.length === 1 ? '' : 's') + ' in fleet.</strong> Open Voyage planner to estimate a route using this vessel’s speed and fuel burn.';
    return;
  }
  var cheapest = Object.keys(BUNK).sort(function (a, b) { return BUNK[a] - BUNK[b]; })[0];
  var vo = vos[0];
  var destP = BUNK[vo.to], fromP = BUNK[vo.from];
  var tip = '';
  if (fromP && destP && destP + 8 < fromP) {
    tip = ' ' + esc(vo.to) + ' VLSFO is $' + (fromP - destP) + '/MT below ' + esc(vo.from) + ' on the ' + esc(vo.vesselName) + ' voyage.';
  } else {
    tip = ' Indicative cheapest bunker in the table: ' + esc(cheapest) + ' at $' + BUNK[cheapest] + '/MT.';
  }
  el.innerHTML = '<strong>Active P&amp;L —</strong> ' + esc(money(vos.reduce(function (s, v) { return s + v.profitUSD; }, 0), true)) + ' across ' + vos.length + ' voyage' + (vos.length === 1 ? '' : 's') + '.' + tip;
}

function renderPnlRail() {
  var list = $('vsel-list');
  var box = $('vdetail-box');
  var fleet = getFleet();
  if (!fleet.length) {
    list.innerHTML = '<div class="empty"><strong>No fleet yet</strong>Add a vessel from the map or Fleet tab.</div>';
    box.style.display = 'none';
    return;
  }
  if (!selMmsi || !findVessel(selMmsi)) selMmsi = String(fleet[0].mmsi || '');
  list.innerHTML = fleet.map(function (v) {
    var st = statusPill(liveStatus(v));
    var vo = voyageFor(v.mmsi);
    var right = vo
      ? '<span class="dval" style="color:' + (vo.profitUSD >= 0 ? 'var(--green)' : 'var(--red)') + '">' + esc(money(vo.profitUSD, true)) + '</span>'
      : '<span class="pill ' + st.cls + '">' + st.txt + '</span>';
    return '<div class="drow clickable' + (String(v.mmsi) === selMmsi ? ' sel' : '') + '" onclick="showVessel(\'' + esc(v.mmsi) + '\')">'
      + '<span style="font-size:13px;font-weight:500;">' + esc((v.flag || '') + ' ' + v.name) + '</span>' + right + '</div>';
  }).join('');
  renderVesselDetail(selMmsi);
}

function renderVesselDetail(mmsi) {
  var box = $('vdetail-box');
  var v = findVessel(mmsi);
  if (!v) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  var vo = voyageFor(mmsi);
  var live = dashVessels[String(mmsi)];
  $('sel-vname').textContent = v.name + (vo ? ' · ' + vo.from + ' → ' + vo.to : '');
  if (vo) {
    $('vdetail').innerHTML =
      dr('Route', vo.from + ' → ' + vo.to)
      + dr('Cargo', (vo.cargoType || 'Cargo') + ' · ' + vo.cargoMT + ' MT', 'font-size:11px;')
      + dr('Distance', vo.distanceNM.toLocaleString() + ' nm')
      + dr('Duration', vo.durationLabel + ' @ ' + vo.speedKnots + ' kn')
      + dr('Revenue', money(vo.revenueUSD, true), 'color:var(--green);')
      + dr('Fuel', money(-vo.fuelCostUSD), 'color:var(--red);')
      + dr('Port+Agent', money(-(vo.portDuesUSD + vo.agentFeesUSD)), 'color:var(--red);')
      + dr('Net P&L', money(vo.profitUSD, true), 'color:' + (vo.profitUSD >= 0 ? 'var(--green)' : 'var(--red)') + ';font-size:14px;');
    var costShare = vo.revenueUSD > 0 ? Math.min(100, Math.round((vo.totalCostUSD / vo.revenueUSD) * 100)) : 100;
    $('mfill').style.width = Math.max(4, 100 - costShare) + '%';
    $('mfill').style.background = vo.profitUSD >= 0 ? 'var(--green)' : 'var(--red)';
    $('mpct').textContent = (vo.marginPct >= 0 ? '+' : '') + vo.marginPct + '%';
    $('mpct').style.color = vo.profitUSD >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    var spd = live ? (live.speedKnots || 0).toFixed(1) : (v.speed || '—');
    $('vdetail').innerHTML =
      dr('Status', statusPill(liveStatus(v)).txt)
      + dr('MMSI', v.mmsi || '—')
      + dr('Type', v.type || '—')
      + dr('Speed', spd + ' kn')
      + dr('Destination', (live && live.destination) || v.destination || '—')
      + '<div class="empty" style="padding:16px 0 4px;">No active voyage. <a href="#" onclick="event.preventDefault();planVoyageFor(\'' + esc(v.mmsi) + '\')" style="color:var(--cyan)">Plan one →</a></div>';
    $('mfill').style.width = '0%';
    $('mpct').textContent = '—';
    $('mpct').style.color = 'var(--muted)';
  }
}

function dr(label, val, valStyle) {
  return '<div class="drow"><span class="dlabel">' + esc(label) + '</span><span class="dval" style="' + (valStyle || '') + '">' + esc(val) + '</span></div>';
}

function showVessel(mmsi) {
  selMmsi = String(mmsi);
  gotoPage('dashboard');
  renderPnlRail();
  var live = dashVessels[selMmsi] || findVessel(selMmsi);
  if (dashMap && live && live.lat) dashMap.setView([live.lat, live.lon], Math.max(dashMap.getZoom(), 7));
}

function planVoyageFor(mmsi) {
  gotoPage('voyage');
  renderVoyageVessels();
  var sel = $('f-vessel');
  if (sel) { sel.value = String(mmsi); onVoyageVesselChange(); }
}

function renderBunkerTable() {
  var ports = ['Rotterdam', 'Singapore', 'Fujairah', 'Bergen', 'Houston', 'Tokyo'];
  $('bunker-body').innerHTML = ports.map(function (p) {
    return '<tr><td><div class="port-n">' + (PORT_FLAG[p] || '') + ' ' + p + '</div></td><td><div class="price-n">$' + BUNK[p] + '</div></td></tr>';
  }).join('');
}

function renderAlertBadge() {
  var n = getAlerts().filter(function (a) { return a.enabled !== false && a.triggered; }).length;
  $('alert-ndot').classList.toggle('show', n > 0);
}

// ════════════════════════════════════════════════════
// FLEET
// ════════════════════════════════════════════════════
function renderFleet() {
  var fleet = getFleet();
  var grid = $('fleet-grid');
  var ph = $('add-ph');
  Array.from(grid.querySelectorAll('.vc')).forEach(function (c) { c.remove(); });
  var underway = 0, anchored = 0, inport = 0;
  fleet.forEach(function (v) {
    var st = liveStatus(v);
    if (st === 'underway') underway++;
    else if (st === 'anchored') anchored++;
    else inport++;
    var pill = statusPill(st);
    var vo = voyageFor(v.mmsi);
    var live = dashVessels[String(v.mmsi)];
    var spd = live ? (live.speedKnots || 0).toFixed(1) : (v.speed || '—');
    var pnl = vo ? '<span style="color:' + (vo.profitUSD >= 0 ? 'var(--green)' : 'var(--red)') + '">' + esc(money(vo.profitUSD, true)) + '</span>' : 'No voyage';
    var card = document.createElement('div');
    card.className = 'vc';
    card.innerHTML = '<div class="vc-top"><div><div style="font-size:18px;">' + esc(v.flag || '🚢') + '</div>'
      + '<div class="vc-name">' + esc(v.name) + '</div>'
      + '<div class="vc-type">' + esc(v.type || 'Vessel') + (v.gt ? ' · ' + esc(v.gt) + ' GT' : '') + '</div></div>'
      + '<span class="pill ' + pill.cls + '">' + pill.txt + '</span></div>'
      + '<div class="vc-stats">'
      + '<div class="vc-stat"><div class="vc-stat-l">MMSI</div><div class="vc-stat-v" style="font-size:11px;">' + esc(v.mmsi || '—') + '</div></div>'
      + '<div class="vc-stat"><div class="vc-stat-l">IMO</div><div class="vc-stat-v" style="font-size:11px;">' + esc(v.imo || '—') + '</div></div>'
      + '<div class="vc-stat"><div class="vc-stat-l">Speed</div><div class="vc-stat-v">' + esc(spd) + ' kn</div></div>'
      + '<div class="vc-stat"><div class="vc-stat-l">P&amp;L</div><div class="vc-stat-v">' + pnl + '</div></div>'
      + '</div>'
      + '<div class="vc-actions">'
      + '<button class="btn btn-s" style="font-size:12px;padding:6px 12px;" onclick="showVessel(\'' + esc(v.mmsi) + '\')">Details</button>'
      + '<button class="btn btn-s" style="font-size:12px;padding:6px 12px;" onclick="editFleetVessel(\'' + esc(v.mmsi) + '\')">Edit</button>'
      + '<button class="btn-danger" onclick="removeFleetVessel(\'' + esc(v.mmsi) + '\')">Remove</button>'
      + '</div>';
    grid.insertBefore(card, ph);
  });
  var summary = fleet.length + ' vessels registered';
  if (underway) summary += ' · ' + underway + ' underway';
  if (anchored) summary += ' · ' + anchored + ' anchored';
  if (inport) summary += ' · ' + inport + ' in port';
  if (!fleet.length) summary = 'No vessels yet — add your first vessel';
  $('fleet-summary').textContent = summary;
  renderVoyageVessels();
}

function renderVoyageVessels() {
  var sel = $('f-vessel');
  if (!sel) return;
  var fleet = getFleet();
  var current = sel.value;
  sel.innerHTML = '';
  if (!fleet.length) {
    var opt = document.createElement('option');
    opt.value = ''; opt.textContent = '— Add vessels in Fleet tab first —';
    sel.appendChild(opt);
    return;
  }
  fleet.forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v.mmsi || v.name;
    opt.textContent = (v.flag || '🚢') + ' ' + v.name + (v.type ? ' (' + v.type + ')' : '');
    sel.appendChild(opt);
  });
  if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) sel.value = current;
  else onVoyageVesselChange();
}

function onVoyageVesselChange() {
  var v = findVessel($('f-vessel').value);
  if (v) {
    if (v.speed) $('f-spd').value = parseFloat(v.speed) || v.speed;
    if (v.fuel) $('f-fuel').value = parseFloat(v.fuel) || v.fuel;
    if (v.type) {
      var cargo = $('f-cargo');
      Array.prototype.forEach.call(cargo.options, function (o) {
        if (o.value.toLowerCase() === String(v.type).toLowerCase()) cargo.value = o.value;
      });
    }
  }
  calcEst();
}

function addVesselFromAIS(mmsi) {
  var v = dashVessels[mmsi];
  if (!v) return;
  var fleet = getFleet();
  if (fleet.some(function (f) { return String(f.mmsi) === String(mmsi); })) { showToast((v.name || mmsi) + ' already in fleet', 'amber'); return; }
  fleet.push({
    mmsi: String(v.mmsi),
    name: v.name || ('MMSI ' + mmsi),
    imo: v.imo || '',
    flag: '🚢',
    type: shipTypeName(v.shipType || 0),
    shipTypeCode: v.shipType || 0,
    gt: '',
    speed: (v.speedKnots || 0).toFixed(1),
    fuel: 28,
    status: liveStatus({ mmsi: mmsi, status: 'underway' }),
    lat: v.lat, lon: v.lon, destination: v.destination || '',
    addedAt: new Date().toISOString(),
    source: 'ais'
  });
  saveFleetData(fleet);
  if (dashMarkers[mmsi]) updateDashMarker(mmsi);
  renderVoyageVessels();
  refreshDashboard();
  showToast('✓ ' + (v.name || mmsi) + ' added to fleet', 'green');
}

function removeFleetVessel(mmsi) {
  if (!confirm('Remove this vessel from fleet? Active voyages stay in the log until you complete them.')) return;
  saveFleetData(getFleet().filter(function (f) { return String(f.mmsi) !== String(mmsi); }));
  if (fleetMarkers[mmsi] && dashMap) { dashMap.removeLayer(fleetMarkers[mmsi]); delete fleetMarkers[mmsi]; }
  if (dashMarkers[mmsi]) updateDashMarker(mmsi);
  if (selMmsi === String(mmsi)) selMmsi = '';
  renderFleet();
  refreshDashboard();
  showToast('Vessel removed', 'red');
}

function editFleetVessel(mmsi) {
  var v = findVessel(mmsi);
  if (!v) return;
  $('modal-title').textContent = 'Edit — ' + v.name;
  $('m-name').value = v.name || '';
  $('m-imo').value = v.imo || '';
  $('m-mmsi').value = v.mmsi || '';
  $('m-gt').value = v.gt || '';
  $('m-fuel').value = v.fuel || '';
  $('m-spd').value = v.speed || '';
  $('m-notes').value = v.notes || '';
  if (v.type) $('m-type').value = v.type;
  $('add-modal').dataset.editMmsi = mmsi;
  $('add-modal').style.display = 'flex';
}

function openAddVessel() {
  $('modal-title').textContent = 'Add vessel';
  ['m-name', 'm-imo', 'm-mmsi', 'm-gt', 'm-fuel', 'm-spd', 'm-notes'].forEach(function (id) { $(id).value = ''; });
  delete $('add-modal').dataset.editMmsi;
  $('add-modal').style.display = 'flex';
}
function closeModal() { $('add-modal').style.display = 'none'; }

function saveVessel() {
  var n = $('m-name').value.trim();
  if (!n) { $('m-name').style.borderColor = 'var(--red)'; setTimeout(function () { $('m-name').style.borderColor = ''; }, 2000); return; }
  var flag = $('m-flag').value.split(' ')[0];
  var rec = {
    name: n,
    flag: flag,
    type: $('m-type').value,
    gt: $('m-gt').value || '',
    speed: $('m-spd').value || '',
    fuel: parseFloat($('m-fuel').value) || 28,
    mmsi: $('m-mmsi').value.trim(),
    imo: $('m-imo').value.trim(),
    notes: $('m-notes').value.trim()
  };
  var editMmsi = $('add-modal').dataset.editMmsi;
  var fleet = getFleet();
  if (editMmsi) {
    fleet = fleet.map(function (f) {
      if (String(f.mmsi) === String(editMmsi)) return Object.assign({}, f, rec, { mmsi: rec.mmsi || editMmsi });
      return f;
    });
    showToast('✓ ' + n + ' updated', 'green');
  } else {
    if (!rec.mmsi) rec.mmsi = 'local-' + uid('v');
    rec.status = 'in port';
    rec.addedAt = new Date().toISOString();
    rec.source = rec.source || 'manual';
    fleet.push(rec);
    showToast('✓ ' + n + ' added to fleet', 'green');
  }
  saveFleetData(fleet);
  closeModal();
  renderFleet();
  refreshDashboard();
}

// ════════════════════════════════════════════════════
// VOYAGE PLANNER
// ════════════════════════════════════════════════════
function calcEst() {
  var from = $('f-from').value, to = $('f-to').value;
  var wt = parseFloat($('f-wt').value) || 0;
  var rate = parseFloat($('f-rate').value) || 0;
  var spd = parseFloat($('f-spd').value) || 14;
  var burn = parseFloat($('f-fuel').value) || 28;
  if (from === to) {
    $('est-body').innerHTML = '<div style="color:var(--red);text-align:center;padding:16px;font-size:13px;">Select different ports</div>';
    lastEstimate = null;
    return;
  }
  if (!getDistance(from, to)) {
    $('est-body').innerHTML = '<div class="empty">No distance on file for this pair. Distances are a static table, not live routing.</div>';
    lastEstimate = null;
    return;
  }
  var est = estimateVoyage(from, to, wt, rate, spd, burn);
  lastEstimate = est;
  var pos = est.profitUSD > 0;
  $('est-body').innerHTML =
    er('Route', from + ' → ' + to)
    + er('Distance', est.distanceNM.toLocaleString() + ' nm')
    + er('Voyage time', est.durationLabel + ' at ' + spd + ' kn')
    + er('Burn', burn + ' MT/day · ' + est.fuelTons + ' MT')
    + er('Revenue', '<span style="color:var(--green);">+$' + est.revenueUSD.toLocaleString() + '</span>')
    + er('Fuel @ $' + est.bunkerPriceUSD, '<span style="color:var(--red);">-$' + est.fuelCostUSD.toLocaleString() + '</span>')
    + er('Port dues', '<span style="color:var(--red);">-$' + est.portDuesUSD.toLocaleString() + '</span>')
    + er('Agent fees', '<span style="color:var(--red);">-$' + est.agentFeesUSD.toLocaleString() + '</span>')
    + '<div class="est-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;"><span class="est-l">Net P&amp;L</span><span style="font-family:\'DM Mono\',monospace;font-size:18px;font-weight:500;color:' + (pos ? 'var(--green)' : 'var(--red)') + ';">' + (pos ? '+' : '-') + '$' + Math.abs(est.profitUSD).toLocaleString() + '</span></div>'
    + er('Margin', '<span style="color:' + (pos ? 'var(--green)' : 'var(--red)') + ';">' + est.marginPct + '%</span>')
    + (!pos ? '<div class="warn-box warn-r">Unprofitable at current rate — raise freight or cut costs.</div>' : '')
    + (pos && est.marginPct < 35 ? '<div class="warn-box warn-a">Margin below 35% — tight. Review before committing.</div>' : '');

  var destBp = BUNK[to] || 615;
  var bestPort = est.bunkerPriceUSD <= destBp ? from : to;
  $('port-comp').innerHTML =
    dr('Bunker at ' + from, '$' + est.bunkerPriceUSD + '/MT', 'color:var(--cyan);')
    + dr('Bunker at ' + to, '$' + destBp + '/MT', 'color:var(--cyan);')
    + dr('Cheaper on route', bestPort + ' · $' + Math.min(est.bunkerPriceUSD, destBp) + '/MT', 'color:var(--green);')
    + dr('Table cheapest', 'Rotterdam · $602/MT', 'color:var(--green);');
}

function er(label, val) {
  return '<div class="est-row"><span class="est-l">' + label + '</span><span class="est-v">' + val + '</span></div>';
}

function createVoyage() {
  calcEst();
  var vesselId = $('f-vessel').value;
  var v = findVessel(vesselId);
  if (!v) { showToast('Add a vessel to the fleet first', 'amber'); gotoPage('fleet'); return; }
  if (!lastEstimate) { showToast('Cannot create this voyage — check ports', 'amber'); return; }
  if (voyageFor(v.mmsi)) {
    if (!confirm(v.name + ' already has an active voyage. Replace it?')) return;
    saveVoyages(getVoyages().map(function (vo) {
      if (vo.status === 'active' && String(vo.vesselMmsi) === String(v.mmsi)) return Object.assign({}, vo, { status: 'completed', completedAt: new Date().toISOString() });
      return vo;
    }));
  }
  var rec = Object.assign({}, lastEstimate, {
    id: uid('voy'),
    vesselMmsi: String(v.mmsi),
    vesselName: v.name,
    cargoType: $('f-cargo').value,
    departDate: $('f-date').value || new Date().toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date().toISOString(),
    source: 'user'
  });
  var list = getVoyages();
  list.unshift(rec);
  saveVoyages(list);
  renderVoyageLog();
  evaluateAlerts();
  refreshDashboard();
  showToast('✓ Voyage created for ' + v.name, 'green');
}

function renderVoyageLog() {
  var list = getVoyages();
  if (!list.length) {
    $('voyage-log').innerHTML = '<div class="empty">No voyages created yet</div>';
    return;
  }
  $('voyage-log').innerHTML = list.map(function (v) {
    var pill = v.status === 'active' ? 'pill-g">Tracking' : 'pill-b">Completed';
    return '<div class="irow"><div class="iico iico-a">🚢</div><div style="flex:1;"><div class="iname">' + esc(v.vesselName) + ' — ' + esc(v.from) + ' → ' + esc(v.to) + '</div>'
      + '<div class="imeta">' + esc(shortDate(v.createdAt)) + ' · ' + esc(v.cargoMT) + ' MT · $' + esc(v.freightRateUSD) + '/MT · ' + esc(money(v.profitUSD, true)) + '</div></div>'
      + '<span class="pill ' + pill + '</span>'
      + (v.status === 'active' ? '<button class="btn btn-s" style="font-size:11px;padding:4px 8px;margin-left:8px;" onclick="completeVoyage(\'' + esc(v.id) + '\')">Complete</button>' : '')
      + '</div>';
  }).join('');
}

function completeVoyage(id) {
  saveVoyages(getVoyages().map(function (v) {
    if (v.id === id) return Object.assign({}, v, { status: 'completed', completedAt: new Date().toISOString() });
    return v;
  }));
  renderVoyageLog();
  refreshDashboard();
  showToast('Voyage completed', 'green');
}

// ════════════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════════════
function renderInvoices() {
  var list = getInvoices();
  var el = $('invoice-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty"><strong>No invoices</strong>Log bunker, port or agency costs against a vessel.</div>';
    return;
  }
  var ico = { fuel: 'iico-f">⛽', port_dues: 'iico-p">⚓', agent_fees: 'iico-a">📋', other: 'iico-a">📋' };
  el.innerHTML = list.slice(0, 8).map(function (i) {
    var pill = i.status === 'paid' ? '<span class="pill pill-g" style="font-size:9px;">Paid</span>' : '<span class="pill pill-a" style="font-size:9px;">Pending</span>';
    var cat = i.category || 'other';
    return '<div class="irow"><div class="iico ' + (ico[cat] || ico.other) + '</div><div style="flex:1;"><div class="iname">' + esc(i.vendor) + (i.port ? ' — ' + esc(i.port) : '') + '</div>'
      + '<div class="imeta">' + esc(i.vesselName || 'Fleet') + ' · ' + esc(shortDate(i.createdAt)) + '</div></div><div><div class="iamt">' + esc(money(-i.amountUSD)) + '</div>' + pill + '</div></div>';
  }).join('');
}

function openInvoiceModal() {
  fillSelect($('i-vessel'), getFleet(), true);
  $('i-vendor').value = '';
  $('i-amt').value = '';
  $('inv-modal').style.display = 'flex';
}
function closeInvoiceModal() { $('inv-modal').style.display = 'none'; }

function fillSelect(sel, fleet, optional) {
  if (!sel) return;
  sel.innerHTML = optional ? '<option value="">— Optional —</option>' : '<option value="">— Select vessel —</option>';
  fleet.forEach(function (v) {
    var o = document.createElement('option');
    o.value = v.mmsi; o.textContent = (v.flag || '') + ' ' + v.name;
    sel.appendChild(o);
  });
}

function saveInvoice() {
  var vendor = $('i-vendor').value.trim();
  var amt = parseFloat($('i-amt').value);
  if (!vendor || !(amt > 0)) {
    $('i-vendor').style.borderColor = vendor ? '' : 'var(--red)';
    $('i-amt').style.borderColor = amt > 0 ? '' : 'var(--red)';
    setTimeout(function () { $('i-vendor').style.borderColor = ''; $('i-amt').style.borderColor = ''; }, 2000);
    return;
  }
  var mmsi = $('i-vessel').value;
  var v = findVessel(mmsi);
  var rec = {
    id: uid('inv'), vendor: vendor, amountUSD: amt, category: $('i-cat').value,
    port: $('i-port').value, vesselMmsi: mmsi, vesselName: v ? v.name : '',
    status: $('i-status').value, createdAt: new Date().toISOString(), source: 'user'
  };
  var list = getInvoices();
  list.unshift(rec);
  saveInvoices(list);
  closeInvoiceModal();
  renderInvoices();
  renderKPIs();
  evaluateAlerts();
  showToast('✓ Invoice logged', 'green');
}

// ════════════════════════════════════════════════════
// ALERTS
// ════════════════════════════════════════════════════
function selType(el) {
  document.querySelectorAll('.atype').forEach(function (a) { a.classList.remove('sel'); });
  el.classList.add('sel');
  alertType = el.getAttribute('data-type') || 'fuel';
  ['fuel', 'margin', 'arrival', 'text'].forEach(function (k) { $('af-' + k).classList.remove('on'); });
  if (alertType === 'fuel') $('af-fuel').classList.add('on');
  else if (alertType === 'margin') $('af-margin').classList.add('on');
  else if (alertType === 'arrival') { $('af-arrival').classList.add('on'); renderAlertVesselSelect(); }
  else if (alertType === 'custom') $('af-text').classList.add('on');
}

function renderAlertVesselSelect() { fillSelect($('a-vessel'), getFleet(), false); }

function addAlert() {
  var name = $('an').value.trim();
  var rec = { id: uid('al'), type: alertType, enabled: true, triggered: false, createdAt: new Date().toISOString(), source: 'user', notify: $('a-notify').value };
  if (alertType === 'fuel') {
    rec.port = $('a-port').value; rec.op = $('a-op').value; rec.threshold = parseFloat($('a-fuel-th').value) || 0;
    rec.condition = rec.port + ' ' + rec.op + ' $' + rec.threshold;
    rec.name = name || ('Bunker ' + rec.op + ' $' + rec.threshold + ' · ' + rec.port);
  } else if (alertType === 'margin') {
    rec.threshold = parseFloat($('a-margin-th').value) || 35;
    rec.condition = 'margin < ' + rec.threshold + '%';
    rec.name = name || ('Margin below ' + rec.threshold + '%');
  } else if (alertType === 'arrival') {
    rec.vesselMmsi = $('a-vessel').value;
    var v = findVessel(rec.vesselMmsi);
    if (!v) { showToast('Pick a fleet vessel', 'amber'); return; }
    rec.condition = v.name + ' arrives / stops';
    rec.name = name || (v.name + ' arrival');
  } else if (alertType === 'invoice') {
    rec.condition = 'pending invoice older than 14 days';
    rec.name = name || 'Invoice overdue';
  } else {
    rec.condition = $('ac').value.trim();
    rec.name = name;
    if (!rec.name || !rec.condition) {
      $('an').style.borderColor = 'var(--red)';
      setTimeout(function () { $('an').style.borderColor = ''; }, 2000);
      return;
    }
  }
  var list = getAlerts();
  list.push(rec);
  saveAlerts(list);
  $('an').value = ''; $('ac').value = '';
  renderAlerts();
  evaluateAlerts();
  showToast('✓ Alert saved', 'green');
}

function toggleAlert(id) {
  saveAlerts(getAlerts().map(function (a) {
    if (a.id === id) return Object.assign({}, a, { enabled: a.enabled === false });
    return a;
  }));
  renderAlerts();
  renderKPIs();
  renderAlertBadge();
}

function renderAlerts() {
  var list = getAlerts();
  $('alrt-count').textContent = list.filter(function (a) { return a.enabled !== false; }).length + ' ACTIVE';
  if (!list.length) {
    $('alert-list').innerHTML = '<div class="empty">No alerts yet — add a fuel, margin or arrival rule.</div>';
    return;
  }
  $('alert-list').innerHTML = list.map(function (a) {
    var on = a.enabled !== false;
    var trig = on && a.triggered;
    var dot = !on ? 'adot-m' : (trig ? 'adot-r' : 'adot-g');
    var pill = !on ? '<span class="pill" style="font-size:10px;background:var(--faint);color:var(--muted);">Paused</span>'
      : trig ? '<span class="pill pill-r" style="font-size:10px;">Triggered</span>'
      : '<span class="pill pill-g" style="font-size:10px;">Watching</span>';
    return '<div class="arow"><div class="adot ' + dot + '"></div><div style="flex:1;"><div class="aname">' + esc(a.name) + '</div>'
      + '<div class="adesc">' + esc(a.condition) + (a.lastFired ? ' · last ' + esc(a.lastFired) : '') + '</div></div>'
      + pill + '<button class="toggle ' + (on ? 'on' : 'off') + '" onclick="toggleAlert(\'' + esc(a.id) + '\')"><div class="tthumb"></div></button></div>';
  }).join('');
}

function pushNotif(level, text, kind) {
  var list = getNotifs();
  var last = list[0];
  if (last && last.text === text) return;
  list.unshift({ id: uid('n'), level: level, text: text, kind: kind, at: new Date().toISOString() });
  saveNotifs(list);
  renderNotifs();
}

function renderNotifs() {
  var list = getNotifs();
  if (!list.length) {
    $('notif-log').innerHTML = '<div class="empty">No notifications yet. Alerts write here when they fire.</div>';
    return;
  }
  var col = { red: 'var(--red)', amber: 'var(--amber)', cyan: 'var(--cyan)' };
  var lab = { red: 'TRIGGERED', amber: 'WARNING', cyan: 'INFO' };
  $('notif-log').innerHTML = list.slice(0, 20).map(function (n) {
    var c = col[n.level] || col.cyan;
    return '<div class="nrow"><div class="ndot2" style="background:' + c + ';"></div><div><div class="ntext"><strong style="color:' + c + ';">' + (lab[n.level] || 'INFO') + '</strong> — ' + esc(n.text) + '</div>'
      + '<div class="ntime">' + esc(shortDate(n.at) + ' ' + (n.at ? new Date(n.at).toISOString().slice(11, 16) : '') + ' UTC · ' + (n.kind || '')) + '</div></div></div>';
  }).join('');
}

function evaluateAlerts() {
  var prefs = settings.notify;
  var alerts = getAlerts();
  var changed = false;
  alerts.forEach(function (a) {
    if (a.enabled === false) return;
    var fire = false, msg = '';
    if (a.type === 'fuel' && prefs.bunker) {
      var p = BUNK[a.port];
      if (p != null) {
        fire = a.op === 'below' ? p < a.threshold : p > a.threshold;
        msg = a.port + ' VLSFO is $' + p + '/MT (' + a.op + ' $' + a.threshold + ').';
      }
    } else if (a.type === 'margin' && prefs.margin) {
      var bad = getVoyages().filter(function (v) { return v.status === 'active' && v.marginPct < a.threshold; });
      fire = bad.length > 0;
      if (fire) msg = bad.map(function (v) { return v.vesselName + ' margin ' + v.marginPct + '%'; }).join('; ') + ' (threshold ' + a.threshold + '%).';
    } else if (a.type === 'arrival' && prefs.arrival) {
      var live = dashVessels[String(a.vesselMmsi)];
      if (live) {
        var stopped = (live.speedKnots || 0) < 0.5 || live.navStatus === 1 || live.navStatus === 5;
        fire = stopped;
        msg = (live.name || a.name) + ' is ' + navName(live.navStatus) + ' at ' + (live.speedKnots || 0).toFixed(1) + ' kn.';
      }
    } else if (a.type === 'invoice' && prefs.invoice) {
      var old = getInvoices().filter(function (i) {
        return i.status === 'pending' && (Date.now() - new Date(i.createdAt).getTime()) > 14 * 86400000;
      });
      fire = old.length > 0;
      if (fire) msg = old.length + ' pending invoice(s) older than 14 days.';
    }
    if (fire && !a.triggered) {
      a.triggered = true; a.lastFired = utcNow(); changed = true;
      pushNotif('red', msg || a.name, a.type);
    } else if (!fire && a.triggered) {
      a.triggered = false; changed = true;
    }
  });
  if (changed) {
    saveAlerts(alerts);
    renderAlerts();
    renderKPIs();
    renderAlertBadge();
  }
}

// ════════════════════════════════════════════════════
// SETTINGS & SAMPLE DATA
// ════════════════════════════════════════════════════
function renderSettings() {
  var key = lsGet(KEY_AIS, '');
  $('key-dot').style.background = key ? 'var(--green)' : 'var(--muted)';
  $('key-display').textContent = key ? key.substring(0, 8) + '••••••••' : 'Not set';
  setTheme(isDark ? 'dark' : 'light');
  $('settings-currency').value = cur;
  if ($('settings-homeport')) $('settings-homeport').value = settings.homePort;
  if ($('settings-region')) $('settings-region').value = settings.region;
  setToggle($('n-bunker'), settings.notify.bunker);
  setToggle($('n-margin'), settings.notify.margin);
  setToggle($('n-arrival'), settings.notify.arrival);
  setToggle($('n-invoice'), settings.notify.invoice);
  setToggle($('n-stale'), settings.notify.stale);
  setToggle($('n-sample'), settings.sample);
}

function togPref(btn, key) {
  var on = !settings.notify[key];
  settings.notify[key] = on;
  saveSettingsData();
  setToggle(btn, on);
  evaluateAlerts();
}

function saveAISKey() {
  var key = $('settings-ais-key').value.trim();
  if (!key) { $('settings-ais-key').style.borderColor = 'var(--red)'; setTimeout(function () { $('settings-ais-key').style.borderColor = ''; }, 2000); return; }
  connectAIS(key);
  $('settings-ais-key').value = '';
  renderSettings();
  showToast('✓ AIS key saved — connecting', 'green');
}

function clearAISKey() {
  if (!confirm('Remove AIS key and disconnect?')) return;
  lsDel(KEY_AIS);
  disconnectAIS();
  dashVessels = {};
  Object.values(dashMarkers).forEach(function (m) { if (dashMap) dashMap.removeLayer(m); });
  dashMarkers = {};
  $('map-count').textContent = '0 vessels';
  $('map-overlay').style.display = 'flex';
  renderSettings();
  refreshDashboard();
  showToast('AIS key removed', 'red');
}

function updateAISRegion() {
  settings.region = $('settings-region').value;
  saveSettingsData();
  resubscribeAIS();
}

function saveSettings() {
  settings.homePort = $('settings-homeport').value;
  settings.region = $('settings-region').value;
  saveSettingsData();
  flyHome();
  resubscribeAIS();
  showToast('✓ Settings saved', 'green');
}

function toggleSample(btn) {
  if (settings.sample) {
    settings.sample = false;
    saveSettingsData();
    stripSample();
    setToggle(btn, false);
    showToast('Sample data removed', 'amber');
  } else loadSample();
  renderSettings();
}

function stripSample() {
  saveFleetData(getFleet().filter(function (x) { return x.source !== 'sample'; }));
  saveVoyages(getVoyages().filter(function (x) { return x.source !== 'sample'; }));
  saveInvoices(getInvoices().filter(function (x) { return x.source !== 'sample'; }));
  saveAlerts(getAlerts().filter(function (x) { return x.source !== 'sample'; }));
  saveNotifs(getNotifs().filter(function (x) { return x.source !== 'sample'; }));
  selMmsi = '';
  renderFleet();
  renderVoyageLog();
  renderAlerts();
  renderNotifs();
  refreshDashboard();
}

function loadSample() {
  settings.sample = true;
  saveSettingsData();
  var fleet = getFleet().filter(function (x) { return x.source !== 'sample'; });
  var voyages = getVoyages().filter(function (x) { return x.source !== 'sample'; });
  var invoices = getInvoices().filter(function (x) { return x.source !== 'sample'; });
  var alerts = getAlerts().filter(function (x) { return x.source !== 'sample'; });

  var sampleFleet = [
    { mmsi: '257123450', name: 'MS Nordfjord', flag: '🇳🇴', type: 'General cargo', gt: '4200', speed: '14.2', fuel: 22, status: 'underway', lat: 59.2, lon: 5.8, destination: 'ROTTERDAM', imo: '9234567', source: 'sample' },
    { mmsi: '257445200', name: 'KV Harstad', flag: '🇳🇴', type: 'Offshore supply', gt: '3100', speed: '11.8', fuel: 18, status: 'underway', lat: 57.4, lon: 7.2, destination: 'ISTANBUL', imo: '9341201', source: 'sample' },
    { mmsi: '235099421', name: 'MV Atlantic', flag: '🇬🇧', type: 'Bulk carrier', gt: '22000', speed: '12.4', fuel: 32, status: 'underway', lat: 40.9, lon: 29.1, destination: 'DUBAI', imo: '9418822', source: 'sample' },
    { mmsi: '565012340', name: 'MV Orient Star', flag: '🇸🇬', type: 'Container', gt: '28000', speed: '16', fuel: 40, status: 'underway', lat: 20.5, lon: 63.4, destination: 'SINGAPORE', imo: '9521104', source: 'sample' },
    { mmsi: '257882110', name: 'SS Bergen', flag: '🇳🇴', type: 'Tanker', gt: '8500', speed: '0.0', fuel: 24, status: 'anchored', lat: 51.9, lon: 4.1, destination: '', imo: '9183308', source: 'sample' }
  ];
  sampleFleet.forEach(function (v) { v.addedAt = new Date().toISOString(); fleet.push(v); });

  function sampleVoy(v, from, to, cargo, rate, type) {
    var est = estimateVoyage(from, to, cargo, rate, parseFloat(v.speed), v.fuel);
    return Object.assign({}, est, {
      id: uid('voy'), vesselMmsi: v.mmsi, vesselName: v.name, cargoType: type,
      departDate: new Date().toISOString().slice(0, 10), status: 'active',
      createdAt: new Date().toISOString(), source: 'sample'
    });
  }
  voyages.unshift(sampleVoy(sampleFleet[0], 'Bergen', 'Rotterdam', 1840, 42, 'General cargo'));
  voyages.unshift(sampleVoy(sampleFleet[1], 'Rotterdam', 'Istanbul', 920, 55, 'Offshore supply'));
  voyages.unshift(sampleVoy(sampleFleet[2], 'Istanbul', 'Dubai', 18200, 18, 'Bulk'));
  voyages.unshift(sampleVoy(sampleFleet[3], 'Dubai', 'Singapore', 6400, 38, 'Container'));

  invoices.unshift(
    { id: uid('inv'), vendor: 'Rotterdam Bunkers BV', amountUSD: 26400, category: 'fuel', port: 'Rotterdam', vesselMmsi: '235099421', vesselName: 'MV Atlantic', status: 'paid', createdAt: new Date().toISOString(), source: 'sample' },
    { id: uid('inv'), vendor: 'Istanbul Port Authority', amountUSD: 3800, category: 'port_dues', port: 'Istanbul', vesselMmsi: '257445200', vesselName: 'KV Harstad', status: 'pending', createdAt: new Date().toISOString(), source: 'sample' },
    { id: uid('inv'), vendor: 'Gulf Maritime Agents LLC', amountUSD: 1650, category: 'agent_fees', port: 'Dubai', vesselMmsi: '565012340', vesselName: 'MV Orient Star', status: 'pending', createdAt: new Date().toISOString(), source: 'sample' }
  );

  alerts.push(
    { id: uid('al'), type: 'fuel', name: 'Bunker spike — Stavanger', condition: 'Stavanger above $630', port: 'Stavanger', op: 'above', threshold: 630, enabled: true, triggered: false, source: 'sample', createdAt: new Date().toISOString() },
    { id: uid('al'), type: 'margin', name: 'Margin below 35%', condition: 'margin < 35%', threshold: 35, enabled: true, triggered: false, source: 'sample', createdAt: new Date().toISOString() },
    { id: uid('al'), type: 'fuel', name: 'Rotterdam price drop', condition: 'Rotterdam below $610', port: 'Rotterdam', op: 'below', threshold: 610, enabled: true, triggered: false, source: 'sample', createdAt: new Date().toISOString() }
  );

  saveFleetData(fleet);
  saveVoyages(voyages);
  saveInvoices(invoices);
  saveAlerts(alerts);
  selMmsi = sampleFleet[0].mmsi;
  setToggle($('n-sample'), true);
  renderFleet();
  renderVoyageLog();
  renderAlerts();
  evaluateAlerts();
  refreshDashboard();
  showToast('✓ Sample fleet loaded', 'green');
}

function clearAllData() {
  if (!confirm('Clear ALL local data? This removes your AIS key, fleet, voyages, invoices and settings.')) return;
  try { localStorage.clear(); } catch (e) {}
  showToast('All local data cleared', 'red');
  setTimeout(function () { location.reload(); }, 1200);
}

// ════════════════════════════════════════════════════
// CHART
// ════════════════════════════════════════════════════
function buildChart() {
  var canvas = $('pnlChart');
  if (!canvas) return;
  var vos = getVoyages().slice().reverse();
  var empty = $('chart-empty');
  if (pnlChart) { pnlChart.destroy(); pnlChart = null; }
  if (!vos.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  var lineColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-line').trim();
  var fillColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-fill').trim();
  var gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim();
  var textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();
  var running = 0;
  var data = vos.map(function (v) { running += v.profitUSD || 0; return Math.round(running * (FX[cur] || FX.USD).r); });
  pnlChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: vos.map(function (v) { return shortDate(v.createdAt); }),
      datasets: [{ data: data, borderColor: lineColor, backgroundColor: fillColor, borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: lineColor, tension: 0.35, fill: true }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 }, callback: function (v) { return (FX[cur] || FX.USD).s + (Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : v); } } }
      }
    }
  });
}

// ════════════════════════════════════════════════════
// TOAST + CLOCK
// ════════════════════════════════════════════════════
function showToast(msg, color) {
  var colors = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)' };
  var el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = 'background:var(--surface);border:1px solid ' + (colors[color] || colors.green) + ';color:' + (colors[color] || colors.green) + ';';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 2500);
}

setInterval(function () { $('clk').textContent = utcNow(); }, 1000);
setInterval(evaluateAlerts, 15000);

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
$('curr-sel').value = cur;
if ($('f-date') && !$('f-date').value) $('f-date').value = new Date().toISOString().slice(0, 10);
initMap();
setTheme(isDark ? 'dark' : 'light');
renderBunkerTable();
renderFleet();
renderVoyageVessels();
renderVoyageLog();
renderAlerts();
renderNotifs();
refreshDashboard();
evaluateAlerts();

(function () {
  var saved = lsGet(KEY_AIS, '');
  if (saved) setTimeout(function () { connectAIS(saved); }, 600);
})();
