(function () {
  const searchBtn    = document.getElementById('searchBtn');
  const searchInput  = document.getElementById('searchInput');
  const minPriceSel  = document.getElementById('minPrice');
  const maxPriceSel  = document.getElementById('maxPrice');
  const listingsEl   = document.getElementById('listings');
  const statusEl     = document.getElementById('status');
  const resultHeader = document.getElementById('resultHeader');

  // ── helpers ──────────────────────────────────────

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = type || '';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch { return ''; }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function priceTier(priceNum) {
    if (!priceNum) return '';
    if (priceNum <= 1200) return 'price-low';
    if (priceNum <= 1700) return 'price-mid';
    return 'price-high';
  }

  function sourceLabel(source) {
    return source.replace(/^Craigslist\s*[–-]?\s*/i, '').trim() || 'Craigslist';
  }

  // ── render ───────────────────────────────────────

  function renderListings(listings) {
    listingsEl.innerHTML = '';

    if (!listings.length) {
      listingsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏚️</div>
          <p>No listings matched your search.<br>Try wider filters, or use the site buttons below.</p>
        </div>`;
      return;
    }

    listings.forEach(function (item, i) {
      const card = document.createElement('article');
      const tier = priceTier(item.priceNum);
      card.className = 'listing-card' + (tier ? ' ' + tier : '');

      const priceHtml = item.price
        ? `<div class="listing-price${tier === 'price-mid' ? ' price-mid' : tier === 'price-high' ? ' price-high' : ''}">${item.price}<small style="font-size:0.55em;font-weight:500">/mo</small></div>`
        : `<div class="listing-price no-price">Price not listed</div>`;

      const srcLabel = sourceLabel(item.source || '');
      const srcHtml  = srcLabel
        ? `<span class="listing-source">${escapeHtml(srcLabel)}</span>`
        : '';

      const locHtml = item.neighborhood
        ? `<span>📍 ${escapeHtml(item.neighborhood)}</span>`
        : '';

      const dateHtml = item.date
        ? `<span>📅 ${formatDate(item.date)}</span>`
        : '';

      const link = escapeHtml(item.link || '#');

      card.innerHTML = `
        ${priceHtml}
        ${srcHtml}
        <div class="listing-title">${escapeHtml(item.title)}</div>
        <div class="listing-meta">${locHtml}${dateHtml}</div>
        <div class="listing-actions">
          <a class="btn-view" href="${link}" target="_blank" rel="noopener">
            View Full Listing &rarr;
          </a>
        </div>`;

      listingsEl.appendChild(card);
    });
  }

  // ── fetch ─────────────────────────────────────────

  async function doSearch() {
    searchBtn.disabled = true;
    searchBtn.classList.add('loading');
    setStatus('Loading listings, please wait…');
    listingsEl.innerHTML = '';
    resultHeader.innerHTML = '';

    const params = new URLSearchParams();
    const kw = searchInput.value.trim();
    const min = minPriceSel.value;
    const max = maxPriceSel.value;
    if (kw)  params.set('search', kw);
    if (min) params.set('minPrice', min);
    if (max) params.set('maxPrice', max);

    try {
      const res  = await fetch('/api/listings?' + params.toString());
      if (!res.ok) throw new Error('Server error ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setStatus('');

      const total = data.total;
      const errNote = data.sourceErrors > 0
        ? ` <span style="color:#9ca3af;font-size:0.8em">(${data.sourceErrors} source${data.sourceErrors > 1 ? 's' : ''} unavailable)</span>`
        : '';
      resultHeader.innerHTML = total === 0
        ? 'No listings found.'
        : `<span class="count-badge">${total} listing${total !== 1 ? 's' : ''} found</span>${errNote}`;

      renderListings(data.listings);

    } catch (err) {
      setStatus('Sorry, couldn\'t load listings right now. Please try again.', 'error');
      console.error(err);
    } finally {
      searchBtn.disabled = false;
      searchBtn.classList.remove('loading');
    }
  }

  // ── events ────────────────────────────────────────

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Auto-search on load
  doSearch();
})();
