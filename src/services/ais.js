/**
 * NavProfit — AIS vessel tracking service
 * Connects to aisstream.io WebSocket for live vessel positions
 *
 * Setup:
 * 1. Get free API key at https://aisstream.io
 * 2. Add AIS_API_KEY to your .env file
 */

const AIS_ENDPOINT = 'wss://stream.aisstream.io/v0/stream';

// Norwegian coastal bounding box
const NORWAY_BBOX = [[57.0, 4.0], [71.5, 31.5]];

// North Sea + English Channel
const NORTH_SEA_BBOX = [[50.0, -5.0], [62.0, 13.0]];

// Global — use sparingly, high data volume
const GLOBAL_BBOX = [[-90.0, -180.0], [90.0, 180.0]];

/**
 * Connect to AIS stream and receive vessel updates
 *
 * @param {Object} options
 * @param {string} options.apiKey - Your aisstream.io API key
 * @param {Array} options.mmsiList - Specific vessel MMSIs to track (empty = all in bbox)
 * @param {Array} options.boundingBoxes - Geographic regions to watch
 * @param {Function} options.onPosition - Called when vessel position updates
 * @param {Function} options.onStatic - Called when vessel static data updates
 * @param {Function} options.onError - Called on connection error
 * @returns {WebSocket} Socket instance (call .close() to disconnect)
 */
export function connectAIS({
  apiKey,
  mmsiList = [],
  boundingBoxes = [NORWAY_BBOX],
  onPosition = () => {},
  onStatic = () => {},
  onError = () => {},
}) {
  const socket = new WebSocket(AIS_ENDPOINT);

  socket.onopen = () => {
    console.log('[AIS] Connected to aisstream.io');

    const subscription = {
      APIKey: apiKey,
      BoundingBoxes: boundingBoxes,
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    };

    // If specific MMSIs provided, filter to those vessels
    if (mmsiList.length > 0) {
      subscription.MMSI = mmsiList;
    }

    socket.send(JSON.stringify(subscription));
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const msgType = msg.MessageType;

      if (msgType === 'PositionReport') {
        const pos = msg.Message.PositionReport;
        onPosition({
          mmsi: pos.UserID,
          latitude: pos.Latitude,
          longitude: pos.Longitude,
          speedKnots: pos.Sog, // Speed over ground
          headingDeg: pos.TrueHeading,
          courseDeg: pos.Cog,
          navStatus: pos.NavigationalStatus,
          timestamp: msg.MetaData?.time_utc,
        });
      }

      if (msgType === 'ShipStaticData') {
        const stat = msg.Message.ShipStaticData;
        onStatic({
          mmsi: stat.UserID,
          name: stat.Name?.trim(),
          callSign: stat.CallSign?.trim(),
          destination: stat.Destination?.trim(),
          imo: stat.ImoNumber,
          shipType: stat.Type,
          draught: stat.MaximumStaticDraught,
          eta: stat.Eta,
        });
      }
    } catch (err) {
      console.error('[AIS] Parse error:', err);
    }
  };

  socket.onerror = (err) => {
    console.error('[AIS] Connection error:', err);
    onError(err);
  };

  socket.onclose = () => {
    console.log('[AIS] Connection closed');
  };

  return socket;
}

/**
 * Decode AIS navigational status to human readable
 * @param {number} status - AIS status code
 * @returns {string}
 */
export function decodeNavStatus(status) {
  const statuses = {
    0: 'underway',
    1: 'anchored',
    2: 'not-under-command',
    3: 'restricted-maneuverability',
    5: 'moored',
    6: 'aground',
    15: 'unknown',
  };
  return statuses[status] || 'unknown';
}

/**
 * Mock vessel data for development/testing
 * Replace with real AIS connection in production
 */
export const MOCK_VESSELS = [
  {
    mmsi: '257123450',
    name: 'MS Nordfjord',
    flag: '🇳🇴',
    type: 'General cargo',
    latitude: 59.2,
    longitude: 5.8,
    speedKnots: 14.2,
    headingDeg: 195,
    navStatus: 'underway',
    destination: 'ROTTERDAM',
  },
  {
    mmsi: '257445200',
    name: 'KV Harstad',
    flag: '🇳🇴',
    type: 'Offshore supply',
    latitude: 57.4,
    longitude: 7.2,
    speedKnots: 11.8,
    headingDeg: 180,
    navStatus: 'underway',
    destination: 'ISTANBUL',
  },
  {
    mmsi: '235099421',
    name: 'MV Atlantic',
    flag: '🇬🇧',
    type: 'Bulk carrier',
    latitude: 40.9,
    longitude: 29.1,
    speedKnots: 12.4,
    headingDeg: 110,
    navStatus: 'underway',
    destination: 'DUBAI',
  },
  {
    mmsi: '565012340',
    name: 'MV Orient Star',
    flag: '🇸🇬',
    type: 'Container',
    latitude: 20.5,
    longitude: 63.4,
    speedKnots: 16.0,
    headingDeg: 115,
    navStatus: 'underway',
    destination: 'SINGAPORE',
  },
  {
    mmsi: '257882110',
    name: 'SS Bergen',
    flag: '🇳🇴',
    type: 'Tanker',
    latitude: 51.9,
    longitude: 4.1,
    speedKnots: 0.0,
    headingDeg: 0,
    navStatus: 'anchored',
    destination: '',
  },
];
