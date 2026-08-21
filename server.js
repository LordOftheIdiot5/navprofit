'use strict';

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const STORES_DIR = path.join(DATA_DIR, 'stores');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');

const FALLBACK_BUNKER = {
  Bergen: 618, Rotterdam: 602, Singapore: 625, Dubai: 614, Istanbul: 619,
  Houston: 608, Tokyo: 631, 'New York': 622, Fujairah: 614, Stavanger: 641
};

const HUB_NAMES = {
  NLRTM: 'Rotterdam',
  SGSIN: 'Singapore',
  USHOU: 'Houston',
  AEFUJ: 'Fujairah',
  USNYC: 'New York',
  HKHKG: 'Hong Kong',
  USLAX: 'Los Angeles',
  BRSSZ: 'Santos'
};

const DERIVED_PORTS = {
  Bergen: { from: 'Rotterdam', add: 16 },
  Stavanger: { from: 'Rotterdam', add: 39 },
  Dubai: { from: 'Fujairah', add: 0 },
  Istanbul: { from: 'Rotterdam', add: 17 },
  Tokyo: { from: 'Singapore', add: 6 }
};

const EXTRACT_PROMPT = `You are a maritime invoice data extractor.
Extract the following fields and return ONLY valid JSON, nothing else.
If a field is not found, use null.

{
  "vendor": "company that issued the invoice",
  "amount": 0.00,
  "currency": "USD/EUR/NOK/GBP etc",
  "port": "port where service was rendered",
  "vessel": "vessel name if mentioned",
  "date": "YYYY-MM-DD format",
  "category": "one of: fuel | port_dues | agent_fees | crew | maintenance | other",
  "description": "brief description",
  "invoiceNumber": "invoice reference if present"
}`;

ensureDataDirs();

const SESSION_SECRET = loadOrCreateSecret();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));

app.get('/api/status', (req, res) => {
  const user = currentUser(req);
  res.json({
    ok: true,
    bunkerFallback: Boolean(process.env.OIL_PRICE_API_KEY),
    invoiceFallback: Boolean(process.env.ANTHROPIC_API_KEY),
    fx: true,
    user: user ? { id: user.id, email: user.email } : null
  });
});

const BUNKER_TTL_MS = 4 * 60 * 60 * 1000;
const bunkerCaches = {};

app.get('/api/bunker', async (req, res) => {
  const key = resolveKey(req, 'x-oil-price-key', 'OIL_PRICE_API_KEY', 'oil');
  if (!key) {
    return res.json({
      source: 'indicative',
      reason: 'No OilPriceAPI key yet — add yours in Settings',
      updatedAt: null,
      prices: FALLBACK_BUNKER
    });
  }
  const cacheId = fingerprint(key);
  const cached = bunkerCaches[cacheId];
  if (cached && (Date.now() - cached.at) < BUNKER_TTL_MS) {
    return res.json(cached.payload);
  }
  try {
    const prices = await fetchMarineFuels(key);
    const payload = {
      source: 'live',
      updatedAt: new Date().toISOString(),
      prices
    };
    bunkerCaches[cacheId] = { at: Date.now(), payload };
    return res.json(payload);
  } catch (err) {
    console.error('[bunker]', sanitizeErr(err.message));
    return res.json({
      source: 'indicative',
      reason: 'OilPriceAPI request failed — check your key in Settings',
      updatedAt: null,
      prices: FALLBACK_BUNKER
    });
  }
});

app.get('/api/fx', async (req, res) => {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!r.ok) throw new Error('FX HTTP ' + r.status);
    const data = await r.json();
    const rates = data.rates || {};
    return res.json({
      source: 'live',
      updatedAt: data.time_last_update_utc || new Date().toISOString(),
      rates: {
        USD: 1,
        NOK: rates.NOK,
        EUR: rates.EUR,
        GBP: rates.GBP,
        SGD: rates.SGD
      }
    });
  } catch (err) {
    return res.json({
      source: 'static',
      reason: err.message,
      rates: { USD: 1, NOK: 10.8, EUR: 0.92, GBP: 0.79, SGD: 1.35 }
    });
  }
});

app.post('/api/invoice/extract', async (req, res) => {
  const key = resolveKey(req, 'x-anthropic-key', 'ANTHROPIC_API_KEY', 'anthropic');
  if (!key) {
    return res.status(503).json({
      error: 'Add your Anthropic API key in Settings to extract invoices.'
    });
  }
  const { text, filename, mediaType, base64 } = req.body || {};
  if (!text && !base64) {
    return res.status(400).json({ error: 'Provide invoice text or a PDF/image upload.' });
  }
  try {
    const extracted = await extractInvoice(key, { text, filename, mediaType, base64 });
    return res.json({ ok: true, invoice: extracted });
  } catch (err) {
    console.error('[invoice]', sanitizeErr(err.message));
    return res.status(502).json({ error: 'Extraction failed — check your Anthropic key in Settings.' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const users = readJson(USERS_FILE, []);
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeJson(USERS_FILE, users);
  const token = createSession(user.id);
  setSessionCookie(res, token);
  return res.json({ ok: true, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/login', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Email or password is wrong.' });
  }
  const token = createSession(user.id);
  setSessionCookie(res, token);
  return res.json({ ok: true, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = cookie(req, 'np_session');
  if (token) {
    const sessions = readJson(SESSIONS_FILE, {});
    delete sessions[token];
    writeJson(SESSIONS_FILE, sessions);
  }
  res.setHeader('Set-Cookie', 'np_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.json({ user: null });
  res.json({ user: { id: user.id, email: user.email } });
});

app.get('/api/store', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to sync.' });
  const store = readJson(storePath(user.id), null);
  res.json({ store });
});

app.put('/api/store', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to sync.' });
  const store = req.body && req.body.store;
  if (!store || typeof store !== 'object') {
    return res.status(400).json({ error: 'Missing store payload.' });
  }
  writeJson(storePath(user.id), {
    fleet: store.fleet || [],
    voyages: store.voyages || [],
    invoices: store.invoices || [],
    alerts: store.alerts || [],
    notifs: store.notifs || [],
    settings: store.settings || {},
    ports: Array.isArray(store.ports) ? store.ports : [],
    keys: {
      oil: store.keys && store.keys.oil ? String(store.keys.oil) : '',
      anthropic: store.keys && store.keys.anthropic ? String(store.keys.anthropic) : ''
    },
    savedAt: new Date().toISOString()
  });
  res.json({ ok: true });
});

app.use('/data', (req, res) => res.status(404).end());
app.use(express.static(__dirname, { index: 'index.html', dotfiles: 'deny' }));

app.listen(PORT, () => {
  console.log('NavProfit running on http://localhost:' + PORT);
  console.log('  per-user keys in Settings; .env keys are optional install-wide fallbacks');
  console.log('  bunker fallback :', process.env.OIL_PRICE_API_KEY ? 'yes' : 'no');
  console.log('  invoice fallback:', process.env.ANTHROPIC_API_KEY ? 'yes' : 'no');
});

function resolveKey(req, headerName, envName, storeField) {
  const fromHeader = String(req.headers[headerName] || '').trim();
  if (fromHeader) return fromHeader;
  const user = currentUser(req);
  if (user && storeField) {
    const store = readJson(storePath(user.id), null);
    const fromStore = store && store.keys && String(store.keys[storeField] || '').trim();
    if (fromStore) return fromStore;
  }
  return String(process.env[envName] || '').trim();
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function sanitizeErr(msg) {
  return String(msg || '').replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-…').replace(/[a-f0-9]{20,}/gi, '[redacted]');
}

function ensureDataDirs() {
  fs.mkdirSync(STORES_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, []);
  if (!fs.existsSync(SESSIONS_FILE)) writeJson(SESSIONS_FILE, {});
}

function loadOrCreateSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function storePath(userId) {
  return path.join(STORES_DIR, userId + '.json');
}

function cookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch (e) {
    return false;
  }
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(SESSIONS_FILE, {});
  const now = Date.now();
  Object.keys(sessions).forEach((k) => {
    if (!sessions[k] || sessions[k].exp < now) delete sessions[k];
  });
  sessions[token] = {
    userId,
    exp: now + 30 * 24 * 60 * 60 * 1000,
    sig: crypto.createHmac('sha256', SESSION_SECRET).update(token + userId).digest('hex')
  };
  writeJson(SESSIONS_FILE, sessions);
  return token;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', 'np_session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (30 * 24 * 60 * 60));
}

function currentUser(req) {
  const token = cookie(req, 'np_session');
  if (!token) return null;
  const sessions = readJson(SESSIONS_FILE, {});
  const sess = sessions[token];
  if (!sess || sess.exp < Date.now()) return null;
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(token + sess.userId).digest('hex');
  if (sess.sig !== expect) return null;
  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.id === sess.userId);
  return user || null;
}

async function fetchMarineFuels(apiKey) {
  const url = 'https://api.oilpriceapi.com/v1/prices/marine-fuels/latest?fuel_type=VLSFO';
  const r = await fetch(url, {
    headers: {
      Authorization: 'Token ' + apiKey,
      Accept: 'application/json'
    }
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('OilPriceAPI ' + r.status + (body ? ': ' + body.slice(0, 180) : ''));
  }
  const json = await r.json();
  const live = {};
  collectPrices(json, live);
  if (!Object.keys(live).length) {
    const all = await fetch('https://api.oilpriceapi.com/v1/prices/marine-fuels?fuel_type=VLSFO', {
      headers: { Authorization: 'Token ' + apiKey, Accept: 'application/json' }
    });
    if (all.ok) collectPrices(await all.json(), live);
  }
  if (!Object.keys(live).length) throw new Error('No VLSFO prices in OilPriceAPI response');

  const prices = Object.assign({}, FALLBACK_BUNKER, live);
  Object.keys(DERIVED_PORTS).forEach((port) => {
    if (live[port]) return;
    const spec = DERIVED_PORTS[port];
    if (live[spec.from]) prices[port] = Math.round(live[spec.from] + spec.add);
  });
  return prices;
}

function collectPrices(json, into) {
  const nodes = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== 'object') return;
    nodes.push(node);
    Object.keys(node).forEach((k) => {
      if (k === 'prices' || k === 'data' || k === 'items' || k === 'ports') walk(node[k]);
    });
  };
  walk(json);

  nodes.forEach((node) => {
    const fuel = String(node.fuel_type || node.fuel_grade || node.grade || node.code || '').toUpperCase();
    const isVlsfo = !fuel || fuel.includes('VLSFO');
    if (fuel && !isVlsfo) return;
    let name = node.port_name || (node.port && (node.port.name || node.port.code)) || node.port || node.port_code;
    if (typeof name === 'object' && name) name = name.name || name.code;
    if (HUB_NAMES[name]) name = HUB_NAMES[name];
    const price = Number(
      (node.prices && node.prices.VLSFO && (node.prices.VLSFO.price || node.prices.VLSFO)) ||
      node.price || node.value
    );
    if (!name || !Number.isFinite(price) || price < 50 || price > 4000) return;
    const pretty = prettyPort(String(name));
    if (pretty) into[pretty] = Math.round(price);
  });
}

function prettyPort(name) {
  const key = name.trim();
  if (HUB_NAMES[key.toUpperCase()]) return HUB_NAMES[key.toUpperCase()];
  const known = Object.keys(FALLBACK_BUNKER);
  const hit = known.find((p) => p.toLowerCase() === key.toLowerCase());
  return hit || null;
}

async function extractInvoice(apiKey, { text, filename, mediaType, base64 }) {
  const content = [];
  if (base64) {
    var mt = mediaType || 'application/pdf';
    if (String(mt).indexOf('image/') === 0) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mt, data: base64 }
      });
    } else {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: mt, data: base64 }
      });
    }
    content.push({ type: 'text', text: EXTRACT_PROMPT + (filename ? '\nFile: ' + filename : '') });
  } else {
    content.push({ type: 'text', text: EXTRACT_PROMPT + '\n\nInvoice text:\n' + text });
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content }]
    })
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('Claude API ' + r.status + (body ? ': ' + body.slice(0, 220) : ''));
  }
  const data = await r.json();
  const raw = ((data.content && data.content[0] && data.content[0].text) || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('Could not parse extracted invoice JSON');
  }
}
