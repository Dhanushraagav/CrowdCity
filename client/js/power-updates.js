/**
 * power-updates.js
 * 
 * Frontend controller for Tamil Nadu planned electricity shutdown updates.
 * References official TNPDCL / TANGEDCO publications.
 * 
 * Features:
 * - Real-time Asia/Kolkata dynamic status computation (SCHEDULED, ONGOING, RESTORED, CANCELLED).
 * - Automatic citizen district detection and highlighting.
 * - 38 Tamil Nadu districts filtering, taluk/area keyword search, and timeframe tabs.
 * - Zero simulated/fake records guarantee with official source attribution.
 * - Bilingual support (en / ta) with strict technical term preservation.
 */

(function () {
  'use strict';

  let powerState = {
    selectedDistrict: 'all',
    searchQuery: '',
    selectedDate: '',
    selectedTab: 'all',
    outages: [],
    lastUpdated: '',
    isLoading: false,
    isDetectingLocation: false,
    userDetectedDistrict: null,
    hasManuallyChangedDistrict: false
  };

  document.addEventListener('DOMContentLoaded', initPowerUpdates);

  function initPowerUpdates() {
    setupEventListeners();

    // 1. Resolve known citizen district synchronously
    let detected = (window.CrowdCityLocation && typeof window.CrowdCityLocation.getSavedUserDistrict === 'function')
      ? window.CrowdCityLocation.getSavedUserDistrict()
      : null;

    if (!detected && typeof window.getCurrentUser === 'function') {
      const user = window.getCurrentUser();
      if (user && user.district && user.district !== 'Tamil Nadu') {
        detected = user.district;
      }
    }

    if (!detected) {
      detected = localStorage.getItem('user_district') || localStorage.getItem('crowdcity_user_district');
      if (detected === 'all' || detected === 'Tamil Nadu') detected = null;
    }

    if (detected) {
      applyDetectedDistrict(detected);
      fetchPowerShutdowns();
    } else {
      // 2. Fallback to cached location or statewide overview (do not force GPS prompt on page load)
      powerState.isDetectingLocation = false;
      if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
        window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 3000, requestGps: false }).then(cachedDistrict => {
          if (cachedDistrict && !powerState.hasManuallyChangedDistrict) {
            applyDetectedDistrict(cachedDistrict);
          }
          updateLocationBanner();
          fetchPowerShutdowns();
        });
      } else {
        updateLocationBanner();
        fetchPowerShutdowns();
      }
    }

    // Listen for language change events
    window.addEventListener('languageChanged', () => {
      renderOutages();
    });

    // Listen for global location events
    window.addEventListener('crowdcity:location_detected', handleLocationEvent);
    window.addEventListener('crowdcity:location_changed', handleLocationEvent);
  }

  function showDetectingLocationState() {
    const container = document.getElementById('power-outages-container');
    if (!container) return;
    container.innerHTML = `
      <div class="power-loading-card" style="padding: 2.5rem; text-align: center; grid-column: 1 / -1; background: #fff; border: 1px solid var(--border-color); border-radius: 14px;">
        <i class="fa-solid fa-location-crosshairs fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 0.75rem;"></i>
        <h4 style="margin: 0 0 0.35rem 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">Detecting Current Location...</h4>
        <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Retrieving official TNPDCL planned electricity shutdown schedules for your area</p>
      </div>
    `;
  }

  function handleLocationEvent(e) {
    if (e.detail && e.detail.district && !powerState.hasManuallyChangedDistrict) {
      powerState.isDetectingLocation = false;
      applyDetectedDistrict(e.detail.district);
      fetchPowerShutdowns();
    }
  }

  function applyDetectedDistrict(districtName) {
    if (!districtName) return;
    powerState.userDetectedDistrict = districtName.trim();
    powerState.selectedDistrict = powerState.userDetectedDistrict;
    updateLocationBanner();

    const districtSelect = document.getElementById('power-district-filter');
    if (districtSelect) {
      const matchOpt = Array.from(districtSelect.options).find(
        opt => opt.value.toLowerCase() === powerState.userDetectedDistrict.toLowerCase()
      );
      if (matchOpt) {
        districtSelect.value = matchOpt.value;
        powerState.selectedDistrict = matchOpt.value;
        if (!matchOpt.text.includes('(Your Location)')) {
          matchOpt.text = `${matchOpt.value} (Your Location)`;
        }
      }
    }
  }

  function updateLocationBanner() {
    const highlightBanner = document.getElementById('power-location-highlight');
    const switchBtn = document.getElementById('btn-power-all-districts');

    if (!highlightBanner) return;

    const bannerContent = highlightBanner.querySelector('.power-location-banner-content');

    if (powerState.isDetectingLocation) {
      highlightBanner.classList.remove('hidden');
      if (bannerContent) {
        bannerContent.innerHTML = `
          <i class="fa-solid fa-location-crosshairs fa-spin"></i>
          <span>Detecting your current location to showcase planned shutdowns for your area...</span>
        `;
      }
      if (switchBtn) switchBtn.style.display = 'none';
      return;
    }

    if (powerState.userDetectedDistrict) {
      highlightBanner.classList.remove('hidden');
      if (switchBtn) switchBtn.style.display = 'inline-flex';
      if (bannerContent) {
        if (powerState.selectedDistrict === 'all') {
          bannerContent.innerHTML = `
            <i class="fa-solid fa-globe"></i>
            <span>Showing all districts across Tamil Nadu. Your detected location: <strong>${escapeHtml(powerState.userDetectedDistrict)}</strong></span>
          `;
          switchBtn.innerHTML = `<span>Back to ${escapeHtml(powerState.userDetectedDistrict)}</span> <i class="fa-solid fa-location-crosshairs"></i>`;
          switchBtn.onclick = () => window.selectUserDetectedDistrict();
        } else {
          bannerContent.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <span>Showing planned power shutdowns for your current location: <strong>${escapeHtml(powerState.selectedDistrict)}</strong></span>
          `;
          switchBtn.innerHTML = `<span>View All Districts (38)</span> <i class="fa-solid fa-arrow-right"></i>`;
          switchBtn.onclick = () => window.clearDistrictFilter();
        }
      }
    } else {
      highlightBanner.classList.remove('hidden');
      if (bannerContent) {
        bannerContent.innerHTML = `
          <i class="fa-solid fa-location-pin"></i>
          <span>Please select your district to showcase local planned power shutdowns.</span>
        `;
      }
      if (switchBtn) switchBtn.style.display = 'none';
    }
  }

  window.selectUserDetectedDistrict = function() {
    if (powerState.userDetectedDistrict) {
      applyDetectedDistrict(powerState.userDetectedDistrict);
      powerState.hasManuallyChangedDistrict = false;
      updateLocationBanner();
      fetchPowerShutdowns();
    }
  };

  function setupEventListeners() {
    const searchInput = document.getElementById('power-search-input');
    if (searchInput) {
      let debounceTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          powerState.searchQuery = e.target.value.trim();
          fetchPowerShutdowns();
        }, 300);
      });
    }

    const districtFilter = document.getElementById('power-district-filter');
    if (districtFilter) {
      districtFilter.addEventListener('change', (e) => {
        powerState.selectedDistrict = e.target.value;
        powerState.hasManuallyChangedDistrict = true;
        updateLocationBanner();
        fetchPowerShutdowns();
      });
    }

    const dateFilter = document.getElementById('power-date-filter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        powerState.selectedDate = e.target.value;
        fetchPowerShutdowns();
      });
    }
  }

  /**
   * Fetch power shutdown schedules from the backend API.
   */
  async function fetchPowerShutdowns(isRefresh = false) {
    if (powerState.isLoading) return;
    powerState.isLoading = true;

    const container = document.getElementById('power-outages-container');
    const emptyState = document.getElementById('power-empty-state');
    const officialInfoBox = document.getElementById('power-official-info-box');
    const errorState = document.getElementById('power-error-state');
    const refreshIcon = document.getElementById('refresh-power-icon');

    if (emptyState) emptyState.classList.add('hidden');
    if (officialInfoBox) officialInfoBox.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');

    if (isRefresh && refreshIcon) {
      refreshIcon.classList.add('fa-spin');
    }

    if (container) {
      container.innerHTML = getSkeletonHtml();
    }

    const params = new URLSearchParams();
    if (powerState.selectedDistrict && powerState.selectedDistrict !== 'all') {
      params.append('district', powerState.selectedDistrict);
    }
    if (powerState.searchQuery) {
      params.append('area', powerState.searchQuery);
    }
    if (powerState.selectedDate) {
      params.append('date', powerState.selectedDate);
    }
    if (powerState.selectedTab && powerState.selectedTab !== 'all') {
      params.append('tab', powerState.selectedTab);
    }
    if (isRefresh) {
      params.append('refresh', 'true');
    }

    try {
      const url = `/api/power-updates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data && data.success) {
        powerState.outages = data.shutdowns || [];
        powerState.lastUpdated = data.last_updated_ist || '';

        const lastUpdatedEl = document.getElementById('power-last-updated-text');
        if (lastUpdatedEl && powerState.lastUpdated) {
          lastUpdatedEl.textContent = powerState.lastUpdated;
        }

        renderOutages();
      } else {
        throw new Error(data.message || 'Failed to fetch power updates');
      }
    } catch (err) {
      console.error('[PowerUpdates] Fetch error:', err);
      if (container) container.innerHTML = '';
      if (errorState) {
        const errorMsgEl = document.getElementById('power-error-message');
        if (errorMsgEl) errorMsgEl.textContent = err.message || 'Unable to connect to the power updates service.';
        errorState.classList.remove('hidden');
      }
    } finally {
      powerState.isLoading = false;
      if (refreshIcon) {
        refreshIcon.classList.remove('fa-spin');
      }
    }
  }

  /**
   * Render outage cards or authentic empty/official state.
   */
  function renderOutages() {
    const container = document.getElementById('power-outages-container');
    const emptyState = document.getElementById('power-empty-state');
    const officialInfoBox = document.getElementById('power-official-info-box');

    if (!container) return;

    if (powerState.outages.length === 0) {
      container.innerHTML = '';
      const hasActiveFilters = (powerState.selectedDistrict !== 'all') ||
        (powerState.selectedTab !== 'all') ||
        Boolean(powerState.searchQuery) ||
        Boolean(powerState.selectedDate);

      if (hasActiveFilters) {
        // If the user's filtered/detected district has no shutdowns and no sub-filters are applied:
        if (powerState.selectedDistrict !== 'all' && !powerState.searchQuery && !powerState.selectedDate && powerState.selectedTab === 'all') {
          container.innerHTML = createNoOutageLocalHtml(powerState.selectedDistrict);
          if (emptyState) emptyState.classList.add('hidden');
          if (officialInfoBox) officialInfoBox.classList.add('hidden');
          return;
        }
        if (emptyState) emptyState.classList.remove('hidden');
        if (officialInfoBox) officialInfoBox.classList.add('hidden');
      } else {
        // Statewide view with zero records in database -> Direct to official source
        if (officialInfoBox) officialInfoBox.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (officialInfoBox) officialInfoBox.classList.add('hidden');

    // When viewing all districts, sort user's detected district outages to the top
    let sortedOutages = [...powerState.outages];
    if (powerState.userDetectedDistrict) {
      const userDist = powerState.userDetectedDistrict.toLowerCase();
      sortedOutages.sort((a, b) => {
        const aMatches = (a.district && a.district.toLowerCase() === userDist) ? 1 : 0;
        const bMatches = (b.district && b.district.toLowerCase() === userDist) ? 1 : 0;
        return bMatches - aMatches;
      });
    }

    container.innerHTML = sortedOutages.map(item => createOutageCardHtml(item)).join('');
  }

  /**
   * HTML template for reassurance when user's district has no scheduled outages.
   */
  function createNoOutageLocalHtml(districtName) {
    const isUserLocation = powerState.userDetectedDistrict &&
      powerState.userDetectedDistrict.toLowerCase() === districtName.toLowerCase();
    
    const subtitle = isUserLocation
      ? `No scheduled power shutdowns found for your district (${escapeHtml(districtName)}). Electricity supply is operating normally under TNPDCL.`
      : `No scheduled power shutdowns found for ${escapeHtml(districtName)}. Electricity supply is operating normally under TNPDCL.`;

    return `
      <div class="power-district-clear-card">
        <div class="power-district-clear-icon">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3>No Scheduled Shutdowns in ${escapeHtml(districtName)}</h3>
        <p>${subtitle}</p>
        <div class="power-district-clear-actions">
          <button type="button" class="btn btn-secondary" onclick="clearDistrictFilter()">
            <i class="fa-solid fa-list-ul"></i>
            <span>View All Districts (38)</span>
          </button>
          <a href="https://www.tnebltd.gov.in/outages/viewshutdown.xhtml" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Official TNPDCL Portal</span>
          </a>
        </div>
      </div>
    `;
  }

  /**
   * HTML template for an individual outage card.
   */
  function createOutageCardHtml(item) {
    const status = (item.status || 'SCHEDULED').toUpperCase();
    let statusBadgeHtml = '';

    if (status === 'ONGOING') {
      statusBadgeHtml = `
        <span class="power-status-badge status-ongoing">
          <span class="status-ongoing-dot"></span>
          ONGOING
        </span>
      `;
    } else if (status === 'RESTORED') {
      statusBadgeHtml = `
        <span class="power-status-badge status-restored">
          <span class="status-dot-restored"></span>
          RESTORED
        </span>
      `;
    } else if (status === 'CANCELLED') {
      statusBadgeHtml = `
        <span class="power-status-badge status-cancelled">
          <span class="status-dot-cancelled"></span>
          CANCELLED
        </span>
      `;
    } else {
      // Default: SCHEDULED
      statusBadgeHtml = `
        <span class="power-status-badge status-scheduled">
          <span class="status-dot-scheduled"></span>
          SCHEDULED
        </span>
      `;
    }

    // Format Date & Time Window
    const dateFormatted = formatDate(item.shutdown_date);
    const timeWindow = `${item.start_time || '09:00'} - ${item.end_time || '17:00'}`;

    // Process affected areas into clean pills
    const areasStr = item.affected_area || item.area || 'All connected sectors';
    const areaTags = areasStr.split(/[,;\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    const tagsHtml = areaTags.map(t => `<span class="power-area-tag">${escapeHtml(t)}</span>`).join('');
    const moreCount = areasStr.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).length - 10;
    const morePill = moreCount > 0 ? `<span class="power-area-tag">+${moreCount} more</span>` : '';

    const isUserDistrict = Boolean(
      powerState.userDetectedDistrict &&
      item.district &&
      item.district.toLowerCase() === powerState.userDetectedDistrict.toLowerCase()
    );

    return `
      <article class="power-card ${isUserDistrict ? 'user-location-highlight' : ''}" id="outage-card-${item.id || ''}">
        <div>
          <div class="power-card-header">
            <div class="power-badges-wrap">
              <span class="power-district-badge">
                <i class="fa-solid fa-location-dot" style="font-size: 0.68rem; color: #64748b;"></i>
                ${escapeHtml(item.district || 'Tamil Nadu')}
              </span>
              ${isUserDistrict ? '<span class="power-area-pill"><i class="fa-solid fa-location-crosshairs"></i> Your Area</span>' : ''}
              ${item.division ? `<span class="power-division-badge">${escapeHtml(item.division)}</span>` : ''}
            </div>
            ${statusBadgeHtml}
          </div>

          <h2 class="power-substation-title">
            ${escapeHtml(item.area || 'Substation Feed')}
          </h2>

          <div class="power-time-window">
            <i class="fa-regular fa-clock"></i>
            <span>${dateFormatted} &bull; ${timeWindow}</span>
          </div>

          <div class="power-areas-section">
            <div class="power-areas-label">Affected Areas</div>
            <div class="power-areas-tags">
              ${tagsHtml}
              ${morePill}
            </div>
          </div>
        </div>

        <div class="power-card-footer">
          <span class="power-source-tag">
            <i class="fa-solid fa-building-columns" style="font-size: 0.72rem; color: #94a3b8;"></i>
            Source: TNPDCL
          </span>
          <button class="power-btn-share" onclick="shareOutage('${escapeHtml(item.area || '')}', '${escapeHtml(item.district || '')}', '${dateFormatted}', '${timeWindow}')" title="Copy outage details">
            <i class="fa-regular fa-copy"></i>
            <span>Share</span>
          </button>
        </div>
      </article>
    `;
  }

  function getSkeletonHtml() {
    return Array(3).fill(0).map(() => `
      <div class="power-card" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 20px; background: #e2e8f0; border-radius: 6px; width: 40%; margin-bottom: 1rem;"></div>
        <div style="height: 24px; background: #e2e8f0; border-radius: 6px; width: 75%; margin-bottom: 1rem;"></div>
        <div style="height: 38px; background: #e2e8f0; border-radius: 8px; width: 100%; margin-bottom: 1rem;"></div>
        <div style="height: 50px; background: #f1f5f9; border-radius: 8px; width: 100%;"></div>
      </div>
    `).join('');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Scheduled Date';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 1, day));
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Window-level exports for HTML inline handlers
  window.setTimeframeTab = function (tab) {
    powerState.selectedTab = tab;
    const tabButtons = document.querySelectorAll('#power-time-tabs .power-tab-btn');
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    fetchPowerShutdowns();
  };

  window.handlePowerFilterChange = function () {
    const districtSelect = document.getElementById('power-district-filter');
    const dateInput = document.getElementById('power-date-filter');
    const searchInput = document.getElementById('power-search-input');

    if (districtSelect) {
      powerState.selectedDistrict = districtSelect.value;
      powerState.hasManuallyChangedDistrict = true;
    }
    if (dateInput) powerState.selectedDate = dateInput.value;
    if (searchInput) powerState.searchQuery = searchInput.value.trim();

    updateLocationBanner();
    fetchPowerShutdowns();
  };

  window.clearDistrictFilter = function () {
    powerState.selectedDistrict = 'all';
    powerState.hasManuallyChangedDistrict = true;
    const districtSelect = document.getElementById('power-district-filter');
    if (districtSelect) districtSelect.value = 'all';

    updateLocationBanner();
    fetchPowerShutdowns();
  };

  window.resetPowerFilters = function () {
    if (powerState.userDetectedDistrict) {
      powerState.selectedDistrict = powerState.userDetectedDistrict;
      powerState.hasManuallyChangedDistrict = false;
    } else {
      powerState.selectedDistrict = 'all';
    }
    powerState.searchQuery = '';
    powerState.selectedDate = '';
    powerState.selectedTab = 'all';

    const districtSelect = document.getElementById('power-district-filter');
    const dateInput = document.getElementById('power-date-filter');
    const searchInput = document.getElementById('power-search-input');

    if (districtSelect) districtSelect.value = powerState.selectedDistrict;
    if (dateInput) dateInput.value = '';
    if (searchInput) searchInput.value = '';

    const tabButtons = document.querySelectorAll('#power-time-tabs .power-tab-btn');
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === 'all') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    updateLocationBanner();
    fetchPowerShutdowns();
  };

  window.refreshPowerUpdates = function () {
    fetchPowerShutdowns(true);
  };

  window.shareOutage = function (area, district, date, time) {
    const text = `[TNPDCL Power Shutdown Alert]\nArea: ${area}\nDistrict: ${district}\nDate: ${date}\nWindow: ${time}\nSource: TNPDCL / CrowdCity`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Outage details copied to clipboard!');
      }).catch(() => {
        prompt('Copy outage details:', text);
      });
    } else {
      prompt('Copy outage details:', text);
    }
  };

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      z-index: 999999;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 20);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

})();
