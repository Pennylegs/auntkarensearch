(function () {
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const maxPriceSelect = document.getElementById('maxPrice');
  const listingsEl = document.getElementById('listings');
  const statusEl = document.getElementById('status');
  const resultCountEl = document.getElementById('resultCount');

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function renderListings(listings) {
    listingsEl.innerHTML = '';

    if (listings.length === 0) {
      listingsEl.innerHTML = `
        <div class="empty-state">
          <p>No listings found. Try adjusting your search or check the sites below.</p>
        </div>`;
      return;
    }

    listings.forEach(function (item) {
      const card = document.createElement('article');
      card.className = 'listing-card';

      const priceHtml = item.price
        ? `<div class="listing-price">${item.price}/mo</div>`
        : `<div class="listing-price no-price">Price not listed</div>`;

      const locationHtml = item.neighborhood
        ? `<div class="listing-location">📍 ${item.neighborhood}</div>`
        : '';

      const dateHtml = item.date
        ? `<div class="listing-date">Posted: ${formatDate(item.date)}</div>`
        : '';

      const link = item.link || '#';

      card.innerHTML = `
        ${priceHtml}
        <div class="listing-title">${escapeHtml(item.title)}</div>
        ${locationHtml}
        ${dateHtml}
        <a class="listing-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">
          View Full Listing &rarr;
        </a>
      `;

      listingsEl.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function doSearch() {
    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';
    setStatus('Loading listings, please wait...', 'loading');
    listingsEl.innerHTML = '';
    resultCountEl.textContent = '';

    const search = searchInput.value.trim();
    const maxPrice = maxPriceSelect.value;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (maxPrice) params.set('maxPrice', maxPrice);

    try {
      const res = await fetch('/api/listings?' + params.toString());
      if (!res.ok) throw new Error('Server error: ' + res.status);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setStatus('');
      resultCountEl.textContent = data.total === 0
        ? 'No listings found.'
        : `Found ${data.total} listing${data.total !== 1 ? 's' : ''}`;

      renderListings(data.listings);

    } catch (err) {
      setStatus('Sorry, could not load listings right now. Please try again in a moment.', 'error');
      resultCountEl.textContent = '';
      console.error(err);
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search Apartments';
    }
  }

  // Search on button click
  searchBtn.addEventListener('click', doSearch);

  // Search on Enter key in text field
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch();
  });

  // Auto-search on page load
  doSearch();
})();
