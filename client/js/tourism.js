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
    districtSearchQuery: '',
    explorerDistrictQuery: '',
    touristSearchQuery: '',
    places: [],
    placesCache: {},
    detectedDistrict: null,
    isLoading: false,
    activeModalPlace: null,
    activeImagesList: [],
    activeImageIndex: 0
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
    'nature': 'fa-leaf',
    'museum': 'fa-monument'
  };

  // Helper: Escape HTML attributes
  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

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
      const searchClearBtn = document.getElementById('tourism-district-search-clear');
      if (filterInput) {
        filterInput.addEventListener('input', (e) => {
          state.districtSearchQuery = e.target.value;
          if (searchClearBtn) {
            searchClearBtn.classList.toggle('hidden', !e.target.value);
          }
          filterDistrictOptions(e.target.value);
        });

        if (searchClearBtn) {
          searchClearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterInput.value = '';
            state.districtSearchQuery = '';
            searchClearBtn.classList.add('hidden');
            filterDistrictOptions('');
            filterInput.focus();
          });
        }

        filterInput.addEventListener('click', (e) => e.stopPropagation());
        filterInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            closeDistrictDropdown();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const firstVisible = menu.querySelector('.tourism-dropdown-option:not([style*="display: none"])');
            if (firstVisible) {
              const distId = firstVisible.getAttribute('data-id');
              if (distId) selectDistrict(distId);
            }
          }
        });
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
        const query = e.target.value;
        state.touristSearchQuery = query;

        if (clearBtn) {
          clearBtn.classList.toggle('hidden', query.trim().length === 0);
        }

        // If cleared or backspaced empty, render immediately without waiting
        if (query.trim().length === 0) {
          clearTimeout(debounceTimer);
          renderPlaces();
          return;
        }

        // Fast 120ms debounce for typing responsiveness
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          renderPlaces();
        }, 120);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          renderPlaces();
        }
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.touristSearchQuery = '';
        clearBtn.classList.add('hidden');
        searchInput.focus();
        renderPlaces();
      });
    }

    // 38-District Interactive Explorer Search Input
    const explorerFilterInput = document.getElementById('tourism-explorer-filter-input');
    const explorerClearBtn = document.getElementById('tourism-explorer-clear-btn');
    if (explorerFilterInput) {
      explorerFilterInput.addEventListener('input', (e) => {
        state.explorerDistrictQuery = e.target.value;
        filterExplorerDistricts(e.target.value);
      });
      explorerFilterInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          explorerFilterInput.value = '';
          state.explorerDistrictQuery = '';
          filterExplorerDistricts('');
        }
      });
    }

    if (explorerClearBtn && explorerFilterInput) {
      explorerClearBtn.addEventListener('click', () => {
        explorerFilterInput.value = '';
        state.explorerDistrictQuery = '';
        explorerClearBtn.classList.add('hidden');
        explorerFilterInput.focus();
        filterExplorerDistricts('');
      });
    }

    // Hero Quick District Jump Search
    const heroDistrictSearchInput = document.getElementById('hero-district-search');
    if (heroDistrictSearchInput) {
      heroDistrictSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const explorerInput = document.getElementById('tourism-explorer-filter-input');
        if (explorerInput) {
          explorerInput.value = val;
          state.explorerDistrictQuery = val;
          filterExplorerDistricts(val);
        }
      });
      heroDistrictSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const target = document.getElementById('tourism-explorer-section');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }

    // Gallery Navigation Buttons
    const prevBtn = document.getElementById('gallery-prev-btn');
    const nextBtn = document.getElementById('gallery-next-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        prevGallerySlide();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        nextGallerySlide();
      });
    }

    // Touch Swipe for Mobile Gallery
    const galleryEl = document.getElementById('tourism-modal-gallery');
    if (galleryEl) {
      let touchStartX = 0;
      let touchStartY = 0;
      galleryEl.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });
      galleryEl.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const diffX = e.changedTouches[0].clientX - touchStartX;
          const diffY = e.changedTouches[0].clientY - touchStartY;
          // Trigger slide navigation on clear horizontal swipe (> 35px)
          if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
              prevGallerySlide();
            } else {
              nextGallerySlide();
            }
          }
        }
      }, { passive: true });
    }

    // Modal & Lightbox Keyboard Listener (Escape, ArrowLeft, ArrowRight)
    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('tourism-lightbox-backdrop');
      const isLightboxOpen = lightbox && !lightbox.classList.contains('hidden');
      const modal = document.getElementById('tourism-modal-backdrop');
      const isModalOpen = modal && !modal.classList.contains('hidden');

      if (isLightboxOpen) {
        if (e.key === 'Escape') {
          closeTourismLightbox();
        }
      } else if (isModalOpen) {
        if (e.key === 'Escape') {
          closeTourismModal();
        } else if (e.key === 'ArrowLeft') {
          prevGallerySlide();
        } else if (e.key === 'ArrowRight') {
          nextGallerySlide();
        }
      } else if (e.key === 'Escape') {
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
    const clearBtn = document.getElementById('tourism-district-search-clear');
    if (!menu || !trigger) return;

    menu.classList.remove('is-closing');
    menu.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('active');

    if (filterInput) {
      filterInput.value = state.districtSearchQuery || '';
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !filterInput.value);
      }
      filterDistrictOptions(state.districtSearchQuery || '');
      setTimeout(() => filterInput.focus(), 40);
    }
  }

  function closeDistrictDropdown() {
    const menu = document.getElementById('tourism-district-menu');
    const trigger = document.getElementById('tourism-district-trigger');
    if (!menu || !trigger) return;
    if (menu.classList.contains('hidden') || menu.classList.contains('is-closing')) return;

    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('active');
    menu.classList.add('is-closing');

    setTimeout(() => {
      menu.classList.remove('is-closing');
      menu.classList.add('hidden');
    }, 150);
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
          updateHeroStats();
          renderDistrictExplorer();
          renderDistrictDropdownOptions();
        }
      }

      // 2. Fetch Categories
      const catRes = await fetch('/api/tourism/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.success && Array.isArray(catData.categories)) {
          state.categories = catData.categories;
          updateHeroStats();
          renderCategoryBar();
        }
      }
    } catch (err) {
      console.warn('[Tourism] Error loading metadata:', err);
    }
  }

  /**
   * Update Dynamic Numbers on the Hero Stats Card
   */
  function updateHeroStats() {
    const districtsCountEl = document.getElementById('hero-stat-districts');
    const destinationsCountEl = document.getElementById('hero-stat-destinations');
    const categoriesCountEl = document.getElementById('hero-stat-categories');
    const coverageEl = document.getElementById('hero-stat-coverage');

    if (districtsCountEl && state.districts.length > 0) {
      districtsCountEl.textContent = state.districts.length;
    }

    if (destinationsCountEl && state.districts.length > 0) {
      const totalPlaces = state.districts.reduce((acc, d) => acc + (Number(d.placeCount) || 0), 0);
      destinationsCountEl.textContent = `${totalPlaces}+`;
    }

    if (categoriesCountEl && state.categories.length > 0) {
      const activeCats = state.categories.filter(c => c.id !== 'all').length;
      categoriesCountEl.textContent = activeCats || '8';
    }

    if (coverageEl) {
      coverageEl.textContent = '100%';
    }
  }

  /**
   * Render 38-District Interactive Explorer Grid
   */
  function renderDistrictExplorer() {
    const grid = document.getElementById('tourism-districts-grid');
    if (!grid || !state.districts.length) return;

    grid.innerHTML = state.districts.map(dist => {
      const isSelected = dist.id === state.selectedDistrictId;
      const count = dist.placeCount || 0;
      const kw = [
        dist.name,
        dist.nameTa,
        dist.id,
        ...(Array.isArray(dist.keywords) ? dist.keywords : []),
        dist.id === 'kanniyakumari' ? 'kanyakumari' : '',
        dist.id === 'nilgiris' ? 'ooty udhagamandalam' : ''
      ].filter(Boolean).join(' ').toLowerCase();

      return `
        <button type="button" 
                class="tourism-district-chip ${isSelected ? 'active' : ''}" 
                data-id="${dist.id}" 
                data-name-en="${(dist.name || '').toLowerCase()}" 
                data-name-ta="${(dist.nameTa || '').toLowerCase()}" 
                data-keywords="${escapeAttr(kw)}"
                title="${dist.name} (${dist.nameTa}) - ${count} verified destinations"
                onclick="window.selectDistrict('${dist.id}', true)">
          <div class="chip-names">
            <span class="chip-name-en">${dist.name}</span>
            <span class="chip-name-ta">${dist.nameTa}</span>
          </div>
          <span class="chip-count">${count}</span>
        </button>
      `;
    }).join('');

    if (state.explorerDistrictQuery) {
      filterExplorerDistricts(state.explorerDistrictQuery);
    }
  }

  /**
   * Filter 38-District Explorer Chips
   */
  function filterExplorerDistricts(query) {
    const cleanQuery = (query || '').trim().toLowerCase();
    const chips = document.querySelectorAll('#tourism-districts-grid .tourism-district-chip');
    const clearBtn = document.getElementById('tourism-explorer-clear-btn');

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', cleanQuery.length === 0);
    }

    chips.forEach(chip => {
      const nameEn = chip.getAttribute('data-name-en') || '';
      const nameTa = chip.getAttribute('data-name-ta') || '';
      const distId = chip.getAttribute('data-id') || '';
      const keywords = chip.getAttribute('data-keywords') || '';
      const matches = !cleanQuery || 
        nameEn.includes(cleanQuery) || 
        nameTa.includes(cleanQuery) || 
        distId.includes(cleanQuery) ||
        keywords.includes(cleanQuery);

      chip.style.display = matches ? 'flex' : 'none';
    });
  }
  window.filterExplorerDistricts = filterExplorerDistricts;

  /**
   * Sync active class across Explorer Chips
   */
  function syncExplorerActiveChip() {
    const chips = document.querySelectorAll('#tourism-districts-grid .tourism-district-chip');
    chips.forEach(chip => {
      const id = chip.getAttribute('data-id');
      chip.classList.toggle('active', id === state.selectedDistrictId);
    });
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
          const countEl = document.getElementById('tourism-detected-district-count');
          const switchBtn = document.getElementById('btn-use-detected-district');

          if (banner && label) {
            const lang = getCurrentLang();
            const primaryName = lang === 'ta' ? matched.nameTa : matched.name;
            const secondaryName = lang === 'ta' ? matched.name : matched.nameTa;
            label.textContent = `${primaryName} (${secondaryName})`;

            if (countEl) {
              const count = matched.placeCount || 0;
              countEl.textContent = lang === 'ta' ? `${count} இடங்கள் உள்ளன` : `${count} destinations`;
            }

            banner.classList.remove('hidden');

            if (switchBtn) {
              switchBtn.onclick = () => {
                selectDistrict(matched.id, true);
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Tourism] Location detection fallback:', err);
    }

    updateSelectedDistrictTrigger();
    syncExplorerActiveChip();
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

      const kw = [
        dist.name,
        dist.nameTa,
        dist.id,
        ...(Array.isArray(dist.keywords) ? dist.keywords : []),
        dist.id === 'kanniyakumari' ? 'kanyakumari' : '',
        dist.id === 'nilgiris' ? 'ooty udhagamandalam' : ''
      ].filter(Boolean).join(' ').toLowerCase();

      return `
        <div class="tourism-dropdown-option ${isSelected ? 'selected' : ''}" 
             data-id="${dist.id}" 
             data-name-en="${(dist.name || '').toLowerCase()}" 
             data-name-ta="${(dist.nameTa || '').toLowerCase()}" 
             data-keywords="${escapeAttr(kw)}"
             role="option"
             aria-selected="${isSelected}"
             onclick="window.selectDistrict('${dist.id}', false)">
          <div class="opt-text-wrap">
            <span class="opt-main-name">${displayName}</span>
            <span class="opt-sub-name">${subName}</span>
          </div>
          <div class="opt-right-meta">
            <i class="fa-solid fa-check opt-check-icon"></i>
            ${countBadge}
          </div>
        </div>
      `;
    }).join('') + `
      <div id="tourism-district-no-results" class="tourism-dropdown-no-results hidden">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>${lang === 'ta' ? 'மாவட்டங்கள் எதுவும் கிடைக்கவில்லை' : 'No matching districts found'}</span>
      </div>
    `;

    // Reapply filter if active
    if (state.districtSearchQuery) {
      filterDistrictOptions(state.districtSearchQuery);
    }
  }

  /**
   * Filter District Options inside the Dropdown search input
   */
  function filterDistrictOptions(query) {
    const cleanQuery = (query || '').trim().toLowerCase();
    const options = document.querySelectorAll('.tourism-dropdown-option');
    let visibleCount = 0;

    options.forEach(opt => {
      const nameEn = opt.getAttribute('data-name-en') || '';
      const nameTa = opt.getAttribute('data-name-ta') || '';
      const distId = opt.getAttribute('data-id') || '';
      const keywords = opt.getAttribute('data-keywords') || '';
      const matches = !cleanQuery || 
        nameEn.includes(cleanQuery) || 
        nameTa.includes(cleanQuery) || 
        distId.includes(cleanQuery) ||
        keywords.includes(cleanQuery);

      opt.style.display = matches ? 'flex' : 'none';
      if (matches) visibleCount++;
    });

    const noResults = document.getElementById('tourism-district-no-results');
    if (noResults) {
      noResults.classList.toggle('hidden', visibleCount > 0);
    }
  }

  /**
   * Select a District
   */
  async function selectDistrict(districtId, shouldScroll = false) {
    if (!districtId) return;
    state.selectedDistrictId = districtId;

    // 1. Close district dropdown
    closeDistrictDropdown();

    // 2. Clear district search query and reset dropdown input
    state.districtSearchQuery = '';
    const filterInput = document.getElementById('tourism-district-filter-input');
    if (filterInput) filterInput.value = '';
    filterDistrictOptions('');

    // 3. Clear in-district tourist search query and reset search input when changing districts
    state.touristSearchQuery = '';
    const searchInput = document.getElementById('tourism-search-input');
    const clearBtn = document.getElementById('tourism-search-clear-btn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');

    // 4. Reset category to 'all' so complete district dataset is immediately accessible
    state.selectedCategory = 'all';
    renderCategoryBar();

    // 5. Update header, trigger labels, and explorer chips
    updateSelectedDistrictTrigger();
    syncExplorerActiveChip();

    // 6. Smooth scroll to discovery section if requested
    if (shouldScroll) {
      const target = document.getElementById('tourism-discovery-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // 7. Fetch complete verified places
    await fetchPlacesForDistrict(districtId);
  }
  window.selectDistrict = selectDistrict;

  /**
   * Update the Trigger label to reflect current district
   */
  function updateSelectedDistrictTrigger() {
    const label = document.getElementById('tourism-selected-district-name');
    const subLabel = document.getElementById('tourism-selected-district-sub');
    const heading = document.getElementById('tourism-active-district-title');
    const countBadge = document.getElementById('tourism-places-count-badge');
    const district = state.districts.find(d => d.id === state.selectedDistrictId);
    if (!district) return;

    const lang = getCurrentLang();
    const primaryName = lang === 'ta' ? district.nameTa : district.name;
    const secondaryName = lang === 'ta' ? district.name : district.nameTa;
    const placesCount = district.placeCount || (state.places ? state.places.length : 0);
    const countText = lang === 'ta' ? `${placesCount} தலங்கள்` : `${placesCount} Verified Destinations`;

    if (label) label.textContent = primaryName;
    if (subLabel) subLabel.innerHTML = `${secondaryName} &bull; ${countText}`;
    if (heading) {
      heading.innerHTML = `${primaryName} <span class="district-heading-sub">(${secondaryName})</span>`;
    }
    if (countBadge && placesCount > 0) {
      countBadge.textContent = `${placesCount} ${lang === 'ta' ? 'இடங்கள்' : 'destinations'}`;
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
    const rawQuery = (state.touristSearchQuery || '').trim().toLowerCase();
    const tokens = rawQuery.split(/\s+/).filter(Boolean);
    const cat = (state.selectedCategory || 'all').toLowerCase();

    // Filter places by Category and in-district Search query
    const filtered = state.places.filter(place => {
      // Category filter
      if (cat !== 'all' && (place.category || '').toLowerCase() !== cat) {
        return false;
      }

      // Multi-term token query filter
      if (tokens.length > 0) {
        const combined = [
          place.name_en,
          place.name_ta,
          place.description_en,
          place.description_ta,
          place.short_desc_en,
          place.short_desc_ta,
          place.category,
          place.category_ta,
          place.address_en,
          place.address_ta,
          place.district_name_en,
          place.district_name_ta
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesAll = tokens.every(token => combined.includes(token));
        if (!matchesAll) return false;
      }

      return true;
    });

    // Update count badge dynamically
    if (countBadge) {
      const isFiltered = (cat !== 'all') || (tokens.length > 0);
      if (isFiltered) {
        const label = lang === 'ta' ? 'பொருந்தும் இடங்கள்' : 'matching destinations';
        countBadge.textContent = `${filtered.length} ${label}`;
      } else {
        const label = lang === 'ta' ? 'இடங்கள் உள்ளன' : 'destinations';
        countBadge.textContent = `${filtered.length} ${label}`;
      }
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
        if (tokens.length > 0 || cat !== 'all') {
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

    // Keep places marked 'image_verification_pending' out of the primary visual destination grid
    const visiblePlaces = filtered.filter(p => p.verification_status !== 'image_verification_pending');

    grid.innerHTML = visiblePlaces.map(place => {
      const primaryName = lang === 'ta' ? place.name_ta : place.name_en;
      const secondaryName = lang === 'ta' ? place.name_en : place.name_ta;
      const categoryName = lang === 'ta' ? place.category_ta : place.category;
      const shortDesc = lang === 'ta' ? place.short_desc_ta : place.short_desc_en;
      const address = lang === 'ta' ? place.address_ta : place.address_en;
      const icon = CATEGORY_ICONS[place.category.toLowerCase()] || 'fa-landmark';
      const catClass = (place.category || '').toLowerCase().replace(/\s+/g, '-');
      const districtLabel = lang === 'ta' ? (place.district_name_ta || place.district_name_en) : (place.district_name_en || place.district_name_ta);

      const hasCoords = !isNaN(place.latitude) && !isNaN(place.longitude) && place.latitude !== null;
      const directionsUrl = hasCoords 
        ? `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
        : '#';

      // Check if place has verified representative image
      const imageUrl = place.image_url || 
        (Array.isArray(place.images) && place.images.length > 0 && place.images[0].url) ||
        (Array.isArray(place.media_images) && place.media_images.length > 0 && place.media_images[0].url);

      // Determine nuanced source badge
      let sourceBadgeClass = 'source-gov';
      let sourceIcon = 'fa-building-columns';
      let sourceLabel = t('tourism_source_gov', 'Government Source');
      if (place.source_type === 'Official Tourism Source') {
        sourceBadgeClass = 'source-tourism';
        sourceIcon = 'fa-compass';
        sourceLabel = t('tourism_source_official', 'Official Tourism Source');
      } else if (place.source_type === 'Verified Public Source') {
        sourceBadgeClass = 'source-public';
        sourceIcon = 'fa-shield-check';
        sourceLabel = t('tourism_source_verified_public', 'Verified Public Source');
      }

      // Format metadata chips
      const timings = lang === 'ta' ? (place.timings_ta || place.timings_en) : (place.timings_en || place.timings_ta);
      const bestTime = lang === 'ta' ? (place.best_time_to_visit_ta || place.best_time_to_visit_en) : (place.best_time_to_visit_en || place.best_time_to_visit_ta);
      const entryFee = lang === 'ta' ? (place.entry_fee_ta || place.entry_fee_en) : (place.entry_fee_en || place.entry_fee_ta);
      const station = place.nearest_station || '';

      const imageSection = imageUrl ? `
        <div class="tourism-card-image-wrap">
          <img src="${escapeAttr(imageUrl)}" 
               alt="${escapeAttr(primaryName)}" 
               class="tourism-card-img" 
               loading="lazy" 
               referrerpolicy="no-referrer"
               onerror="window.handleCardImageError(this, '${escapeAttr(catClass)}', '${escapeAttr(categoryName)}', '${escapeAttr(icon)}')">
          <div class="tourism-card-overlay-top">
            <span class="card-category-badge cat-${escapeAttr(catClass)}">
              <i class="fa-solid ${icon}"></i>
              <span>${categoryName}</span>
            </span>
            ${districtLabel ? `
              <span class="card-district-badge" title="${districtLabel}">
                <i class="fa-solid fa-map-pin"></i>
                <span>${districtLabel}</span>
              </span>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="tourism-card-image-wrap">
          <div class="tourism-card-fallback-banner fallback-cat-${catClass}">
            <i class="fa-solid ${icon} fallback-cat-icon"></i>
            <span class="fallback-cat-text">${categoryName}</span>
          </div>
          <div class="tourism-card-overlay-top">
            <span class="card-category-badge cat-${escapeAttr(catClass)}">
              <i class="fa-solid ${icon}"></i>
              <span>${categoryName}</span>
            </span>
            ${districtLabel ? `
              <span class="card-district-badge" title="${districtLabel}">
                <i class="fa-solid fa-map-pin"></i>
                <span>${districtLabel}</span>
              </span>
            ` : ''}
          </div>
        </div>
      `;

      return `
        <article class="tourism-card" data-id="${place.id}">
          ${imageSection}
          <div class="tourism-card-content">
            <div class="tourism-card-header">
              <span class="card-source-badge ${sourceBadgeClass}">
                <i class="fa-solid ${sourceIcon}"></i>
                <span>${sourceLabel}</span>
              </span>
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
              <div class="tourism-card-chips">
                ${bestTime ? `<span class="tourism-chip" title="${t('tourism_best_time', 'Best Time')}"><i class="fa-regular fa-calendar"></i> <span>${bestTime}</span></span>` : ''}
                ${timings ? `<span class="tourism-chip" title="${t('tourism_timings', 'Timings')}"><i class="fa-regular fa-clock"></i> <span>${timings}</span></span>` : ''}
                ${entryFee ? `<span class="tourism-chip" title="${t('tourism_entry_fee', 'Entry Fee')}"><i class="fa-solid fa-ticket"></i> <span>${entryFee}</span></span>` : ''}
                ${station ? `<span class="tourism-chip" title="${t('tourism_nearest_station', 'Nearest Railway')}"><i class="fa-solid fa-train"></i> <span>${station}</span></span>` : ''}
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
          </div>
        </article>
      `;
    }).join('');

    // Trigger IntersectionObserver to smoothly reveal cards on scroll
    observeCards();
  }

  /**
   * IntersectionObserver scroll-reveal for destination cards
   */
  function observeCards() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.tourism-card').forEach(card => card.classList.add('is-visible'));
      return;
    }
    const cards = document.querySelectorAll('.tourism-card:not(.is-visible)');
    if (!cards.length) return;

    if (!('IntersectionObserver' in window)) {
      cards.forEach(card => card.classList.add('is-visible'));
      return;
    }

    const scrollContainer = document.querySelector('.app-main') || null;
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      root: scrollContainer,
      rootMargin: '0px 0px 60px 0px',
      threshold: 0.05
    });

    cards.forEach(card => observer.observe(card));
  }

  /**
   * Graceful Card Image Fallback when Network Image Fails
   */
  function handleCardImageError(imgEl, catClass, catLabel, iconClass) {
    if (!imgEl || !imgEl.parentElement) return;
    const wrap = imgEl.parentElement;
    const icon = iconClass || 'fa-landmark';
    const fallbackHtml = `
      <div class="tourism-card-fallback-banner fallback-cat-${catClass || 'default'}">
        <i class="fa-solid ${icon} fallback-cat-icon"></i>
        <span class="fallback-cat-text">${catLabel || 'Destination'}</span>
      </div>
    `;
    imgEl.remove();
    wrap.insertAdjacentHTML('afterbegin', fallbackHtml);
  }
  window.handleCardImageError = handleCardImageError;

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
    const stationEl = document.getElementById('modal-place-nearest-station');
    const airportEl = document.getElementById('modal-place-nearest-airport');
    const sourceName = document.getElementById('modal-place-source-name');
    const sourceLink = document.getElementById('modal-place-source-link');
    const sourceTypeBadge = document.getElementById('modal-place-source-type-badge');
    const directionsBtn = document.getElementById('modal-place-directions-btn');

    if (catPill) catPill.textContent = categoryName;
    if (title) title.textContent = primaryName;
    if (subtitle) subtitle.textContent = secondaryName;
    if (desc) desc.textContent = description;
    if (timingsEl) timingsEl.textContent = timings || (lang === 'ta' ? 'நிர்வாகத்தை அணுகவும்' : 'Contact administration');
    if (bestTimeEl) bestTimeEl.textContent = bestTime || (lang === 'ta' ? 'அனைத்து காலங்களிலும்' : 'All season');
    if (feeEl) feeEl.textContent = entryFee || (lang === 'ta' ? 'இலவச அனுமதி' : 'Free admission');
    if (addressEl) addressEl.textContent = address;
    if (stationEl) stationEl.textContent = place.nearest_station || '--';
    if (airportEl) airportEl.textContent = place.nearest_airport || '--';
    if (sourceName) sourceName.textContent = place.source_name;
    if (sourceLink) sourceLink.href = place.source_url;

    if (sourceTypeBadge) {
      let sourceBadgeClass = 'source-gov';
      let sourceIcon = 'fa-building-columns';
      let sourceLabel = t('tourism_source_gov', 'Government Source');
      if (place.source_type === 'Official Tourism Source') {
        sourceBadgeClass = 'source-tourism';
        sourceIcon = 'fa-compass';
        sourceLabel = t('tourism_source_official', 'Official Tourism Source');
      } else if (place.source_type === 'Verified Public Source') {
        sourceBadgeClass = 'source-public';
        sourceIcon = 'fa-shield-check';
        sourceLabel = t('tourism_source_verified_public', 'Verified Public Source');
      }
      sourceTypeBadge.className = `card-source-badge ${sourceBadgeClass}`;
      sourceTypeBadge.innerHTML = `<i class="fa-solid ${sourceIcon}"></i> <span>${sourceLabel}</span>`;
    }

    if (directionsBtn) {
      const hasCoords = !isNaN(place.latitude) && !isNaN(place.longitude) && place.latitude !== null;
      if (hasCoords) {
        directionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
        directionsBtn.classList.remove('disabled');
      } else {
        directionsBtn.href = '#';
        directionsBtn.classList.add('disabled');
      }
    }

    // 1. Populate Image Gallery (Top of Modal)
    const galleryList = (Array.isArray(place.media_images) && place.media_images.length > 0)
      ? place.media_images
      : (Array.isArray(place.images) && place.images.length > 0
        ? place.images
        : (place.image_url ? [{ url: place.image_url, alt_en: place.name_en, alt_ta: place.name_ta, source_name: place.image_source_name, source_url: place.image_source_url }] : []));
    populateGallery(galleryList);

    // 2. Populate Official Video Section
    populateVideo(place.media_video);
  }

  /**
   * Populate Image Gallery (Top of Modal)
   */
  function populateGallery(images) {
    const wrap = document.getElementById('tourism-modal-gallery-wrap');
    const track = document.getElementById('tourism-gallery-track');
    const prevBtn = document.getElementById('gallery-prev-btn');
    const nextBtn = document.getElementById('gallery-next-btn');
    if (!wrap || !track) return;

    state.activeImagesList = Array.isArray(images) ? [...images] : [];
    state.activeImageIndex = 0;

    if (state.activeImagesList.length === 0) {
      wrap.classList.add('hidden');
      track.innerHTML = '';
      return;
    }

    wrap.classList.remove('hidden');
    const lang = getCurrentLang();

    if (state.activeImagesList.length <= 1) {
      if (prevBtn) prevBtn.classList.add('hidden');
      if (nextBtn) nextBtn.classList.add('hidden');
    } else {
      if (prevBtn) prevBtn.classList.remove('hidden');
      if (nextBtn) nextBtn.classList.remove('hidden');
    }

    track.innerHTML = state.activeImagesList.map((img, i) => {
      const alt = lang === 'ta' ? (img.alt_ta || img.alt_en) : (img.alt_en || img.alt_ta);
      return `
        <div class="tourism-gallery-slide ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="window.handleSlideClick(${i})">
          <img src="${img.url}" 
               alt="${alt || 'Tourist place'}" 
               class="tourism-gallery-img" 
               loading="${i === 0 ? 'eager' : 'lazy'}"
               referrerpolicy="no-referrer"
               onerror="window.handleTourismImageError(this, ${i})">
        </div>
      `;
    }).join('');

    updateGalleryUI();
  }

  /**
   * Update Gallery State, Active Slide, Counter & Attribution
   */
  function updateGalleryUI() {
    const track = document.getElementById('tourism-gallery-track');
    const counterPill = document.getElementById('gallery-counter-pill');
    const sourceLink = document.getElementById('gallery-source-link');
    const prevBtn = document.getElementById('gallery-prev-btn');
    const nextBtn = document.getElementById('gallery-next-btn');
    const wrap = document.getElementById('tourism-modal-gallery-wrap');
    if (!track) return;

    const total = state.activeImagesList.length;
    if (total === 0) {
      if (wrap) wrap.classList.add('hidden');
      return;
    }

    if (state.activeImageIndex >= total) state.activeImageIndex = 0;
    if (state.activeImageIndex < 0) state.activeImageIndex = total - 1;

    const slides = track.querySelectorAll('.tourism-gallery-slide');
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === state.activeImageIndex);
    });

    if (counterPill) {
      counterPill.textContent = `${state.activeImageIndex + 1} / ${total}`;
    }

    if (total <= 1) {
      if (prevBtn) prevBtn.classList.add('hidden');
      if (nextBtn) nextBtn.classList.add('hidden');
    } else {
      if (prevBtn) prevBtn.classList.remove('hidden');
      if (nextBtn) nextBtn.classList.remove('hidden');
    }

    const current = state.activeImagesList[state.activeImageIndex];
    if (sourceLink && current) {
      sourceLink.textContent = current.source_name || 'Official Source';
      sourceLink.href = current.source_url || '#';
    }

    const expandBtn = document.getElementById('gallery-expand-btn');
    if (expandBtn) {
      expandBtn.onclick = (e) => {
        e.stopPropagation();
        handleSlideClick(state.activeImageIndex);
      };
    }
  }

  /**
   * Gallery Next Slide Action
   */
  function nextGallerySlide() {
    if (state.activeImagesList.length <= 1) return;
    state.activeImageIndex = (state.activeImageIndex + 1) % state.activeImagesList.length;
    updateGalleryUI();
  }
  window.nextGallerySlide = nextGallerySlide;

  /**
   * Gallery Previous Slide Action
   */
  function prevGallerySlide() {
    if (state.activeImagesList.length <= 1) return;
    state.activeImageIndex = (state.activeImageIndex - 1 + state.activeImagesList.length) % state.activeImagesList.length;
    updateGalleryUI();
  }
  window.prevGallerySlide = prevGallerySlide;

  /**
   * Click Image to Enlarge in Lightbox
   */
  function handleSlideClick(index) {
    const current = state.activeImagesList[index];
    if (!current) return;
    const lang = getCurrentLang();
    const alt = lang === 'ta' ? (current.alt_ta || current.alt_en) : (current.alt_en || current.alt_ta);
    openTourismLightbox(current.url, alt, current.source_name, current.source_url);
  }
  window.handleSlideClick = handleSlideClick;

  /**
   * Graceful Broken Image Handling
   */
  function handleTourismImageError(imgEl, index) {
    if (index >= 0 && index < state.activeImagesList.length) {
      state.activeImagesList.splice(index, 1);
      if (state.activeImagesList.length === 0) {
        const wrap = document.getElementById('tourism-modal-gallery-wrap');
        if (wrap) wrap.classList.add('hidden');
        const track = document.getElementById('tourism-gallery-track');
        if (track) track.innerHTML = '';
      } else {
        if (state.activeImageIndex >= state.activeImagesList.length) {
          state.activeImageIndex = state.activeImagesList.length - 1;
        }
        populateGallery(state.activeImagesList);
      }
    }
  }
  window.handleTourismImageError = handleTourismImageError;

  /**
   * Populate Official Video Section (Lazy Click-to-Play Facade)
   */
  function populateVideo(videoData) {
    const section = document.getElementById('tourism-modal-video-section');
    const container = document.getElementById('video-player-container');
    const badge = document.getElementById('video-source-badge');
    if (!section || !container) return;

    if (!videoData || (!videoData.youtube_id && !videoData.url)) {
      section.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    section.classList.remove('hidden');
    const lang = getCurrentLang();
    const title = lang === 'ta' ? (videoData.title_ta || videoData.title_en) : (videoData.title_en || videoData.title_ta);
    const sourceName = videoData.source_name || 'Official Department';

    if (badge) {
      const span = badge.querySelector('span');
      if (span) span.textContent = sourceName;
    }

    const ytid = videoData.youtube_id || (videoData.url && videoData.url.match(/v=([a-zA-Z0-9_-]+)/)?.[1]);

    if (!ytid) {
      section.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    const playLabel = lang === 'ta' ? 'காணொளியை இயக்கு' : 'Play Video';
    container.innerHTML = `
      <div class="video-facade" id="video-facade-${ytid}" onclick="window.playTourismVideo('${ytid}')" title="${playLabel}">
        <img src="https://img.youtube.com/vi/${ytid}/hqdefault.jpg" alt="${title}" class="video-facade-thumb" loading="lazy">
        <div class="video-facade-overlay">
          <div class="video-play-btn" aria-label="${playLabel}">
            <i class="fa-solid fa-play"></i>
          </div>
          <div class="video-facade-title">${title}</div>
        </div>
      </div>
    `;
  }

  /**
   * Play Video by Embedding Responsive YouTube Iframe
   */
  function playTourismVideo(youtubeId) {
    const container = document.getElementById('video-player-container');
    if (!container) return;

    container.innerHTML = `
      <iframe class="video-player-iframe" 
              src="https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0" 
              title="Official Video Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
      </iframe>
    `;
  }
  window.playTourismVideo = playTourismVideo;

  /**
   * Open Lightbox Fullscreen Preview
   */
  function openTourismLightbox(url, caption, sourceName, sourceUrl) {
    const backdrop = document.getElementById('tourism-lightbox-backdrop');
    const img = document.getElementById('lightbox-image');
    const cap = document.getElementById('lightbox-caption');
    const link = document.getElementById('lightbox-source-link');
    if (!backdrop || !img) return;

    img.referrerPolicy = 'no-referrer';
    img.src = url;
    img.alt = caption || 'Tourist image full size';
    if (cap) cap.textContent = caption || '';
    if (link) {
      link.href = sourceUrl || '#';
      link.textContent = 'Source: ' + (sourceName || 'Official Source');
    }

    backdrop.classList.remove('hidden');
  }
  window.openTourismLightbox = openTourismLightbox;

  /**
   * Close Lightbox
   */
  function closeTourismLightbox(event) {
    if (event && event.target && event.target.id !== 'tourism-lightbox-backdrop' && !event.target.closest('.lightbox-close-btn')) {
      return;
    }
    const backdrop = document.getElementById('tourism-lightbox-backdrop');
    const img = document.getElementById('lightbox-image');
    if (backdrop) {
      backdrop.classList.add('hidden');
    }
    if (img) {
      img.src = '';
    }
  }
  window.closeTourismLightbox = closeTourismLightbox;

  /**
   * Close Place Details Modal with Complete Lifecycle Cleanup
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

    // Stop and dismantle video iframe immediately to halt audio/video playback
    const videoContainer = document.getElementById('video-player-container');
    if (videoContainer) {
      videoContainer.innerHTML = '';
    }

    // Close lightbox if open
    closeTourismLightbox();

    // Reset active gallery state
    state.activeImagesList = [];
    state.activeImageIndex = 0;
  }
  window.closeTourismModal = closeTourismModal;

  /**
   * Reset All Filters
   */
  function resetTourismFilters() {
    state.touristSearchQuery = '';
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
    renderDistrictExplorer();
    updateHeroStats();

    if (state.detectedDistrict) {
      const banner = document.getElementById('tourism-location-banner');
      const label = document.getElementById('tourism-detected-district-label');
      const countEl = document.getElementById('tourism-detected-district-count');
      if (banner && label) {
        const lang = getCurrentLang();
        const primaryName = lang === 'ta' ? state.detectedDistrict.nameTa : state.detectedDistrict.name;
        const secondaryName = lang === 'ta' ? state.detectedDistrict.name : state.detectedDistrict.nameTa;
        label.textContent = `${primaryName} (${secondaryName})`;

        if (countEl) {
          const count = state.detectedDistrict.placeCount || 0;
          countEl.textContent = lang === 'ta' ? `${count} இடங்கள் உள்ளன` : `${count} destinations`;
        }
      }
    }
  }

  // Bootstrap when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
