/**
 * NavProfit — Bunker fuel price service
 * Fetches live VLSFO, MGO prices from OilPriceAPI
 *
 * Setup:
 * 1. Get API key at https://www.oilpriceapi.com
 * 2. Add OIL_PRICE_API_KEY to your .env file
 */

const OIL_API_BASE = 'https://api.oilpriceapi.com/v1';

// Cache prices to avoid hammering the API
let priceCache = null;
let cacheTime = null;
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Fetch live bunker prices from OilPriceAPI
 * @param {string} apiKey - Your OilPriceAPI key
 * @returns {Promise<Object>} Prices keyed by port name
 */
export async function fetchBunkerPrices(apiKey) {
  // Return cached if fresh
  if (priceCache && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION_MS) {
    return priceCache;
  }

  try {
    const res = await fetch(`${OIL_API_BASE}/prices/marine-fuels/latest`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const prices = {};

    data.data.prices.forEach((item) => {
      if (item.fuel_grade === 'VLSFO') {
        prices[item.port] = {
          price: item.price,
          currency: item.currency,
          grade: item.fuel_grade,
          updatedAt: item.created_at,
        };
      }
    });

    priceCache = prices;
    cacheTime = Date.now();
    return prices;

  } catch (err) {
    console.error('[Fuel] Failed to fetch prices:', err);
    // Return mock data as fallback
    return MOCK_FUEL_PRICES;
  }
}

/**
 * Calculate fuel cost for a voyage
 * @param {number} distanceNM - Distance in nautical miles
 * @param {number} speedKnots - Vessel speed
 * @param {number} consumptionMTPerDay - Fuel consumption MT/day
 * @param {number} fuelPriceUSD - Price per MT in USD
 * @returns {Object} Fuel cost breakdown
 */
export function calcFuelCost(distanceNM, speedKnots, consumptionMTPerDay, fuelPriceUSD) {
  const voyageHours = distanceNM / speedKnots;
  const voyageDays = voyageHours / 24;
  const fuelMT = voyageDays * consumptionMTPerDay;
  const costUSD = fuelMT * fuelPriceUSD;

  return {
    voyageDays: Math.round(voyageDays * 10) / 10,
    fuelMT: Math.round(fuelMT),
    costUSD: Math.round(costUSD),
    pricePerNM: Math.round((costUSD / distanceNM) * 100) / 100,
  };
}

/**
 * Find cheapest bunkering option for a set of ports
 * @param {Array<string>} ports - Port names to compare
 * @param {Object} prices - Price data keyed by port
 * @returns {Object} Sorted comparison
 */
export function compareBunkerPorts(ports, prices = MOCK_FUEL_PRICES) {
  return ports
    .filter(p => prices[p])
    .map(p => ({ port: p, price: prices[p]?.price || prices[p] }))
    .sort((a, b) => a.price - b.price);
}

/**
 * Mock fuel prices for development
 * Replace with live API in production
 */
export const MOCK_FUEL_PRICES = {
  Rotterdam: { price: 602, change24h: -1.1, grade: 'VLSFO', flag: '🇳🇱' },
  Singapore: { price: 625, change24h: +0.8, grade: 'VLSFO', flag: '🇸🇬' },
  Fujairah: { price: 614, change24h: -0.4, grade: 'VLSFO', flag: '🇦🇪' },
  Bergen: { price: 618, change24h: -0.8, grade: 'VLSFO', flag: '🇳🇴' },
  Houston: { price: 608, change24h: +0.3, grade: 'VLSFO', flag: '🇺🇸' },
  Tokyo: { price: 631, change24h: +1.2, grade: 'VLSFO', flag: '🇯🇵' },
  'New York': { price: 622, change24h: -0.2, grade: 'VLSFO', flag: '🇺🇸' },
  Istanbul: { price: 619, change24h: +0.6, grade: 'VLSFO', flag: '🇹🇷' },
  Dubai: { price: 614, change24h: -0.3, grade: 'VLSFO', flag: '🇦🇪' },
  Stavanger: { price: 641, change24h: +2.1, grade: 'VLSFO', flag: '🇳🇴' },
  Trondheim: { price: 624, change24h: -0.3, grade: 'VLSFO', flag: '🇳🇴' },
  Tromsø: { price: 629, change24h: +0.5, grade: 'VLSFO', flag: '🇳🇴' },
  Ålesund: { price: 611, change24h: -1.2, grade: 'VLSFO', flag: '🇳🇴' },
};
