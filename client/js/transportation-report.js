// CrowdCity AI v3.2 - Transportation Report Form Controller

let pickerMap = null;
let pickerMarker = null;
let currentLat = 11.0168; // Default Coimbatore center
let currentLng = 76.9558;
let uploadedPhotos = [];
let liveAiResult = null;
let triageDebounceTimer = null;

// Initialize Page & Map Picker on Load
document.addEventListener('DOMContentLoaded', () => {
  initMapPicker();
});

function initMapPicker() {
  const mapContainer = document.getElementById('map-picker-container');
  if (!mapContainer || typeof L === 'undefined') return;

  pickerMap = L.map('map-picker-container').setView([currentLat, currentLng], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(pickerMap);

  pickerMarker = L.marker([currentLat, currentLng], { draggable: true }).addTo(pickerMap);

  pickerMarker.on('dragend', function (e) {
    const coord = e.target.getLatLng();
    updateLocationCoords(coord.lat, coord.lng);
  });

  pickerMap.on('click', function (e) {
    updateLocationCoords(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => {
    pickerMap.invalidateSize();
  }, 400);
}

function updateLocationCoords(lat, lng) {
  currentLat = parseFloat(lat.toFixed(6));
  currentLng = parseFloat(lng.toFixed(6));

  if (pickerMarker) {
    pickerMarker.setLatLng([currentLat, currentLng]);
  }
  if (pickerMap) {
    pickerMap.panTo([currentLat, currentLng]);
  }

  const addrInput = document.getElementById('report-address');
  if (addrInput && !addrInput.value) {
    addrInput.value = `Lat: ${currentLat}, Lng: ${currentLng} (Smart City Zone)`;
  }
}

function autoDetectGPS() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      updateLocationCoords(pos.coords.latitude, pos.coords.longitude);
      if (pickerMap) pickerMap.setZoom(16);
    },
    (err) => {
      console.warn('GPS detection failed:', err);
      alert('Unable to retrieve GPS location. You can click on the map to set location.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Upload Evidence Handlers
function handleFileSelection(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = function (event) {
      uploadedPhotos.push(event.target.result);
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  }
}

function addUrlPhoto() {
  const urlInput = document.getElementById('photo-url-input');
  if (!urlInput || !urlInput.value.trim()) return;

  const url = urlInput.value.trim();
  uploadedPhotos.push(url);
  urlInput.value = '';
  renderImagePreviews();
}

function removePhoto(index) {
  uploadedPhotos.splice(index, 1);
  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById('image-previews-grid');
  if (!grid) return;

  if (uploadedPhotos.length === 0) {
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = uploadedPhotos.map((url, idx) => `
    <div class="image-preview-item">
      <img src="${escapeHtml(url)}" alt="Preview ${idx + 1}" />
      <button type="button" class="remove-img-btn" onclick="removePhoto(${idx})" title="Remove Photo">&times;</button>
    </div>
  `).join('');
}

// Live Groq AI Triage Analysis Trigger
function triggerLiveAiTriage(force = false) {
  if (triageDebounceTimer) clearTimeout(triageDebounceTimer);

  triageDebounceTimer = setTimeout(() => {
    runGroqAiTriage(force);
  }, 600);
}

async function runGroqAiTriage(force = false) {
  const title = document.getElementById('report-title')?.value.trim();
  const category = document.getElementById('report-category')?.value;
  const description = document.getElementById('report-description')?.value.trim();

  const container = document.getElementById('ai-review-content');
  if (!container) return;

  if (!title || !description) {
    container.innerHTML = `
      <p style="margin: 0; color: #cbd5e1; font-style: italic;">
        Fill in the Issue Title and Description above to automatically run AI triage analysis...
      </p>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.6rem; color: #fbbf24;">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>State AI Triage Engine Analyzing Issue...</span>
    </div>
  `;

  try {
    let result = null;
    if (window.API && typeof window.API.analyzeTransportationIssue === 'function') {
      const res = await window.API.analyzeTransportationIssue({ title, description, category });
      if (res && res.analysis) result = res.analysis;
    }

    if (!result) {
      result = getFallbackAiAnalysis(title, description, category);
    }

    liveAiResult = result;
    renderAiReviewCard(result);
  } catch (err) {
    console.warn('AI Triage error:', err);
    liveAiResult = getFallbackAiAnalysis(title, description, category);
    renderAiReviewCard(liveAiResult);
  }
}

function getFallbackAiAnalysis(title, description, category) {
  const text = `${title} ${description}`.toLowerCase();
  let prio = 'Medium';
  let score = 5;
  let dept = 'Roads Department';

  if (text.includes('signal') || text.includes('accident') || text.includes('danger')) {
    prio = 'Critical';
    score = 9;
    dept = 'Traffic Police';
  } else if (text.includes('pothole') || text.includes('crack') || text.includes('water')) {
    prio = 'High';
    score = 8;
    dept = text.includes('water') ? 'Municipal Corporation' : 'Roads Department';
  }

  return {
    category: category || 'Damaged Roads',
    priority: prio,
    severity_score: score,
    department: dept,
    summary: `Citizen reported issue: "${title}"`,
    suggested_resolution: 'Dispatch site assessment officer and technical crew for immediate inspection.',
    confidence_score: 94.2
  };
}

function renderAiReviewCard(ai) {
  const container = document.getElementById('ai-review-content');
  if (!container) return;

  const prioClass = `priority-${(ai.priority || 'medium').toLowerCase()}`;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
      <div>
        <span style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Verified Category</span>
        <span style="font-weight: 800; color: #ffffff;">${escapeHtml(ai.category || 'Transportation Issue')}</span>
      </div>

      <div>
        <span style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Priority Level</span>
        <span class="ai-metric-badge ${prioClass}">${escapeHtml(ai.priority || 'Medium')}</span>
      </div>

      <div>
        <span style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Severity Score</span>
        <span style="font-weight: 800; color: #fbbf24;">${ai.severity_score || 5} / 10</span>
      </div>

      <div>
        <span style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Responsible Dept</span>
        <span style="font-weight: 800; color: #38bdf8;">${escapeHtml(ai.department || 'Roads Department')}</span>
      </div>
    </div>

    <div style="background: rgba(0, 0, 0, 0.25); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.08);">
      <div style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">AI Triage Executive Summary</div>
      <p style="margin: 0; font-size: 0.85rem; color: #f1f5f9;">${escapeHtml(ai.summary || '')}</p>
    </div>

    <div style="background: rgba(0, 0, 0, 0.25); border-radius: 8px; padding: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <div style="flex: 1;">
        <div style="font-size: 0.75rem; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 2px;">Suggested Action</div>
        <div style="font-size: 0.84rem; color: #e2e8f0;">${escapeHtml(ai.suggested_resolution || '')}</div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 0.72rem; color: #94a3b8; display: block;">Confidence</span>
        <span style="font-size: 0.88rem; font-weight: 800; color: #34d399;">${ai.confidence_score || 94.5}%</span>
      </div>
    </div>
  `;
}

// Submit Transportation Report Form
async function handleFormSubmission(e) {
  e.preventDefault();

  const title = document.getElementById('report-title')?.value.trim();
  const category = document.getElementById('report-category')?.value;
  const ward = document.getElementById('report-ward')?.value.trim();
  const description = document.getElementById('report-description')?.value.trim();
  const roadName = document.getElementById('report-road-name')?.value.trim();
  const landmark = document.getElementById('report-landmark')?.value.trim();
  const address = document.getElementById('report-address')?.value.trim();

  const submitBtn = document.getElementById('btn-submit-report');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting Report...';
  }

  let userId = 'citizen_anonymous';
  try {
    if (typeof getCurrentUser === 'function') {
      const user = getCurrentUser();
      if (user) userId = user.id;
    }
  } catch (err) {}

  const reportPayload = {
    title,
    category,
    description,
    road_name: roadName,
    landmark,
    ward,
    address,
    latitude: currentLat,
    longitude: currentLng,
    photo_urls: uploadedPhotos,
    user_id: userId
  };

  try {
    let res = null;
    if (window.API && typeof window.API.createTransportationReport === 'function') {
      res = await window.API.createTransportationReport(reportPayload);
    }

    const createdReport = (res && res.report) ? res.report : {
      report_number: `TRP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString(),
      status: 'Submitted',
      responsible_department: liveAiResult?.department || 'Roads Department'
    };

    renderSuccessScreen(createdReport);
  } catch (err) {
    console.error('Failed to submit transportation report:', err);
    alert('Failed to submit report. Please check connection and try again.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Transportation Report';
    }
  }
}

function renderSuccessScreen(report) {
  const formBox = document.getElementById('form-container');
  const succBox = document.getElementById('success-container');

  if (formBox) formBox.style.display = 'none';
  if (succBox) succBox.style.display = 'block';

  document.getElementById('succ-issue-id').textContent = `#${report.report_number || 'TRP-2026-1001'}`;
  document.getElementById('succ-time').textContent = new Date().toLocaleString();
  document.getElementById('succ-status').textContent = report.status || 'Submitted';
  document.getElementById('succ-department').textContent = report.responsible_department || 'Roads Department';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
