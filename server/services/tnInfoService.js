import logger from '../config/logger.js';

// 38 Districts of Tamil Nadu for entity tagging
const TN_DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Trichy', 'Salem', 
  'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Tuticorin', 'Dindigul', 
  'Thanjavur', 'Ranipet', 'Sivaganga', 'Karur', 'Ramanathapuram', 'Virudhunagar', 
  'Cuddalore', 'Kanchipuram', 'Tiruvallur', 'Chengalpattu', 'Tiruppur', 'Namakkal', 
  'Krishnagiri', 'Dharmapuri', 'Nilgiris', 'Nagapattinam', 'Tiruvarur', 
  'Mayiladuthurai', 'Pudukkottai', 'Theni', 'Perambalur', 'Ariyalur', 'Tenkasi', 
  'Tirupathur', 'Kallakurichi', 'Kanniyakumari'
];

// Public RSS and API Feed Sources for Tamil Nadu Civic, Governance & Welfare Updates
const FEED_SOURCES = [
  {
    name: 'Google News TN (Tamil)',
    url: 'https://news.google.com/rss/search?q=%E0%AE%A4%E0%AE%AE%E0%AE%BF%E0%AE%B4%E0%AE%A8%E0%AE%BE%E0%AE%9F%E0%AE%A1%E0%AE%BE%E0%AE%B0%E0%AE%9A%E0%AF%81+OR+%E0%AE%A4%E0%AE%AE%E0%AE%BF%E0%AE%B4%E0%AE%A8%E0%AE%BE%E0%AE%9F%E0%AE%A1%E0%AF%81+OR+%E0%AE%AE%E0%AE%BE%E0%AE%A3%E0%AF%8D%E0%AE%AA%E0%AF%81%E0%AE%AE%E0%AE%BF%E0%AE%95%E0%AF%81+%E0%AE%AE%E0%AF%81%E0%AE%A4%E0%AE%B2%E0%AE%AE%E0%AF%88%E0%AE%9A%E0%AF%8D%E0%AE%9A%E0%AE%B0%E0%AF%8D&hl=ta&gl=IN&ceid=IN:ta'
  },
  {
    name: 'Google News TN (English)',
    url: 'https://news.google.com/rss/search?q=Tamil+Nadu+government+OR+civic+OR+infrastructure+OR+welfare+OR+transportation+when:7d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    name: 'The Hindu (Tamil Nadu)',
    url: 'https://www.thehindu.com/news/national/tamil-nadu/feeder/default.rss'
  },
  {
    name: 'Indian Express (Tamil Nadu)',
    url: 'https://indianexpress.com/section/cities/chennai/feed/'
  }
];

// Server-side cache state
let _cache = {
  data: [],
  lastFetchedAt: 0,
  ttl: 15 * 60 * 1000 // 15 minutes TTL
};

/**
 * Decode XML entities into clean unicode strings
 */
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .trim();
}

/**
 * Extract district from text headline
 */
function detectDistrict(text) {
  if (!text) return 'Tamil Nadu';
  for (const d of TN_DISTRICTS) {
    if (new RegExp(`\\b${d}\\b`, 'i').test(text)) {
      return d === 'Trichy' ? 'Tiruchirappalli' : d;
    }
  }
  return 'Tamil Nadu';
}

/**
 * Parse RSS / XML text into normalized updates
 */
function parseRssItems(xmlText, defaultSource) {
  const items = [];
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i) || itemXml.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/i);
    const pubDateMatch = itemXml.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i);
    const sourceMatch = itemXml.match(/<source[^>]*?>([\s\S]*?)<\/source>/i);

    let rawTitle = titleMatch ? titleMatch[1] : '';
    let title = decodeEntities(rawTitle);

    // Clean Google News trailing source if present: "Headline - Source Name"
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      if (parts.length > 1 && parts[parts.length - 1].length < 40) {
        title = parts.slice(0, -1).join(' - ').trim();
      }
    }

    if (!title || title.length < 8) continue;

    let url = linkMatch ? decodeEntities(linkMatch[1]) : '';
    let publishedAt = new Date().toISOString();
    if (pubDateMatch && pubDateMatch[1]) {
      const parsedDate = new Date(decodeEntities(pubDateMatch[1]));
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    let sourceName = sourceMatch ? decodeEntities(sourceMatch[1]) : defaultSource;
    const district = detectDistrict(title);

    items.push({
      title,
      url,
      publishedAt,
      district,
      source: sourceName
    });
  }

  return items;
}

/**
 * Fetch updates from public feeds with fallback and caching
 */
export async function getTamilNaduUpdates(forceRefresh = false) {
  const now = Date.now();

  // Return cached data if fresh and not forced
  if (!forceRefresh && _cache.data.length > 0 && (now - _cache.lastFetchedAt < _cache.ttl)) {
    return {
      success: true,
      count: _cache.data.length,
      cached: true,
      lastFetchedAt: new Date(_cache.lastFetchedAt).toISOString(),
      updates: _cache.data
    };
  }

  logger.info('[TN-Info Service] Fetching latest Tamil Nadu updates from public feeds...');
  const collectedUpdates = [];
  const seenTitles = new Set();

  for (const src of FEED_SOURCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout per source

      const response = await fetch(src.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`[TN-Info Service] Failed to fetch ${src.name}: HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const items = parseRssItems(xml, src.name);

      for (const item of items) {
        const normalized = item.title.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '');
        if (!seenTitles.has(normalized)) {
          seenTitles.add(normalized);
          collectedUpdates.push(item);
        }
      }
    } catch (err) {
      logger.warn(`[TN-Info Service] Error fetching feed ${src.name}: ${err.message}`);
    }
  }

  if (collectedUpdates.length > 0) {
    // Sort newest first
    collectedUpdates.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Limit to top 30 updates
    const topUpdates = collectedUpdates.slice(0, 30);

    _cache.data = topUpdates;
    _cache.lastFetchedAt = now;

    logger.info(`[TN-Info Service] Successfully cached ${topUpdates.length} Tamil Nadu updates.`);
    return {
      success: true,
      count: topUpdates.length,
      cached: false,
      lastFetchedAt: new Date(now).toISOString(),
      updates: topUpdates
    };
  }

  // If live fetching failed, use existing cache if available
  if (_cache.data.length > 0) {
    logger.warn('[TN-Info Service] Live feed unavailable, serving stale cache.');
    return {
      success: true,
      count: _cache.data.length,
      cached: true,
      stale: true,
      lastFetchedAt: new Date(_cache.lastFetchedAt).toISOString(),
      updates: _cache.data
    };
  }

  // Graceful empty state
  logger.info('[TN-Info Service] No live updates retrieved; returning empty state.');
  return {
    success: true,
    count: 0,
    cached: false,
    updates: []
  };
}

export default {
  getTamilNaduUpdates
};
