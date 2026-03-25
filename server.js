const express = require('express');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Craigslist RSS feed for Orange County / Hudson Valley area, 1BR apartments
const CRAIGSLIST_FEEDS = [
  {
    label: 'Hudson Valley (Orange County)',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  },
  {
    label: 'Hudson Valley - Goshen area',
    url: 'https://hudsonvalley.craigslist.org/search/apa?format=rss&query=goshen&min_bedrooms=1&max_bedrooms=1&availabilityMode=0'
  }
];

async function parseFeed(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ApartmentSearchBot/1.0)' },
    timeout: 10000
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list.map(item => {
    // Extract price from title like "$1,200 1br - ..."
    const priceMatch = (item.title || '').match(/\$[\d,]+/);
    const price = priceMatch ? priceMatch[0] : null;
    // Extract neighborhood/location
    const locMatch = (item.title || '').match(/\(([^)]+)\)\s*$/);
    const neighborhood = locMatch ? locMatch[1] : '';
    return {
      title: item.title || '',
      link: item.link || item.guid?._ || item.guid || '',
      description: item.description || '',
      date: item.pubDate || '',
      price,
      neighborhood
    };
  });
}

app.get('/api/listings', async (req, res) => {
  try {
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : null;
    const search = (req.query.search || '').toLowerCase().trim();

    // Fetch both feeds in parallel
    const results = await Promise.allSettled(CRAIGSLIST_FEEDS.map(f => parseFeed(f.url)));
    const allItems = [];
    const seen = new Set();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          const key = item.link || item.title;
          if (!seen.has(key)) {
            seen.add(key);
            allItems.push(item);
          }
        }
      }
    }

    let filtered = allItems;

    if (maxPrice) {
      filtered = filtered.filter(item => {
        if (!item.price) return true; // include if no price listed
        const num = parseInt(item.price.replace(/[$,]/g, ''));
        return num <= maxPrice;
      });
    }

    if (search) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        item.neighborhood.toLowerCase().includes(search)
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ listings: filtered, total: filtered.length });
  } catch (err) {
    console.error('Error fetching listings:', err.message);
    res.status(500).json({ error: 'Could not load listings. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Aunt Karen's Apartment Search is running!`);
  console.log(`  Open your browser to: http://localhost:${PORT}\n`);
});
