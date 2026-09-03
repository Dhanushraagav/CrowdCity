/**
 * CrowdCity Global Civic Search Controller
 * Fast, debounced, accessible search across complaints, IDs, locations, categories, and departments.
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.CrowdCityGlobalSearchInitialized) return;
  window.CrowdCityGlobalSearchInitialized = true;

  let currentAbortController = null;
  let debounceTimer = null;
  let activeIndex = -1;
  let currentResults = [];
  let isFilterDrawerOpen = false;

  const CATEGORIES = [
    { value: 'all', label: 'All Categories' },
    { value: 'roads', label: 'Roads & Pavements' },
    { value: 'streetlights', label: 'Streetlights & Electrical' },
    { value: 'garbage', label: 'Garbage & Waste' },
    { value: 'drainage', label: 'Drainage & Sewerage' },
    { value: 'water_supply', label: 'Water Supply' },
    { value: 'traffic', label: 'Traffic & Signals' },
    { value: 'sanitation', label: 'Sanitation' },
    { value: 'safety_hazard', label: 'Safety Hazards' },
    { value: 'parks', label: 'Parks & Playgrounds' },
    { value: 'environment', label: 'Environment & Pollution' },
    { value: 'other', label: 'Other Concerns' }
  ];

  const STATUSES = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved / Verified' },
    { value: 'overdue', label: 'Overdue (SLA Breached)' },
    { value: 'escalated', label: 'Escalated' }
  ];

  const PRIORITIES = [
    { value: 'all', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const DISTRICTS = [
    { value: 'all', label: 'All 38 Districts' },
    { value: 'ariyalur', label: 'Ariyalur' },
    { value: 'chengalpattu', label: 'Chengalpattu' },
    { value: 'chennai', label: 'Chennai' },
    { value: 'coimbatore', label: 'Coimbatore' },
    { value: 'cuddalore', label: 'Cuddalore' },
    { value: 'dharmapuri', label: 'Dharmapuri' },
    { value: 'dindigul', label: 'Dindigul' },
    { value: 'erode', label: 'Erode' },
    { value: 'kallakurichi', label: 'Kallakurichi' },
    { value: 'kancheepuram', label: 'Kancheepuram' },
    { value: 'kanniyakumari', label: 'Kanniyakumari' },
    { value: 'karur', label: 'Karur' },
    { value: 'krishnagiri', label: 'Krishnagiri' },
    { value: 'madurai', label: 'Madurai' },
    { value: 'mayiladuthurai', label: 'Mayiladuthurai' },
    { value: 'nagapattinam', label: 'Nagapattinam' },
    { value: 'namakkal', label: 'Namakkal' },
    { value: 'nilgiris', label: 'The Nilgiris' },
    { value: 'perambalur', label: 'Perambalur' },
    { value: 'pudukkottai', label: 'Pudukkottai' },
    { value: 'ramanathapuram', label: 'Ramanathapuram' },
    { value: 'ranipet', label: 'Ranipet' },
    { value: 'salem', label: 'Salem' },
    { value: 'sivaganga', label: 'Sivaganga' },
    { value: 'tenkasi', label: 'Tenkasi' },
    { value: 'thanjavur', label: 'Thanjavur' },
    { value: 'theni', label: 'Theni' },
    { value: 'thoothukudi', label: 'Thoothukudi' },
    { value: 'tiruchirappalli', label: 'Tiruchirappalli' },
    { value: 'tirunelveli', label: 'Tirunelveli' },
    { value: 'tirupathur', label: 'Tirupathur' },
    { value: 'tiruppur', label: 'Tiruppur' },
    { value: 'tiruvallur', label: 'Tiruvallur' },
    { value: 'tiruvannamalai', label: 'Tiruvannamalai' },
    { value: 'tiruvarur', label: 'Tiruvarur' },
    { value: 'vellore', label: 'Vellore' },
    { value: 'viluppuram', label: 'Viluppuram' },
    { value: 'virudhunagar', label: 'Virudhunagar' }
  ];

  /**
   * Mount Global Search component into the page header
   */
  function mountGlobalSearch() {
    if (document.getElementById('global-civic-search-wrapper')) return;

    // Target header
    const header = document.querySelector('.app-header-main, .dashboard-header, header.app-header');
    if (!header) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'global-civic-search-wrapper';
    wrapper.className = 'global-search-wrapper';

    wrapper.innerHTML = `
      <div class="global-search-input-box" id="global-search-box">
        <i class="fa-solid fa-magnifying-glass global-search-icon"></i>
        <input 
          type="text" 
          id="global-search-input" 
          class="global-search-input" 
          placeholder="Search CrowdCity (ID, Location, Category, Dept)..." 
          autocomplete="off" 
          spellcheck="false" 
          aria-label="Global Civic Search"
        />
        <i class="fa-solid fa-circle-notch fa-spin global-search-spinner hidden" id="global-search-spinner"></i>
        <button type="button" class="global-search-clear-btn hidden" id="global-search-clear" aria-label="Clear search">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <span class="global-search-kbd" id="global-search-kbd">Ctrl K</span>
      </div>

      <!-- Dropdown Results Panel -->
      <div class="global-search-dropdown hidden" id="global-search-dropdown">
        <div class="global-search-panel-header">
          <span class="global-search-panel-title" id="global-search-panel-title">
            <i class="fa-solid fa-compass"></i> Civic Results
          </span>
          <button type="button" class="global-search-filter-toggle" id="global-search-filter-toggle">
            <i class="fa-solid fa-sliders"></i> Filters
          </button>
        </div>

        <!-- Filter Drawer -->
        <div class="global-search-filter-drawer hidden" id="global-search-filter-drawer">
          <select id="search-filter-district" class="global-search-select" aria-label="Filter by District">
            ${DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
          </select>

          <select id="search-filter-category" class="global-search-select" aria-label="Filter by Category">
            ${CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
          </select>

          <select id="search-filter-status" class="global-search-select" aria-label="Filter by Status">
            ${STATUSES.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
          </select>
        </div>

        <!-- Results List -->
        <div class="global-search-results-list" id="global-search-results-list">
          <!-- Dynamically populated rows or empty state -->
        </div>

        <!-- Panel Footer -->
        <div class="global-search-footer">
          <span id="global-search-count-text">Type a Complaint ID, district, or category</span>
          <div class="global-search-kbd-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> navigate <kbd>↵</kbd> select <kbd>esc</kbd> close
          </div>
        </div>
      </div>
    `;

    // Insert before actions container if available, otherwise append
    const actionsContainer = header.querySelector('.app-header-actions, #auth-nav-container');
    if (actionsContainer && actionsContainer.parentNode === header) {
      header.insertBefore(wrapper, actionsContainer);
    } else {
      header.appendChild(wrapper);
    }

    bindSearchEvents();
  }

  /**
   * Bind event listeners for input, filters, and keyboard navigation
   */
  function bindSearchEvents() {
    const input = document.getElementById('global-search-input');
    const clearBtn = document.getElementById('global-search-clear');
    const kbd = document.getElementById('global-search-kbd');
    const dropdown = document.getElementById('global-search-dropdown');
    const filterToggle = document.getElementById('global-search-filter-toggle');
    const filterDrawer = document.getElementById('global-search-filter-drawer');

    if (!input) return;

    // Detect OS for shortcut display (⌘K on Mac, Ctrl K on Windows/Linux)
    if (kbd) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      kbd.textContent = isMac ? '⌘K' : 'Ctrl K';
    }

    // Input handler with debounce and AbortController
    input.addEventListener('input', (e) => {
      const query = e.target.value;
      if (clearBtn) clearBtn.classList.toggle('hidden', query.length === 0);
      if (kbd) kbd.classList.toggle('hidden', query.length > 0);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        executeSearch(query);
      }, 250);
    });

    // Focus handler
    input.addEventListener('focus', () => {
      if (input.value.trim().length > 0 || isFilterActive()) {
        dropdown.classList.remove('hidden');
      }
    });

    // Clear button handler
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.add('hidden');
        if (kbd) kbd.classList.remove('hidden');
        closeDropdown();
        input.focus();
      });
    }

    // Filter toggle button
    if (filterToggle && filterDrawer) {
      filterToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        isFilterDrawerOpen = !isFilterDrawerOpen;
        filterDrawer.classList.toggle('hidden', !isFilterDrawerOpen);
        filterToggle.classList.toggle('active', isFilterDrawerOpen);
      });
    }

    // Filter selects change
    const filterDistrict = document.getElementById('search-filter-district');
    const filterCategory = document.getElementById('search-filter-category');
    const filterStatus = document.getElementById('search-filter-status');

    [filterDistrict, filterCategory, filterStatus].forEach(sel => {
      if (sel) {
        sel.addEventListener('change', () => {
          executeSearch(input.value);
        });
      }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (dropdown.classList.contains('hidden')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectActiveResult();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    });

    // Global keyboard shortcut (Ctrl+K or /)
    document.addEventListener('keydown', (e) => {
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      } else if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        input.focus();
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('global-civic-search-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  /**
   * Check if any advanced filter is currently applied
   */
  function isFilterActive() {
    const dist = document.getElementById('search-filter-district')?.value;
    const cat = document.getElementById('search-filter-category')?.value;
    const stat = document.getElementById('search-filter-status')?.value;
    return (dist && dist !== 'all') || (cat && cat !== 'all') || (stat && stat !== 'all');
  }

  /**
   * Close search dropdown
   */
  function closeDropdown() {
    const dropdown = document.getElementById('global-search-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    activeIndex = -1;
  }

  /**
   * Execute search request with AbortController cancellation
   */
  async function executeSearch(query = '') {
    const trimmed = query.trim();
    const dropdown = document.getElementById('global-search-dropdown');
    const spinner = document.getElementById('global-search-spinner');
    const resultsContainer = document.getElementById('global-search-results-list');
    const countText = document.getElementById('global-search-count-text');

    // If query is empty and no filters are active, hide dropdown
    if (!trimmed && !isFilterActive()) {
      closeDropdown();
      return;
    }

    dropdown.classList.remove('hidden');

    // Abort previous in-flight request
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    if (spinner) spinner.classList.remove('hidden');

    const params = {
      q: trimmed,
      district: document.getElementById('search-filter-district')?.value || 'all',
      category: document.getElementById('search-filter-category')?.value || 'all',
      status: document.getElementById('search-filter-status')?.value || 'all',
      limit: 15
    };

    try {
      let result = null;

      // 1. Try unified window.API client
      if (window.API && typeof window.API.searchIssues === 'function') {
        const apiRes = await window.API.searchIssues(params, currentAbortController.signal);
        if (apiRes && apiRes.data) {
          result = apiRes.data;
        }
      }

      // 2. Direct fetch fallback
      if (!result) {
        const qs = new URLSearchParams();
        if (params.q) qs.append('q', params.q);
        if (params.district !== 'all') qs.append('district', params.district);
        if (params.category !== 'all') qs.append('category', params.category);
        if (params.status !== 'all') qs.append('status', params.status);
        qs.append('limit', params.limit);

        const raw = await fetch(`/api/issues/search?${qs.toString()}`, {
          signal: currentAbortController.signal,
          headers: { 'Accept': 'application/json' }
        });
        if (raw.ok) {
          result = await raw.json();
        }
      }

      if (result && Array.isArray(result.data)) {
        currentResults = result.data;
        activeIndex = -1;
        renderSearchResults(currentResults, trimmed);

        if (countText) {
          countText.textContent = `${result.total} ${result.total === 1 ? 'complaint' : 'complaints'} found`;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // Expected cancellation on rapid typing

      console.error('Civic search error:', err);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="global-search-state-box">
            <i class="fa-solid fa-triangle-exclamation global-search-state-icon" style="color: #ef4444;"></i>
            <span class="global-search-state-title">Search Service Unavailable</span>
            <span class="global-search-state-desc">Unable to retrieve complaints. Please check your network connection or try again.</span>
          </div>
        `;
      }
    } finally {
      if (spinner) spinner.classList.add('hidden');
    }
  }

  /**
   * Render search results or empty state
   */
  function renderSearchResults(items = [], query = '') {
    const container = document.getElementById('global-search-results-list');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="global-search-state-box">
          <i class="fa-solid fa-magnifying-glass global-search-state-icon"></i>
          <span class="global-search-state-title">No complaints found</span>
          <span class="global-search-state-desc">Try another Complaint ID, location, category, district, status or department.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item, idx) => {
      const statusClass = `status-tag-${(item.status || 'pending').toLowerCase()}`;
      const statusLabel = (item.status || 'pending').replace('_', ' ');
      const priorityLabel = (item.priority || 'medium').toUpperCase();
      const districtLabel = item.district ? item.district.name : 'Tamil Nadu';
      const categoryLabel = (item.category || 'General').replace('_', ' ');

      return `
        <a 
          href="issue-details.html?id=${encodeURIComponent(item.id)}" 
          class="global-search-item" 
          data-index="${idx}"
          id="search-item-${idx}"
        >
          <div class="global-search-item-top">
            <span class="global-search-id-badge">${escapeHtml(item.complaint_id || 'CC-2026')}</span>
            <div class="global-search-badges">
              ${item.priority === 'critical' ? `<span class="global-search-status-tag status-tag-critical"><i class="fa-solid fa-triangle-exclamation"></i> CRITICAL</span>` : ''}
              <span class="global-search-status-tag ${statusClass}">${escapeHtml(statusLabel)}</span>
            </div>
          </div>

          <div class="global-search-item-title">${escapeHtml(item.title)}</div>

          <div class="global-search-item-meta">
            <span><i class="fa-solid fa-tag"></i> ${escapeHtml(categoryLabel)}</span>
            <span class="global-search-meta-dot"></span>
            <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(districtLabel)}</span>
            <span class="global-search-meta-dot"></span>
            <span><i class="fa-solid fa-building"></i> ${escapeHtml(item.department)}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  /**
   * Keyboard result navigation
   */
  function navigateResults(direction) {
    if (currentResults.length === 0) return;

    activeIndex += direction;
    if (activeIndex >= currentResults.length) activeIndex = 0;
    if (activeIndex < 0) activeIndex = currentResults.length - 1;

    document.querySelectorAll('.global-search-item').forEach((el, idx) => {
      el.classList.toggle('active', idx === activeIndex);
    });

    const activeEl = document.getElementById(`search-item-${activeIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Navigate to currently highlighted item on Enter key
   */
  function selectActiveResult() {
    if (activeIndex >= 0 && activeIndex < currentResults.length) {
      const selected = currentResults[activeIndex];
      if (selected && selected.id) {
        window.location.href = `issue-details.html?id=${encodeURIComponent(selected.id)}`;
      }
    } else if (currentResults.length > 0) {
      // If none explicitly highlighted, open the first match
      window.location.href = `issue-details.html?id=${encodeURIComponent(currentResults[0].id)}`;
    }
  }

  /**
   * HTML Escaping helper
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialize once DOM is loaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountGlobalSearch);
  } else {
    mountGlobalSearch();
  }

})();
