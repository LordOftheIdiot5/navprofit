# API Setup Guide

How to connect NavProfit to real live data.

---

## 1. AIS — Vessel positions (FREE to start)

**Provider: aisstream.io**
- Website: https://aisstream.io
- Cost: Free tier available
- What you get: Real-time vessel position, speed, heading, destination via WebSocket

**How to connect:**
1. Create account at aisstream.io
2. Get your API key from the dashboard
3. Add to `.env`:
   ```
   AIS_API_KEY=your_key_here
   ```

**WebSocket connection example:**
```javascript
const socket = new WebSocket('wss://stream.aisstream.io/v0/stream');

socket.onopen = () => {
  socket.send(JSON.stringify({
    APIKey: process.env.AIS_API_KEY,
    BoundingBoxes: [
      // Norwegian coast
      [[57.0, 4.0], [71.5, 31.5]],
      // Add more regions as needed
    ],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
  }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update vessel position in your state
};
```

**Alternative: MarineTraffic API**
- More data, better coverage
- Cost: ~$50-500/month depending on usage
- Docs: https://servicedocs.marinetraffic.com

---

## 2. Bunker fuel prices

**Provider: OilPriceAPI (simple, affordable)**
- Website: https://www.oilpriceapi.com
- Cost: Free tier, then ~$30/month
- What you get: VLSFO, MGO, HFO prices per port

**Endpoint:**
```
GET https://api.oilpriceapi.com/v1/prices/marine-fuels/latest
Authorization: Token YOUR_API_KEY
```

**Response:**
```json
{
  "data": {
    "prices": [
      {
        "port": "Rotterdam",
        "fuel_grade": "VLSFO",
        "price": 602.50,
        "currency": "USD",
        "created_at": "2026-04-06T08:00:00Z"
      }
    ]
  }
}
```

**Alternative: Tideform (more accurate, 500+ ports)**
- Website: https://www.tideform.io
- Cost: Contact for pricing
- Better for production use — verified transaction data

---

## 3. Exchange rates

**Provider: exchangerate-api.com**
- Website: https://www.exchangerate-api.com
- Cost: Free for 1,500 requests/month
- What you get: Live NOK, USD, EUR, GBP, SGD rates

```javascript
const res = await fetch(
  `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`
);
const data = await res.json();
// data.conversion_rates.NOK etc
```

---

## 4. AI Invoice extraction (Anthropic Claude API)

**Provider: Anthropic**
- Already used in this prototype
- Cost: Pay per token — very cheap for invoices

**How it works:**
```javascript
// User uploads invoice PDF or forwards email
// We send to Claude API with extraction prompt

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
        },
        {
          type: 'text',
          text: `Extract invoice data as JSON:
          {
            "vendor": "",
            "amount": 0,
            "currency": "",
            "port": "",
            "vessel": "",
            "date": "",
            "category": "fuel|port_dues|agent_fees|other",
            "description": ""
          }
          Return only valid JSON, nothing else.`
        }
      ]
    }]
  })
});
```

---

## 5. Environment variables

Create a `.env` file in project root:

```
AIS_API_KEY=
OIL_PRICE_API_KEY=
EXCHANGE_RATE_API_KEY=
ANTHROPIC_API_KEY=
```

**Never commit `.env` to git.**
Add `.env` to your `.gitignore`.

---

## Estimated monthly API costs at small scale (5 vessels)

| Service | Usage | Cost/month |
|---------|-------|------------|
| aisstream.io | 5 vessels, Norwegian coast | Free |
| OilPriceAPI | 10 ports, daily updates | ~$30 |
| exchangerate-api | Daily rates | Free |
| Anthropic API | ~100 invoices/month | ~$2 |
| **Total** | | **~$32/month** |

This means you can run the full live product for under $50/month.
At 500 NOK/vessel/month subscription, just 1 operator with 5 vessels covers all your API costs.
