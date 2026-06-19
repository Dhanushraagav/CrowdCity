// CrowdCity - Interactive Map View Controller

let map = null;
let markersGroup = null;
let currentIssues = [];
let activeCategory = '';
let activeStatus = '';
let activeSelectedIssue = null;

// Default coordinates (Coimbatore)
const DEFAULT_CENTER = [11.0168, 76.9558];
const DEFAULT_ZOOM = 13;

async function initMapView() {
  initMap();
  setupFilterListeners();
  setupSearchListener();
  await loadAndRenderMapIssues();
  
  // Geolocation auto-centering
  requestBrowserLocation();

  // Start 30-second polling for real-time updates
  setInterval(async () => {
    await loadAndRenderMapIssues();
  }, 30000);
}

// Initialize Leaflet Map
function initMap() {
  const mapElement = document.getElementById('leaflet-map');
  if (!mapElement) return;

  map = L.map('leaflet-map', {
    zoomControl: false
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  markersGroup = L.markerClusterGroup({
    iconCreateFunction: function(cluster) {
      const childCount = cluster.getChildCount();
      let sizeClass = 'small';
      if (childCount >= 10 && childCount < 50) {
        sizeClass = 'medium';
      } else if (childCount >= 50) {
        sizeClass = 'large';
      }
      
      return L.divIcon({
        html: `<div class="custom-cluster-icon ${sizeClass}"><span>${childCount}</span></div>`,
        className: 'marker-cluster-custom',
        iconSize: [40, 40]
      });
    },
    showCoverageOnHover: false,
    maxClusterRadius: 40
  }).addTo(map);
}

// Fetch database records and draw markers
async function loadAndRenderMapIssues() {
  const { data: issues, error } = await window.API.getIssues({
    category: activeCategory,
    status: activeStatus
  });

  if (error || !issues) {
    console.error("Failed to load map issues:", error);
    return;
  }

  currentIssues = issues;
  renderMapLayer(issues);
}

// Draw markers on map
function renderMapMarkers(issues) {
  if (!map || !markersGroup) return;
  markersGroup.clearLayers();

  issues.forEach(issue => {
    const markerHtml = `
      <div class="custom-map-marker ${issue.category}" style="
        width: 32px; 
        height: 32px; 
        border-radius: 50%; 
        border: 2px solid white; 
        box-shadow: var(--shadow-md); 
        background-color: var(--color-${issue.category}); 
        display: flex; 
        align-items: center; 
        justify-content: center;
        color: white;
      ">
        <i class="${getCategoryIconClass(issue.category)}" style="font-size: 0.85rem;"></i>
      </div>
    `;

    const customIcon = L.divIcon({
      html: markerHtml,
      className: 'div-icon-container',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([issue.latitude, issue.longitude], { icon: customIcon });
    
    // Bind simple popup
    const popupContent = `
      <div style="font-family: var(--font-heading); font-weight:700; font-size:0.9rem; margin-bottom: 0.25rem;">${escapeHTML(issue.title)}</div>
      <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(issue.address || 'Address')}</div>
    `;
    marker.bindPopup(popupContent, { offset: [0, -10] });

    marker.on('click', () => {
      selectIssueForSummary(issue);
    });

    marker.issueId = issue.id;
    markersGroup.addLayer(marker);
  });
}

// Populate the sidebar summary card when a marker is clicked
function selectIssueForSummary(issue) {
  const container = document.getElementById('map-issue-summary');
  if (!container) return;

  activeSelectedIssue = issue;


  const timeAgo = formatTimeAgo(new Date(issue.created_at));
  const reporterName = issue.reporter?.full_name || 'Anonymous Citizen';
  const upvotedClass = (issue.user_has_upvoted || localStorage.getItem(`voted-${issue.id}`)) ? 'upvoted' : '';

  const imageTag = issue.image_url 
    ? `<div style="width:100%; height:120px; border-radius: var(--radius-sm); overflow:hidden; margin-bottom:0.5rem;">
         <img src="${issue.image_url}" alt="Complaint Photo" style="width:100%; height:100%; object-fit:cover;">
       </div>`
    : '';

  const statusKey = `status_${issue.status}`;
  const statusLabel = window.i18n ? window.i18n.t(statusKey) : issue.status.replace('_', ' ');
  const byAuthorText = window.i18n ? window.i18n.t('by_author', { name: reporterName }) : `By ${reporterName}`;
  const tDetails = window.i18n ? window.i18n.t('details') : 'Details';
  const tGetDirections = window.i18n ? window.i18n.t('get_directions') : 'Get Directions';

  container.innerHTML = `
    <div class="glass-panel" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; border-color: var(--primary-light-alpha); box-shadow: var(--shadow-md); margin-top: 1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="badge badge-category ${issue.category}">${window.formatCategoryName(issue.category)}</span>
        <span class="badge badge-status ${issue.status}">${statusLabel}</span>
      </div>

      ${imageTag}

      <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-main); line-height: 1.3;">${escapeHTML(issue.title)}</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;">${escapeHTML(issue.description)}</p>
      
      <div style="font-size: 0.8rem; color: var(--text-muted); display:flex; align-items:center; gap:0.25rem;">
        <i class="fa-solid fa-location-dot"></i> <span>${escapeHTML(issue.address || 'Location detected. Address unavailable.')}</span>
      </div>

      <div style="border-top:1px solid var(--border-color); padding-top:0.75rem; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted);">
        <span>${escapeHTML(byAuthorText)}</span>
        <span>${timeAgo}</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.25rem;">
        <div style="display:flex; gap:0.5rem;">
          <button class="upvote-action ${upvotedClass}" onclick="toggleMapUpvote('${issue.id}')" id="map-vote-btn-${issue.id}" style="flex:1; justify-content:center; margin: 0;">
            <i class="fa-solid fa-thumbs-up"></i> <span id="map-vote-count-${issue.id}">${issue.upvotes_count || 0}</span> Upvotes
          </button>
          <a href="issue-details.html?id=${issue.id}" class="btn btn-secondary" style="font-size:0.8rem; padding: 0.5rem 1rem; margin: 0; text-align: center; display: inline-flex; align-items: center; justify-content: center;">
            ${tDetails}
          </a>
        </div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}" target="_blank" class="btn btn-primary" style="font-size:0.85rem; padding: 0.5rem 1rem; width:100%; justify-content:center; text-decoration:none; margin: 0; display: inline-flex; align-items: center; gap: 0.35rem;">
          <i class="fa-solid fa-diamond-turn-right"></i> ${tGetDirections}
        </a>
      </div>
    </div>
  `;


  // Centering viewport on select
  map.setView([issue.latitude, issue.longitude], 15, { animate: true, duration: 0.75 });
}

// Direct upvote integration from map summary
async function toggleMapUpvote(id) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    window.showToast("You must be logged in to upvote civic issues.", "warning");
    window.authRouter.redirectToLogin('citizen');
    return;
  }

  const voteBtn = document.getElementById(`map-vote-btn-${id}`);
  const countSpan = document.getElementById(`map-vote-count-${id}`);
  if (!voteBtn || !countSpan) return;

  voteBtn.disabled = true;
  const { data, error } = await window.API.upvoteIssue(id);
  voteBtn.disabled = false;

  if (error) {
    console.error("Upvote action failed:", error);
    return;
  }

  if (data.upvoted !== undefined) {
    if (data.upvoted) {
      voteBtn.classList.add('upvoted');
      localStorage.setItem(`voted-${id}`, 'true');
    } else {
      voteBtn.classList.remove('upvoted');
      localStorage.removeItem(`voted-${id}`);
    }
  }

  if (data.upvotes_count !== undefined) {
    countSpan.textContent = data.upvotes_count;
  }
}

// Request Browser Location to center map
function requestBrowserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (map) map.setView([latitude, longitude], 14);
        
        // Trigger proximity alert check for issues within 500m
        checkNearbyProximityAlert(latitude, longitude, currentIssues);
      },
      (error) => {
        console.warn("Map Geolocation denied:", error.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
}

// Bind search and filter triggers
function setupFilterListeners() {
  const catSelect = document.getElementById('map-category-select');
  const statSelect = document.getElementById('map-status-select');
  const layerSelect = document.getElementById('map-layer-select');

  if (catSelect) {
    catSelect.addEventListener('change', async () => {
      activeCategory = catSelect.value;
      await loadAndRenderMapIssues();
    });
  }

  if (statSelect) {
    statSelect.addEventListener('change', async () => {
      activeStatus = statSelect.value;
      await loadAndRenderMapIssues();
    });
  }

  if (layerSelect) {
    layerSelect.addEventListener('change', () => {
      activeMapLayerType = layerSelect.value;
      renderMapLayer(currentIssues);
    });
  }
}

function setupSearchListener() {
  const searchInput = document.getElementById('map-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      renderMapMarkers(currentIssues);
      return;
    }

    const filtered = currentIssues.filter(i => 
      i.title.toLowerCase().includes(term) ||
      i.description.toLowerCase().includes(term) ||
      (i.address && i.address.toLowerCase().includes(term))
    );

    renderMapMarkers(filtered);
  });
}

function getCategoryIconClass(category) {
  switch(category) {
    case 'roads': return 'fa-solid fa-road';
    case 'streetlights': return 'fa-solid fa-lightbulb';
    case 'water_supply': return 'fa-solid fa-faucet-drip';
    case 'drainage': return 'fa-solid fa-water';
    case 'garbage': return 'fa-solid fa-trash-can';
    case 'traffic': return 'fa-solid fa-traffic-light';
    case 'public_property': return 'fa-solid fa-building-shield';
    case 'parks': return 'fa-solid fa-tree';
    case 'sanitation': return 'fa-solid fa-restroom';
    case 'safety_hazard': return 'fa-solid fa-triangle-exclamation';
    case 'environment': return 'fa-solid fa-leaf';
    case 'other': return 'fa-solid fa-circle-question';
    // Backwards compatibility
    case 'pothole': return 'fa-solid fa-road';
    case 'leakage': return 'fa-solid fa-faucet-drip';
    case 'streetlight': return 'fa-solid fa-lightbulb';
    case 'road': return 'fa-solid fa-road';
    default: return 'fa-solid fa-circle-exclamation';
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {
    if (interval === 1) return window.i18n ? window.i18n.t('time_yesterday') : "Yesterday";
    return window.i18n ? window.i18n.t('time_days_ago', { days: interval }) : `${interval}d ago`;
  }
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return window.i18n ? window.i18n.t('time_hours_ago', { hours: interval }) : `${interval}h ago`;
  }
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return window.i18n ? window.i18n.t('time_mins_ago', { mins: interval }) : `${interval}m ago`;
  }
  return window.i18n ? window.i18n.t('time_just_now') : "Just now";
}


function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

window.addEventListener('auth-change', async () => {
  await loadAndRenderMapIssues();
});

window.addEventListener('DOMContentLoaded', () => {
  initMapView();
});

window.addEventListener('language-change', () => {
  if (window.i18n) {
    window.i18n.translatePage();
  }
  if (currentIssues && currentIssues.length > 0) {
    renderMapLayer(currentIssues);
  }
  if (activeSelectedIssue) {
    selectIssueForSummary(activeSelectedIssue);
  }
});


// Heatmap and Proximity Alert helpers
let activeMapLayerType = 'markers';
let heatmapLayer = null;

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function checkNearbyProximityAlert(userLat, userLng, issues) {
  const proximityLimit = 0.5; // 500 meters
  let nearbyCount = 0;

  issues.forEach(i => {
    const distance = calculateDistance(userLat, userLng, i.latitude, i.longitude);
    if (distance <= proximityLimit) {
      nearbyCount += 1;
    }
  });

  if (nearbyCount > 0) {
    showProximityAlert(nearbyCount);
  }
}

function showProximityAlert(count) {
  if (sessionStorage.getItem('cc_proximity_alert_shown')) return;

  const alertBox = document.createElement('div');
  alertBox.style = "position: fixed; top: calc(var(--header-height) + 12px); left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 0.85rem 1.5rem; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 10000; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; gap: 0.5rem; animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.2);";
  const alertText = window.i18n ? window.i18n.t('proximity_alert', { count: count }) : `Proximity Alert: There are ${count} issues reported within 500m of your position!`;
  alertBox.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${alertText}`;

  
  document.body.appendChild(alertBox);
  sessionStorage.setItem('cc_proximity_alert_shown', 'true');

  // Slide down animation stylesheet insert
  if (!document.getElementById('proximity-animation-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'proximity-animation-style';
    styleTag.innerHTML = `
      @keyframes slide-down {
        0% { transform: translate(-50%, -20px); opacity: 0; }
        100% { transform: translate(-50%, 0); opacity: 1; }
      }
      @keyframes fade-out {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(styleTag);
  }

  setTimeout(() => {
    alertBox.style.animation = 'fade-out 0.4s forwards';
    setTimeout(() => alertBox.remove(), 400);
  }, 6000);
}

function renderMapLayer(issues) {
  if (!map) return;

  // Clear existing map layers
  if (markersGroup) {
    map.removeLayer(markersGroup);
  }
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer);
    heatmapLayer = null;
  }

  if (activeMapLayerType === 'heatmap') {
    const heatData = issues.map(i => {
      let intensity = 0.5;
      if (i.ai_priority === 'critical') intensity = 1.0;
      else if (i.ai_priority === 'high') intensity = 0.8;
      else if (i.ai_priority === 'medium') intensity = 0.6;
      
      return [i.latitude, i.longitude, intensity];
    });

    heatmapLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17
    }).addTo(map);
  } else {
    markersGroup.addTo(map);
    renderMapMarkers(issues);
  }
}
