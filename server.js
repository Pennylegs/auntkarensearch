const express = require('express');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ─── Craigslist RSS sources ───────────────────────────────────────────────────
// Hudson Valley CL covers all of Orange County NY.
// We run multiple targeted searches and deduplicate results.
const CRAIGSLIST_FEEDS = [
  // General 1BR sweep for the entire region
  {
    label: 'Craigslist',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&min_bedrooms=1&max_bedrooms=1&availabilityMode=0&sort=date'
  },
  // Town-specific keyword searches
  {
    label: 'Craigslist – Goshen',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=goshen&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  {
    label: 'Craigslist – Middletown',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=middletown&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  {
    label: 'Craigslist – Newburgh',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=newburgh&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  {
    label: 'Craigslist – Port Jervis',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=port+jervis&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  {
    label: 'Craigslist – Warwick',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=warwick&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  {
    label: 'Craigslist – Monroe',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=monroe+ny&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  // Rooms & shared housing (often cheap 1BR equivalents)
  {
    label: 'Craigslist – Rooms/Shares',
    url: 'https://hudsonvalley.craigslist.org/search/roo?format=rss&availabilityMode=0&sort=date'
  },
  // Sublets & temporary housing
  {
    label: 'Craigslist – Sublets',
    url: 'https://hudsonvalley.craigslist.org/search/sub?format=rss&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  }
];

async function parseFeed(feedInfo) {
  const response = await fetch(feedInfo.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 12000
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${feedInfo.label}`);
  const text = await response.text();
  const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];

  return list.map(item => {
    const title = item.title || '';
    // Extract price
    const priceMatch = title.match(/\$[\d,]+/);
    const price = priceMatch ? priceMatch[0] : null;
    const priceNum = price ? parseInt(price.replace(/[$,]/g, '')) : null;
    // Extract neighborhood from "(location)" at end of title
    const locMatch = title.match(/\(([^)]+)\)\s*$/);
    const neighborhood = locMatch ? locMatch[1] : '';
    // Clean title (remove price prefix Craigslist adds)
    const cleanTitle = title.replace(/^\$[\d,]+\s+\d+br\s+-\s+/i, '').trim();

    return {
      title: cleanTitle || title,
      rawTitle: title,
      link: item.link || item.guid?._ || item.guid || '',
      description: item.description || '',
      date: item.pubDate || '',
      price,
      priceNum,
      neighborhood,
      source: feedInfo.label
    };
  });
}

app.get('/api/listings', async (req, res) => {
  try {
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : null;
    const minPrice = req.query.minPrice ? parseInt(req.query.minPrice) : null;
    const search = (req.query.search || '').toLowerCase().trim();

    const results = await Promise.allSettled(CRAIGSLIST_FEEDS.map(f => parseFeed(f)));

    const allItems = [];
    const seen = new Set();
    let sourceErrors = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          const key = item.link || item.rawTitle;
          if (!seen.has(key)) {
            seen.add(key);
            allItems.push(item);
          }
        }
      } else {
        sourceErrors++;
      }
    }

    let filtered = allItems;

    if (maxPrice) {
      filtered = filtered.filter(item => {
        if (!item.priceNum) return true;
        return item.priceNum <= maxPrice;
      });
    }

    if (minPrice) {
      filtered = filtered.filter(item => {
        if (!item.priceNum) return true;
        return item.priceNum >= minPrice;
      });
    }

    if (search) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.rawTitle.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        item.neighborhood.toLowerCase().includes(search) ||
        item.source.toLowerCase().includes(search)
      );
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      listings: filtered,
      total: filtered.length,
      sourceErrors,
      sourcesQueried: CRAIGSLIST_FEEDS.length
    });
  } catch (err) {
    console.error('Error fetching listings:', err.message);
    res.status(500).json({ error: 'Could not load listings. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Aunt Karen's Apartment Search is running!`);
  console.log(`  Open your browser to: http://localhost:${PORT}\n`);
});
