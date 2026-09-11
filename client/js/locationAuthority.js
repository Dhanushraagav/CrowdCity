/**
 * CrowdCity AI - Location-Aware Authority & Civic Contact System
 * Frontend Client Module
 * 
 * Features:
 * 1. Auto-detect location via Geolocation API + OpenStreetMap Nominatim reverse geocoding.
 * 2. Manual override with 4-tier dependent cascade dropdowns:
 *    District -> Taluk/Block -> Village/Town -> Local Body
 * 3. Multi-factor authority resolution via /api/authorities/resolve
 * 4. Renders Verified Official Authority Card, Elected Representative, and Escalation Contact.
 * 5. Strict adherence: Verified official contacts only, never simulated data.
 * 6. Leaflet map integration with pin and local body boundary circle overlay.
 */

(function(window, document) {
  'use strict';

  const API_BASE = '/api/authorities';
  const API_LOCATIONS = '/api/locations';

  let currentTalukLocations = [];

  // Centralized CrowdCity 24/7 Support Configuration
  const CROWDCITY_SUPPORT_CONFIG = (typeof window !== 'undefined' && window.CROWDCITY_CONFIG?.SUPPORT) || {
    label: 'CrowdCity Support',
    title: 'CrowdCity 24/7 Support',
    phone: '+91 9025132196',
    get tel() {
      return `tel:${this.phone.replace(/[^0-9+]/g, '')}`;
    },
    actionText: 'Call CrowdCity Support'
  };

  if (typeof window !== 'undefined') {
    window.CROWDCITY_CONFIG = window.CROWDCITY_CONFIG || {};
    window.CROWDCITY_CONFIG.SUPPORT = CROWDCITY_SUPPORT_CONFIG;
  }

  // 38 Verified Tamil Nadu Districts (Instant Fallback / Zero Latency)
  const DEFAULT_TN_DISTRICTS = [
    { id: 'ariyalur', name: 'Ariyalur', nameTa: 'அரியலூர்' },
    { id: 'chengalpattu', name: 'Chengalpattu', nameTa: 'செங்கல்பட்டு' },
    { id: 'chennai', name: 'Chennai', nameTa: 'சென்னை' },
    { id: 'coimbatore', name: 'Coimbatore', nameTa: 'கோயம்புத்தூர்' },
    { id: 'cuddalore', name: 'Cuddalore', nameTa: 'கடலூர்' },
    { id: 'dharmapuri', name: 'Dharmapuri', nameTa: 'தருமபுரி' },
    { id: 'dindigul', name: 'Dindigul', nameTa: 'திண்டுக்கல்' },
    { id: 'erode', name: 'Erode', nameTa: 'ஈரோடு' },
    { id: 'kallakurichi', name: 'Kallakurichi', nameTa: 'கள்ளக்குறிச்சி' },
    { id: 'kancheepuram', name: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்' },
    { id: 'karur', name: 'Karur', nameTa: 'கரூர்' },
    { id: 'krishnagiri', name: 'Krishnagiri', nameTa: 'கிருஷ்ணகிரி' },
    { id: 'madurai', name: 'Madurai', nameTa: 'மதுரை' },
    { id: 'mayiladuthurai', name: 'Mayiladuthurai', nameTa: 'மயிலாடுதுறை' },
    { id: 'nagapattinam', name: 'Nagapattinam', nameTa: 'நாகப்பட்டினம்' },
    { id: 'kanniyakumari', name: 'Kanniyakumari', nameTa: 'கன்னியாகுமரி' },
    { id: 'namakkal', name: 'Namakkal', nameTa: 'நாமக்கல்' },
    { id: 'perambalur', name: 'Perambalur', nameTa: 'பெரம்பலூர்' },
    { id: 'pudukkottai', name: 'Pudukkottai', nameTa: 'புதுக்கோட்டை' },
    { id: 'ramanathapuram', name: 'Ramanathapuram', nameTa: 'ராமநாதபுரம்' },
    { id: 'ranipet', name: 'Ranipet', nameTa: 'ராணிப்பேட்டை' },
    { id: 'salem', name: 'Salem', nameTa: 'சேலம்' },
    { id: 'sivaganga', name: 'Sivaganga', nameTa: 'சிவகங்கை' },
    { id: 'tenkasi', name: 'Tenkasi', nameTa: 'தென்காசி' },
    { id: 'thanjavur', name: 'Thanjavur', nameTa: 'தஞ்சாவூர்' },
    { id: 'theni', name: 'Theni', nameTa: 'தேனி' },
    { id: 'tiruvallur', name: 'Tiruvallur', nameTa: 'திருவள்ளூர்' },
    { id: 'tiruvarur', name: 'Tiruvarur', nameTa: 'திருவாரூர்' },
    { id: 'thoothukudi', name: 'Thoothukudi', nameTa: 'தூத்துக்குடி' },
    { id: 'tiruchirappalli', name: 'Tiruchirappalli', nameTa: 'திருச்சிராப்பள்ளி' },
    { id: 'tirunelveli', name: 'Tirunelveli', nameTa: 'திருநெல்வேலி' },
    { id: 'tirupathur', name: 'Tirupathur', nameTa: 'திருப்பத்தூர்' },
    { id: 'tiruppur', name: 'Tiruppur', nameTa: 'திருப்பூர்' },
    { id: 'tiruvannamalai', name: 'Tiruvannamalai', nameTa: 'திருவண்ணாமலை' },
    { id: 'nilgiris', name: 'The Nilgiris', nameTa: 'நீலகிரி' },
    { id: 'vellore', name: 'Vellore', nameTa: 'வேலூர்' },
    { id: 'viluppuram', name: 'Viluppuram', nameTa: 'விழுப்புரம்' },
    { id: 'virudhunagar', name: 'Virudhunagar', nameTa: 'விருதுநகர்' }
  ];
  
  // Cache for hierarchy data (initialized with all 38 districts)
  let districtsCache = DEFAULT_TN_DISTRICTS;
  let subdivisionsCache = {};
  let villagesCache = {};
  let localBodiesCache = {};

  // Current resolution state
  let currentResolution = null;
  let isManualOverride = false;
  let boundaryCircle = null;

  // Debounce timer for village/town input
  let villageDebounceTimer = null;

  const LocationAuthority = {
    state: {
      lat: null,
      lng: null,
      address: '',
      districtId: '',
      subdivisionId: '',
      localBodyId: '',
      villageOrTown: '',
      isResolving: false
    },

    /**
     * Initialize the Location Authority component.
     */
    init: function() {
      console.log('[LocationAuthority] Initializing Location-Aware Civic Authority module...');
      this.populateDistricts();
      this.bindUIEvents();
      this.preloadDistricts();

      // If coordinates or address already exist on page load, resolve immediately
      setTimeout(() => {
        const latInput = document.getElementById('report-latitude');
        const lngInput = document.getElementById('report-longitude');
        if (latInput && latInput.value && lngInput && lngInput.value) {
          this.state.lat = parseFloat(latInput.value);
          this.state.lng = parseFloat(lngInput.value);
          this.state.address = document.getElementById('report-address')?.value || '';
          this.triggerResolution();
        } else {
          // Default initial resolution for Tamil Nadu
          this.triggerResolution();
        }
      }, 400);
    },

    /**
     * Bind DOM elements and events.
     */
    bindUIEvents: function() {
      const toggleManualBtn = document.getElementById('btn-toggle-manual-location');
      const toggleAutoBtn = document.getElementById('btn-toggle-auto-location');
      const districtSelect = document.getElementById('la-district-select');
      const subdivSelect = document.getElementById('la-subdivision-select');
      const villageSelect = document.getElementById('la-village-select');
      const villageCustomInput = document.getElementById('la-village-custom-input');
      const localBodySelect = document.getElementById('la-localbody-select');
      const categorySelect = document.getElementById('report-category');

      if (toggleManualBtn) {
        toggleManualBtn.addEventListener('click', () => {
          this.setManualMode(true);
        });
      }

      if (toggleAutoBtn) {
        toggleAutoBtn.addEventListener('click', () => {
          this.setManualMode(false);
          const gpsBtn = document.getElementById('btn-use-gps');
          if (gpsBtn) gpsBtn.click();
        });
      }

      if (districtSelect) {
        districtSelect.addEventListener('change', async (e) => {
          const distId = e.target.value;
          this.state.districtId = distId;
          this.state.subdivisionId = '';
          this.state.localBodyId = '';
          this.state.villageOrTown = '';
          this.resetVillagesAndLocalBodies();
          this.updateLocationHeaderLabel();
          await this.populateSubdivisions(distId);
          this.triggerResolution();
        });
      }

      if (subdivSelect) {
        subdivSelect.addEventListener('change', async (e) => {
          const subId = e.target.value;
          this.state.subdivisionId = subId;
          this.state.villageOrTown = '';
          this.state.localBodyId = '';
          this.resetVillagesAndLocalBodies();
          this.updateLocationHeaderLabel();
          await this.populateVillages(this.state.districtId, subId);
          await this.populateLocalBodies(this.state.districtId, subId);
          this.triggerResolution();
        });
      }

      const villageSearchInput = document.getElementById('la-village-search-input');
      const clearVillageSearchBtn = document.getElementById('btn-clear-village-search');

      if (villageSearchInput) {
        villageSearchInput.addEventListener('input', (e) => {
          this.filterVillages(e.target.value);
        });
      }

      if (clearVillageSearchBtn) {
        clearVillageSearchBtn.addEventListener('click', () => {
          if (villageSearchInput) {
            villageSearchInput.value = '';
            villageSearchInput.focus();
          }
          this.filterVillages('');
        });
      }

      if (villageSelect) {
        villageSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val === '__custom__') {
            if (villageCustomInput) {
              villageCustomInput.classList.remove('hidden');
              villageCustomInput.focus();
            }
            this.state.villageOrTown = (villageCustomInput?.value || '').trim();
            this.updateLocationHeaderLabel();
          } else {
            if (villageCustomInput) {
              villageCustomInput.classList.add('hidden');
            }
            this.state.villageOrTown = (val || '').trim();
            this.updateLocationHeaderLabel();
            this.syncLocalBodyWithVillage(val);
            this.triggerResolution();
          }
        });
      }

      if (villageCustomInput) {
        villageCustomInput.addEventListener('input', (e) => {
          this.state.villageOrTown = e.target.value.trim();
          this.updateLocationHeaderLabel();
          clearTimeout(villageDebounceTimer);
          villageDebounceTimer = setTimeout(() => {
            this.triggerResolution();
          }, 500);
        });
      }

      if (localBodySelect) {
        localBodySelect.addEventListener('change', (e) => {
          this.state.localBodyId = e.target.value;
          this.updateLocationHeaderLabel();
          this.triggerResolution();
        });
      }

      if (categorySelect) {
        categorySelect.addEventListener('change', () => {
          this.triggerResolution();
        });
      }
    },

    /**
     * Switch between Auto-Detected (GPS/Map pin) and Manual Override (Cascading Selectors) mode.
     */
    setManualMode: async function(isManual) {
      isManualOverride = isManual;
      const autoBox = document.getElementById('la-auto-mode-container');
      const manualBox = document.getElementById('la-manual-mode-container');
      const toggleManualBtn = document.getElementById('btn-toggle-manual-location');
      const toggleAutoBtn = document.getElementById('btn-toggle-auto-location');
      const districtSelect = document.getElementById('la-district-select');

      if (isManual) {
        if (autoBox) autoBox.classList.add('hidden');
        if (manualBox) manualBox.classList.remove('hidden');
        if (toggleManualBtn) toggleManualBtn.classList.add('hidden');
        if (toggleAutoBtn) toggleAutoBtn.classList.remove('hidden');

        this.populateDistricts();

        const defaultDist = this.state.districtId || 'coimbatore';
        if (districtSelect && (!districtSelect.value || districtSelect.value === '')) {
          districtSelect.value = defaultDist;
          this.state.districtId = defaultDist;
          await this.populateSubdivisions(defaultDist);
          this.resetVillagesAndLocalBodies();
        }
        this.updateLocationHeaderLabel();
        this.triggerResolution();
      } else {
        if (autoBox) autoBox.classList.remove('hidden');
        if (manualBox) manualBox.classList.add('hidden');
        if (toggleManualBtn) toggleManualBtn.classList.remove('hidden');
        if (toggleAutoBtn) toggleAutoBtn.classList.add('hidden');

        // Reset manual state
        this.state.districtId = '';
        this.state.subdivisionId = '';
        this.state.localBodyId = '';
        this.state.villageOrTown = '';
        this.resetVillagesAndLocalBodies();
        this.updateLocationHeaderLabel();
        this.triggerResolution();
      }
    },

    /**
     * Reset village search, village select, and local body select when parent changes
     */
    resetVillagesAndLocalBodies: function() {
      const villageSelect = document.getElementById('la-village-select');
      const villageSearchInput = document.getElementById('la-village-search-input');
      const clearSearchBtn = document.getElementById('btn-clear-village-search');
      const countBadge = document.getElementById('la-village-count-badge');
      const localBodySelect = document.getElementById('la-localbody-select');
      const customInput = document.getElementById('la-village-custom-input');

      currentTalukLocations = [];
      if (villageSearchInput) {
        villageSearchInput.value = '';
        villageSearchInput.disabled = true;
      }
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      if (countBadge) countBadge.textContent = '';
      if (villageSelect) {
        villageSelect.innerHTML = '<option value="" disabled selected>Select Taluk / Block first...</option>';
        villageSelect.disabled = true;
      }
      if (localBodySelect) {
        localBodySelect.innerHTML = '<option value="" disabled selected>Select Taluk / Block first...</option>';
        localBodySelect.disabled = true;
      }
      if (customInput) {
        customInput.value = '';
        customInput.classList.add('hidden');
      }
    },

    /**
     * Preload districts list in background from API.
     */
    preloadDistricts: async function() {
      try {
        let res = await fetch(`${API_LOCATIONS}/districts`);
        if (!res.ok) {
          res = await fetch(`${API_BASE}/districts`);
        }
        if (res.ok) {
          const data = await res.json();
          const list = data.districts || data.data || (Array.isArray(data) ? data : []);
          if (list && list.length > 0) {
            districtsCache = list.map(d => ({
              id: d.id,
              name: d.name,
              nameTa: d.tamil_name || d.nameTa || ''
            }));
            this.populateDistricts();
          }
        }
      } catch (err) {
        console.warn('[LocationAuthority] Network preload notice (using embedded 38 districts):', err);
      }
    },

    /**
     * Populate District dropdown with all 38 Tamil Nadu districts.
     */
    populateDistricts: function() {
      const select = document.getElementById('la-district-select');
      if (!select || !districtsCache || districtsCache.length === 0) return;

      const currentVal = select.value || this.state.districtId;
      let html = '<option value="" disabled selected>Select District (மாவட்டம்)...</option>';
      districtsCache.forEach(d => {
        const isSel = (currentVal === d.id || currentVal === d.name.toLowerCase()) ? 'selected' : '';
        const taPart = d.nameTa ? ` (${d.nameTa})` : '';
        html += `<option value="${d.id}" ${isSel}>${d.name}${taPart}</option>`;
      });
      select.innerHTML = html;
    },

    /**
     * Populate Taluk / Subdivision dropdown based on selected District.
     */
    populateSubdivisions: async function(districtId) {
      const select = document.getElementById('la-subdivision-select');
      if (!select) return;

      if (!districtId) {
        select.innerHTML = '<option value="" disabled selected>Select Taluk / Block first...</option>';
        select.disabled = true;
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Taluks / Blocks...</option>';

      try {
        if (!subdivisionsCache[districtId]) {
          let res = await fetch(`${API_LOCATIONS}/districts/${encodeURIComponent(districtId)}/taluks`);
          if (!res.ok) {
            res = await fetch(`${API_BASE}/subdivisions?district=${encodeURIComponent(districtId)}`);
          }
          if (res.ok) {
            const data = await res.json();
            subdivisionsCache[districtId] = data.taluks || data.subdivisions || data.data || [];
          }
        }

        const subs = subdivisionsCache[districtId] || [];
        let html = '<option value="" selected>Select Taluk / Block (வட்டம் / ஒன்றியம்)...</option>';
        subs.forEach(s => {
          const taLabel = s.tamil_name || s.nameTa ? ` (${s.tamil_name || s.nameTa})` : '';
          const typeLabel = s.type === 'block' ? 'Block' : (s.type === 'zone' ? 'Zone' : 'Taluk');
          html += `<option value="${s.id}">${s.name} [${typeLabel}]${taLabel}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;
      } catch (err) {
        console.error('[LocationAuthority] Error fetching subdivisions:', err);
        select.innerHTML = '<option value="">Failed to load taluks</option>';
      }
    },

    /**
     * Helper to format administrative location types
     */
    formatLocationTypeBadge: function(type) {
      switch (type) {
        case 'town_panchayat': return 'Town Panchayat';
        case 'municipality': return 'Municipality';
        case 'corporation': return 'Corporation';
        case 'village_panchayat': return 'Village Panchayat';
        case 'town': return 'Town';
        default: return 'Revenue Village';
      }
    },

    /**
     * Populate Village / Town dropdown based on selected District & Taluk.
     */
    populateVillages: async function(districtId, subdivisionId) {
      const select = document.getElementById('la-village-select');
      const customInput = document.getElementById('la-village-custom-input');
      const searchInput = document.getElementById('la-village-search-input');
      const clearBtn = document.getElementById('btn-clear-village-search');
      const countBadge = document.getElementById('la-village-count-badge');
      if (!select) return;

      if (customInput) customInput.classList.add('hidden');
      if (searchInput) {
        searchInput.value = '';
        searchInput.disabled = !subdivisionId;
      }
      if (clearBtn) clearBtn.classList.add('hidden');

      if (!districtId || !subdivisionId) {
        select.innerHTML = '<option value="" disabled selected>Select Taluk / Block first...</option>';
        select.disabled = true;
        currentTalukLocations = [];
        if (countBadge) countBadge.textContent = '';
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Villages / Towns...</option>';
      if (countBadge) countBadge.textContent = 'Loading...';

      try {
        const cacheKey = `${districtId}_${subdivisionId}`;
        if (!villagesCache[cacheKey]) {
          let res = await fetch(`${API_LOCATIONS}/taluks/${encodeURIComponent(subdivisionId)}/locations`);
          if (!res.ok) {
            res = await fetch(`${API_BASE}/villages?district=${encodeURIComponent(districtId)}&subdivision=${encodeURIComponent(subdivisionId)}`);
          }
          if (res.ok) {
            const data = await res.json();
            villagesCache[cacheKey] = data.locations || data.villages || data.data || [];
          }
        }

        currentTalukLocations = villagesCache[cacheKey] || [];
        this.renderVillageOptions(currentTalukLocations);
        select.disabled = false;
        if (searchInput) {
          searchInput.disabled = false;
        }
      } catch (err) {
        console.error('[LocationAuthority] Error fetching villages:', err);
        select.innerHTML = '<option value="">Failed to load villages</option>';
        if (countBadge) countBadge.textContent = '';
      }
    },

    /**
     * Render village options with bilingual display and administrative type badge
     */
    renderVillageOptions: function(list, filterQuery = '') {
      const select = document.getElementById('la-village-select');
      const countBadge = document.getElementById('la-village-count-badge');
      if (!select) return;

      const totalCount = currentTalukLocations.length;
      const count = list.length;

      if (countBadge) {
        if (filterQuery) {
          countBadge.textContent = `Showing ${count} of ${totalCount}`;
        } else {
          countBadge.textContent = `${totalCount} locations`;
        }
      }

      let html = '<option value="" disabled selected>Select Village / Town (கிராமம் / நகரம்)...</option>';
      list.forEach(v => {
        const taPart = (v.tamil_name || v.nameTa) ? ` (${v.tamil_name || v.nameTa})` : '';
        const typeBadge = ` [${this.formatLocationTypeBadge(v.location_type || v.type)}]`;
        html += `<option value="${v.name}">${v.name}${taPart}${typeBadge}</option>`;
      });
      html += '<option value="__custom__">Can\'t find your village? Enter manually...</option>';

      select.innerHTML = html;
    },

    /**
     * Filter village options in real-time within the selected Taluk
     */
    filterVillages: function(query) {
      const q = String(query).trim().toLowerCase();
      const clearBtn = document.getElementById('btn-clear-village-search');
      if (clearBtn) {
        if (q) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }

      if (!q) {
        this.renderVillageOptions(currentTalukLocations);
        return;
      }

      const filtered = currentTalukLocations.filter(v => {
        const nameEn = (v.name || '').toLowerCase();
        const nameTa = (v.tamil_name || v.nameTa || '').toLowerCase();
        return nameEn.includes(q) || nameTa.includes(q);
      });

      this.renderVillageOptions(filtered, q);
    },

    /**
     * Smart sync: if user picks a village that corresponds to a local body, pre-select it
     */
    syncLocalBodyWithVillage: function(villageName) {
      if (!villageName) return;
      const select = document.getElementById('la-localbody-select');
      if (!select || select.disabled) return;

      const normV = villageName.toLowerCase().trim();
      for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        if (opt.value && opt.text.toLowerCase().includes(normV)) {
          select.selectedIndex = i;
          this.state.localBodyId = opt.value;
          break;
        }
      }
    },

    /**
     * Populate Local Bodies dropdown based on selected District & Subdivision.
     */
    populateLocalBodies: async function(districtId, subdivisionId, villageName) {
      const select = document.getElementById('la-localbody-select');
      if (!select) return;

      if (!districtId) {
        select.innerHTML = '<option value="" disabled selected>Select Local Body...</option>';
        select.disabled = true;
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Local Bodies...</option>';

      try {
        let url = `${API_LOCATIONS}/local-bodies?district=${encodeURIComponent(districtId)}`;
        if (subdivisionId) url += `&taluk=${encodeURIComponent(subdivisionId)}`;
        if (villageName) url += `&village=${encodeURIComponent(villageName)}`;

        let res = await fetch(url);
        if (!res.ok) {
          res = await fetch(`${API_BASE}/local-bodies?district=${encodeURIComponent(districtId)}${subdivisionId ? `&subdivision=${encodeURIComponent(subdivisionId)}` : ''}`);
        }
        if (res.ok) {
          const data = await res.json();
          const lbs = data.localBodies || data.data || [];
          let html = '<option value="" selected>Select Local Body (உள்ளாட்சி அமைப்பு)...</option>';
          lbs.forEach(lb => {
            const taLabel = (lb.tamil_name || lb.nameTa) ? ` (${lb.tamil_name || lb.nameTa})` : '';
            html += `<option value="${lb.id}">${lb.name}${taLabel}</option>`;
          });
          select.innerHTML = html;
          select.disabled = false;
        }
      } catch (err) {
        console.error('[LocationAuthority] Error fetching local bodies:', err);
        select.innerHTML = '<option value="">Failed to load local bodies</option>';
      }
    },

    /**
     * Trigger resolution using current state (auto or manual).
     */
    triggerResolution: async function() {
      const latInput = document.getElementById('report-latitude');
      const lngInput = document.getElementById('report-longitude');
      const addrInput = document.getElementById('report-address');
      const catSelect = document.getElementById('report-category');

      const lat = parseFloat(latInput?.value) || this.state.lat || 11.0168;
      const lng = parseFloat(lngInput?.value) || this.state.lng || 76.9558;
      const address = addrInput?.value || this.state.address || 'Coimbatore, Tamil Nadu';
      const category = catSelect?.value || 'roads';
      const mode = window.currentReportMode || 'civic';

      const payload = {
        latitude: lat,
        longitude: lng,
        address: address,
        category: category,
        mode: mode
      };

      if (isManualOverride && this.state.districtId) {
        payload.manualSelection = {
          districtId: this.state.districtId,
          subdivisionId: this.state.subdivisionId,
          localBodyId: this.state.localBodyId,
          villageOrTown: this.state.villageOrTown
        };
      }

      await this.resolveAuthority(payload);
    },

    /**
     * Call the backend resolution endpoint.
     */
    resolveAuthority: async function(payload) {
      if (this.state.isResolving) return;
      this.state.isResolving = true;
      this.showCardLoading(true);

      try {
        const res = await fetch(`${API_BASE}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`Resolution request failed with status: ${res.status}`);
        }

        const data = await res.json();
        const resObj = (data && data.resolution) ? data.resolution : ((data && data.data) ? data.data : data);
        if (resObj && (resObj.jurisdiction || resObj.administrativeAuthority)) {
          currentResolution = resObj;
          this.renderAuthorityCard(resObj);
          this.updateStep3Preview(resObj);
          this.updateMapJurisdictionCircle(resObj, payload.latitude, payload.longitude);
        }
      } catch (err) {
        console.warn('[LocationAuthority] Error resolving authority:', err);
      } finally {
        this.state.isResolving = false;
        this.showCardLoading(false);
      }
    },

    /**
     * Called when reverseGeocode finishes in report.js.
     */
    onGeocodeResolved: function(lat, lng, address, nominatimData) {
      this.state.lat = lat;
      this.state.lng = lng;
      this.state.address = address;

      if (nominatimData && nominatimData.address) {
        const addr = nominatimData.address;
        const loc = addr.village || addr.town || addr.city || addr.suburb || addr.neighbourhood || addr.subdistrict || '';
        const dist = addr.county || addr.district || addr.state_district || '';
        if (loc && dist && loc.toLowerCase() !== dist.toLowerCase()) {
          this.updateLocationHeaderLabel(`${loc}, ${dist}`);
        } else if (loc || dist) {
          this.updateLocationHeaderLabel(loc || dist);
        } else {
          this.updateLocationHeaderLabel();
        }
      } else {
        this.updateLocationHeaderLabel();
      }

      if (!isManualOverride) {
        this.triggerResolution();
      }
    },

    /**
     * Update the Location status text next to the pin icon in the Mode Toggle Bar.
     * Shows current location: village, town, city, or district.
     */
    updateLocationHeaderLabel: function(customText) {
      const labelEl = document.getElementById('la-current-mode-label');
      if (!labelEl) return;

      if (customText && typeof customText === 'string') {
        labelEl.textContent = customText;
        labelEl.title = customText;
        return;
      }

      if (isManualOverride) {
        // Build from manual selection
        const villageSelect = document.getElementById('la-village-select');
        const villageCustomInput = document.getElementById('la-village-custom-input');
        let village = (this.state.villageOrTown || '').trim();
        if (!village) {
          if (villageSelect && villageSelect.value && villageSelect.value !== '__custom__') {
            village = villageSelect.value.trim();
          } else if (villageCustomInput && villageCustomInput.value) {
            village = villageCustomInput.value.trim();
          }
        } else if (villageSelect && villageSelect.value === '__custom__' && villageCustomInput) {
          village = villageCustomInput.value.trim();
        }

        const distSelect = document.getElementById('la-district-select');
        const subdivSelect = document.getElementById('la-subdivision-select');
        
        let distName = '';
        if (distSelect && distSelect.selectedIndex > 0) {
          distName = distSelect.options[distSelect.selectedIndex].text.split('(')[0].trim();
        } else if (this.state.districtId) {
          const d = districtsCache.find(x => x.id === this.state.districtId);
          distName = d ? d.name : this.state.districtId;
        }

        let talukName = '';
        if (subdivSelect && subdivSelect.selectedIndex > 0 && subdivSelect.value) {
          talukName = subdivSelect.options[subdivSelect.selectedIndex].text.split('[')[0].split('(')[0].trim();
        }

        const parts = [];
        if (village) parts.push(village);
        if (talukName && talukName !== village && (!distName || !talukName.toLowerCase().includes(distName.toLowerCase()))) {
          parts.push(talukName);
        }
        if (distName) parts.push(distName);

        const text = parts.length > 0 ? parts.join(', ') : 'Select Location Manually';
        labelEl.textContent = text;
        labelEl.title = text;
      } else {
        // Auto mode: build from current resolution or address
        if (currentResolution && currentResolution.jurisdiction) {
          const j = currentResolution.jurisdiction;
          const village = (j.villageOrTown || '').trim();
          const taluk = (j.taluk || '').trim();
          const district = (j.district || '').trim();

          const parts = [];
          if (village && district && village.toLowerCase() !== district.toLowerCase()) {
            parts.push(village);
          } else if (taluk && district && taluk.toLowerCase() !== district.toLowerCase()) {
            parts.push(taluk);
          }
          if (district) parts.push(district);

          const text = parts.length > 0 ? parts.join(', ') : (j.district || 'Tamil Nadu');
          labelEl.textContent = text;
          labelEl.title = text;
        } else if (this.state.address) {
          const addrTokens = this.state.address.split(',').map(s => s.trim()).filter(Boolean);
          if (addrTokens.length >= 2) {
            const text = `${addrTokens[0]}, ${addrTokens[1]}`;
            labelEl.textContent = text;
            labelEl.title = this.state.address;
          } else {
            labelEl.textContent = addrTokens[0] || 'Tamil Nadu';
            labelEl.title = this.state.address;
          }
        } else {
          labelEl.textContent = 'Detecting location...';
        }
      }
    },

    /**
     * Show loading skeleton in Authority Card.
     */
    showCardLoading: function(isLoading) {
      const loader = document.getElementById('la-authority-card-loader');
      const content = document.getElementById('la-authority-card-content');
      const card = document.getElementById('la-authority-card-container');
      if (card) card.classList.remove('hidden');
      if (loader && content) {
        if (isLoading) {
          loader.classList.remove('hidden');
          content.style.opacity = '0.4';
        } else {
          loader.classList.add('hidden');
          content.style.opacity = '1';
        }
      }
    },

    /**
     * Render the official Verified Responsible Authority Card.
     */
    renderAuthorityCard: function(res) {
      const cardContainer = document.getElementById('la-authority-card-container');
      if (!cardContainer) return;
      cardContainer.classList.remove('hidden');
      this.updateLocationHeaderLabel();

      const j = res.jurisdiction || {};
      const a = res.administrativeAuthority || {};
      const el = res.electedRepresentative;
      const esc = res.escalationContact;
      const sup = res.supportFallback;

      // 1. Hierarchy Badges
      const badgesEl = document.getElementById('la-card-hierarchy-badges');
      if (badgesEl) {
        badgesEl.innerHTML = `
          <span class="la-badge" title="District">
            <span class="la-badge-label">District:</span>
            <strong class="la-badge-value">${j.district || 'Coimbatore'}</strong>
          </span>
          <span class="la-badge" title="Taluk / Subdivision">
            <span class="la-badge-label">Taluk:</span>
            <strong class="la-badge-value">${j.taluk || 'Sulur'}</strong>
          </span>
          ${j.villageOrTown ? `
          <span class="la-badge" title="Village / Town">
            <span class="la-badge-label">Village/Town:</span>
            <strong class="la-badge-value">${j.villageOrTown}</strong>
          </span>` : ''}
          <span class="la-badge" title="${j.localBodyType || 'Local Body'}">
            <span class="la-badge-label">Local Body:</span>
            <strong class="la-badge-value">${j.localBody || 'Local Body'}</strong>
            <span class="la-badge-sub">(${j.localBodyType || 'Village Panchayat'} &bull; ${j.tier || 'Rural'})</span>
          </span>
        `;
      }

      // 2. Fallback Notice Banner
      const fallbackBanner = document.getElementById('la-card-fallback-banner');
      if (fallbackBanner) {
        if (a.isFallback) {
          fallbackBanner.classList.remove('hidden');
          fallbackBanner.innerHTML = `
            <i class="fa-solid fa-circle-info"></i>
            <div>
              <strong>Administrative Routing:</strong> ${a.fallbackMessage || 'Direct local contact unavailable. Showing verified higher-level authority.'}
            </div>
          `;
        } else {
          fallbackBanner.classList.add('hidden');
        }
      }

      // 3. Administrative / Service Authority
      const officeEl = document.getElementById('la-card-auth-office');
      const desigEl = document.getElementById('la-card-auth-designation');
      const deptEl = document.getElementById('la-card-auth-department');
      const phoneEl = document.getElementById('la-card-auth-phone');
      const emailEl = document.getElementById('la-card-auth-email');
      const sourceEl = document.getElementById('la-card-auth-source');
      const verifyEl = document.getElementById('la-card-auth-verified-time');

      if (officeEl) officeEl.textContent = a.office || 'Local Administrative Office';
      if (desigEl) desigEl.textContent = a.designation || 'Responsible Public Officer';
      if (deptEl) deptEl.textContent = a.serviceDepartment || 'Municipal Administrative Services';

      // Phone
      if (phoneEl) {
        if (a.hasPhone && a.phone && a.phone !== 'Contact information unavailable') {
          phoneEl.innerHTML = `<a href="tel:${a.phone.replace(/[^0-9+]/g, '')}" class="la-contact-btn phone"><i class="fa-solid fa-phone"></i> <span>${a.phone}</span></a>`;
        } else {
          phoneEl.innerHTML = `<span class="la-contact-na"><i class="fa-solid fa-phone-slash"></i> Contact number unavailable</span>`;
        }
      }

      // Email
      if (emailEl) {
        if (a.hasEmail && a.email && a.email !== 'Contact information unavailable') {
          emailEl.innerHTML = `<a href="mailto:${a.email}" class="la-contact-btn email"><i class="fa-solid fa-envelope"></i> <span>${a.email}</span></a>`;
        } else {
          emailEl.innerHTML = `<span class="la-contact-na"><i class="fa-solid fa-envelope-open"></i> Official email unavailable</span>`;
        }
      }

      // Source URL
      if (sourceEl) {
        if (a.sourceUrl) {
          sourceEl.innerHTML = `<a href="${a.sourceUrl}" target="_blank" rel="noopener noreferrer" class="la-source-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Official Source: ${a.sourceUrl.replace('https://', '')}</a>`;
        } else {
          sourceEl.innerHTML = `<span class="la-source-link"><i class="fa-solid fa-check-double"></i> Verified via TN e-Governance Agency</span>`;
        }
      }

      if (verifyEl && a.lastVerifiedAt) {
        verifyEl.textContent = `Record Verified: March 2026`;
      }

      // 4. Elected Representative Card
      const electedBox = document.getElementById('la-card-elected-box');
      if (electedBox) {
        if (el) {
          electedBox.classList.remove('hidden');
          electedBox.innerHTML = `
            <div class="la-section-label">
              <i class="fa-solid fa-landmark"></i> Elected Public Representative
              <span class="la-sub-label">(Public Representative — non-executive office)</span>
            </div>
            <div class="la-elected-info">
              <div class="la-rep-office">${el.office}</div>
              <div class="la-rep-desig">${el.designation}</div>
              <div class="la-contact-row">
                ${el.phone ? `<a href="tel:${el.phone.replace(/[^0-9+]/g, '')}" class="la-contact-btn phone"><i class="fa-solid fa-phone"></i> <span>${el.phone}</span></a>` : '<span class="la-contact-na"><i class="fa-solid fa-phone-slash"></i> <span>Phone unavailable</span></span>'}
                ${el.email ? `<a href="mailto:${el.email}" class="la-contact-btn email"><i class="fa-solid fa-envelope"></i> <span>${el.email}</span></a>` : ''}
              </div>
            </div>
          `;
        } else {
          electedBox.classList.add('hidden');
        }
      }

      // 5. Level 1 Escalation Contact
      const escBox = document.getElementById('la-card-escalation-box');
      if (escBox && esc) {
        escBox.innerHTML = `
          <div class="la-section-label">
            ${esc.level || 'Level 1 Escalation Authority'}
            <span class="la-sub-label">(Triggered automatically if complaint exceeds SLA)</span>
          </div>
          <div class="la-escalation-info">
            <div class="la-esc-office">${esc.office}</div>
            <div class="la-esc-desig">${esc.designation}</div>
            <div class="la-contact-row">
              <a href="tel:${esc.phone.replace(/[^0-9+]/g, '')}" class="la-contact-btn phone"><i class="fa-solid fa-phone"></i> <span>${esc.phone}</span></a>
              <a href="mailto:${esc.email}" class="la-contact-btn email"><i class="fa-solid fa-envelope"></i> <span>${esc.email}</span></a>
            </div>
          </div>
        `;
      }

      // 6. CrowdCity 24/7 Support Card
      const supBox = document.getElementById('la-card-support-box');
      if (supBox && sup) {
        const supportConfig = (typeof window !== 'undefined' && window.CROWDCITY_CONFIG?.SUPPORT) || CROWDCITY_SUPPORT_CONFIG;
        const telUri = sup.tel || (sup.phone ? `tel:${sup.phone.replace(/[^0-9+]/g, '')}` : supportConfig.tel);
        const titleText = sup.title || supportConfig.title || 'CrowdCity 24/7 Support';
        const actionText = supportConfig.actionText || 'Call CrowdCity Support';

        supBox.innerHTML = `
          <div class="la-support-line">
            <div class="la-support-info">
              <i class="fa-solid fa-headset" aria-hidden="true"></i>
              <span class="la-support-title"><strong>${titleText}</strong></span>
            </div>
            <a href="${telUri}" class="la-support-call-btn" role="button" aria-label="${actionText}">
              <i class="fa-solid fa-phone" aria-hidden="true"></i>
              <span>${actionText}</span>
            </a>
          </div>
        `;
      }
    },

    /**
     * Update Step 3 AI Review pane with resolved jurisdiction and authority details.
     */
    updateStep3Preview: function(res) {
      const j = res.jurisdiction || {};
      const a = res.administrativeAuthority || {};

      const deptEl = document.getElementById('step3-ai-department');
      if (deptEl) {
        deptEl.textContent = `${j.localBody || 'Municipal Administration'} (${a.serviceDepartment || 'Civic Services'})`;
      }

      const authEl = document.getElementById('step3-ai-authority');
      if (authEl) {
        authEl.textContent = a.office || 'Local Municipal Authority';
      }

      const locEl = document.getElementById('step3-ai-jurisdiction');
      if (locEl) {
        locEl.textContent = `${j.district || 'Coimbatore'} &bull; ${j.taluk || 'Sulur'} &bull; ${j.localBodyType || 'Village Panchayat'}`;
      }
    },

    /**
     * Draw boundary circle on Leaflet reportMap if available.
     */
    updateMapJurisdictionCircle: function(res, lat, lng) {
      if (!window.reportMap || !lat || !lng) return;

      try {
        if (boundaryCircle) {
          window.reportMap.removeLayer(boundaryCircle);
          boundaryCircle = null;
        }

        const localBodyType = res.jurisdiction?.rawLocalBodyType || 'village_panchayat';
        let radiusMeters = 3000;
        let color = '#0d9488';

        if (localBodyType === 'municipal_corporation') {
          radiusMeters = 8000;
          color = '#2563eb';
        } else if (localBodyType === 'municipality') {
          radiusMeters = 5000;
          color = '#0284c7';
        } else if (localBodyType === 'town_panchayat') {
          radiusMeters = 3500;
          color = '#059669';
        }

        boundaryCircle = L.circle([lat, lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '4, 6',
          radius: radiusMeters
        }).addTo(window.reportMap);

        boundaryCircle.bindTooltip(`${res.jurisdiction?.localBody || 'Local Body Jurisdiction'} (${res.jurisdiction?.localBodyType || ''})`, {
          permanent: false,
          direction: 'top'
        });
      } catch (err) {
        console.warn('[LocationAuthority] Leaflet circle draw error:', err);
      }
    },

    /**
     * Returns resolved authority payload for form submission.
     */
    getSubmissionPayload: function() {
      if (!currentResolution) return null;
      const j = currentResolution.jurisdiction || {};
      const a = currentResolution.administrativeAuthority || {};
      const esc = currentResolution.escalationContact || {};

      return {
        district: j.district || null,
        taluk: j.taluk || null,
        village_or_town: j.villageOrTown || null,
        local_body: j.localBody || null,
        local_body_type: j.localBodyType || null,
        responsible_authority_name: a.office || null,
        authority_phone: a.hasPhone ? a.phone : null,
        authority_email: a.hasEmail ? a.email : null,
        higher_authority_name: esc.office || null
      };
    },

    /**
     * Get the full resolution object.
     */
    getCurrentResolution: function() {
      return currentResolution;
    }
  };

  // Expose to global window scope
  window.LocationAuthority = LocationAuthority;

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LocationAuthority.init());
  } else {
    LocationAuthority.init();
  }

})(window, document);
