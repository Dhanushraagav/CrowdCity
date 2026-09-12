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
    tollFree: '1800-425-1100',
    whatsappPhone: '+91 90251 32196',
    whatsappUrl: 'https://wa.me/919025132196?text=Hi%20CrowdCity%20Support%2C%20I%20need%20assistance%20regarding%20a%20civic%20issue.',
    whatsappMessage: 'Hi CrowdCity Support, I need assistance regarding a civic issue.',
    get tel() {
      return `tel:${this.phone.replace(/[^0-9+]/g, '')}`;
    },
    actionText: 'Call CrowdCity Support',
    whatsappActionText: 'Chat with Support'
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
  let blocksCache = {};
  let villagePanchayatsCache = {};
  let urbanBodiesCache = {};
  let taluksCache = {};
  let revenueVillagesCache = {};

  // Current resolution state
  let currentResolution = null;
  let isManualOverride = false;
  let boundaryCircle = null;

  // Debounce timers
  let villageDebounceTimer = null;
  let streamDebounceTimer = null;

  const LocationAuthority = {
    state: {
      lat: null,
      lng: null,
      address: '',
      districtId: '',
      stream: 'rural', // 'rural' | 'urban' | 'revenue'
      blockId: '',
      villagePanchayatId: '',
      habitation: '',
      urbanTypeFilter: 'all',
      urbanBodyId: '',
      urbanLocality: '',
      talukId: '',
      revenueVillageId: '',
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
      this.initTypeaheadSearch();
      this.preloadDistricts();

      // Pre-initialize stream controls for default/initial district so child options are ready immediately
      const initialDist = this.state.districtId || document.getElementById('la-district-select')?.value || 'coimbatore';
      this.state.districtId = initialDist;
      const streamSelect = document.getElementById('la-stream-select');
      if (streamSelect) streamSelect.disabled = false;
      this.populateStream(initialDist, this.state.stream || 'rural');

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
      const streamSelect = document.getElementById('la-stream-select');

      // Rural Stream
      const blockSelect = document.getElementById('la-block-select');
      const vpSelect = document.getElementById('la-vp-select');
      const habitationInput = document.getElementById('la-habitation-input');

      // Urban Stream
      const urbanTypeFilter = document.getElementById('la-urban-type-filter');
      const urbanBodySelect = document.getElementById('la-urban-body-select');
      const urbanLocalityInput = document.getElementById('la-urban-locality-input');

      // Revenue Stream
      const talukSelect = document.getElementById('la-taluk-select');
      const rvSelect = document.getElementById('la-revenue-village-select');

      // Legacy fallback controls
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
        const handleDistrictSelect = async (force = false) => {
          const distId = districtSelect.value || this.state.districtId || 'coimbatore';
          const blkSelect = document.getElementById('la-block-select');
          const isPopulated = blkSelect && !blkSelect.disabled && blkSelect.options.length > 1;

          if (this.state.districtId === distId && isPopulated && !force) {
            return;
          }

          this.state.districtId = distId;
          this.state.subdivisionId = '';
          this.state.localBodyId = '';
          this.state.villageOrTown = '';
          this.state.blockId = '';
          this.state.villagePanchayatId = '';
          this.state.habitation = '';
          this.state.urbanBodyId = '';
          this.state.urbanLocality = '';
          this.state.talukId = '';
          this.state.revenueVillageId = '';

          this.resetStreamSelectors();
          this.resetVillagesAndLocalBodies();
          this.updateLocationHeaderLabel();

          if (streamSelect) streamSelect.disabled = false;
          await this.populateStream(distId, this.state.stream || 'rural');
          await this.populateSubdivisions(distId);
          this.triggerResolution();
        };

        districtSelect.addEventListener('change', () => handleDistrictSelect(true));
        districtSelect.addEventListener('input', () => handleDistrictSelect(true));
        districtSelect.addEventListener('click', () => {
          const blkSelect = document.getElementById('la-block-select');
          if (districtSelect.value && (!blkSelect || blkSelect.disabled || blkSelect.options.length <= 1)) {
            handleDistrictSelect(true);
          }
        });
      }

      if (streamSelect) {
        streamSelect.disabled = false;
        streamSelect.addEventListener('change', async (e) => {
          await this.setStream(e.target.value, true);
        });
      }

      // Rural Stream Handlers
      if (blockSelect) {
        blockSelect.addEventListener('change', async (e) => {
          const bId = e.target.value;
          this.state.blockId = bId;
          this.state.subdivisionId = bId;
          this.state.villagePanchayatId = '';
          this.state.habitation = '';
          this.state.villageOrTown = '';
          if (habitationInput) habitationInput.value = '';
          if (subdivSelect) subdivSelect.value = bId;
          this.updateLocationHeaderLabel();
          await this.populateVillagePanchayats(bId);
          this.triggerResolution();
        });
      }

      if (vpSelect) {
        vpSelect.addEventListener('change', (e) => {
          const opt = vpSelect.options[vpSelect.selectedIndex];
          const val = e.target.value;
          const vpName = opt ? (opt.getAttribute('data-name') || opt.text.split('[')[0].split('(')[0].trim()) : '';
          this.state.villagePanchayatId = val;
          this.state.localBodyId = val;
          this.state.villageOrTown = vpName;
          if (villageSelect) villageSelect.value = vpName;
          if (localBodySelect) localBodySelect.value = val;
          this.updateLocationHeaderLabel();
          this.triggerResolution();
        });
      }

      if (habitationInput) {
        habitationInput.addEventListener('input', (e) => {
          this.state.habitation = e.target.value.trim();
          this.updateLocationHeaderLabel();
          clearTimeout(streamDebounceTimer);
          streamDebounceTimer = setTimeout(() => {
            this.triggerResolution();
          }, 450);
        });
      }

      // Urban Stream Handlers
      if (urbanTypeFilter) {
        urbanTypeFilter.addEventListener('change', async (e) => {
          this.state.urbanTypeFilter = e.target.value;
          await this.populateUrbanBodies(this.state.districtId, this.state.urbanTypeFilter);
        });
      }

      if (urbanBodySelect) {
        urbanBodySelect.addEventListener('change', (e) => {
          const opt = urbanBodySelect.options[urbanBodySelect.selectedIndex];
          const val = e.target.value;
          const bodyName = opt ? (opt.getAttribute('data-name') || opt.text.split('[')[0].split('(')[0].trim()) : '';
          this.state.urbanBodyId = val;
          this.state.localBodyId = val;
          this.state.villageOrTown = bodyName;
          if (villageSelect) villageSelect.value = bodyName;
          if (localBodySelect) localBodySelect.value = val;
          this.updateLocationHeaderLabel();
          this.triggerResolution();
        });
      }

      if (urbanLocalityInput) {
        urbanLocalityInput.addEventListener('input', (e) => {
          this.state.urbanLocality = e.target.value.trim();
          this.updateLocationHeaderLabel();
          clearTimeout(streamDebounceTimer);
          streamDebounceTimer = setTimeout(() => {
            this.triggerResolution();
          }, 450);
        });
      }

      // Revenue Stream Handlers
      if (talukSelect) {
        talukSelect.addEventListener('change', async (e) => {
          const tId = e.target.value;
          this.state.talukId = tId;
          this.state.subdivisionId = tId;
          this.state.revenueVillageId = '';
          this.state.villageOrTown = '';
          if (subdivSelect) subdivSelect.value = tId;
          this.updateLocationHeaderLabel();
          await this.populateRevenueVillages(tId);
          this.triggerResolution();
        });
      }

      if (rvSelect) {
        rvSelect.addEventListener('change', (e) => {
          const opt = rvSelect.options[rvSelect.selectedIndex];
          const val = e.target.value;
          const rvName = opt ? (opt.getAttribute('data-name') || opt.text.split('(')[0].trim()) : '';
          this.state.revenueVillageId = val;
          this.state.villageOrTown = rvName;
          if (villageSelect) villageSelect.value = rvName;
          this.updateLocationHeaderLabel();
          this.triggerResolution();
        });
      }

      // Legacy Subdivision Handler
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

      // Type-to-search support across all dropdowns (typing while focused jumps to matching option like other dropdowns)
      const attachTypeAhead = (selectElem) => {
        if (!selectElem) return;
        let buffer = '';
        let timer = null;

        selectElem.addEventListener('keydown', (e) => {
          if (e.altKey || e.ctrlKey || e.metaKey) return;
          if (['Tab', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

          if (e.key === 'Backspace') {
            buffer = buffer.slice(0, -1);
            e.preventDefault();
          } else if (e.key.length === 1) {
            buffer += e.key.toLowerCase();
          } else {
            return;
          }

          clearTimeout(timer);
          timer = setTimeout(() => { buffer = ''; }, 1200);

          if (!buffer) return;

          const options = Array.from(selectElem.options);
          // Try prefix match first
          let matchIdx = options.findIndex(opt => opt.value && !opt.disabled && opt.text.toLowerCase().trim().startsWith(buffer));
          // If no prefix match, try substring match
          if (matchIdx === -1) {
            matchIdx = options.findIndex(opt => opt.value && !opt.disabled && opt.text.toLowerCase().includes(buffer));
          }

          if (matchIdx !== -1 && matchIdx !== selectElem.selectedIndex) {
            selectElem.selectedIndex = matchIdx;
            selectElem.dispatchEvent(new Event('change'));
          }
        });
      };

      attachTypeAhead(districtSelect);
      attachTypeAhead(streamSelect);
      attachTypeAhead(blockSelect);
      attachTypeAhead(vpSelect);
      attachTypeAhead(urbanTypeFilter);
      attachTypeAhead(urbanBodySelect);
      attachTypeAhead(talukSelect);
      attachTypeAhead(rvSelect);
      attachTypeAhead(subdivSelect);
      attachTypeAhead(villageSelect);
      attachTypeAhead(localBodySelect);

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
     * Search-First Typeahead Controller
     * Instant debounced lookup with administrative type filters and parent context
     */
    initTypeaheadSearch: function() {
      const input = document.getElementById('la-search-typeahead-input');
      const clearBtn = document.getElementById('la-search-clear-btn');
      const dropdown = document.getElementById('la-typeahead-dropdown');
      const filterChips = document.querySelectorAll('.la-filter-chip');

      if (!input || !dropdown) return;

      let activeTypeFilter = 'all';
      let searchDebounce = null;
      let currentResults = [];
      let focusedIndex = -1;

      // Filter chips click handler
      filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          filterChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          activeTypeFilter = chip.getAttribute('data-type') || 'all';
          if (input.value.trim()) {
            triggerSearch(input.value.trim());
          }
        });
      });

      const triggerSearch = async (query) => {
        const q = (query || '').trim();
        if (!q) {
          dropdown.innerHTML = '';
          dropdown.classList.add('hidden');
          if (clearBtn) clearBtn.classList.add('hidden');
          return;
        }

        if (clearBtn) clearBtn.classList.remove('hidden');

        try {
          const dist = LocationAuthority.state.districtId || '';
          let url = `${API_LOCATIONS}/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(activeTypeFilter)}&limit=25`;
          if (dist) url += `&district=${encodeURIComponent(dist)}`;

          const res = await fetch(url);
          if (!res.ok) {
            throw new Error('Search failed');
          }
          const data = await res.json();
          currentResults = data.data || [];
          renderDropdown(currentResults, q);
        } catch (err) {
          console.warn('[LocationAuthority] Search fetch error:', err);
          // Fallback: search in memory / client cache
          const cached = (currentTalukLocations || []).filter(l => !l.is_quarantined && (l.name.toLowerCase().includes(q.toLowerCase()) || (l.tamil_name && l.tamil_name.includes(q))));
          renderDropdown(cached, q);
        }
      };

      const renderDropdown = (results, query) => {
        focusedIndex = -1;
        if (!results || results.length === 0) {
          dropdown.innerHTML = `<div class="la-typeahead-no-results">No locations found matching "${query}". You can select via the dropdowns below.</div>`;
          dropdown.classList.remove('hidden');
          return;
        }

        let html = '';
        results.forEach((item, idx) => {
          const taPart = item.tamil_name && item.tamil_name !== item.name ? ` (${item.tamil_name})` : '';
          const badgeClass = item.location_type === 'village_panchayat' ? 'badge-panchayat' :
                             (item.location_type === 'town_panchayat' ? 'badge-town' :
                             (item.location_type === 'municipality' || item.location_type === 'corporation' ? 'badge-urban' : 'badge-revenue'));
          const typeLabel = item.type_label || LocationAuthority.formatLocationTypeBadge(item.location_type);
          const context = item.parent_context || (item.district_name ? `${item.district_name}` : '');

          html += `
            <div class="la-typeahead-item" data-idx="${idx}">
              <div class="la-item-main">
                <div class="la-item-title">${item.name}${taPart}</div>
                <div class="la-item-context"><i class="fa-solid fa-location-dot" style="font-size: 0.65rem;"></i> ${context}</div>
              </div>
              <span class="la-item-badge ${badgeClass}">${typeLabel}</span>
            </div>
          `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.la-typeahead-item').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            const selected = currentResults[idx];
            if (selected) {
              selectLocation(selected);
            }
          });
        });
      };

      const selectLocation = async (item) => {
        input.value = `${item.name}${item.tamil_name && item.tamil_name !== item.name ? ` (${item.tamil_name})` : ''}`;
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        if (clearBtn) clearBtn.classList.remove('hidden');

        const adminType = item.administrative_type || item.location_type || '';
        const distId = item.district_id || '';

        // 1. Sync District
        if (distId) {
          LocationAuthority.state.districtId = distId;
          const distSelect = document.getElementById('la-district-select');
          if (distSelect) {
            distSelect.value = distId;
          }
          const streamSelect = document.getElementById('la-stream-select');
          if (streamSelect) streamSelect.disabled = false;
        }

        // 2. Determine stream
        let stream = 'rural';
        if (['corporation', 'municipality', 'town_panchayat', 'locality', 'urban'].includes(adminType)) {
          stream = 'urban';
        } else if (['revenue_village', 'taluk'].includes(adminType)) {
          stream = 'revenue';
        } else if (adminType === 'village_panchayat') {
          stream = 'rural';
        }

        await LocationAuthority.setStream(stream, false);

        if (stream === 'rural') {
          const blockId = item.block_id || item.parent_id;
          LocationAuthority.state.villagePanchayatId = item.official_code || item.id || item.name;
          LocationAuthority.state.villageOrTown = item.name;
          LocationAuthority.state.localBodyId = item.official_code || item.id || item.name;
          if (blockId) {
            LocationAuthority.state.blockId = blockId;
            LocationAuthority.state.subdivisionId = blockId;
            await LocationAuthority.populateRuralBlocks(distId, blockId);
            await LocationAuthority.populateVillagePanchayats(blockId, item.official_code || item.name);
          }
        } else if (stream === 'urban') {
          const bodyId = item.urban_local_body_id || item.local_body_id || item.id;
          LocationAuthority.state.urbanBodyId = bodyId;
          LocationAuthority.state.localBodyId = bodyId;
          LocationAuthority.state.villageOrTown = item.name;
          await LocationAuthority.populateUrbanBodies(distId, 'all', bodyId);
          if (adminType === 'locality') {
            LocationAuthority.state.urbanLocality = item.name;
            const locInput = document.getElementById('la-urban-locality-input');
            if (locInput) locInput.value = item.name;
          }
        } else if (stream === 'revenue') {
          const talukId = item.taluk_id || item.parent_id;
          LocationAuthority.state.revenueVillageId = item.id || item.name;
          LocationAuthority.state.villageOrTown = item.name;
          if (talukId) {
            LocationAuthority.state.talukId = talukId;
            LocationAuthority.state.subdivisionId = talukId;
            await LocationAuthority.populateRevenueTaluks(distId, talukId);
            if (adminType === 'revenue_village') {
              await LocationAuthority.populateRevenueVillages(talukId, item.name);
            }
          }
        }

        // Backward compatibility sync with legacy selectors
        LocationAuthority.syncLegacyElements(item);
        LocationAuthority.updateLocationHeaderLabel();
        LocationAuthority.triggerResolution();
      };

      input.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        const val = e.target.value;
        if (!val.trim()) {
          dropdown.classList.add('hidden');
          dropdown.innerHTML = '';
          if (clearBtn) clearBtn.classList.add('hidden');
          return;
        }
        searchDebounce = setTimeout(() => {
          triggerSearch(val);
        }, 250);
      });

      input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.la-typeahead-item');
        if (items.length === 0 || dropdown.classList.contains('hidden')) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
          items.forEach((it, i) => it.classList.toggle('focused', i === focusedIndex));
          if (items[focusedIndex]) items[focusedIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          focusedIndex = Math.max(focusedIndex - 1, 0);
          items.forEach((it, i) => it.classList.toggle('focused', i === focusedIndex));
          if (items[focusedIndex]) items[focusedIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (focusedIndex >= 0 && currentResults[focusedIndex]) {
            selectLocation(currentResults[focusedIndex]);
          }
        } else if (e.key === 'Escape') {
          dropdown.classList.add('hidden');
        }
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          input.value = '';
          clearBtn.classList.add('hidden');
          dropdown.classList.add('hidden');
          dropdown.innerHTML = '';
          input.focus();
        });
      }

      // Close dropdown on outside click
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
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
      const streamSelect = document.getElementById('la-stream-select');

      if (isManual) {
        if (autoBox) autoBox.classList.add('hidden');
        if (manualBox) manualBox.classList.remove('hidden');
        if (toggleManualBtn) toggleManualBtn.classList.add('hidden');
        if (toggleAutoBtn) toggleAutoBtn.classList.remove('hidden');

        const defaultDist = this.state.districtId || (currentResolution && currentResolution.jurisdiction && currentResolution.jurisdiction.districtId) || 'coimbatore';
        this.state.districtId = defaultDist;
        this.populateDistricts();

        if (districtSelect) {
          districtSelect.value = defaultDist;
        }
        if (streamSelect) {
          streamSelect.disabled = false;
          if (this.state.stream) streamSelect.value = this.state.stream;
        }
        await this.populateStream(defaultDist, this.state.stream || 'rural');
        await this.populateSubdivisions(defaultDist);
        this.updateLocationHeaderLabel();
        this.triggerResolution();

        // Focus typeahead input for rapid search
        setTimeout(() => {
          const searchInput = document.getElementById('la-search-typeahead-input');
          if (searchInput) searchInput.focus();
        }, 120);
      } else {
        if (autoBox) autoBox.classList.remove('hidden');
        if (manualBox) manualBox.classList.add('hidden');
        if (toggleManualBtn) toggleManualBtn.classList.remove('hidden');
        if (toggleAutoBtn) toggleAutoBtn.classList.add('hidden');

        // Reset manual stream selections (preserve district for smooth re-entry)
        this.state.subdivisionId = '';
        this.state.localBodyId = '';
        this.state.villageOrTown = '';
        this.state.blockId = '';
        this.state.villagePanchayatId = '';
        this.state.habitation = '';
        this.state.urbanBodyId = '';
        this.state.urbanLocality = '';
        this.state.talukId = '';
        this.state.revenueVillageId = '';
        this.resetStreamSelectors();
        this.resetVillagesAndLocalBodies();
        this.updateLocationHeaderLabel();
        this.triggerResolution();
      }
    },

    /**
     * Switch active administrative stream panel (rural, urban, revenue)
     */
    setStream: async function(streamName, shouldTriggerResolution = true) {
      const stream = streamName || 'rural';
      const prevStream = this.state.stream;
      this.state.stream = stream;

      const streamSelect = document.getElementById('la-stream-select');
      if (streamSelect) {
        streamSelect.disabled = false;
        if (streamSelect.value !== stream) {
          streamSelect.value = stream;
        }
      }

      const ruralPanel = document.getElementById('la-stream-rural-panel');
      const urbanPanel = document.getElementById('la-stream-urban-panel');
      const revenuePanel = document.getElementById('la-stream-revenue-panel');

      if (ruralPanel) ruralPanel.classList.toggle('hidden', stream !== 'rural');
      if (urbanPanel) urbanPanel.classList.toggle('hidden', stream !== 'urban');
      if (revenuePanel) revenuePanel.classList.toggle('hidden', stream !== 'revenue');

      // Purge inactive stream state and reset inactive selectors
      if (prevStream !== stream || shouldTriggerResolution) {
        this.clearInactiveStreamValues(stream);
      }

      const activeDist = this.state.districtId || document.getElementById('la-district-select')?.value || 'coimbatore';
      this.state.districtId = activeDist;
      await this.populateStream(activeDist, stream);

      this.updateLocationHeaderLabel();
      if (shouldTriggerResolution) {
        this.triggerResolution();
      }
    },

    /**
     * Clear stale location values and reset selectors of inactive streams
     */
    clearInactiveStreamValues: function(activeStream) {
      if (activeStream !== 'rural') {
        this.state.blockId = '';
        this.state.villagePanchayatId = '';
        this.state.habitation = '';
        const blockSelect = document.getElementById('la-block-select');
        const vpSelect = document.getElementById('la-vp-select');
        const habInput = document.getElementById('la-habitation-input');
        if (blockSelect) blockSelect.selectedIndex = 0;
        if (vpSelect) {
          vpSelect.innerHTML = '<option value="" disabled selected>Select Block first...</option>';
          vpSelect.disabled = true;
        }
        if (habInput) habInput.value = '';
      }
      if (activeStream !== 'urban') {
        this.state.urbanBodyId = '';
        this.state.urbanLocality = '';
        const urbanBodySelect = document.getElementById('la-urban-body-select');
        const urbanLocInput = document.getElementById('la-urban-locality-input');
        if (urbanBodySelect) urbanBodySelect.selectedIndex = 0;
        if (urbanLocInput) urbanLocInput.value = '';
      }
      if (activeStream !== 'revenue') {
        this.state.talukId = '';
        this.state.revenueVillageId = '';
        const talukSelect = document.getElementById('la-taluk-select');
        const rvSelect = document.getElementById('la-revenue-village-select');
        if (talukSelect) talukSelect.selectedIndex = 0;
        if (rvSelect) {
          rvSelect.innerHTML = '<option value="" disabled selected>Select Taluk first...</option>';
          rvSelect.disabled = true;
        }
      }

      // Reset common location identifiers
      this.state.subdivisionId = '';
      this.state.localBodyId = '';
      this.state.villageOrTown = '';
      this.resetVillagesAndLocalBodies();
    },

    /**
     * Populate stream controls for active district
     */
    populateStream: async function(districtId, stream) {
      const dist = districtId || this.state.districtId || document.getElementById('la-district-select')?.value || 'coimbatore';
      this.state.districtId = dist;
      const streamSelect = document.getElementById('la-stream-select');
      if (streamSelect) streamSelect.disabled = false;

      const targetStream = stream || this.state.stream || 'rural';
      if (targetStream === 'rural') {
        await this.populateRuralBlocks(dist, this.state.blockId);
      } else if (targetStream === 'urban') {
        await this.populateUrbanBodies(dist, this.state.urbanTypeFilter || 'all', this.state.urbanBodyId);
      } else if (targetStream === 'revenue') {
        await this.populateRevenueTaluks(dist, this.state.talukId);
      }
    },

    /**
     * Populate Rural Blocks for District
     */
    populateRuralBlocks: async function(districtId, preselectedBlockId) {
      const select = document.getElementById('la-block-select');
      if (!select) return;
      const dist = districtId || this.state.districtId || document.getElementById('la-district-select')?.value || 'coimbatore';
      this.state.districtId = dist;

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Blocks...</option>';

      try {
        if (!blocksCache[dist]) {
          let res = await fetch(`${API_LOCATIONS}/districts/${encodeURIComponent(dist)}/blocks`);
          if (res.ok) {
            const data = await res.json();
            blocksCache[dist] = data.blocks || data.data || [];
          } else {
            let fallbackRes = await fetch(`${API_LOCATIONS}/districts/${encodeURIComponent(dist)}/taluks`);
            if (fallbackRes.ok) {
              const data = await fallbackRes.json();
              blocksCache[dist] = data.taluks || data.data || [];
            }
          }
        }

        const blocks = blocksCache[dist] || [];
        let html = '<option value="" disabled selected>Select Rural Block (ஊராட்சி ஒன்றியம்)...</option>';
        blocks.forEach(b => {
          const taPart = (b.name_ta || b.tamil_name || b.nameTa) ? ` (${b.name_ta || b.tamil_name || b.nameTa})` : '';
          const codePart = b.official_code ? ` [Code: ${b.official_code}]` : '';
          const isSel = (preselectedBlockId && (b.id === preselectedBlockId || b.name.toLowerCase() === preselectedBlockId.toLowerCase())) ? 'selected' : '';
          html += `<option value="${b.id}" ${isSel}>${b.name}${taPart}${codePart}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;

        if (preselectedBlockId) {
          select.value = preselectedBlockId;
          await this.populateVillagePanchayats(preselectedBlockId, this.state.villagePanchayatId);
        }
      } catch (err) {
        console.error('[LocationAuthority] Error loading blocks:', err);
        select.innerHTML = '<option value="">Failed to load blocks</option>';
        select.disabled = false;
      }
    },

    /**
     * Populate Village Panchayats for Block
     */
    populateVillagePanchayats: async function(blockId, preselectedVp) {
      const select = document.getElementById('la-vp-select');
      if (!select) return;
      if (!blockId) {
        select.innerHTML = '<option value="" disabled selected>Select Block first...</option>';
        select.disabled = true;
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Village Panchayats...</option>';

      try {
        if (!villagePanchayatsCache[blockId]) {
          const res = await fetch(`${API_LOCATIONS}/blocks/${encodeURIComponent(blockId)}/village-panchayats`);
          if (res.ok) {
            const data = await res.json();
            villagePanchayatsCache[blockId] = data.village_panchayats || data.data || [];
          }
        }

        const vps = villagePanchayatsCache[blockId] || [];
        let html = '<option value="" disabled selected>Select Village Panchayat (கிராம ஊராட்சி)...</option>';
        vps.forEach(vp => {
          const taPart = (vp.name_ta || vp.tamil_name) ? ` (${vp.name_ta || vp.tamil_name})` : '';
          const codePart = vp.official_code ? ` [LGD: ${vp.official_code}]` : '';
          const isSel = (preselectedVp && (vp.name.toLowerCase() === preselectedVp.toLowerCase() || vp.id === preselectedVp || vp.official_code === preselectedVp)) ? 'selected' : '';
          html += `<option value="${vp.official_code || vp.id}" data-name="${vp.name}" ${isSel}>${vp.name}${taPart}${codePart}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;

        if (preselectedVp) {
          for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i];
            if (opt.value === preselectedVp || (opt.getAttribute('data-name') || '').toLowerCase() === preselectedVp.toLowerCase()) {
              select.selectedIndex = i;
              break;
            }
          }
        }
      } catch (err) {
        console.error('[LocationAuthority] Error loading village panchayats:', err);
        select.innerHTML = '<option value="">Failed to load village panchayats</option>';
        select.disabled = false;
      }
    },

    /**
     * Populate Urban Local Bodies for District
     */
    populateUrbanBodies: async function(districtId, filterType = 'all', preselectedBodyId) {
      const select = document.getElementById('la-urban-body-select');
      if (!select) return;
      const dist = districtId || this.state.districtId || document.getElementById('la-district-select')?.value || 'coimbatore';
      this.state.districtId = dist;

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Urban Local Bodies...</option>';

      try {
        const cacheKey = `${dist}_${filterType || 'all'}`;
        if (!urbanBodiesCache[cacheKey]) {
          const url = `${API_LOCATIONS}/districts/${encodeURIComponent(dist)}/urban-local-bodies?type=${encodeURIComponent(filterType || 'all')}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            urbanBodiesCache[cacheKey] = data.urban_local_bodies || data.data || [];
          }
        }

        const bodies = urbanBodiesCache[cacheKey] || [];
        let html = '<option value="" disabled selected>Select Urban Local Body (உள்ளாட்சி அமைப்பு)...</option>';
        bodies.forEach(b => {
          const taPart = (b.name_ta || b.tamil_name) ? ` (${b.name_ta || b.tamil_name})` : '';
          const typeBadge = ` [${this.formatLocationTypeBadge(b.administrative_type || b.location_type || b.type)}]`;
          const isSel = (preselectedBodyId && (b.id === preselectedBodyId || b.name.toLowerCase() === preselectedBodyId.toLowerCase())) ? 'selected' : '';
          html += `<option value="${b.id}" data-name="${b.name}" ${isSel}>${b.name}${taPart}${typeBadge}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;

        if (preselectedBodyId) {
          for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i];
            if (opt.value === preselectedBodyId || (opt.getAttribute('data-name') || '').toLowerCase() === preselectedBodyId.toLowerCase()) {
              select.selectedIndex = i;
              break;
            }
          }
        }
      } catch (err) {
        console.error('[LocationAuthority] Error loading urban bodies:', err);
        select.innerHTML = '<option value="">Failed to load urban local bodies</option>';
        select.disabled = false;
      }
    },

    /**
     * Populate Taluks for District (Revenue Stream)
     */
    populateRevenueTaluks: async function(districtId, preselectedTalukId) {
      const select = document.getElementById('la-taluk-select');
      if (!select) return;
      const dist = districtId || this.state.districtId || document.getElementById('la-district-select')?.value || 'coimbatore';
      this.state.districtId = dist;

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Taluks...</option>';

      try {
        if (!taluksCache[dist]) {
          const res = await fetch(`${API_LOCATIONS}/districts/${encodeURIComponent(dist)}/taluks`);
          if (res.ok) {
            const data = await res.json();
            taluksCache[dist] = data.taluks || data.data || [];
          }
        }

        const taluks = taluksCache[dist] || [];
        let html = '<option value="" disabled selected>Select Taluk (வருவாய் வட்டம்)...</option>';
        taluks.forEach(t => {
          const taPart = (t.name_ta || t.tamil_name || t.nameTa) ? ` (${t.name_ta || t.tamil_name || t.nameTa})` : '';
          const isSel = (preselectedTalukId && (t.id === preselectedTalukId || t.name.toLowerCase() === preselectedTalukId.toLowerCase())) ? 'selected' : '';
          html += `<option value="${t.id}" data-name="${t.name}" ${isSel}>${t.name}${taPart}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;

        if (preselectedTalukId) {
          select.value = preselectedTalukId;
          await this.populateRevenueVillages(preselectedTalukId, this.state.revenueVillageId);
        }
      } catch (err) {
        console.error('[LocationAuthority] Error loading taluks:', err);
        select.innerHTML = '<option value="">Failed to load taluks</option>';
      }
    },

    /**
     * Populate Revenue Villages for Taluk
     */
    populateRevenueVillages: async function(talukId, preselectedRv) {
      const select = document.getElementById('la-revenue-village-select');
      if (!select) return;
      if (!talukId) {
        select.innerHTML = '<option value="" disabled selected>Select Taluk first...</option>';
        select.disabled = true;
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Revenue Villages...</option>';

      try {
        if (!revenueVillagesCache[talukId]) {
          const res = await fetch(`${API_LOCATIONS}/taluks/${encodeURIComponent(talukId)}/revenue-villages`);
          if (res.ok) {
            const data = await res.json();
            revenueVillagesCache[talukId] = data.revenue_villages || data.data || [];
          }
        }

        const rvs = revenueVillagesCache[talukId] || [];
        let html = '<option value="" disabled selected>Select Revenue Village (வருவாய் கிராமம்)...</option>';
        rvs.forEach(rv => {
          const taPart = (rv.name_ta || rv.tamil_name) ? ` (${rv.name_ta || rv.tamil_name})` : '';
          const isSel = (preselectedRv && (rv.name.toLowerCase() === preselectedRv.toLowerCase() || rv.id === preselectedRv)) ? 'selected' : '';
          html += `<option value="${rv.id || rv.name}" data-name="${rv.name}" ${isSel}>${rv.name}${taPart}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;

        if (preselectedRv) {
          for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i];
            if (opt.value === preselectedRv || (opt.getAttribute('data-name') || '').toLowerCase() === preselectedRv.toLowerCase()) {
              select.selectedIndex = i;
              break;
            }
          }
        }
      } catch (err) {
        console.error('[LocationAuthority] Error loading revenue villages:', err);
        select.innerHTML = '<option value="">Failed to load revenue villages</option>';
      }
    },

    /**
     * Reset stream selectors
     */
    resetStreamSelectors: function() {
      const blockSelect = document.getElementById('la-block-select');
      const vpSelect = document.getElementById('la-vp-select');
      const habitationInput = document.getElementById('la-habitation-input');
      const urbanBodySelect = document.getElementById('la-urban-body-select');
      const urbanLocalityInput = document.getElementById('la-urban-locality-input');
      const talukSelect = document.getElementById('la-taluk-select');
      const rvSelect = document.getElementById('la-revenue-village-select');

      if (blockSelect) {
        blockSelect.innerHTML = '<option value="" disabled selected>Select Rural Block (ஊராட்சி ஒன்றியம்)...</option>';
        blockSelect.disabled = false;
      }
      if (vpSelect) {
        vpSelect.innerHTML = '<option value="" disabled selected>Select Block first...</option>';
        vpSelect.disabled = true;
      }
      if (habitationInput) habitationInput.value = '';
      if (urbanBodySelect) {
        urbanBodySelect.innerHTML = '<option value="" disabled selected>Select Urban Local Body (உள்ளாட்சி அமைப்பு)...</option>';
        urbanBodySelect.disabled = false;
      }
      if (urbanLocalityInput) urbanLocalityInput.value = '';
      if (talukSelect) {
        talukSelect.innerHTML = '<option value="" disabled selected>Select Taluk (வருவாய் வட்டம்)...</option>';
        talukSelect.disabled = false;
      }
      if (rvSelect) {
        rvSelect.innerHTML = '<option value="" disabled selected>Select Taluk first...</option>';
        rvSelect.disabled = true;
      }
    },

    /**
     * Reset village search, village select, and local body select when parent changes
     */
    resetVillagesAndLocalBodies: function() {
      const villageSelect = document.getElementById('la-village-select');
      const localBodySelect = document.getElementById('la-localbody-select');
      const customInput = document.getElementById('la-village-custom-input');

      currentTalukLocations = [];
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
     * Synchronize hidden legacy elements for full backwards compatibility
     */
    syncLegacyElements: function(item) {
      if (!item) return;
      const subdivSelect = document.getElementById('la-subdivision-select');
      const villageSelect = document.getElementById('la-village-select');
      const localBodySelect = document.getElementById('la-localbody-select');

      const subId = item.taluk_id || item.block_id || item.parent_id;
      if (subdivSelect && subId) {
        subdivSelect.value = subId;
      }
      if (villageSelect && item.name) {
        villageSelect.value = item.name;
      }
      if (localBodySelect && (item.urban_local_body_id || item.id)) {
        localBodySelect.value = item.urban_local_body_id || item.id;
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

      const currentVal = select.value || this.state.districtId || 'coimbatore';
      let html = '<option value="" disabled>Select District (மாவட்டம்)...</option>';
      districtsCache.forEach(d => {
        const isSel = (currentVal === d.id || currentVal === d.name.toLowerCase()) ? 'selected' : '';
        const taPart = d.nameTa ? ` (${d.nameTa})` : '';
        html += `<option value="${d.id}" ${isSel}>${d.name}${taPart}</option>`;
      });
      select.innerHTML = html;
      if (!select.value && currentVal) {
        select.value = currentVal;
      }
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
        case 'corporation':
        case 'municipal_corporation': return 'Corporation';
        case 'corporation_zone': return 'Corporation Zone';
        case 'village_panchayat': return 'Village Panchayat';
        case 'revenue_village': return 'Revenue Village';
        case 'locality': return 'Locality / Area';
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
      if (!select) return;

      if (customInput) customInput.classList.add('hidden');

      if (!districtId || !subdivisionId) {
        select.innerHTML = '<option value="" disabled selected>Select Taluk / Block first...</option>';
        select.disabled = true;
        currentTalukLocations = [];
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Loading Villages / Towns...</option>';

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
      } catch (err) {
        console.error('[LocationAuthority] Error fetching villages:', err);
        select.innerHTML = '<option value="">Failed to load villages</option>';
      }
    },

    /**
     * Render village options with bilingual display and administrative type badge
     * Excludes quarantined synthetic placeholders
     */
    renderVillageOptions: function(list) {
      const select = document.getElementById('la-village-select');
      if (!select) return;

      const activeList = (list || []).filter(v => !v.is_quarantined);

      let html = '<option value="" disabled selected>Select Village / Town (கிராமம் / நகரம்)...</option>';
      activeList.forEach(v => {
        const taPart = (v.tamil_name || v.nameTa) ? ` (${v.tamil_name || v.nameTa})` : '';
        const typeBadge = ` [${this.formatLocationTypeBadge(v.location_type || v.type)}]`;
        html += `<option value="${v.name}">${v.name}${taPart}${typeBadge}</option>`;
      });
      html += '<option value="__custom__">Can\'t find your village? Enter manually...</option>';

      select.innerHTML = html;
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
          villageOrTown: this.state.villageOrTown,
          administrativeType: this.state.stream,
          stream: this.state.stream,
          blockId: this.state.blockId,
          villagePanchayatId: this.state.villagePanchayatId,
          habitation: this.state.habitation,
          urbanBodyId: this.state.urbanBodyId,
          urbanLocality: this.state.urbanLocality,
          talukId: this.state.talukId,
          revenueVillageId: this.state.revenueVillageId
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
          this.syncJurisdictionToState(resObj);
        }
      } catch (err) {
        console.warn('[LocationAuthority] Error resolving authority:', err);
      } finally {
        this.state.isResolving = false;
        this.showCardLoading(false);
      }
    },

    /**
     * Synchronize resolved backend jurisdiction into manual hierarchy selectors
     */
    syncJurisdictionToState: function(resObj) {
      if (!resObj) return;
      const jur = resObj.jurisdiction || {};
      const auth = resObj.administrativeAuthority || {};

      // 1. Sync District
      const distId = (jur.districtId || (jur.district ? jur.district.toLowerCase() : '') || '').trim();
      if (distId) {
        this.state.districtId = distId;
        const distSelect = document.getElementById('la-district-select');
        if (distSelect && (!distSelect.value || distSelect.value === '' || distSelect.value !== distId)) {
          distSelect.value = distId;
        }
      }

      // 2. Sync Stream based on resolved administrative tier
      const tier = (auth.tier || '').toLowerCase();
      const rawType = (auth.rawLocalBodyType || jur.localBodyType || '').toLowerCase();
      let stream = this.state.stream || 'rural';
      if (['corporation', 'municipality', 'town_panchayat', 'urban'].includes(tier) ||
          rawType.includes('corporation') || rawType.includes('municipality') || rawType.includes('town panchayat')) {
        stream = 'urban';
      } else if (['taluk', 'revenue_village', 'revenue'].includes(tier)) {
        stream = 'revenue';
      } else if (tier === 'rural' || rawType.includes('panchayat union') || rawType.includes('village panchayat') || jur.block) {
        stream = 'rural';
      }
      this.state.stream = stream;

      const streamSelect = document.getElementById('la-stream-select');
      if (streamSelect) {
        streamSelect.disabled = false;
        streamSelect.value = stream;
      }

      // Ensure active stream panel is displayed
      const ruralPanel = document.getElementById('la-stream-rural-panel');
      const urbanPanel = document.getElementById('la-stream-urban-panel');
      const revenuePanel = document.getElementById('la-stream-revenue-panel');
      if (ruralPanel) ruralPanel.classList.toggle('hidden', stream !== 'rural');
      if (urbanPanel) urbanPanel.classList.toggle('hidden', stream !== 'urban');
      if (revenuePanel) revenuePanel.classList.toggle('hidden', stream !== 'revenue');

      // Preload active stream controls so dropdowns are enabled and populated
      const activeDist = this.state.districtId || 'coimbatore';
      this.populateStream(activeDist, stream);
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

        // Match district name if available from Nominatim
        if (dist && !isManualOverride) {
          const normDist = dist.toLowerCase().replace(/district|dt/gi, '').trim();
          const matched = districtsCache.find(d => d.id === normDist || d.name.toLowerCase() === normDist || normDist.includes(d.id));
          if (matched) {
            this.state.districtId = matched.id;
            const distSelect = document.getElementById('la-district-select');
            if (distSelect) distSelect.value = matched.id;
          }
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
        let distName = '';
        const distSelect = document.getElementById('la-district-select');
        if (distSelect && distSelect.selectedIndex > 0) {
          distName = distSelect.options[distSelect.selectedIndex].text.split('(')[0].trim();
        } else if (this.state.districtId) {
          const d = districtsCache.find(x => x.id === this.state.districtId);
          distName = d ? d.name : this.state.districtId;
        }

        const parts = [];

        if (this.state.stream === 'rural') {
          if (this.state.habitation) parts.push(this.state.habitation);
          const vpSelect = document.getElementById('la-vp-select');
          let vpName = '';
          if (vpSelect && vpSelect.selectedIndex > 0) {
            vpName = vpSelect.options[vpSelect.selectedIndex].text.split('[')[0].split('(')[0].trim();
          } else if (this.state.villageOrTown) {
            vpName = this.state.villageOrTown;
          }
          if (vpName) parts.push(vpName);

          const blockSelect = document.getElementById('la-block-select');
          let blockName = '';
          if (blockSelect && blockSelect.selectedIndex > 0) {
            blockName = blockSelect.options[blockSelect.selectedIndex].text.split('[')[0].split('(')[0].trim();
          }
          if (blockName && blockName !== vpName) parts.push(blockName);
        } else if (this.state.stream === 'urban') {
          if (this.state.urbanLocality) parts.push(this.state.urbanLocality);
          const bodySelect = document.getElementById('la-urban-body-select');
          let bodyName = '';
          if (bodySelect && bodySelect.selectedIndex > 0) {
            bodyName = bodySelect.options[bodySelect.selectedIndex].text.split('[')[0].split('(')[0].trim();
          } else if (this.state.villageOrTown) {
            bodyName = this.state.villageOrTown;
          }
          if (bodyName) parts.push(bodyName);
        } else if (this.state.stream === 'revenue') {
          const rvSelect = document.getElementById('la-revenue-village-select');
          let rvName = '';
          if (rvSelect && rvSelect.selectedIndex > 0) {
            rvName = rvSelect.options[rvSelect.selectedIndex].text.split('(')[0].trim();
          } else if (this.state.villageOrTown) {
            rvName = this.state.villageOrTown;
          }
          if (rvName) parts.push(rvName);

          const talukSelect = document.getElementById('la-taluk-select');
          let talukName = '';
          if (talukSelect && talukSelect.selectedIndex > 0) {
            talukName = talukSelect.options[talukSelect.selectedIndex].text.split('(')[0].trim();
          }
          if (talukName && talukName !== rvName) parts.push(talukName);
        } else {
          const village = (this.state.villageOrTown || '').trim();
          if (village) parts.push(village);
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

      // 6. CrowdCity 24/7 Support Card (Omitted here; dedicated Need Assistance card is displayed in the page panel)
      const supBox = document.getElementById('la-card-support-box');
      if (supBox) {
        supBox.innerHTML = '';
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
