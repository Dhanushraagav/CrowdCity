/**
 * tourism.js
 * 
 * Client-side Controller for Tamil Nadu Tourism (தமிழ்நாடு சுற்றுலாத் தலங்கள்)
 * Part of CrowdCity Public Pulse.
 * 
 * Features:
 * - 38 Tamil Nadu districts selection with instant search
 * - Auto-detection of citizen district via CrowdCityLocation
 * - Bilingual support (English & Tamil) with reactive translation
 * - Category filtering (Heritage, Temples, Hill Stations, Waterfalls, etc.)
 * - Instant in-district text search
 * - Place details modal with official source attribution
 * - Accurate directions link to Google Maps
 * - Civic SaaS micro-interactions & full Light / AMOLED Dark mode support
 */

(function() {
  'use strict';

  // State
  const state = {
    districts: [],
    categories: [],
    selectedDistrictId: 'coimbatore',
    selectedCategory: 'all',
    searchQuery: '',
    places: [],
    placesCache: {},
    detectedDistrict: null,
    isLoading: false,
    activeModalPlace: null
  };

  // Category Icon Mapping
  const CATEGORY_ICONS = {
    'heritage': 'fa-landmark',
    'temple': 'fa-gopuram',
    'hill station': 'fa-mountain',
    'beach': 'fa-umbrella-beach',
    'waterfall': 'fa-water',
    'wildlife': 'fa-paw',
    'fort': 'fa-shield-halved',
    'dam': 'fa-bridge-water',
    'nature': 'fa-leaf'
  };

  // Helper: Get Current Language ('en' or 'ta')
  function getCurrentLang() {
    if (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') {
      return window.i18n.getCurrentLanguage();
    }
    const htmlLang = document.documentElement.getAttribute('data-lang') || document.documentElement.lang;
    return htmlLang === 'ta' ? 'ta' : 'en';
  }

  // Helper: Get Translated Text
  function t(key, defaultVal) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key);
      if (translated && translated !== key) return translated;
    }
    return defaultVal || key;
  }

  /**
   * Initialize Tourism Page
   */
  async function init() {
    setupEventListeners();
    await loadDistrictsAndCategories();
    await detectUserLocation();
    await fetchPlacesForDistrict(state.selectedDistrictId);
  }

  /**
   * Set up UI Event Listeners
   */
  function setupEventListeners() {
    // Dropdown trigger toggle
    const trigger = document.getElementById('tourism-district-trigger');
    const menu = document.getElementById('tourism-district-menu');
    const filterInput = document.getElementById('tourism-district-filter-input');

    if (trigger && menu) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
          openDistrictDropdown();
        } else {
          closeDistrictDropdown();
        }
      });

      // Filter districts input inside dropdown
      if (filterInput) {
        filterInput.addEventListener('input', (e) => {
          filterDistrictOptions(e.target.value);
        });
        filterInput.addEventListener('click', (e) => e.stopPropagation());
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !trigger.contains(e.target)) {
          closeDistrictDropdown();
        }
      });
    }

    // In-district Search Input
    const searchInput = document.getElementById('tourism-search-input');
    const clearBtn = document.getElementById('tourism-search-clear-btn');

    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        state.searchQuery = query;

        if (clearBtn) {
          clearBtn.classList.toggle('hidden', query.length === 0);
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          renderPlaces();
        }, 150);
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearBtn.classList.add('hidden');
        searchInput.focus();
        renderPlaces();
      });
    }

    // Modal Escape Key Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTourismModal();
        closeDistrictDropdown();
      }
    });

    // Listen for language change events
    window.addEventListener('i18nLanguageChanged', () => {
      updateLocalizedLabels();
      renderDistrictDropdownOptions();
      renderCategoryBar();
      renderPlaces();
      if (state.activeModalPlace) {
        populateModalData(state.activeModalPlace);
      }
    });
  }

  function openDistrictDropdown() {
    const menu = document.getElementById('tourism-district-menu');
    const trigger = document.getElementById('tourism-district-trigger');
    const filterInput = document.getElementById('tourism-district-filter-input');
    if (!menu || !trigger) return;

    menu.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('active');

    if (filterInput) {
      filterInput.value = '';
      filterDistrictOptions('');
      setTimeout(() => filterInput.focus(), 50);
    }
  }

  function closeDistrictDropdown() {
    const menu = document.getElementById('tourism-district-menu');
    const trigger = document.getElementById('tourism-district-trigger');
    if (!menu || !trigger) return;

    menu.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('active');
  }

  /**
   * Load Districts & Categories from Backend API
   */
  async function loadDistrictsAndCategories() {
    try {
      // 1. Fetch Districts
      const distRes = await fetch('/api/tourism/districts');
      if (distRes.ok) {
        const data = await distRes.json();
        if (data.success && Array.isArray(data.districts)) {
          state.districts = data.districts;
          renderDistrictDropdownOptions();
        }
      }

      // 2. Fetch Categories
      const catRes = await fetch('/api/tourism/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.success && Array.isArray(catData.categories)) {
          state.categories = catData.categories;
          renderCategoryBar();
        }
      }
    } catch (err) {
      console.warn('[Tourism] Error loading metadata:', err);
    }
  }

  /**
   * Detect User District via CrowdCityLocation
   */
  async function detectUserLocation() {
    try {
      let detectedName = null;

      if (window.CrowdCityLocation) {
        if (typeof window.CrowdCityLocation.getSavedUserDistrict === 'function') {
          const saved = window.CrowdCityLocation.getSavedUserDistrict();
          if (saved && (saved.name || saved.district)) {
            detectedName = saved.name || saved.district;
          }
        }

        if (!detectedName && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
          const res = await window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 2500, requestGps: false });
          if (res && res.district) {
            detectedName = res.district;
          }
        }
      }

      if (detectedName) {
        const matched = state.districts.find(d => 
          d.name.toLowerCase() === detectedName.toLowerCase() ||
          d.id === detectedName.toLowerCase()
        );

        if (matched) {
          state.detectedDistrict = matched;
          state.selectedDistrictId = matched.id;

          const banner = document.getElementById('tourism-location-banner');
          const label = document.getElementById('tourism-detected-district-label');
          const switchBtn = document.getElementById('btn-use-detected-district');

          if (banner && label) {
            const lang = getCurrentLang();
            label.textContent = lang === 'ta' ? matched.nameTa : matched.name;
            banner.classList.remove('hidden');

            if (switchBtn) {
              switchBtn.onclick = () => {
                selectDistrict(matched.id);
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Tourism] Location detection fallback:', err);
    }

    updateSelectedDistrictTrigger();
  }

  /**
   * Render Searchable District Dropdown Options
   */
  function renderDistrictDropdownOptions() {
    const list = document.getElementById('tourism-district-options-list');
    if (!list) return;

    const lang = getCurrentLang();

    list.innerHTML = state.districts.map(dist => {
      const isSelected = dist.id === state.selectedDistrictId;
      const displayName = lang === 'ta' ? dist.nameTa : dist.name;
      const subName = lang === 'ta' ? dist.name : dist.nameTa;
      const countBadge = dist.placeCount > 0 
        ? `<span class="opt-count-pill">${dist.placeCount}</span>`
        : `<span class="opt-count-empty">0</span>`;

      return `
        <div class="tourism-dropdown-option ${isSelected ? 'selected' : ''}" 
             data-id="${dist.id}" 
             data-name-en="${dist.name.toLowerCase()}" 
             data-name-ta="${dist.nameTa}" 
             onclick="window.selectDistrict('${dist.id}')">
          <div class="opt-text-wrap">
            <span class="opt-main-name">${displayName}</span>
            <span class="opt-sub-name">${subName}</span>
          </div>
          ${countBadge}
        </div>
      `;
    }).join('');
  }

  /**
   * Filter District Options inside the Dropdown search input
   */
  function filterDistrictOptions(query) {
    const cleanQuery = (query || '').trim().toLowerCase();
    const options = document.querySelectorAll('.tourism-dropdown-option');

    options.forEach(opt => {
      const nameEn = opt.getAttribute('data-name-en') || '';
      const nameTa = opt.getAttribute('data-name-ta') || '';
      const matches = !cleanQuery || nameEn.includes(cleanQuery) || nameTa.includes(cleanQuery);
      opt.style.display = matches ? 'flex' : 'none';
    });
  }

  /**
   * Select a District
   */
  async function selectDistrict(districtId) {
    if (!districtId) return;
    state.selectedDistrictId = districtId;
    closeDistrictDropdown();
    updateSelectedDistrictTrigger();
    await fetchPlacesForDistrict(districtId);
  }
  window.selectDistrict = selectDistrict;

  /**
   * Update the Trigger label to reflect current district
   */
  function updateSelectedDistrictTrigger() {
    const label = document.getElementById('tourism-selected-district-name');
    const heading = document.getElementById('tourism-active-district-title');
    const district = state.districts.find(d => d.id === state.selectedDistrictId);
    if (!district) return;

    const lang = getCurrentLang();
    const primaryName = lang === 'ta' ? district.nameTa : district.name;
    const secondaryName = lang === 'ta' ? district.name : district.nameTa;

    if (label) label.textContent = primaryName;
    if (heading) {
      heading.innerHTML = `${primaryName} <span class="district-heading-sub">(${secondaryName})</span>`;
    }

    renderDistrictDropdownOptions();
  }

  /**
   * Fetch Tourist Places for District (with memory cache)
   */
  async function fetchPlacesForDistrict(districtId) {
    if (state.placesCache[districtId]) {
      state.places = state.placesCache[districtId];
      renderPlaces();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/tourism/places?district_id=${encodeURIComponent(districtId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.places)) {
          state.places = data.places;
          state.placesCache[districtId] = data.places;
        } else {
          state.places = [];
        }
      } else {
        state.places = [];
      }
    } catch (err) {
      console.error('[Tourism] Error fetching places:', err);
      state.places = [];
    } finally {
      setLoading(false);
      renderPlaces();
    }
  }

  /**
   * Loading Skeleton State
   */
  function setLoading(isLoading) {
    state.isLoading = isLoading;
    const grid = document.getElementById('tourism-places-grid');
    const emptyBox = document.getElementById('tourism-empty-state');
    if (!grid) return;

    if (isLoading) {
      emptyBox.classList.add('hidden');
      grid.innerHTML = Array(3).fill(0).map(() => `
        <div class="tourism-card skeleton-card">
          <div class="skeleton-pill"></div>
          <div class="skeleton-line title"></div>
          <div class="skeleton-line subtitle"></div>
          <div class="skeleton-line desc"></div>
          <div class="skeleton-line desc short"></div>
          <div class="skeleton-actions"></div>
        </div>
      `).join('');
    }
  }

  /**
   * Render Category Pills Bar
   */
  function renderCategoryBar() {
    const bar = document.getElementById('tourism-category-bar');
    if (!bar || !state.categories.length) return;

    const lang = getCurrentLang();

    bar.innerHTML = state.categories.map(cat => {
      const isActive = state.selectedCategory.toLowerCase() === cat.id.toLowerCase();
      const displayName = lang === 'ta' ? cat.name_ta : cat.name_en;
      const icon = cat.icon || 'fa-tag';

      return `
        <button type="button" 
                class="tourism-category-pill ${isActive ? 'active' : ''}" 
                data-cat="${cat.id}" 
                onclick="window.filterByCategory('${cat.id}')">
          <i class="fa-solid ${icon}"></i>
          <span>${displayName}</span>
        </button>
      `;
    }).join('');
  }

  /**
   * Category Filter Action
   */
  function filterByCategory(catId) {
    state.selectedCategory = catId;
    renderCategoryBar();
    renderPlaces();
  }
  window.filterByCategory = filterByCategory;

  /**
   * Render Tourist Places Grid
   */
  function renderPlaces() {
    if (state.isLoading) return;

    const grid = document.getElementById('tourism-places-grid');
    const emptyBox = document.getElementById('tourism-empty-state');
    const countBadge = document.getElementById('tourism-places-count-badge');
    if (!grid || !emptyBox) return;

    const lang = getCurrentLang();
    const query = state.searchQuery.toLowerCase();
    const cat = state.selectedCategory.toLowerCase();

    // Filter places by Category and in-district Search query
    const filtered = state.places.filter(place => {
      // Category filter
      if (cat !== 'all' && place.category.toLowerCase() !== cat) {
        return false;
      }

      // Query filter
      if (query) {
        const matchesQuery = 
          place.name_en.toLowerCase().includes(query) ||
          place.name_ta.toLowerCase().includes(query) ||
          place.description_en.toLowerCase().includes(query) ||
          place.description_ta.toLowerCase().includes(query) ||
          place.short_desc_en.toLowerCase().includes(query) ||
          place.short_desc_ta.toLowerCase().includes(query) ||
          place.address_en.toLowerCase().includes(query) ||
          place.address_ta.toLowerCase().includes(query) ||
          place.category.toLowerCase().includes(query) ||
          place.category_ta.toLowerCase().includes(query);

        if (!matchesQuery) return false;
      }

      return true;
    });

    // Update count badge
    if (countBadge) {
      const label = lang === 'ta' ? 'இடங்கள் உள்ளன' : 'destinations';
      countBadge.textContent = `${filtered.length} ${label}`;
    }

    // Check Empty State
    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyBox.classList.remove('hidden');

      const emptyMsg = document.getElementById('tourism-empty-message');
      const emptyTitle = document.getElementById('tourism-empty-title');
      const district = state.districts.find(d => d.id === state.selectedDistrictId);
      const districtName = district ? (lang === 'ta' ? district.nameTa : district.name) : '';

      if (emptyTitle) {
        emptyTitle.textContent = districtName ? `${districtName} - Tourism` : 'Tamil Nadu Tourism';
      }

      if (emptyMsg) {
        // Strict specification matching
        if (state.searchQuery) {
          emptyMsg.textContent = lang === 'ta'
            ? 'உங்கள் தேடலுக்குரிய சுற்றுலா தலங்கள் எதுவும் கிடைக்கவில்லை.'
            : 'No tourist places match your search query.';
        } else {
          emptyMsg.textContent = lang === 'ta'
            ? 'இந்த மாவட்டத்திற்கான சரிபார்க்கப்பட்ட சுற்றுலாத் தகவல்கள் தற்போது கிடைக்கவில்லை.'
            : 'Verified tourism information is currently unavailable for this district.';
        }
      }
      return;
    }

    emptyBox.classList.add('hidden');

    grid.innerHTML = filtered.map(place => {
      const primaryName = lang === 'ta' ? place.name_ta : place.name_en;
      const secondaryName = lang === 'ta' ? place.name_en : place.name_ta;
      const categoryName = lang === 'ta' ? place.category_ta : place.category;
      const shortDesc = lang === 'ta' ? place.short_desc_ta : place.short_desc_en;
      const address = lang === 'ta' ? place.address_ta : place.address_en;
      const icon = CATEGORY_ICONS[place.category.toLowerCase()] || 'fa-landmark';

      const hasCoords = !isNaN(place.latitude) && !isNaN(place.longitude) && place.latitude !== null;
      const directionsUrl = hasCoords 
        ? `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
        : '#';

      return `
        <article class="tourism-card" data-id="${place.id}">
          <div class="tourism-card-header">
            <div class="tourism-badge-row">
              <span class="tourism-category-tag">
                <i class="fa-solid ${icon}"></i>
                <span>${categoryName}</span>
              </span>
              <span class="tourism-verified-pill" title="Verified Government Source">
                <i class="fa-solid fa-circle-check"></i>
                <span>${t('tourism_verified_badge', 'Verified')}</span>
              </span>
            </div>
            <h3 class="tourism-card-title">${primaryName}</h3>
            <div class="tourism-card-subtitle">${secondaryName}</div>
          </div>

          <div class="tourism-card-body">
            <p class="tourism-card-desc">${shortDesc}</p>
            <div class="tourism-card-meta">
              <div class="tourism-meta-item">
                <i class="fa-solid fa-location-dot"></i>
                <span class="tourism-meta-text" title="${address}">${address}</span>
              </div>
            </div>
          </div>

          <div class="tourism-card-actions">
            <button type="button" class="btn-tourism-details" onclick="window.openTourismModal('${place.id}')">
              <i class="fa-solid fa-circle-info"></i>
              <span data-i18n="tourism_view_details">${t('tourism_view_details', 'View Details')}</span>
            </button>
            <a href="${directionsUrl}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="btn-tourism-directions ${!hasCoords ? 'disabled' : ''}" 
               title="Get Directions in Google Maps"
               ${!hasCoords ? 'aria-disabled="true" onclick="return false;"' : ''}>
              <i class="fa-solid fa-diamond-turn-right"></i>
              <span data-i18n="tourism_get_directions">${t('tourism_get_directions', 'Directions')}</span>
            </a>
          </div>
        </article>
      `;
    }).join('');
  }

  /**
   * Open Place Details Modal
   */
  function openTourismModal(placeId) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    state.activeModalPlace = place;
    populateModalData(place);

    const backdrop = document.getElementById('tourism-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }
  window.openTourismModal = openTourismModal;

  /**
   * Populate Data inside Modal
   */
  function populateModalData(place) {
    const lang = getCurrentLang();
    const primaryName = lang === 'ta' ? place.name_ta : place.name_en;
    const secondaryName = lang === 'ta' ? place.name_en : place.name_ta;
    const categoryName = lang === 'ta' ? place.category_ta : place.category;
    const description = lang === 'ta' ? place.description_ta : place.description_en;
    const timings = lang === 'ta' ? place.timings_ta : place.timings_en;
    const bestTime = lang === 'ta' ? place.best_time_to_visit_ta : place.best_time_to_visit_en;
    const entryFee = lang === 'ta' ? place.entry_fee_ta : place.entry_fee_en;
    const address = lang === 'ta' ? place.address_ta : place.address_en;

    const catPill = document.getElementById('modal-category-pill');
    const title = document.getElementById('modal-place-title');
    const subtitle = document.getElementById('modal-place-subtitle');
    const desc = document.getElementById('modal-place-description');
    const timingsEl = document.getElementById('modal-place-timings');
    const bestTimeEl = document.getElementById('modal-place-best-time');
    const feeEl = document.getElementById('modal-place-entry-fee');
    const addressEl = document.getElementById('modal-place-address');
    const sourceName = document.getElementById('modal-place-source-name');
    const sourceLink = document.getElementById('modal-place-source-link');
    const directionsBtn = document.getElementById('modal-place-directions-btn');

    if (catPill) catPill.textContent = categoryName;
    if (title) title.textContent = primaryName;
    if (subtitle) subtitle.textContent = secondaryName;
    if (desc) desc.textContent = description;
    if (timingsEl) timingsEl.textContent = timings || 'Contact administration';
    if (bestTimeEl) bestTimeEl.textContent = bestTime || 'All season';
    if (feeEl) feeEl.textContent = entryFee || 'Free admission';
    if (addressEl) addressEl.textContent = address;
    if (sourceName) sourceName.textContent = place.source_name;
    if (sourceLink) sourceLink.href = place.source_url;

    if (directionsBtn) {
      const hasCoords = !isNaN(place.latitude) && !isNaN(place.longitude);
      if (hasCoords) {
        directionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
        directionsBtn.classList.remove('disabled');
      } else {
        directionsBtn.href = '#';
        directionsBtn.classList.add('disabled');
      }
    }
  }

  /**
   * Close Place Details Modal
   */
  function closeTourismModal(event) {
    if (event && event.target && event.target.id !== 'tourism-modal-backdrop') {
      return;
    }
    const backdrop = document.getElementById('tourism-modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
      state.activeModalPlace = null;
    }
  }
  window.closeTourismModal = closeTourismModal;

  /**
   * Reset All Filters
   */
  function resetTourismFilters() {
    state.searchQuery = '';
    state.selectedCategory = 'all';

    const searchInput = document.getElementById('tourism-search-input');
    const clearBtn = document.getElementById('tourism-search-clear-btn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');

    renderCategoryBar();
    renderPlaces();
  }
  window.resetTourismFilters = resetTourismFilters;

  /**
   * Update Dynamic Localized Labels on Language Switch
   */
  function updateLocalizedLabels() {
    updateSelectedDistrictTrigger();
  }

  // Bootstrap when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
