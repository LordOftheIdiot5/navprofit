/**
 * NavProfit — Voyage calculation utilities
 * Core P&L math for voyage estimation
 */

// Port-to-port distances in nautical miles
// Source: approximate great circle distances
export const PORT_DISTANCES = {
  Bergen: {
    Rotterdam: 612, Singapore: 10940, Dubai: 6240,
    Istanbul: 2840, Houston: 8200, Tokyo: 11800,
    'New York': 6100, Tromsø: 1080, Trondheim: 490,
    Stavanger: 134, Ålesund: 230
  },
  Rotterdam: {
    Bergen: 612, Singapore: 10640, Dubai: 6640,
    Istanbul: 2180, Houston: 7600, Tokyo: 11200,
    'New York': 5550, Tromsø: 1600, Trondheim: 1080,
    Stavanger: 720, Ålesund: 840
  },
  Singapore: {
    Bergen: 10940, Rotterdam: 10640, Dubai: 3640,
    Istanbul: 8200, Houston: 13200, Tokyo: 3300,
    'New York': 15600
  },
  Dubai: {
    Bergen: 6240, Rotterdam: 6640, Singapore: 3640,
    Istanbul: 3620, Houston: 9800, Tokyo: 5900,
    'New York': 11200
  },
  Istanbul: {
    Bergen: 2840, Rotterdam: 2180, Singapore: 8200,
    Dubai: 3620, Houston: 9200, Tokyo: 9800,
    'New York': 8100
  },
  Houston: {
    Bergen: 8200, Rotterdam: 7600, Singapore: 13200,
    Dubai: 9800, Istanbul: 9200, Tokyo: 9800,
    'New York': 1600
  },
  Tokyo: {
    Bergen: 11800, Rotterdam: 11200, Singapore: 3300,
    Dubai: 5900, Istanbul: 9800, Houston: 9800,
    'New York': 10300
  },
  'New York': {
    Bergen: 6100, Rotterdam: 5550, Singapore: 15600,
    Dubai: 11200, Istanbul: 8100, Houston: 1600,
    Tokyo: 10300
  },
  Tromsø: { Bergen: 1080, Trondheim: 612, Stavanger: 1204, Ålesund: 820 },
  Trondheim: { Bergen: 490, Tromsø: 612, Stavanger: 560, Ålesund: 280 },
  Stavanger: { Bergen: 134, Tromsø: 1204, Trondheim: 560, Ålesund: 340 },
  Ålesund: { Bergen: 230, Tromsø: 820, Trondheim: 280, Stavanger: 340 },
};

// Bunker prices by port (USD/MT VLSFO)
// In production: replace with live API data
export const BUNKER_PRICES = {
  Rotterdam: 602,
  Singapore: 625,
  Fujairah: 614,
  Bergen: 618,
  Houston: 608,
  Tokyo: 631,
  'New York': 622,
  Stavanger: 641,
  Trondheim: 624,
  Tromsø: 629,
  Ålesund: 611,
  Istanbul: 619,
  Dubai: 614,
};

/**
 * Get distance between two ports
 * @param {string} from - Departure port name
 * @param {string} to - Destination port name
 * @returns {number} Distance in nautical miles
 */
export function getDistance(from, to) {
  return PORT_DISTANCES[from]?.[to]
    || PORT_DISTANCES[to]?.[from]
    || 2000; // fallback estimate
}

/**
 * Calculate full voyage P&L estimate
 * @param {Object} params
 * @param {string} params.from - Departure port
 * @param {string} params.to - Destination port
 * @param {number} params.cargoMT - Cargo weight in metric tons
 * @param {number} params.freightRateUSD - Freight rate in USD per MT
 * @param {number} params.speedKnots - Vessel service speed in knots
 * @param {number} params.fuelConsumptionMTPerDay - Fuel burn rate MT/day
 * @returns {Object} Full voyage estimate
 */
export function estimateVoyage({
  from,
  to,
  cargoMT = 1000,
  freightRateUSD = 40,
  speedKnots = 14,
  fuelConsumptionMTPerDay = 28,
}) {
  if (from === to) return null;

  const distanceNM = getDistance(from, to);
  const voyageHours = distanceNM / speedKnots;
  const voyageDays = voyageHours / 24;

  // Fuel calculation
  const fuelTonsConsumed = voyageDays * fuelConsumptionMTPerDay;
  const bunkerPriceUSD = BUNKER_PRICES[from] || 620;
  const fuelCostUSD = Math.round(fuelTonsConsumed * bunkerPriceUSD);

  // Port and agency costs (estimated from distance and port complexity)
  const portDuesUSD = Math.round(distanceNM * 8 + 12000);
  const agentFeesUSD = Math.round(8000 + (distanceNM * 2));

  // Revenue
  const revenueUSD = Math.round(cargoMT * freightRateUSD);

  // Total costs and P&L
  const totalCostUSD = fuelCostUSD + portDuesUSD + agentFeesUSD;
  const profitUSD = revenueUSD - totalCostUSD;
  const marginPct = revenueUSD > 0
    ? Math.round((profitUSD / revenueUSD) * 100)
    : 0;

  const daysWhole = Math.floor(voyageDays);
  const hoursRemainder = Math.round((voyageDays % 1) * 24);

  return {
    from,
    to,
    distanceNM,
    voyageDays,
    durationLabel: daysWhole > 0
      ? `${daysWhole}d ${hoursRemainder}h`
      : `${hoursRemainder}h`,
    fuelTonsConsumed: Math.round(fuelTonsConsumed),
    bunkerPriceUSD,
    fuelCostUSD,
    portDuesUSD,
    agentFeesUSD,
    totalCostUSD,
    revenueUSD,
    profitUSD,
    marginPct,
    isProfitable: profitUSD > 0,
    isTight: profitUSD > 0 && marginPct < 35,
  };
}

/**
 * Get best bunkering port for a route
 * Compares departure port vs destination vs cheapest global
 * @param {string} from - Departure port
 * @param {string} to - Destination port
 * @returns {Object} Port comparison
 */
export function getBunkerComparison(from, to) {
  const fromPrice = BUNKER_PRICES[from] || null;
  const toPrice = BUNKER_PRICES[to] || null;

  // Find global cheapest
  const sorted = Object.entries(BUNKER_PRICES).sort((a, b) => a[1] - b[1]);
  const cheapest = sorted[0];
  const cheapestOnRoute = fromPrice && toPrice
    ? (fromPrice <= toPrice ? { port: from, price: fromPrice } : { port: to, price: toPrice })
    : null;

  return {
    departure: fromPrice ? { port: from, price: fromPrice } : null,
    destination: toPrice ? { port: to, price: toPrice } : null,
    bestOnRoute: cheapestOnRoute,
    globalCheapest: { port: cheapest[0], price: cheapest[1] },
    potentialSaving: cheapestOnRoute
      ? Math.max(0, cheapestOnRoute.price - cheapest[1])
      : null,
  };
}
