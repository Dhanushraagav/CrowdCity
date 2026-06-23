// CrowdCity AI - Report Issue Controller

let lastRecentIssuesReport = null;

let reportMap = null;
let reportMarker = null;
let isAddressManuallyEntered = false;
let selectedFiles = [];

const DEFAULT_CENTER = [11.0168, 76.9558]; // Coimbatore, India
const DEFAULT_ZOOM = 13;

// Initialize Report Page
function initReportPage() {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    window.showToast("You must be logged in to report civic issues. Redirecting to sign in...", "warning");
    window.authRouter.redirectToLogin('citizen');
    return;
  }

  initReportMap();
  setupCategorySelector();
  setupImageUpload();
  setupAiAssistant();
  setupFormSubmit();
  setupGPSButton();
  setupSearchButton();
  loadRecentActivity();

  // Listen to address input manual edits
  const addressInput = document.getElementById('report-address');
  if (addressInput) {
    addressInput.addEventListener('input', () => {
      isAddressManuallyEntered = true;
    });
  }

  // Proactively request browser location on load to center the map
  requestBrowserLocation(false);
}

// Load real recent activity from API
async function loadRecentActivity(isLanguageChange = false) {
  const container = document.getElementById('report-recent-activity-list');
  if (!container) return;

  if (isLanguageChange && lastRecentIssuesReport && lastRecentIssuesReport.length > 0) {
    renderRecentActivityHTML(container, lastRecentIssuesReport);
    return;
  }

  try {
    if (!window.API || typeof window.API.getIssues !== 'function') {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 1rem 0;">No recent activity</div>';
      return;
    }

    const { data: issues, error } = await window.API.getIssues({ sort_by: 'newest' });

    if (error || !issues || issues.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 1rem 0;">No recent activity</div>';
      return;
    }

    lastRecentIssuesReport = issues;
    renderRecentActivityHTML(container, issues);
  } catch (err) {
    console.error("Failed to load recent activity:", err);
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 1rem 0;">No recent activity</div>';
  }
}

function renderRecentActivityHTML(container, issues) {
  const recent = issues.slice(0, 3);
  container.innerHTML = recent.map((issue, idx) => {
    const timeAgo = formatReportTimeAgo(new Date(issue.created_at));
    const addr = issue.address || 'Location detected';
    const shortAddr = addr.length > 25 ? addr.substring(0, 25) + '...' : addr;
    const isFirst = idx === 0;

    let actionKey = 'reported';
    if (issue.status === 'resolved' || issue.status === 'verified') actionKey = 'resolved';
    else if (issue.status === 'in_progress') actionKey = 'in_progress';
    const actionLabel = window.i18n ? window.i18n.t(actionKey) : (actionKey.charAt(0).toUpperCase() + actionKey.slice(1).replace('_', ' '));

    return `
      <div class="activity-item">
        <span class="activity-dot ${isFirst ? 'live' : 'muted'}"></span>
        <div>
          <div class="activity-title">${actionLabel}: ${escapeReportHTML(issue.title)}</div>
          <div class="activity-meta">${timeAgo} &mdash; ${escapeReportHTML(shortAddr)}</div>
        </div>
      </div>
    `;
  }).join('');
}


// Simple time formatter for report page
function formatReportTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return window.i18n ? window.i18n.t('time_just_now') : 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return window.i18n ? window.i18n.t('time_mins_ago', { mins: minutes }) : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return window.i18n ? window.i18n.t('time_hours_ago', { hours: hours }) : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return window.i18n ? window.i18n.t('time_yesterday') : 'Yesterday';
  return window.i18n ? window.i18n.t('time_days_ago', { days: days }) : `${days}d ago`;
}


// Escape HTML for report page
function escapeReportHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}


// Initialize Leaflet map for location selection
function initReportMap() {
  const mapElement = document.getElementById('map-selector');
  if (!mapElement) return;

  reportMap = L.map('map-selector').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(reportMap);

  // Click handler on map
  reportMap.on('click', (e) => {
    setCoordinates(e.latlng.lat, e.latlng.lng);
  });
}

// Set coordinates programmatically
function setCoordinates(lat, lng) {
  document.getElementById('report-latitude').value = lat.toFixed(6);
  document.getElementById('report-longitude').value = lng.toFixed(6);

  // Render/Move Marker
  if (reportMarker) {
    reportMarker.setLatLng([lat, lng]);
  } else {
    reportMarker = L.marker([lat, lng], { draggable: true }).addTo(reportMap);
    
    // Update coordinates on drag end
    reportMarker.on('dragend', (event) => {
      const markerLatlng = event.target.getLatLng();
      document.getElementById('report-latitude').value = markerLatlng.lat.toFixed(6);
      document.getElementById('report-longitude').value = markerLatlng.lng.toFixed(6);
      reverseGeocode(markerLatlng.lat, markerLatlng.lng);
    });
  }

  reverseGeocode(lat, lng);
}

// Request Browser Geolocation
function requestBrowserLocation(showAlerts = false) {
  if (!navigator.geolocation) {
    if (showAlerts) window.showToast("Geolocation is not supported by your browser.", "warning");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      
      // Center map on user location
      if (reportMap) {
        reportMap.setView([latitude, longitude], 15);
      }
      
      // Drop marker and populate fields
      setCoordinates(latitude, longitude);
      
      if (showAlerts) {
        const alertBanner = document.getElementById('report-alert');
        if (alertBanner) {
          alertBanner.innerHTML = `<i class="fa-solid fa-location-dot"></i> GPS coordinates resolved successfully.`;
          alertBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
          alertBanner.style.color = '#10b981';
          alertBanner.classList.remove('hidden');
          setTimeout(() => alertBanner.classList.add('hidden'), 3000);
        }
      }
    },
    (error) => {
      console.warn("Geolocation permission denied or timed out:", error.message);
      if (showAlerts) {
        window.showToast(`Failed to retrieve location: ${error.message}. Please click on the map to set location manually.`, "error");
      }
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Bind GPS Location Button click listener
function setupGPSButton() {
  const gpsBtn = document.getElementById('btn-use-gps');
  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => requestBrowserLocation(true));
  }
}

// Bind Address Search Button click listener
function setupSearchButton() {
  const searchBtn = document.getElementById('btn-search-address');
  const addressInput = document.getElementById('report-address');
  const alertBanner = document.getElementById('report-alert');

  if (!searchBtn || !addressInput) return;

  // Prevent Enter key from submitting the form, trigger search instead
  addressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  searchBtn.addEventListener('click', async () => {
    const address = addressInput.value.trim();
    if (!address || address.length < 5) {
      window.showToast(window.i18n ? window.i18n.t('enter_detailed_address_error') || 'Please enter a detailed address to search.' : 'Please enter a detailed address to search.', 'warning');
      addressInput.focus();
      return;
    }

    searchBtn.disabled = true;
    const originalContent = searchBtn.innerHTML;
    searchBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    if (alertBanner) alertBanner.classList.add('hidden');

    try {
      const result = await window.ServiceArea.validateAddressText(address);
      if (result.isValid) {
        // Update inputs
        document.getElementById('report-latitude').value = result.lat.toFixed(6);
        document.getElementById('report-longitude').value = result.lng.toFixed(6);
        addressInput.value = result.displayName || address;
        
        // Update map/marker
        const resolvedLat = result.lat;
        const resolvedLng = result.lng;
        
        if (reportMap) {
          reportMap.setView([resolvedLat, resolvedLng], 15);
        }
        if (reportMarker) {
          reportMarker.setLatLng([resolvedLat, resolvedLng]);
        } else if (reportMap) {
          reportMarker = L.marker([resolvedLat, resolvedLng], { draggable: true }).addTo(reportMap);
          // Set dragend handler
          reportMarker.on('dragend', (event) => {
            const markerLatlng = event.target.getLatLng();
            document.getElementById('report-latitude').value = markerLatlng.lat.toFixed(6);
            document.getElementById('report-longitude').value = markerLatlng.lng.toFixed(6);
            reverseGeocode(markerLatlng.lat, markerLatlng.lng);
          });
        }
        isAddressManuallyEntered = false;
        window.showToast('Location resolved successfully.', 'success');
      } else {
        const errorMsg = result.errorMsg || 'Could not resolve the address. Please pin it on the map manually.';
        window.showToast(errorMsg, 'error');
        if (alertBanner) {
          alertBanner.textContent = errorMsg;
          alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          alertBanner.style.color = '#ef4444';
          alertBanner.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      window.showToast('Failed to search address.', 'error');
    } finally {
      searchBtn.disabled = false;
      searchBtn.innerHTML = originalContent;
    }
  });
}

// Reverse geocoding using OpenStreetMap Nominatim API
async function reverseGeocode(lat, lng) {
  const addressInput = document.getElementById('report-address');
  if (!addressInput) return;

  addressInput.value = "Resolving address...";
  
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'CrowdCity-AI-Civic-Tech'
      }
    });

    if (!response.ok) {
      throw new Error("Nominatim geocoding request failed");
    }

    const data = await response.json();
    console.log("Nominatim Response:", data);

    if (data && data.address) {
      const addr = data.address;
      
      const road = addr.road || addr.pedestrian || addr.highway || addr.street || '';
      const area = addr.suburb || addr.neighbourhood || addr.residential || addr.village || addr.hamlet || addr.subdistrict || '';
      const city = addr.city || addr.town || addr.village || addr.municipality || '';
      const district = addr.county || addr.district || '';
      const state = addr.state || addr.province || addr.state_district || '';
      const country = addr.country || '';

      const parts = [road, area, city, district, state, country].filter(p => p.trim() !== '');
      let addressStr = parts.join(', ');

      if (!addressStr) {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        addressStr = `Location detected near ${Math.abs(lat).toFixed(4)} ${latDir}, ${Math.abs(lng).toFixed(4)} ${lngDir}`;
      }

      addressInput.value = addressStr;
      isAddressManuallyEntered = false;
      console.log("GPS:", lat, lng);
      console.log("Resolved Address:", addressStr);

      // Verify Service Area immediately
      const alertBanner = document.getElementById('report-alert');
      const serviceAreaMsg = window.i18n ? window.i18n.t('outside_service_area_error') : "Currently, CrowdCity AI supports reporting only within Tamil Nadu. We are expanding to other states soon.";
      if (!window.ServiceArea.isStateAllowed(state)) {
        // If state is not allowed, check if bounding box fallback applies (in case state is missing/misidentified)
        const validation = await window.ServiceArea.validateCoordinates(lat, lng);
        if (!validation.isValid) {
          if (alertBanner) {
            alertBanner.textContent = serviceAreaMsg;
            alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            alertBanner.style.color = '#ef4444';
            alertBanner.classList.remove('hidden');
          }
        } else {
          if (alertBanner && (alertBanner.textContent.includes("supports reporting only within Tamil Nadu") || alertBanner.textContent.includes("தமிழ்நாடு எல்லைக்குள்"))) {
            alertBanner.classList.add('hidden');
          }
        }
      } else {
        if (alertBanner && (alertBanner.textContent.includes("supports reporting only within Tamil Nadu") || alertBanner.textContent.includes("தமிழ்நாடு எல்லைக்குள்"))) {
          alertBanner.classList.add('hidden');
        }
      }
    } else {
      throw new Error("No address returned from Nominatim");
    }
  } catch (err) {
    console.error("Reverse geocoding error:", err);
    const fallbackStr = "Location detected. Address unavailable.";
    addressInput.value = fallbackStr;
    isAddressManuallyEntered = false;
    console.log("GPS:", lat, lng);
    console.log("Resolved Address:", fallbackStr);

    // Bounding box validation fallback
    const validation = await window.ServiceArea.validateCoordinates(lat, lng);
    const alertBanner = document.getElementById('report-alert');
    const serviceAreaMsg = window.i18n ? window.i18n.t('outside_service_area_error') : "Currently, CrowdCity AI supports reporting only within Tamil Nadu. We are expanding to other states soon.";
    if (!validation.isValid) {
      if (alertBanner) {
        alertBanner.textContent = serviceAreaMsg;
        alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
        alertBanner.style.color = '#ef4444';
        alertBanner.classList.remove('hidden');
      }
    } else {
      if (alertBanner && (alertBanner.textContent.includes("supports reporting only within Tamil Nadu") || alertBanner.textContent.includes("தமிழ்நாடு எல்லைக்குள்"))) {
        alertBanner.classList.add('hidden');
      }
    }
  }
}

// Setup Category Selector Grid click listener
function setupCategorySelector() {
  // Category selection is handled natively by the HTML select dropdown
}

// Set category item programmatically
function setCategoryProgrammatically(categoryName) {
  const categoryInput = document.getElementById('report-category');
  if (categoryInput) {
    categoryInput.value = categoryName;
  }
}

// Image upload and preview rendering
function setupImageUpload() {
  const uploadZone = document.getElementById('image-upload-zone');
  const fileInput = document.getElementById('report-image-input');
  const previewContainer = document.getElementById('image-preview-container');
  const previewsGrid = document.getElementById('image-previews-grid');

  if (!uploadZone || !fileInput) return;

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--primary)';
    uploadZone.style.backgroundColor = 'var(--primary-light-alpha)';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = 'var(--border-color)';
    uploadZone.style.backgroundColor = 'transparent';
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--border-color)';
    uploadZone.style.backgroundColor = 'transparent';
    
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      addFiles(fileInput.files);
      fileInput.value = ''; // Clear value to allow selecting same files again if removed
    }
  });

  function addFiles(filesList) {
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (selectedFiles.length >= 5) {
        window.showToast("You can upload a maximum of 5 images.", "warning");
        break;
      }
      if (!file.type.startsWith('image/')) {
        window.showToast("Only image files are supported.", "error");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        window.showToast(`File ${file.name} is too large. Max size is 10MB.`, "error");
        continue;
      }
      const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        selectedFiles.push(file);
      }
    }
    renderPreviews();
  }

  function renderPreviews() {
    if (!previewsGrid || !previewContainer) return;

    previewsGrid.innerHTML = '';
    
    if (selectedFiles.length === 0) {
      previewContainer.classList.add('hidden');
      uploadZone.classList.remove('hidden');
      return;
    }

    previewContainer.classList.remove('hidden');
    if (selectedFiles.length >= 5) {
      uploadZone.classList.add('hidden');
    } else {
      uploadZone.classList.remove('hidden');
    }

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      
      const card = document.createElement('div');
      card.style.position = 'relative';
      card.style.height = '120px';
      card.style.borderRadius = 'var(--radius-md)';
      card.style.border = '1px solid var(--border-color)';
      card.style.overflow = 'hidden';
      card.style.backgroundColor = 'var(--bg-app)';

      const img = document.createElement('img');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      card.appendChild(img);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      removeBtn.style.position = 'absolute';
      removeBtn.style.top = '4px';
      removeBtn.style.right = '4px';
      removeBtn.style.width = '20px';
      removeBtn.style.height = '20px';
      removeBtn.style.borderRadius = '50%';
      removeBtn.style.background = 'rgba(15,19,26,0.85)';
      removeBtn.style.color = '#ffffff';
      removeBtn.style.border = '1px solid var(--border-color)';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.display = 'flex';
      removeBtn.style.alignItems = 'center';
      removeBtn.style.justifyContent = 'center';
      removeBtn.style.fontSize = '0.75rem';
      
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderPreviews();
      });
      card.appendChild(removeBtn);
      previewsGrid.appendChild(card);

      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
}

// AI Assistant Action triggers real Groq AI backend analysis API
function setupAiAssistant() {
  const aiBtn = document.getElementById('btn-ai-assist');
  const alertBanner = document.getElementById('report-alert');

  if (!aiBtn) return;

  aiBtn.addEventListener('click', async () => {
    const description = document.getElementById('report-description').value.trim();

    if (!description) {
      alertBanner.textContent = 'Please fill out the Detailed Description first so the AI can analyze the details.';
      alertBanner.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      alertBanner.style.color = '#f59e0b';
      alertBanner.classList.remove('hidden');
      alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    aiBtn.disabled = true;
    aiBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> AI Analyzing...';
    alertBanner.classList.add('hidden');

    const { data, error } = await window.API.analyzeWithAi("Civic Issue", description);

    aiBtn.disabled = false;
    aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Categorize with AI';

    if (error) {
      alertBanner.textContent = `AI analysis failed: ${error}`;
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      return;
    }

    if (data && data.suggestedCategory) {
      setCategoryProgrammatically(data.suggestedCategory);
      
      alertBanner.innerHTML = `
        <i class="fa-solid fa-square-check"></i> 
        <strong>AI Suggestion Applied:</strong> Categorized as <strong>${data.suggestedCategory.toUpperCase()}</strong> 
        (Severity: <strong>${data.severity.toUpperCase()}</strong>, Confidence: <strong>${(data.confidenceScore * 100).toFixed(0)}%</strong>).
      `;
      alertBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      alertBanner.style.color = '#10b981';
      alertBanner.classList.remove('hidden');
      alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// Format a raw category value into a human-readable name
function formatCategoryName(val) {
  if (!val) return 'Civic Issue';
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
window.formatCategoryName = formatCategoryName;

// Form Submission handling (Multipart FormData payload)
function setupFormSubmit() {
  const form = document.getElementById('report-form');
  const alertBanner = document.getElementById('report-alert');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBanner.classList.add('hidden');

    const description = document.getElementById('report-description').value.trim();
    const category = document.getElementById('report-category').value;
    const latitude = document.getElementById('report-latitude').value;
    const longitude = document.getElementById('report-longitude').value;
    const address = document.getElementById('report-address').value.trim();
    const fileInput = document.getElementById('report-image-input');

    // Auto-generate title from category + description (backend requires 5–100 chars)
    const categoryFormatted = formatCategoryName(category) || 'Civic Issue';
    const descSnippet = description.substring(0, 60).trim();
    const title = `${categoryFormatted}: ${descSnippet}${description.length > 60 ? '...' : ''}`;

    // Frontend Validations
    if (description.length < 10 || description.length > 1000) {
      alertBanner.textContent = 'Description must be between 10 and 1000 characters.';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      return;
    }

    if (!category) {
      alertBanner.textContent = 'Please select an issue category.';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      return;
    }

    if (!latitude || !longitude) {
      alertBanner.textContent = 'Please pin the location of the issue on the map or click "Use GPS".';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-report');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying location...';

    let finalLat = parseFloat(latitude);
    let finalLng = parseFloat(longitude);
    let finalAddress = address;

    if (isAddressManuallyEntered) {
      const addressValidation = await window.ServiceArea.validateAddressText(address);
      if (!addressValidation.isValid) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
        let errMsg = addressValidation.errorMsg || 'Currently, CrowdCity AI supports reporting only within Tamil Nadu. We are expanding to other states soon.';
        if (errMsg.includes('supports reporting only within Tamil Nadu')) {
          errMsg = window.i18n ? window.i18n.t('outside_service_area_error') : errMsg;
        }
        alertBanner.textContent = errMsg;
        alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
        alertBanner.style.color = '#ef4444';
        alertBanner.classList.remove('hidden');
        alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      // Update form values with resolved geocoding results
      finalLat = addressValidation.lat;
      finalLng = addressValidation.lng;
      finalAddress = addressValidation.displayName || address;
      
      document.getElementById('report-latitude').value = finalLat.toFixed(6);
      document.getElementById('report-longitude').value = finalLng.toFixed(6);
      
      if (reportMap) {
        reportMap.setView([finalLat, finalLng], 15);
      }
      if (reportMarker) {
        reportMarker.setLatLng([finalLat, finalLng]);
      } else if (reportMap) {
        reportMarker = L.marker([finalLat, finalLng], { draggable: true }).addTo(reportMap);
      }
      isAddressManuallyEntered = false;
    } else {
      const coordValidation = await window.ServiceArea.validateCoordinates(finalLat, finalLng);
      if (!coordValidation.isValid) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
        alertBanner.textContent = window.i18n ? window.i18n.t('outside_service_area_error') : 'Currently, CrowdCity AI supports reporting only within Tamil Nadu. We are expanding to other states soon.';
        alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
        alertBanner.style.color = '#ef4444';
        alertBanner.classList.remove('hidden');
        alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }

    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...';

    // Construct FormData object to package both text and file payloads
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('latitude', finalLat);
    formData.append('longitude', finalLng);
    formData.append('address', finalAddress || 'Location detected. Address unavailable.');

    if (selectedFiles.length) {
      selectedFiles.forEach(file => {
        formData.append('image', file);
      });
    }

    // --- NEW LOGIC FOR AI LOADING OVERLAY ---
    const overlay = document.getElementById('ai-modal-overlay');
    const loaderStage = document.getElementById('ai-loader-stage');
    const resultsStage = document.getElementById('ai-results-stage');
    
    if (overlay && loaderStage && resultsStage) {
      overlay.classList.remove('hidden');
      loaderStage.classList.remove('hidden');
      resultsStage.classList.add('hidden');
    }

    const { data, error } = await window.API.createIssue(formData);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';

    if (error) {
      // Hide the overlay if it was shown
      if (overlay) overlay.classList.add('hidden');
      
      alertBanner.textContent = `Submission failed: ${error}`;
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
    } else {
      // Clear local file uploads on success
      selectedFiles = [];
      
      // Transition to Stage 2: Results
      if (overlay && loaderStage && resultsStage) {
        loaderStage.classList.add('hidden');
        resultsStage.classList.remove('hidden');
        
        // Populate fields
        document.getElementById('ai-res-summary').textContent = data.ai_summary || 'No summary generated.';
        document.getElementById('ai-res-category').textContent = data.ai_category || 'Other';
        document.getElementById('ai-res-department').textContent = data.ai_department || 'General Department';
        
        const priorityBadge = document.getElementById('ai-res-priority');
        const priority = (data.ai_priority || 'Medium').toLowerCase();
        priorityBadge.textContent = priority;
        
        // Set styling based on priority
        let bgStyle = '';
        if (priority === 'low') {
          bgStyle = '#10b981'; // Green
        } else if (priority === 'medium') {
          bgStyle = '#f59e0b'; // Amber
        } else if (priority === 'high') {
          bgStyle = '#ef4444'; // Red
        } else if (priority === 'critical') {
          bgStyle = '#7f1d1d'; // Dark Red / Crimson
          priorityBadge.style.animation = 'pulse 1s infinite';
        }
        priorityBadge.style.backgroundColor = bgStyle;

        // Start 5-second countdown
        let count = 5;
        const countdownEl = document.getElementById('ai-redirect-countdown');
        const interval = setInterval(() => {
          count--;
          if (countdownEl) {
            countdownEl.textContent = `Redirecting to Home Dashboard in ${count} seconds...`;
          }
          if (count <= 0) {
            clearInterval(interval);
            window.authRouter.redirectToDashboard('citizen');
          }
        }, 1000);
      } else {
        // Fallback if elements don't exist
        alertBanner.textContent = 'Issue reported successfully! Redirecting to dashboard...';
        alertBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
        alertBanner.style.color = '#10b981';
        alertBanner.classList.remove('hidden');
        setTimeout(() => {
          window.authRouter.redirectToDashboard('citizen');
        }, 1500);
      }
    }
  });
}

// Bootstrap report page
window.addEventListener('DOMContentLoaded', async () => {
  if (window.authInitPromise) {
    await window.authInitPromise;
  }
  initReportPage();
});

window.addEventListener('language-change', () => {
  if (window.i18n) {
    window.i18n.translatePage();
  }
  loadRecentActivity(true);
});

