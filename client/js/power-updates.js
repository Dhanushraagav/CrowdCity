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

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  let powerState = {
    selectedDistrict: 'all',
    searchQuery: '',
    selectedDate: '',
    selectedTab: 'all',
    outages: [],
    supplementaryReports: [],
    status: 'unable_to_verify',
    verificationStatus: 'unable_to_verify',
    sourceName: 'TNPDCL / TANGEDCO Official',
    lastChecked: '',
    lastUpdated: '',
    hasConflict: false,
    conflictNotice: null,
    statusMessage: '',
    statusReason: '',
    isLoading: false,
    isDetectingLocation: false,
    userDetectedDistrict: null,
    locationIsDetected: false,
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
      applyDetectedDistrict(detected, true);
      fetchPowerShutdowns();
    } else {
      // 2. Fallback to cached location or statewide overview (do not force GPS prompt on page load)
      powerState.isDetectingLocation = false;
      if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
        window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 3000, requestGps: false }).then(cachedDistrict => {
          if (cachedDistrict && !powerState.hasManuallyChangedDistrict) {
            applyDetectedDistrict(cachedDistrict, true);
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
      updateSourceStatusStrip();
      updateConflictBanner();
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
      <div class="power-loading-card" style="padding: 2.5rem; text-align: center; grid-column: 1 / -1; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px;">
        <i class="fa-solid fa-location-crosshairs fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 0.75rem;"></i>
        <h4 style="margin: 0 0 0.35rem 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">Detecting Current Location...</h4>
        <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Retrieving official TNPDCL planned electricity shutdown schedules for your area</p>
      </div>
    `;
  }

  function handleLocationEvent(e) {
    if (e.detail && e.detail.district && !powerState.hasManuallyChangedDistrict) {
      powerState.isDetectingLocation = false;
      applyDetectedDistrict(e.detail.district, true);
      fetchPowerShutdowns();
    }
  }

  function applyDetectedDistrict(districtName, isDetected = false) {
    if (!districtName) return;
    powerState.userDetectedDistrict = districtName.trim();
    powerState.selectedDistrict = powerState.userDetectedDistrict;
    powerState.locationIsDetected = isDetected;
    updateLocationBanner();

    const districtSelect = document.getElementById('power-district-filter');
    if (districtSelect) {
      const matchOpt = Array.from(districtSelect.options).find(
        opt => opt.value.toLowerCase() === powerState.userDetectedDistrict.toLowerCase()
      );
      if (matchOpt) {
        districtSelect.value = matchOpt.value;
        powerState.selectedDistrict = matchOpt.value;
        if (isDetected && !matchOpt.text.includes('(Your Location)')) {
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

    if (powerState.userDetectedDistrict && powerState.locationIsDetected && powerState.selectedDistrict && powerState.selectedDistrict.toLowerCase() === powerState.userDetectedDistrict.toLowerCase()) {
      highlightBanner.classList.remove('hidden');
      if (switchBtn) switchBtn.style.display = 'inline-flex';
      if (bannerContent) {
        bannerContent.innerHTML = `
          <i class="fa-solid fa-location-dot"></i>
          <span>Showing planned power shutdowns for your current location: <strong>${escapeHtml(powerState.selectedDistrict)}</strong></span>
        `;
        switchBtn.innerHTML = `<span>View All Districts (38)</span> <i class="fa-solid fa-arrow-right"></i>`;
        switchBtn.onclick = () => window.clearDistrictFilter();
      }
    } else if (powerState.selectedDistrict && powerState.selectedDistrict !== 'all') {
      highlightBanner.classList.remove('hidden');
      if (switchBtn) switchBtn.style.display = 'inline-flex';
      if (bannerContent) {
        bannerContent.innerHTML = `
          <i class="fa-solid fa-location-dot"></i>
          <span>Showing planned power shutdowns for selected district: <strong>${escapeHtml(powerState.selectedDistrict)}</strong></span>
        `;
        switchBtn.innerHTML = `<span>View All Districts (38)</span> <i class="fa-solid fa-arrow-right"></i>`;
        switchBtn.onclick = () => window.clearDistrictFilter();
      }
    } else if (powerState.userDetectedDistrict && powerState.locationIsDetected) {
      highlightBanner.classList.remove('hidden');
      if (switchBtn) switchBtn.style.display = 'inline-flex';
      if (bannerContent) {
        bannerContent.innerHTML = `
          <i class="fa-solid fa-globe"></i>
          <span>Showing all districts across Tamil Nadu. Your detected location: <strong>${escapeHtml(powerState.userDetectedDistrict)}</strong></span>
        `;
        switchBtn.innerHTML = `<span>Back to ${escapeHtml(powerState.userDetectedDistrict)}</span> <i class="fa-solid fa-location-crosshairs"></i>`;
        switchBtn.onclick = () => window.selectUserDetectedDistrict();
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
      applyDetectedDistrict(powerState.userDetectedDistrict, true);
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
        powerState.locationIsDetected = false;
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
        powerState.supplementaryReports = data.supplementary_reports || [];
        powerState.status = data.status || (powerState.outages.length > 0 ? 'verified' : 'verified_no_shutdown');
        powerState.verificationStatus = data.verification_status || (powerState.status === 'verified' ? 'verified' : (powerState.status === 'verified_no_shutdown' ? 'verified' : 'unable_to_verify'));
        powerState.sourceName = data.source_display || data.source || 'TNPDCL / TANGEDCO Official';
        powerState.lastChecked = data.last_checked_ist || data.last_updated_ist || '';
        powerState.lastUpdated = data.last_updated_ist || '';
        powerState.hasConflict = Boolean(data.has_conflict);
        powerState.conflictNotice = data.conflict_notice || null;
        powerState.statusMessage = data.message || '';
        powerState.statusReason = data.reason || '';
        powerState.officialPortalUrl = data.official_source_url || 'https://www.tnebltd.gov.in/outages/viewshutdown.xhtml';

        updateSourceStatusStrip();
        updateConflictBanner();
        renderOutages();
      } else {
        throw new Error(data.message || 'Failed to fetch power updates');
      }
    } catch (err) {
      console.error('[PowerUpdates] Fetch error:', err);
      powerState.status = 'unable_to_verify';
      powerState.verificationStatus = 'unable_to_verify';
      updateSourceStatusStrip();
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

  function updateSourceStatusStrip() {
    const sourceNameEl = document.getElementById('power-source-name-text');
    const badgeEl = document.getElementById('power-verification-badge');
    const badgeTextEl = document.getElementById('power-verification-text');
    const badgeIconEl = document.getElementById('power-verification-icon');
    const lastCheckedEl = document.getElementById('power-last-checked-text');
    const lastUpdatedEl = document.getElementById('power-last-updated-text');

    if (sourceNameEl) {
      sourceNameEl.textContent = powerState.sourceName || t('power_official_source_title', 'TNPDCL / TANGEDCO Official');
    }

    const isVerified = (powerState.verificationStatus === 'verified' || powerState.status === 'verified' || powerState.status === 'verified_no_shutdown');
    if (badgeEl) {
      if (isVerified) {
        badgeEl.className = 'verification-badge badge-verified';
        if (badgeIconEl) badgeIconEl.className = 'fa-solid fa-circle-check';
        if (badgeTextEl) badgeTextEl.textContent = t('power_verification_status_verified', 'Verified');
      } else {
        badgeEl.className = 'verification-badge badge-unverified';
        if (badgeIconEl) badgeIconEl.className = 'fa-solid fa-triangle-exclamation';
        if (badgeTextEl) badgeTextEl.textContent = t('power_verification_status_unverified', 'Unable to verify');
      }
    }

    if (lastCheckedEl) {
      lastCheckedEl.textContent = powerState.lastChecked || powerState.lastUpdated || '--';
    }

    if (lastUpdatedEl && powerState.lastUpdated) {
      lastUpdatedEl.textContent = powerState.lastUpdated;
    }
  }

  function updateConflictBanner() {
    const bannerEl = document.getElementById('power-conflict-banner');
    const officialEl = document.getElementById('conflict-official-status');
    const suppEl = document.getElementById('conflict-supplementary-status');

    if (!bannerEl) return;

    if (powerState.hasConflict && powerState.conflictNotice) {
      bannerEl.classList.remove('hidden');
      if (officialEl) officialEl.textContent = powerState.conflictNotice.official_status || 'No official publication found for selected district';
      if (suppEl) suppEl.textContent = powerState.conflictNotice.supplementary_status || 'Third-party sources report planned shutdown';
    } else {
      bannerEl.classList.add('hidden');
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

    if (emptyState) emptyState.classList.add('hidden');
    if (officialInfoBox) officialInfoBox.classList.add('hidden');

    const hasOutages = powerState.outages && powerState.outages.length > 0;
    const hasSupplementary = powerState.supplementaryReports && powerState.supplementaryReports.length > 0;
    const selectedDist = (powerState.selectedDistrict && powerState.selectedDistrict !== 'all') ? powerState.selectedDistrict : '';

    // STATE C: Official source is unable to verify
    if (powerState.status === 'unable_to_verify') {
      let html = createUnableToVerifyHtml(selectedDist || 'Tamil Nadu');
      if (hasSupplementary) {
        html += renderSupplementarySectionHtml(powerState.supplementaryReports);
      }
      container.innerHTML = html;
      return;
    }

    // STATE B: Verified check completed and no outages found
    if (!hasOutages && powerState.status === 'verified_no_shutdown') {
      let html = createVerifiedNoOutageHtml(selectedDist || 'Tamil Nadu');
      if (hasSupplementary) {
        html += renderSupplementarySectionHtml(powerState.supplementaryReports);
      }
      container.innerHTML = html;
      return;
    }

    // STATE A: Verified shutdowns found
    if (hasOutages) {
      let sortedOutages = [...powerState.outages];
      if (powerState.userDetectedDistrict) {
        const userDist = powerState.userDetectedDistrict.toLowerCase();
        sortedOutages.sort((a, b) => {
          const aMatches = (a.district && a.district.toLowerCase() === userDist) ? 1 : 0;
          const bMatches = (b.district && b.district.toLowerCase() === userDist) ? 1 : 0;
          return bMatches - aMatches;
        });
      }

      let html = sortedOutages.map(item => createOutageCardHtml(item)).join('');
      if (hasSupplementary) {
        html += renderSupplementarySectionHtml(powerState.supplementaryReports);
      }
      container.innerHTML = html;
      return;
    }

    // Fallback: When no records and unverified/unfiltered
    if (powerState.selectedDistrict === 'all' && !powerState.searchQuery && !powerState.selectedDate && powerState.selectedTab === 'all') {
      if (officialInfoBox) officialInfoBox.classList.remove('hidden');
    } else {
      if (emptyState) emptyState.classList.remove('hidden');
    }
    container.innerHTML = '';
  }

  /**
   * HTML template for verified state when no scheduled outages exist in official records.
   */
  function createVerifiedNoOutageHtml(districtName) {
    const isAll = !districtName || districtName === 'all' || districtName.toLowerCase() === 'all';
    const displayName = isAll ? 'Tamil Nadu' : districtName;
    const title = t('power_verified_no_outages', 'No planned power shutdown was found in the available TNPDCL data for this date.');
    const subtitle = isAll
      ? 'No planned power shutdowns are recorded in the available TNPDCL official database for all audited circles.'
      : `No planned power shutdown was found in the available TNPDCL data for ${escapeHtml(displayName)}.`;

    return `
      <div class="power-district-clear-card">
        <div class="power-district-clear-icon">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3 style="margin-bottom: 0.5rem;">${escapeHtml(displayName)}</h3>
        <p style="font-size: 0.95rem; font-weight: 600; color: #15803d; margin-bottom: 0.5rem;">${title}</p>
        <p style="font-size: 0.85rem; color: var(--text-muted, #64748b); max-width: 540px; margin: 0 auto 1.25rem;">${subtitle}</p>
        <div class="power-district-clear-actions">
          ${!isAll ? `
          <button type="button" class="btn btn-secondary" onclick="clearDistrictFilter()">
            <i class="fa-solid fa-list-ul"></i>
            <span>View All Districts (38)</span>
          </button>
          ` : ''}
          <a href="${escapeHtml(powerState.officialPortalUrl || 'https://www.tnebltd.gov.in/outages/viewshutdown.xhtml')}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Official TNPDCL Portal</span>
          </a>
          <button type="button" class="btn btn-secondary" onclick="refreshPowerUpdates()">
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Re-verify</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * HTML template for State C: when official live status cannot be verified automatically.
   */
  function createUnableToVerifyHtml(districtName) {
    const isAll = !districtName || districtName === 'all' || districtName.toLowerCase() === 'all';
    const displayName = isAll ? 'selected location' : districtName;

    const mainTitle = t('power_unable_to_verify', 'TNPDCL shutdown information could not be verified right now.');
    const instruction = t('power_check_official_schedule', 'Please check the official TNPDCL outage portal for the latest schedule.');
    const captchaNotice = t('power_captcha_notice', 'Official TNPDCL portal requires interactive CAPTCHA verification and could not be verified automatically for this selection. CrowdCity strictly adheres to government access policies and does not bypass CAPTCHA.');

    return `
      <div class="power-district-unable-card">
        <div class="power-district-unable-icon">
          <i class="fa-solid fa-circle-question"></i>
        </div>
        <div class="power-district-unable-badge">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Official Verification Pending (${escapeHtml(displayName)})</span>
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0.5rem 0 0.4rem 0;">${mainTitle}</h3>
        <p style="font-size: 0.88rem; font-weight: 500; color: var(--text-main, #334155); margin-bottom: 0.6rem;">${instruction}</p>
        <p class="power-district-unable-note">${captchaNotice}</p>
        <div class="power-district-clear-actions" style="margin-top: 1.25rem;">
          <a href="${escapeHtml(powerState.officialPortalUrl || 'https://www.tnebltd.gov.in/outages/viewshutdown.xhtml')}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.45rem; text-decoration: none;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Open Official TNPDCL Outage Portal</span>
          </a>
          <button type="button" class="btn btn-secondary" onclick="refreshPowerUpdates()">
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Retry Verification</span>
          </button>
          ${!isAll ? `
          <button type="button" class="btn btn-secondary" onclick="clearDistrictFilter()">
            <i class="fa-solid fa-list-ul"></i>
            <span>View All Districts (38)</span>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * HTML wrapper for supplementary/secondary reports section.
   */
  function renderSupplementarySectionHtml(reports) {
    if (!reports || reports.length === 0) return '';
    const heading = t('power_supplementary_heading', 'Supplementary Reports (Unofficial)');
    const cardsHtml = reports.map(r => createSupplementaryCardHtml(r)).join('');
    return `
      <div class="power-supplementary-section" style="grid-column: 1 / -1; margin-top: 1.5rem;">
        <div class="supplementary-section-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; padding-bottom: 0.4rem; border-bottom: 1px dashed var(--border-color, #cbd5e1);">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 0.95rem;"></i>
            <h3 style="font-size: 0.98rem; font-weight: 700; margin: 0; color: var(--text-main, #0f172a);">${heading}</h3>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted, #64748b); font-weight: 500;">CrowdCity does not vouch for unofficial reports</span>
        </div>
        <div class="power-outages-grid" style="padding: 0;">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  /**
   * HTML card for unofficial/supplementary report.
   */
  function createSupplementaryCardHtml(item) {
    const dateFormatted = formatDate(item.shutdown_date);
    const timeWindow = `${item.start_time || '09:00'} - ${item.end_time || '17:00'}`;
    const areasStr = item.affected_area || item.area || 'Connected feeders';
    const areaTags = areasStr.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 10);
    const tagsHtml = areaTags.map(t => `<span class="power-area-tag">${escapeHtml(t)}</span>`).join('');
    const moreCount = areasStr.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).length - 10;
    const morePill = moreCount > 0 ? `<span class="power-area-tag">+${moreCount} more</span>` : '';

    return `
      <article class="power-card supplementary-report-card">
        <div>
          <div class="power-card-header">
            <div class="power-badges-wrap">
              <span class="power-district-badge">
                <i class="fa-solid fa-location-dot" style="font-size: 0.68rem; color: #64748b;"></i>
                ${escapeHtml(item.district || 'Tamil Nadu')}
              </span>
              <span class="badge-supplementary-tag">
                <i class="fa-solid fa-triangle-exclamation"></i>
                UNOFFICIAL / MEDIA REPORT
              </span>
            </div>
          </div>

          <h2 class="power-substation-title">
            ${escapeHtml(item.area || 'Reported Maintenance')}
          </h2>

          <div class="power-time-window">
            <i class="fa-regular fa-clock"></i>
            <span>${dateFormatted} &bull; ${timeWindow}</span>
          </div>

          <div class="power-areas-section">
            <div class="power-areas-label">Reported Affected Areas</div>
            <div class="power-areas-tags">
              ${tagsHtml}
              ${morePill}
            </div>
          </div>
        </div>

        <div class="power-card-footer">
          <span class="power-source-tag" style="color: #b45309;">
            <i class="fa-solid fa-newspaper" style="font-size: 0.72rem;"></i>
            Source: ${escapeHtml(item.source || 'Secondary News / Community Report')}
          </span>
          <button class="power-btn-share" onclick="shareOutage('${escapeHtml(item.area || '')}', '${escapeHtml(item.district || '')}', '${dateFormatted}', '${timeWindow}')" title="Copy outage details">
            <i class="fa-regular fa-copy"></i>
            <span>Share</span>
          </button>
        </div>
      </article>
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
            Source: ${escapeHtml(item.source || 'TNPDCL / TANGEDCO Official')}
          </span>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 0.7rem; color: #15803d; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
              <i class="fa-solid fa-circle-check"></i> ${escapeHtml(item.last_verified_ist ? `Verified: ${item.last_verified_ist}` : 'Verified')}
            </span>
            <button class="power-btn-share" onclick="shareOutage('${escapeHtml(item.area || '')}', '${escapeHtml(item.district || '')}', '${dateFormatted}', '${timeWindow}')" title="Copy outage details">
              <i class="fa-regular fa-copy"></i>
              <span>Share</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function getSkeletonHtml() {
    return Array(3).fill(0).map(() => `
      <div class="power-card" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 20px; background: var(--border-color, #e2e8f0); border-radius: 6px; width: 40%; margin-bottom: 1rem;"></div>
        <div style="height: 24px; background: var(--border-color, #e2e8f0); border-radius: 6px; width: 75%; margin-bottom: 1rem;"></div>
        <div style="height: 38px; background: var(--border-color, #e2e8f0); border-radius: 8px; width: 100%; margin-bottom: 1rem;"></div>
        <div style="height: 50px; background: var(--bg-hover, #f1f5f9); border-radius: 8px; width: 100%;"></div>
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
