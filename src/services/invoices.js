/**
 * NavProfit — AI invoice extraction service
 * Uses Claude API to extract structured data from invoices
 *
 * Setup:
 * 1. Get API key at https://console.anthropic.com
 * 2. Add ANTHROPIC_API_KEY to your .env file
 */

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

const EXTRACTION_PROMPT = `You are a maritime invoice data extractor.
Extract the following fields from this invoice and return ONLY valid JSON, nothing else.
If a field is not found, use null.

{
  "vendor": "company that issued the invoice",
  "amount": 0.00,
  "currency": "USD/EUR/NOK/GBP etc",
  "port": "port where service was rendered",
  "vessel": "vessel name if mentioned",
  "date": "YYYY-MM-DD format",
  "category": "one of: fuel | port_dues | agent_fees | crew | maintenance | other",
  "description": "brief description of what was invoiced",
  "invoiceNumber": "invoice reference number if present",
  "dueDateDays": 30
}

Return only valid JSON. No explanation, no markdown, no backticks.`;

/**
 * Extract invoice data from a PDF file
 * @param {File} file - PDF file object
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object>} Extracted invoice data
 */
export async function extractInvoicePDF(file, apiKey) {
  // Convert file to base64
  const base64 = await fileToBase64(file);

  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Failed to parse extracted data');
  }
}

/**
 * Extract invoice data from plain text (e.g. forwarded email)
 * @param {string} text - Email or invoice text
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object>} Extracted invoice data
 */
export async function extractInvoiceText(text, apiKey) {
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\nInvoice text:\n${text}`,
      }],
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  const raw = data.content[0].text;

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Failed to parse response');
  }
}

/**
 * Validate extracted invoice against market rates
 * Flags if price is significantly above market
 * @param {Object} invoice - Extracted invoice data
 * @param {Object} marketRates - Current bunker prices by port
 * @returns {Object} Invoice with anomaly flags
 */
export function validateInvoice(invoice, marketRates = {}) {
  const flags = [];

  if (invoice.category === 'fuel' && invoice.port && marketRates[invoice.port]) {
    const marketPrice = marketRates[invoice.port].price;
    // Simple check: if amount per MT implied is >15% above market, flag it
    // In production: use actual quantity from invoice
    const implied = invoice.amount;
    if (implied > marketPrice * 1.15) {
      flags.push({
        type: 'price_above_market',
        message: `Fuel price appears ${Math.round(((implied / marketPrice) - 1) * 100)}% above market rate at ${invoice.port}`,
        severity: 'warning',
      });
    }
  }

  return { ...invoice, flags };
}

/**
 * Convert File object to base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Mock invoice data for testing
 */
export const MOCK_INVOICES = [
  {
    id: 'inv-001',
    vendor: 'Rotterdam Bunkers BV',
    amount: 26400,
    currency: 'USD',
    port: 'Rotterdam',
    vessel: 'MV Atlantic',
    date: '2026-04-03',
    category: 'fuel',
    description: 'VLSFO delivery 440 MT',
    status: 'paid',
    flags: [],
  },
  {
    id: 'inv-002',
    vendor: 'Istanbul Port Authority',
    amount: 3800,
    currency: 'USD',
    port: 'Istanbul',
    vessel: 'KV Harstad',
    date: '2026-04-03',
    category: 'port_dues',
    description: 'Port dues and pilotage',
    status: 'pending',
    flags: [],
  },
  {
    id: 'inv-003',
    vendor: 'Gulf Maritime Agents LLC',
    amount: 1650,
    currency: 'USD',
    port: 'Dubai',
    vessel: 'MV Orient Star',
    date: '2026-04-02',
    category: 'agent_fees',
    description: 'Port agency services',
    status: 'pending',
    flags: [],
  },
  {
    id: 'inv-004',
    vendor: 'Fujairah Bunkering',
    amount: 14200,
    currency: 'USD',
    port: 'Fujairah',
    vessel: 'MV Orient Star',
    date: '2026-04-01',
    category: 'fuel',
    description: 'VLSFO delivery 228 MT',
    status: 'paid',
    flags: [],
  },
];
