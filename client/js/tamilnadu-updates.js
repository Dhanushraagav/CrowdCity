// CrowdCity - Tamil Nadu Updates Controller

let _allTNUpdates = [];
let _isLoadingUpdates = false;

document.addEventListener('DOMContentLoaded', () => {
  loadTamilNaduUpdates();
});

/**
 * Format timestamp into friendly relative time
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Fetch updates from the backend API
 */
async function loadTamilNaduUpdates(forceRefresh = false) {
  if (_isLoadingUpdates) return;
  _isLoadingUpdates = true;

  const emptyState = document.getElementById('tn-empty-state');
  const errorState = document.getElementById('tn-error-state');
  const container = document.getElementById('tn-updates-container');
  const refreshIcon = document.getElementById('refresh-icon');

  if (emptyState) emptyState.classList.add('hidden');
  if (errorState) errorState.classList.add('hidden');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  const btnRefresh = document.getElementById('btn-refresh-updates');

  if (forceRefresh && btnRefresh && window.CrowdCityLoading) {
    window.CrowdCityLoading.setButtonLoading(btnRefresh, true, 'Updating...');
  }

  if (!forceRefresh && _allTNUpdates.length === 0) {
    if (window.CrowdCityLoading && container) {
      window.CrowdCityLoading.show(container, {
        message: 'Retrieving Tamil Nadu live updates...',
        subtitle: 'Connecting to statewide municipal and administrative dispatches',
        size: 'lg'
      });
    }
  } else if (_allTNUpdates.length > 0 && forceRefresh && window.CrowdCityLoading && container) {
    window.CrowdCityLoading.showBackgroundSync(container);
  }

  try {
    const url = forceRefresh ? '/api/tamilnadu-updates?refresh=true' : '/api/tamilnadu-updates';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    _allTNUpdates = Array.isArray(data.updates) ? data.updates : [];

    populateSourceOptions(_allTNUpdates);
    renderFilteredUpdates();
  } catch (err) {
    console.error('[TN Updates] Failed to fetch live updates:', err);
    if (_allTNUpdates.length === 0) {
      if (container) container.innerHTML = '';
      if (errorState) {
        const errorMsg = document.getElementById('tn-error-message');
        if (errorMsg) errorMsg.textContent = err.message || 'Could not load updates from the server.';
        errorState.classList.remove('hidden');
      }
    }
  } finally {
    _isLoadingUpdates = false;
    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    if (btnRefresh && window.CrowdCityLoading) {
      window.CrowdCityLoading.setButtonLoading(btnRefresh, false);
    }
    if (window.CrowdCityLoading && container) {
      window.CrowdCityLoading.hideBackgroundSync(container);
      window.CrowdCityLoading.hide(container);
    }
  }
}

/**
 * Populate dynamic sources in the source select dropdown
 */
function populateSourceOptions(updates) {
  const sourceSelect = document.getElementById('tn-source-filter');
  if (!sourceSelect) return;

  const currentVal = sourceSelect.value;
  const sources = new Set();
  updates.forEach(u => {
    if (u.source && u.source.trim()) sources.add(u.source.trim());
  });

  const options = ['<option value="all">All Sources</option>'];
  Array.from(sources).sort().forEach(src => {
    options.push(`<option value="${escapeHtml(src)}">${escapeHtml(src)}</option>`);
  });

  sourceSelect.innerHTML = options.join('');
  if (sources.has(currentVal)) {
    sourceSelect.value = currentVal;
  }
}

/**
 * Filter and render updates matching user criteria
 */
function renderFilteredUpdates() {
  const container = document.getElementById('tn-updates-container');
  const emptyState = document.getElementById('tn-empty-state');
  const errorState = document.getElementById('tn-error-state');
  if (!container) return;

  if (errorState) errorState.classList.add('hidden');

  const searchInput = document.getElementById('tn-search-input');
  const districtSelect = document.getElementById('tn-district-filter');
  const sourceSelect = document.getElementById('tn-source-filter');

  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedDistrict = districtSelect ? districtSelect.value : 'all';
  const selectedSource = sourceSelect ? sourceSelect.value : 'all';

  const filtered = _allTNUpdates.filter(item => {
    // District match
    if (selectedDistrict !== 'all') {
      if (!item.district || item.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
        return false;
      }
    }

    // Source match
    if (selectedSource !== 'all') {
      if (!item.source || item.source !== selectedSource) {
        return false;
      }
    }

    // Keyword search match
    if (query) {
      const matchTitle = item.title && item.title.toLowerCase().includes(query);
      const matchDistrict = item.district && item.district.toLowerCase().includes(query);
      const matchSource = item.source && item.source.toLowerCase().includes(query);
      if (!matchTitle && !matchDistrict && !matchSource) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(item => {
    const safeTitle = escapeHtml(item.title || 'Tamil Nadu Update');
    const safeSource = escapeHtml(item.source || 'TN-Info');
    const safeDistrict = escapeHtml(item.district || 'Tamil Nadu');
    const safeUrl = item.url ? escapeHtml(item.url) : '#';
    const relativeTime = formatRelativeTime(item.publishedAt);

    return `
      <article class="tn-update-card">
        <div>
          <div class="tn-card-meta">
            <span class="tn-district-pill">
              <i class="fa-solid fa-location-dot"></i>
              <span>${safeDistrict}</span>
            </span>
            <span class="tn-source-badge">
              <i class="fa-regular fa-newspaper"></i>
              <span>${safeSource}</span>
            </span>
          </div>
          <h3 class="tn-card-title">
            ${safeTitle}
          </h3>
        </div>

        <div class="tn-card-footer">
          <span class="tn-time-meta">
            <i class="fa-regular fa-clock"></i>
            <span>${relativeTime}</span>
          </span>
          ${item.url ? `
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="tn-read-story-btn">
              <span>Read Story</span>
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Filter change handler
 */
window.handleFilterUpdates = function() {
  renderFilteredUpdates();
};

/**
 * Reset all filters
 */
window.resetFilters = function() {
  const searchInput = document.getElementById('tn-search-input');
  const districtSelect = document.getElementById('tn-district-filter');
  const sourceSelect = document.getElementById('tn-source-filter');

  if (searchInput) searchInput.value = '';
  if (districtSelect) districtSelect.value = 'all';
  if (sourceSelect) sourceSelect.value = 'all';

  renderFilteredUpdates();
};

/**
 * Trigger manual feed refresh
 */
window.refreshTamilNaduUpdates = function() {
  loadTamilNaduUpdates(true);
};

/**
 * HTML Escaper helper
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
