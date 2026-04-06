/**
 * NavProfit — Currency and formatting utilities
 */

// Exchange rates vs USD (update via API in production)
export const EXCHANGE_RATES = {
  USD: 1,
  NOK: 10.8,
  EUR: 0.92,
  GBP: 0.79,
  SGD: 1.35,
};

export const CURRENCY_SYMBOLS = {
  USD: '$',
  NOK: 'kr',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
};

/**
 * Convert USD amount to target currency
 */
export function convertFromUSD(amountUSD, targetCurrency = 'USD') {
  const rate = EXCHANGE_RATES[targetCurrency] || 1;
  return Math.round(amountUSD * rate);
}

/**
 * Format a number as currency
 * @param {number} amount - Amount in target currency
 * @param {string} currency - Currency code
 * @param {boolean} showSign - Show + for positive numbers
 */
export function formatCurrency(amount, currency = 'USD', showSign = false) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const abs = Math.abs(amount);
  const formatted = abs >= 1000000
    ? (abs / 1000000).toFixed(1) + 'M'
    : abs >= 1000
    ? abs.toLocaleString()
    : abs.toString();

  const sign = amount < 0 ? '-' : showSign ? '+' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(n, decimals = 0) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a percentage
 */
export function formatPct(n, showSign = false) {
  const sign = n > 0 && showSign ? '+' : n < 0 ? '-' : '';
  return `${sign}${Math.abs(Math.round(n))}%`;
}

/**
 * Format nautical miles
 */
export function formatNM(nm) {
  return `${nm.toLocaleString()} nm`;
}

/**
 * Format UTC timestamp to readable
 */
export function formatUTC(date = new Date()) {
  return date.toUTCString().replace('GMT', 'UTC');
}

/**
 * Get current UTC time string HH:MM:SS
 */
export function getUTCClock() {
  const now = new Date();
  return [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':') + ' UTC';
}
