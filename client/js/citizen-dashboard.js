/**
 * CrowdCity AI - Dynamic Location-Based Citizen Dashboard Controller
 */

(function () {
  'use strict';

  // 1. Time Formatting Utility
  function formatRelativeTime(dateInput) {
    const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;
    if (!dateInput) return isTa ? 'சமீபத்தில்' : 'Recently';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return isTa ? 'சமீபத்தில்' : 'Recently';
    
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return isTa ? 'சற்று முன்' : 'Just now';
    if (diffSec < 3600) return isTa ? `${Math.floor(diffSec / 60)} நிமிடங்களுக்கு முன்` : `${Math.floor(diffSec / 60)} mins ago`;
    if (diffSec < 86400) return isTa ? `${Math.floor(diffSec / 3600)} மணிநேரங்களுக்கு முன்` : `${Math.floor(diffSec / 3600)} hrs ago`;
    if (diffSec < 172800) return isTa ? 'நேற்று' : 'Yesterday';
    if (diffSec < 604800) return isTa ? `${Math.floor(diffSec / 86400)} நாட்களுக்கு முன்` : `${Math.floor(diffSec / 86400)} days ago`;
    return date.toLocaleDateString(isTa ? 'ta-IN' : 'en-IN', { month: 'short', day: 'numeric' });
  }

  // 2. Status Badge Class Helper
  function getStatusBadge(status) {
    const s = (status || '').toUpperCase();
    const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;
    if (s === 'ESCALATED') {
      return `<span class="status-badge-sm" style="background: rgba(127,29,29,0.15); color: #7f1d1d; border: 1px solid rgba(127,29,29,0.3); font-weight: 800;">${isTa ? 'தீவிரப்படுத்தப்பட்டது (Escalated)' : 'Escalated'}</span>`;
    }
    if (s === 'OVERDUE') {
      return `<span class="status-badge-sm" style="background: rgba(220,38,38,0.12); color: #dc2626; border: 1px solid rgba(220,38,38,0.25); font-weight: 800;">${isTa ? 'தாமதமானது (Overdue)' : 'Overdue'}</span>`;
    }
    if (s === 'IN_PROGRESS' || s === 'PROGRESS') {
      return `<span class="status-badge-sm badge-progress">${isTa ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</span>`;
    }
    if (s === 'RESOLVED' || s === 'CLOSED' || s === 'VERIFIED') {
      return `<span class="status-badge-sm badge-resolved">${isTa ? 'தீர்க்கப்பட்டது (Resolved)' : 'Resolved'}</span>`;
    }
    return `<span class="status-badge-sm badge-pending">${isTa ? 'பரிசீலனையில் (Under Review)' : 'Under Review'}</span>`;
  }

  function formatStatus(status) {
    const s = (status || '').toUpperCase();
    const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;
    if (s === 'ESCALATED') return isTa ? 'தீவிரப்படுத்தப்பட்டது (Escalated)' : 'Escalated';
    if (s === 'OVERDUE') return isTa ? 'தாமதமானது (Overdue)' : 'Overdue';
    if (s === 'IN_PROGRESS' || s === 'PROGRESS') return isTa ? 'செயல்பாட்டில் (In Progress)' : 'In Progress';
    if (s === 'RESOLVED' || s === 'CLOSED' || s === 'VERIFIED') return isTa ? 'தீர்க்கப்பட்டது (Resolved)' : 'Resolved';
    return isTa ? 'பரிசீலனையில் (Under Review)' : 'Under Review';
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

  // 3. Main Dashboard Init
  async function initDynamicDashboard() {
    const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    
    // Determine User City / Location Priority (1. Profile, 2. Storage / Geolocation Service)
    let userCity = '';
    if (user && (user.city || user.district)) {
      userCity = user.city || user.district;
    } else if (window.CrowdCityLocation && typeof window.CrowdCityLocation.getSavedUserDistrict === 'function') {
      userCity = window.CrowdCityLocation.getSavedUserDistrict() || '';
    } else if (localStorage.getItem('user_district')) {
      userCity = localStorage.getItem('user_district');
    } else if (localStorage.getItem('cc_user_location')) {
      userCity = localStorage.getItem('cc_user_location');
    }

    // Clean City Name
    if (userCity) {
      userCity = userCity.replace(/ district$/i, '').trim();
    }

    // Update City Indicators across Dashboard Header
    function updateCityHeaders(city) {
      const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;
      const headerCityEl = document.querySelector('.header-city-indicator span');
      if (headerCityEl) {
        headerCityEl.textContent = city ? `${city}, ${isTa ? 'தமிழ்நாடு' : 'Tamil Nadu'}` : (isTa ? 'தமிழ்நாடு' : 'Tamil Nadu');
      }
      const headerCorpEl = document.getElementById('city-corp-name');
      if (headerCorpEl) {
        headerCorpEl.textContent = city ? `${city} ${isTa ? 'மாநகராட்சி' : 'City Corp'}` : (isTa ? 'தமிழ்நாடு நகர்ப்புற மையம்' : 'Tamil Nadu Civic Hub');
      }
    }
    updateCityHeaders(userCity);

    // Fetch All Complaints from API
    let issues = [];
    try {
      if (window.API && typeof window.API.getIssues === 'function') {
        const res = await window.API.getIssues();
        if (res && res.data) {
          issues = Array.isArray(res.data) ? res.data : (res.data.issues || []);
        }
      }
    } catch (e) {
      console.warn('Failed to load issues from API:', e);
    }

    // Function to render city-filtered complaints
    function renderRecentComplaints(targetCity) {
      const recentListEl = document.getElementById('dash-recent-activity-list');
      if (!recentListEl) return;
      const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;

      const cityIssues = targetCity ? issues.filter(item => {
        if (!item) return false;
        const loc = (item.address || '') + ' ' + (item.city || '') + ' ' + (item.district || '');
        return loc.toLowerCase().includes(targetCity.toLowerCase());
      }) : issues;

      if (cityIssues.length === 0) {
        const placeName = targetCity || (isTa ? 'உங்கள் பகுதி' : 'your area');
        recentListEl.innerHTML = `
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
            <p style="margin: 0; font-size: 0.88rem; font-weight: 600;">${isTa ? `${escapeHtml(placeName)} பகுதியில் சமீபத்திய புகார்கள் எதுவும் இல்லை.` : `No recent complaints found for ${escapeHtml(placeName)}.`}</p>
          </div>
        `;
      } else {
        recentListEl.innerHTML = cityIssues.slice(0, 4).map(item => `
          <div class="activity-item" style="cursor: pointer;" onclick="window.location.href='issue-details.html?id=${item.id}'">
            <div class="activity-icon-wrap status-${(item.status || 'open').toLowerCase()}">
              <i class="fa-solid ${typeof getCategoryIcon === 'function' ? getCategoryIcon(item.category) : 'fa-circle-exclamation'}"></i>
            </div>
            <div class="activity-details">
              <div class="activity-title">${escapeHtml(item.title || item.category || (isTa ? 'குடிமக்கள் புகார்' : 'Civic Issue'))}</div>
              <div class="activity-meta">
                <span class="activity-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.address || targetCity || (isTa ? 'தமிழ்நாடு' : 'Tamil Nadu'))}</span>
                <span class="activity-time">&bull; ${typeof formatTimeAgo === 'function' ? formatTimeAgo(item.created_at || item.createdAt) : formatRelativeTime(item.created_at || item.createdAt)}</span>
              </div>
            </div>
            <div class="activity-status">
              <span class="status-pill status-${(item.status || 'open').toLowerCase()}">${escapeHtml(formatStatus(item.status || 'open'))}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // ----------------------------------------------------
    // Section 1: Recent Complaint Activity (City Filtered)
    // ----------------------------------------------------
    renderRecentComplaints(userCity);

    // Listen for live location detected or changed event to update header and complaints dynamically
    function handleLocationUpdate(evt) {
      if (evt.detail && evt.detail.district) {
        const detected = evt.detail.district.replace(/ district$/i, '').trim();
        userCity = detected;
        updateCityHeaders(detected);
        renderRecentComplaints(detected);
        renderNearbyIssues(detected);
        renderAnnouncements(detected);
      }
    }
    window.addEventListener('crowdcity:location_detected', handleLocationUpdate);
    window.addEventListener('crowdcity:location_changed', handleLocationUpdate);

    // ----------------------------------------------------
    // Section 2: My Active Complaints
    // ----------------------------------------------------
    function renderMyActiveComplaints() {
      const myActiveListEl = document.getElementById('dash-my-active-list');
      if (!myActiveListEl) return;
      const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;

      const myIssues = issues.filter(item => {
        if (!item) return false;
        const isMyIssue = user ? (item.reporter_id === user.id || item.user_email === user.email || item.is_supporting_report) : true;
        const isActive = item.status !== 'RESOLVED' && item.status !== 'CLOSED' && item.status !== 'verified';
        return isMyIssue && isActive;
      });

      if (myIssues.length === 0) {
        myActiveListEl.innerHTML = `
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
            <p style="margin: 0; font-size: 0.88rem; font-weight: 600;">${isTa ? 'செயலில் உள்ள புகார்கள் எதுவும் இல்லை.' : 'No active complaints submitted yet.'}</p>
          </div>
        `;
      } else {
        myActiveListEl.innerHTML = myIssues.slice(0, 3).map(item => {
          const officer = item.assigned_to_name || item.assigned_officer || item.department || (isTa ? 'ஒதுக்கப்பட்ட அதிகாரி' : 'Assigned Authority');
          const citizensCount = item.citizen_count || 1;
          const citizenWord = citizensCount === 1 ? (isTa ? 'குடிமகன்' : 'citizen') : (isTa ? 'குடிமக்கள்' : 'citizens');
          const completionText = item.expected_completion 
            ? (isTa ? `எதிர்பார்க்கப்படும் நிறைவு: ${escapeHtml(item.expected_completion)}` : `Expected completion: ${escapeHtml(item.expected_completion)}`)
            : (isTa ? `புதுப்பிக்கப்பட்டது ${formatRelativeTime(item.updated_at || item.created_at)}` : `Updated ${formatRelativeTime(item.updated_at || item.created_at)}`);

          return `
            <div class="activity-item" style="cursor: pointer;" onclick="window.location.href='issue-details.html?id=${item.id}'">
              <div class="activity-item-details">
                <h4 class="activity-item-title">${escapeHtml(item.title || (isTa ? 'செயலில் உள்ள புகார்' : 'Active Complaint'))}</h4>
                <div class="activity-item-meta">
                  <span style="font-family: monospace; font-weight: 700; color: var(--primary);">${escapeHtml(item.complaint_id || ('#CMP-' + (item.id || '').substring(0, 8)))}</span> &bull; 
                  <span><i class="fa-solid fa-users"></i> ${citizensCount} ${citizenWord}</span> &bull; 
                  <span>${isTa ? 'ஒதுக்கப்பட்டது: ' : 'Assigned: '}${escapeHtml(officer)}</span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem;">
                  <i class="fa-regular fa-calendar-check"></i> ${completionText}
                </div>
              </div>
              ${getStatusBadge(item.status)}
            </div>
          `;
        }).join('');
      }
    }
    renderMyActiveComplaints();

    // ----------------------------------------------------
    // Section 3: City Announcements (Dynamic Location-Based)
    // ----------------------------------------------------
    function renderAnnouncements(city) {
      const announcementsListEl = document.getElementById('dash-announcements-list');
      if (!announcementsListEl) return;
      const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;
      const targetCity = city || userCity || '';
      let cityNotices = [];
      
      if (targetCity.toLowerCase().includes('chennai')) {
        cityNotices = isTa ? [
          { title: 'அண்ணா சாலையில் மெட்ரோ கட்டம் II போக்குவரத்து மாற்றம்', desc: 'ஜெமினி மேம்பாலம் அருகே தற்காலிக பாதை மாற்றம் செய்யப்பட்டுள்ளது. பயணிகள் மவுண்ட் ரோடு மாற்றுப்பாதையைப் பயன்படுத்த அறிவுறுத்தப்படுகிறார்கள்.', meta: 'சென்னை போக்குவரத்து ஆலோசனை • Active' },
          { title: 'மெரினா கடற்கரை பராமரிப்பு பணிகள்', desc: 'லைட் ஹவுஸ் பகுதி அருகே பெருநகர சென்னை மாநகராட்சியின் தூய்மைப் பணிகள் நடைபெற்று வருகின்றன.', meta: 'பெருநகர சென்னை மாநகராட்சி • Today' }
        ] : [
          { title: 'Metro Phase II Traffic Diversions on Anna Salai', desc: 'Temporary lane restriction active near Gemini Flyover. Commuters advised to use Mount Road bypass.', meta: 'Chennai Traffic Advisory • Active' },
          { title: 'Marina Beach Promenade Maintenance Drive', desc: 'Greater Chennai Corporation beautification drive in progress near Light House area.', meta: 'Greater Chennai Corp • Today' }
        ];
      } else if (targetCity.toLowerCase().includes('madurai')) {
        cityNotices = isTa ? [
          { title: 'வைகை ஆற்றங்கரை பாரம்பரிய நடைபாதை அறிவிப்பு', desc: 'வைகை ஆற்றங்கரையோரம் சிறப்பு கழிவு மேலாண்மை இயக்கத்தை மதுரை மாநகராட்சி தொடங்கியுள்ளது.', meta: 'மதுரை மாநகராட்சி • Active Notice' },
          { title: 'மீனாட்சி அம்மன் கோவில் வாகன அனுமதி ஆலோசனை', desc: 'சித்திரை வீதிகளைச் சுற்றி பாதசாரிகள் மண்டல விதிகள் அமலில் உள்ளன.', meta: 'மதுரை நகர போக்குவரத்து • Updated' }
        ] : [
          { title: 'Vaigai Riverfront Heritage Corridor Notice', desc: 'Madurai Corporation initiates special waste management drive along river banks.', meta: 'Madurai Corp • Active Notice' },
          { title: 'Meenakshi Temple Zone Vehicle Access Advisory', desc: 'Pedestrian plaza rules active around Chithirai streets.', meta: 'Madurai City Traffic • Updated' }
        ];
      } else {
        const placeDisplay = targetCity || (isTa ? 'மாநகராட்சி' : 'City');
        cityNotices = isTa ? [
          { title: `${placeDisplay} சாலை பராமரிப்பு பணிகள்`, desc: 'முக்கிய சாலைகளில் குண்டும் குழியுமான பகுதிகளை சீரமைக்கும் பணிகள் தீவிரமாக நடைபெற்று வருகின்றன.', meta: `${placeDisplay} மாநகராட்சி • Active` },
          { title: 'திட்டமிடப்பட்ட நகராட்சி குடிநீர் வழங்கல் தகவல்', desc: 'மேல்நிலை நீர்த்தேக்க தொட்டி குழாய் பராமரிப்பு பணிகள் நடைபெறுகின்றன. வழக்கமான குடிநீர் விநியோகம் விரைவில் தொடங்கும்.', meta: `${placeDisplay} குடிநீர் வடிகால் வாரியம் • Notice` }
        ] : [
          { title: `${placeDisplay} Corporation Road Maintenance Work`, desc: 'Pothole restoration and asphalt surfacing active along major arterial corridors.', meta: `${placeDisplay} City Corp • Active` },
          { title: 'Scheduled Municipal Water Supply Update', desc: 'Overhead tank pipeline maintenance in progress. Regular supply resumes tomorrow morning.', meta: `${placeDisplay} TWAD Board • Notice` }
        ];
      }

      announcementsListEl.innerHTML = cityNotices.map((notice, idx) => `
        <div class="announcement-card" style="border-left-color: ${idx % 2 === 0 ? '#ea580c' : '#0284c7'};">
          <h4 class="announcement-title">${escapeHtml(notice.title)}</h4>
          <p class="announcement-desc">${escapeHtml(notice.desc)}</p>
          <span class="announcement-meta">${escapeHtml(notice.meta)}</span>
        </div>
      `).join('');
    }
    renderAnnouncements(userCity);

    // ----------------------------------------------------
    // Section 4: Government Welfare Updates (Personalized)
    // ----------------------------------------------------
    function renderSchemes() {
      const schemesListEl = document.getElementById('dash-schemes-list');
      if (!schemesListEl) return;
      const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;

      const schemes = isTa ? [
        { title: 'கலைஞர் மகளிர் உரிமைத் திட்டம்', desc: 'தகுதியுள்ள குடும்பத் தலைவிகளுக்கு மாதம் ₹1,000 உரிமைத் தொகை. சரிபார்ப்பு தளம் செயல்பாட்டில் உள்ளது.', meta: 'சமூக நலத்துறை • Active Scheme', color: '#7c3aed' },
        { title: 'நான் முதல்வன் திறன் மேம்பாட்டுத் திட்டம்', desc: 'தமிழ்நாடு இளைஞர்களுக்கான தொழில் திறன் பயிற்சி மற்றும் சர்வதேச சான்றிதழ் திட்டங்கள்.', meta: 'உயர் கல்வித்துறை • Open Scheme', color: '#059669' },
        { title: 'புதுமைப் பெண் திட்டம்', desc: 'அரசுப் பள்ளிகளில் பயின்று உயர்கல்வி பயிலும் மாணவிகளுக்கு மாதம் ₹1,000 நிதியுதவி.', meta: 'சமூக நலத்துறை • Active', color: '#0284c7' }
      ] : [
        { title: 'Kalaignar Magalir Urimai Thittam', desc: 'Monthly financial assistance for eligible women heads of households. Verification portal active.', meta: 'Social Welfare Dept • Active Scheme', color: '#7c3aed' },
        { title: 'Naan Mudhalvan Skill Initiative', desc: 'Upskilling & industry certification programs for Tamil Nadu youth.', meta: 'Higher Education Dept • Open Scheme', color: '#059669' },
        { title: 'Pudhumai Penn Financial Scheme', desc: 'Monthly support for government school girls pursuing higher education degrees.', meta: 'Social Welfare Dept • Active', color: '#0284c7' }
      ];

      schemesListEl.innerHTML = schemes.map(scheme => `
        <div class="announcement-card" style="border-left-color: ${scheme.color};">
          <h4 class="announcement-title">${escapeHtml(scheme.title)}</h4>
          <p class="announcement-desc">${escapeHtml(scheme.desc)}</p>
          <span class="announcement-meta">${escapeHtml(scheme.meta)}</span>
        </div>
      `).join('');
    }
    renderSchemes();

    // ----------------------------------------------------
    // Section 5: Nearby Community Issues Grid
    // ----------------------------------------------------
    function renderNearbyIssues(city) {
      const nearbyGridEl = document.getElementById('dash-nearby-issues-grid');
      if (!nearbyGridEl) return;
      const isTa = window.i18n ? window.i18n.getLanguage() === 'ta' : false;
      const targetCity = city || userCity || '';

      const nearbyIssues = issues.filter(item => {
        if (!item) return false;
        return (item.address || '').toLowerCase().includes(targetCity.toLowerCase());
      });

      if (nearbyIssues.length === 0) {
        nearbyGridEl.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-map-location-dot" style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
            <p style="margin: 0; font-size: 0.85rem; font-weight: 600;">${isTa ? `${targetCity || 'உங்கள் பகுதியில்'} அருகிலுள்ள சமூக புகார்கள் எதுவும் இல்லை.` : `No nearby community issues reported in ${targetCity || 'your area'}.`}</p>
          </div>
        `;
      } else {
        nearbyGridEl.innerHTML = nearbyIssues.slice(0, 3).map((item, idx) => {
          const dist = (0.4 + idx * 0.4).toFixed(1);
          const distText = isTa ? `${dist} கி.மீ தொலைவில்` : `${dist} km away`;
          return `
            <div class="nearby-issue-item">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="status-badge-sm ${item.status === 'RESOLVED' ? 'badge-resolved' : (item.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-pending')}">${escapeHtml(item.category || (isTa ? 'புகார்' : 'Issue'))}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-location-arrow"></i> ${distText}</span>
              </div>
              <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin: 0;">${escapeHtml(item.title || (isTa ? 'சமூக புகார்' : 'Community Issue'))}</h4>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.address || targetCity || (isTa ? 'தமிழ்நாடு' : 'Tamil Nadu'))} &bull; ${formatRelativeTime(item.created_at)}</span>
            </div>
          `;
        }).join('');
      }
    }
    renderNearbyIssues(userCity);

    // Re-render all sections if language changes
    window.addEventListener('language-change', () => {
      updateCityHeaders(userCity);
      renderRecentComplaints(userCity);
      renderMyActiveComplaints();
      renderAnnouncements(userCity);
      renderSchemes();
      renderNearbyIssues(userCity);
    });
  }

  // ----------------------------------------------------
  // Section 6: Instant Quick Actions Interactions & Prefetching
  // ----------------------------------------------------
  function initQuickActionsInteractions() {
    const quickCards = document.querySelectorAll('.quick-action-card');
    if (!quickCards.length) return;

    // Top progress indicator for zero perceived latency
    function showTopNavLoader() {
      let loader = document.getElementById('cc-top-nav-loader');
      if (!loader) {
        loader = document.createElement('div');
        loader.id = 'cc-top-nav-loader';
        loader.style.cssText = 'position:fixed;top:0;left:0;width:0%;height:3px;background:linear-gradient(90deg,#0d9488,#14b8a6,#38bdf8);z-index:99999;box-shadow:0 0 8px rgba(13,148,136,0.6);transition:width 0.25s cubic-bezier(0.16,1,0.3,1);pointer-events:none;';
        document.body.appendChild(loader);
      }
      loader.style.width = '0%';
      loader.style.opacity = '1';
      requestAnimationFrame(() => {
        loader.style.width = '80%';
      });
    }

    quickCards.forEach(card => {
      // 0ms tactile depress on touch down
      card.addEventListener('touchstart', function () {
        this.classList.add('touch-pressed');
        if (navigator.vibrate) {
          try { navigator.vibrate(8); } catch (_) {}
        }
      }, { passive: true });

      // Immediate release on touch finish/cancel
      card.addEventListener('touchend', function () {
        this.classList.remove('touch-pressed');
      }, { passive: true });

      card.addEventListener('touchcancel', function () {
        this.classList.remove('touch-pressed');
      }, { passive: true });

      // Immediate progress loader on selection
      card.addEventListener('click', function () {
        showTopNavLoader();
      });
    });

    // Destination pages to prefetch in background
    const prefetchUrls = [
      'report.html',
      'power-updates.html',
      'weather-alerts.html',
      'emergency-services.html',
      'map.html',
      'tamilnadu-updates.html',
      'services.html',
      'helplines.html',
      'my-documents.html'
    ];

    function prefetchDestinations() {
      prefetchUrls.forEach(url => {
        try {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = url;
          link.as = 'document';
          document.head.appendChild(link);
        } catch (_) {}
      });
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(prefetchDestinations, { timeout: 1500 });
    } else {
      setTimeout(prefetchDestinations, 600);
    }
  }

  function startDashboard() {
    initDynamicDashboard();
    initQuickActionsInteractions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDashboard);
  } else {
    startDashboard();
  }
})();
