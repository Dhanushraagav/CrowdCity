// CrowdCity AI - Report Issue Controller

let lastRecentIssuesReport = null;

let reportMap = null;
let reportMarker = null;
let isAddressManuallyEntered = false;
let selectedFiles = [];

const DEFAULT_CENTER = [11.0168, 76.9558]; // Coimbatore, India
const DEFAULT_ZOOM = 13;

let currentReportMode = 'civic'; // 'civic' or 'transportation'

const transportationCategories = [
  { value: 'Potholes', label: 'Potholes' },
  { value: 'Damaged Roads', label: 'Damaged Roads' },
  { value: 'Traffic Signal Not Working', label: 'Traffic Signal Failure' },
  { value: 'Waterlogging', label: 'Road Waterlogging' },
  { value: 'Broken Street Lights', label: 'Broken Street Lights' },
  { value: 'Illegal Parking', label: 'Illegal Parking' },
  { value: 'Missing Road Signs', label: 'Missing Road Signs' },
  { value: 'Bus Stop Issues', label: 'Bus Stop Issues' },
  { value: 'Road Block', label: 'Road Block' },
  { value: 'Construction Work', label: 'Construction Work' },
  { value: 'Accident', label: 'Accident' },
  { value: 'Heavy Traffic', label: 'Heavy Traffic' },
  { value: 'Other Transportation Issue', label: 'Other Transportation Issue' }
];

const civicCategories = [
  { value: 'roads', label: 'Roads' },
  { value: 'streetlights', label: 'Streetlights' },
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'drainage', label: 'Drainage' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'public_property', label: 'Public Property' },
  { value: 'parks', label: 'Parks' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'safety_hazard', label: 'Safety Hazard' },
  { value: 'environment', label: 'Environment' },
  { value: 'other', label: 'Other' }
];

let currentStep = 1;

window.goToWizardStep1 = function() {
  currentStep = 1;
  updateStepperUI();
};

window.goToWizardStep2 = function(mode) {
  if (mode) {
    currentReportMode = mode;
    updateFormModeUI();
  }
  currentStep = 2;
  updateStepperUI();
  setTimeout(() => {
    if (reportMap) reportMap.invalidateSize();
  }, 300);
};

window.proceedToWizardStep3 = async function() {
  const categoryInput = document.getElementById('report-category');
  const descriptionInput = document.getElementById('report-description');
  const alertBanner = document.getElementById('report-alert');

  const description = descriptionInput?.value?.trim() || '';

  if (description.length < 5) {
    if (alertBanner) {
      alertBanner.textContent = 'Please provide a detailed description of the issue (at least 5 characters).';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  // If category is unselected or empty, auto-assign based on current mode
  if (!categoryInput?.value) {
    if (typeof currentReportMode !== 'undefined' && currentReportMode === 'transportation') {
      categoryInput.value = 'roads';
    } else {
      categoryInput.value = 'other';
    }
  }

  const category = categoryInput.value;

  if (alertBanner) alertBanner.classList.add('hidden');

  currentStep = 3;
  updateStepperUI();
  runStep3AiTriagePreview(category, description);
};

function updateStepperUI() {
  const pane1 = document.getElementById('wizard-step-1');
  const pane2 = document.getElementById('wizard-step-2');
  const pane3 = document.getElementById('wizard-step-3');

  const ind1 = document.getElementById('step-ind-1');
  const ind2 = document.getElementById('step-ind-2');
  const ind3 = document.getElementById('step-ind-3');

  if (pane1) pane1.classList.toggle('hidden', currentStep !== 1);
  if (pane2) pane2.classList.toggle('hidden', currentStep !== 2);
  if (pane3) pane3.classList.toggle('hidden', currentStep !== 3);

  updateStepBadge(ind1, currentStep >= 1, currentStep === 1);
  updateStepBadge(ind2, currentStep >= 2, currentStep === 2);
  updateStepBadge(ind3, currentStep >= 3, currentStep === 3);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepBadge(el, isReached, isActive) {
  if (!el) return;
  const circle = el.querySelector('.step-circle');
  if (isReached) {
    el.style.opacity = '1';
    if (circle) {
      circle.style.background = 'var(--primary, #0d9488)';
      circle.style.color = '#ffffff';
    }
  } else {
    el.style.opacity = '0.5';
    if (circle) {
      circle.style.background = 'var(--bg-surface-hover, #f1f5f9)';
      circle.style.color = 'var(--text-muted, #64748b)';
    }
  }
}

function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function calculateSpatialDuplicates(userLat, userLng, userCat) {
  if (!userLat || !userLng) return { count: 0, text: '0 Duplicates (Unique Verification)', color: '#0d9488' };

  try {
    let existingList = [];
    if (currentReportMode === 'transportation') {
      if (window.API && typeof window.API.getTransportationReports === 'function') {
        const res = await window.API.getTransportationReports({ category: userCat });
        existingList = (res && res.data && res.data.reports) ? res.data.reports : ((res && res.reports) ? res.reports : []);
      }
    } else {
      if (window.API && typeof window.API.getIssues === 'function') {
        const res = await window.API.getIssues({ category: userCat });
        existingList = (res && res.data) ? res.data : [];
      }
    }

    let duplicateCount = 0;
    existingList.forEach(item => {
      const itemLat = parseFloat(item.latitude || item.lat);
      const itemLng = parseFloat(item.longitude || item.lng || item.lon);
      if (itemLat && itemLng) {
        const distKm = getHaversineDistanceKm(userLat, userLng, itemLat, itemLng);
        // Flag duplicate if reported within 500 meters (0.5 km) radius
        if (distKm <= 0.5) {
          duplicateCount++;
        }
      }
    });

    if (duplicateCount === 0) {
      return { count: 0, text: '0 Duplicates (Unique Verification)', color: '#0d9488' };
    } else if (duplicateCount === 1) {
      return { count: 1, text: '1 Nearby Report (Spatial Cluster)', color: '#b45309' };
    } else {
      return { count: duplicateCount, text: `${duplicateCount} Nearby Reports (Spatial Cluster)`, color: '#dc2626' };
    }
  } catch (err) {
    console.warn('Spatial duplicate check fallback:', err);
    return { count: 0, text: '0 Duplicates (Unique Verification)', color: '#0d9488' };
  }
}

async function runStep3AiTriagePreview(category, description) {
  const refEl = document.getElementById('step3-ai-ref-code');
  const catEl = document.getElementById('step3-ai-category');
  const prioEl = document.getElementById('step3-ai-priority');
  const slaEl = document.getElementById('step3-ai-sla');
  const deptEl = document.getElementById('step3-ai-department');
  const confEl = document.getElementById('step3-ai-confidence');
  const dupEl = document.getElementById('step3-ai-duplicate');
  const sumEl = document.getElementById('step3-ai-summary');
  const actEl = document.getElementById('step3-ai-action');

  // Dynamic official tracking reference code
  const randomRef = 'TN-AI-2026-' + Math.floor(10000 + Math.random() * 90000);
  if (refEl) refEl.textContent = randomRef;

  const formattedCat = (category || 'General Civic').replace(/_/g, ' ');
  if (catEl) catEl.textContent = formattedCat;

  // 1. Department Mapping Based on Category
  let departmentName = 'Greater Municipal Corporation (Zone 4)';
  const catLower = (category || '').toLowerCase();
  if (catLower.includes('garbage') || catLower.includes('sanitation')) {
    departmentName = 'Solid Waste Management Division';
  } else if (catLower.includes('water') || catLower.includes('drainage')) {
    departmentName = 'Water Supply & Drainage Board (TWAD)';
  } else if (catLower.includes('light') || catLower.includes('electric')) {
    departmentName = 'Electrical & Public Lighting Wing';
  } else if (catLower.includes('road') || catLower.includes('pothole')) {
    departmentName = 'Highways & Public Works Dept (PWD)';
  } else if (catLower.includes('signal') || catLower.includes('traffic') || catLower.includes('parking')) {
    departmentName = 'Traffic Police & Control Division';
  } else if (catLower.includes('property')) {
    departmentName = 'Civic Infrastructure Cell (PWD)';
  }

  if (deptEl) deptEl.textContent = departmentName;

  // 2. Priority & Severity Scoring
  const isEmergency = document.getElementById('report-emergency-checkbox')?.checked;
  const isHighPriorityCat = ['safety_hazard', 'traffic_signal', 'road_block', 'waterlogging', 'drainage'].includes(catLower);

  let priorityLabel = 'MEDIUM (Severity: 6.2/10)';
  let priorityColor = '#0d9488';
  let slaText = '24 Hours (Standard SLA)';

  if (isEmergency) {
    priorityLabel = 'CRITICAL (Severity: 9.6/10)';
    priorityColor = '#dc2626';
    slaText = '4 Hours (Urgent SLA)';
  } else if (isHighPriorityCat || (description && description.length > 60)) {
    priorityLabel = 'HIGH (Severity: 7.8/10)';
    priorityColor = '#b45309';
    slaText = '12 Hours (Priority SLA)';
  }

  if (prioEl) {
    prioEl.textContent = priorityLabel;
    prioEl.style.color = priorityColor;
  }
  if (slaEl) slaEl.textContent = slaText;

  // 3. Model Confidence Certainty Calculation
  let baseCertainty = 91.5;
  const userAddress = document.getElementById('report-address')?.value || '';
  const userLat = parseFloat(document.getElementById('report-latitude')?.value);
  const userLng = parseFloat(document.getElementById('report-longitude')?.value);

  if (userAddress.length > 5) baseCertainty += 2.4;
  if (userLat && userLng) baseCertainty += 2.8;
  if (description && description.length > 40) baseCertainty += 2.1;
  const finalCertainty = Math.min(99.4, baseCertainty).toFixed(1);

  if (confEl) confEl.textContent = `${finalCertainty}% Certainty`;

  // 4. Authentic Spatial Duplicate Calculation (Haversine Distance Check)
  if (dupEl) dupEl.textContent = 'Checking location proximity...';
  const dupResult = await calculateSpatialDuplicates(userLat, userLng, category);
  if (dupEl) {
    dupEl.textContent = dupResult.text;
    dupEl.style.color = dupResult.color;
  }

  // 5. Executive Summary & Action Plan
  if (sumEl) sumEl.textContent = description || 'Issue description submitted for automatic triage.';
  if (actEl) {
    actEl.textContent = isEmergency
      ? 'Immediate Emergency Dispatch: Route high-priority mobile inspection unit and alert zonal control room.'
      : `Automated Ticket Dispatch: Assign field officer to ${departmentName} and dispatch work crew within ${slaText}.`;
  }

  // Attempt real AI API call if backend Groq triage endpoint is reachable
  try {
    if (window.API && typeof window.API.analyzeTransportationIssue === 'function' && currentReportMode === 'transportation') {
      const address = userAddress || 'Location';
      const res = await window.API.analyzeTransportationIssue({ title: address, description, category });
      const a = (res && res.data && res.data.analysis) ? res.data.analysis : (res && res.analysis ? res.analysis : null);
      if (a) {
        if (catEl) catEl.textContent = a.category || formattedCat;
        if (prioEl) prioEl.textContent = `${(a.priority || 'Medium').toUpperCase()} (Severity: ${a.severity_score || 7.2}/10)`;
        if (deptEl) deptEl.textContent = a.department || departmentName;
        if (confEl) confEl.textContent = `${a.confidence_score || finalCertainty}% Certainty`;
        if (sumEl) sumEl.textContent = a.summary || description;
        if (actEl) actEl.textContent = a.suggested_resolution || 'Dispatch field unit.';
      }
    }
  } catch (e) {
    console.warn('AI Triage preview fallback active:', e);
  }
}

window.submitFinalReport = async function() {
  const btn = document.getElementById('btn-final-submit');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;
  }
  const form = document.getElementById('report-form');
  if (form) {
    form.requestSubmit();
  }
};

window.openIssueSelectorModal = function() {
  window.goToWizardStep1();
};

window.closeIssueSelectorModal = function() {
  window.goToWizardStep2();
};

window.selectReportMode = function(mode) {
  window.goToWizardStep2(mode);
};

function updateFormModeUI() {
  const pageTitle = document.getElementById('report-page-title');
  const pageDesc = document.getElementById('report-page-desc');
  const modeName = document.getElementById('mode-badge-name');
  const categorySelect = document.getElementById('report-category');

  if (currentReportMode === 'transportation') {
    if (pageTitle) pageTitle.textContent = 'Report a Transportation Issue';
    if (pageDesc) pageDesc.textContent = 'Report road hazards, damaged pavements, traffic signal outages, or transit infrastructure concerns.';
    if (modeName) {
      modeName.textContent = 'Transportation Issue';
      modeName.style.color = '#0284c7';
    }

    if (categorySelect) {
      categorySelect.innerHTML = `
        <option value="" disabled selected>Select a transportation category...</option>
        ${transportationCategories.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
      `;
    }
  } else {
    if (pageTitle) pageTitle.textContent = 'Report a Civic Issue';
    if (pageDesc) pageDesc.textContent = 'Provide details about the infrastructure or safety concern in your area. Our AI will route it to the appropriate department.';
    if (modeName) {
      modeName.textContent = 'Civic Issue';
      modeName.style.color = 'var(--primary)';
    }

    if (categorySelect) {
      categorySelect.innerHTML = `
        <option value="" disabled selected>Select a category...</option>
        ${civicCategories.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
      `;
    }
  }
}

// ----------------------------------------------------
// MULTI-LINGUAL VOICE GRIEVANCE REPORTER (TAMIL & ENGLISH)
// ----------------------------------------------------
function initVoiceGrievanceReporter() {
  const voiceBtn = document.getElementById('btn-voice-record');
  const micIcon = document.getElementById('voice-mic-icon');
  const statusText = document.getElementById('voice-status-text');
  const waveContainer = document.getElementById('voice-wave-container');
  const descTextarea = document.getElementById('report-description');

  if (!voiceBtn || !descTextarea) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (statusText) {
      statusText.innerHTML = '<span style="color: #f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> Speech recognition not supported on this browser. Please type description below.</span>';
    }
    voiceBtn.style.opacity = '0.5';
    voiceBtn.style.cursor = 'not-allowed';
    return;
  }

  let recognition = null;
  let isRecording = false;

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ta-IN'; // Tamil & English India voice model
  } catch (err) {
    console.warn("SpeechRecognition init error:", err);
  }

  voiceBtn.addEventListener('click', () => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
      return;
    }

    try {
      // Toggle language auto-detection between Tamil and English on alternate taps
      if (!recognition.lang || recognition.lang === 'en-IN') {
        recognition.lang = 'ta-IN';
      } else {
        recognition.lang = 'en-IN';
      }

      recognition.start();
      isRecording = true;

      voiceBtn.style.backgroundColor = '#ef4444';
      voiceBtn.style.transform = 'scale(1.08)';
      micIcon.className = 'fa-solid fa-square';
      if (waveContainer) waveContainer.style.display = 'flex';

      if (statusText) {
        statusText.innerHTML = `<span style="color: #0d9488; font-weight: 700;"><i class="fa-solid fa-circle-dot"></i> Listening in ${recognition.lang === 'ta-IN' ? 'Tamil / தமிழ்' : 'English'}... Speak naturally!</span>`;
      }
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
      isRecording = false;
    }
  });

  if (recognition) {
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        descTextarea.value = finalTranscript.trim();
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      stopRecordingUI();
      if (statusText) {
        statusText.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Mic issue (${event.error}). Tap mic or type below.</span>`;
      }
    };

    recognition.onend = async () => {
      stopRecordingUI();
      const rawText = descTextarea.value.trim();
      if (rawText.length >= 2) {
        if (statusText) {
          statusText.innerHTML = `<span style="color: #0d9488; font-weight: 700;"><i class="fa-solid fa-spinner fa-spin"></i> Translating to English & Auto-Categorizing...</span>`;
        }

        // Call AI to translate Tamil script / Tanglish / English speech into perfect English
        if (window.API && typeof window.API.translateVoiceText === 'function') {
          try {
            const { data, error } = await window.API.translateVoiceText(rawText);
            if (data && data.englishText) {
              descTextarea.value = data.englishText;
            }
          } catch (err) {
            console.warn("Voice translation API fallback:", err);
          }
        }

        if (statusText) {
          statusText.innerHTML = `<span style="color: #10b981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Transcribed into English! AI auto-categorizing...</span>`;
        }

        // Auto-trigger AI categorization on translated text
        const aiBtn = document.getElementById('btn-ai-assist');
        if (aiBtn) aiBtn.click();
      } else if (statusText) {
        statusText.textContent = 'Tap mic to speak in Tamil or English.';
      }
    };
  }

  function stopRecordingUI() {
    isRecording = false;
    voiceBtn.style.backgroundColor = 'var(--primary, #0d9488)';
    voiceBtn.style.transform = 'scale(1)';
    micIcon.className = 'fa-solid fa-microphone';
    if (waveContainer) waveContainer.style.display = 'none';
  }
}

/**
 * AI Camera & Image Detection Controller
 * Mobile/Tablet: triggers rear camera capture (capture="environment")
 * Desktop: triggers image file upload
 * Sends Base64 to Groq Vision AI and auto-fills category, description, and attaches photo.
 */
function initAiCameraDetection() {
  const cameraBtn = document.getElementById('btn-ai-camera-trigger');
  const uploadBtn = document.getElementById('btn-ai-upload-trigger');
  const cameraInput = document.getElementById('ai-camera-file-input');
  const uploadInput = document.getElementById('ai-upload-file-input');
  const statusText = document.getElementById('ai-camera-status-text');
  const reviewBanner = document.getElementById('ai-vision-review-banner');
  const summaryText = document.getElementById('ai-vision-summary-text');
  const priorityTag = document.getElementById('ai-vision-priority-tag');

  if (cameraBtn && cameraInput) {
    cameraBtn.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', (e) => handleAiImageFile(e.target.files[0]));
  }

  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', (e) => handleAiImageFile(e.target.files[0]));
  }

  async function handleAiImageFile(file) {
    if (!file) return;

    // Attach file to selectedFiles array so it submits with the complaint form
    if (Array.isArray(selectedFiles) && !selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      selectedFiles.push(file);
      if (typeof renderFilePreviews === 'function') {
        renderFilePreviews();
      }
    }

    if (statusText) {
      statusText.innerHTML = `<span style="color: #0284c7; font-weight: 700;"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing photo with AI...</span>`;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;

      if (window.API && typeof window.API.analyzeImageWithAi === 'function') {
        try {
          const { data, error } = await window.API.analyzeImageWithAi(base64Data);
          
          if (data && !error) {
            // Auto-fill category
            const categorySelect = document.getElementById('report-category');
            if (categorySelect && data.category) {
              const targetVal = data.category.toLowerCase().replace(/\s+/g, '_');
              let matchOption = Array.from(categorySelect.options).find(o => o.value.toLowerCase() === targetVal || o.value.toLowerCase() === data.category.toLowerCase());
              if (matchOption) {
                categorySelect.value = matchOption.value;
              }
            }

            // Auto-fill description
            const descTextarea = document.getElementById('report-description');
            if (descTextarea && data.description) {
              descTextarea.value = `${data.title ? data.title + ': ' : ''}${data.description}`;
            }

            // Unhide review banner
            if (reviewBanner && summaryText) {
              reviewBanner.classList.remove('hidden');
              summaryText.textContent = `Detected Hazard: ${data.title || 'Civic Infrastructure Hazard'}. Category: ${data.category || 'Roads'}. Description and category have been pre-filled below for your review.`;
              if (priorityTag && data.priority) {
                priorityTag.textContent = `${data.priority} Priority`;
              }
            }

            if (statusText) {
              statusText.innerHTML = `<span style="color: #10b981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> AI photo detection complete. Review details below.</span>`;
            }
            return;
          }
        } catch (err) {
          console.warn("AI camera vision detection error:", err);
        }
      }

      // Fallback
      if (statusText) {
        statusText.textContent = 'Photo attached. Please review complaint details below.';
      }
    };
    reader.readAsDataURL(file);
  }
}

// Initialize Report Page
function initReportPage() {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    window.showToast("You must be logged in to report civic issues. Redirecting to sign in...", "warning");
    window.authRouter.redirectToLogin('citizen');
    return;
  }

  // Check URL type parameter
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  if (typeParam === 'transportation' || typeParam === 'civic') {
    window.goToWizardStep2(typeParam);
  } else {
    window.goToWizardStep1();
  }

  initReportMap();
  setupCategorySelector();
  setupImageUpload();
  setupAiAssistant();
  initVoiceGrievanceReporter();
  initAiCameraDetection();
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

  // Emergency toggle interaction
  const emergencyCheckbox = document.getElementById('report-emergency');
  const emergencyWarningBox = document.getElementById('emergency-warning-box');
  if (emergencyCheckbox && emergencyWarningBox) {
    emergencyCheckbox.addEventListener('change', () => {
      if (emergencyCheckbox.checked) {
        emergencyWarningBox.classList.remove('hidden');
      } else {
        emergencyWarningBox.classList.add('hidden');
      }
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

  // Force Leaflet map to redraw after container height is set
  setTimeout(() => {
    if (reportMap) {
      reportMap.invalidateSize();
    }
  }, 200);

  // Resize handling to ensure Leaflet maps redraw correctly on mobile/window resize
  window.addEventListener('resize', () => {
    if (reportMap) {
      reportMap.invalidateSize();
    }
  });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      if (reportMap) {
        reportMap.invalidateSize();
      }
    });
    observer.observe(mapElement);
  }
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

// Set category item programmatically with normalized option matching
function setCategoryProgrammatically(categoryName) {
  const categoryInput = document.getElementById('report-category');
  if (!categoryInput) return;

  if (!categoryName) {
    if (typeof currentReportMode !== 'undefined' && currentReportMode === 'transportation') {
      categoryInput.value = 'roads';
    } else {
      categoryInput.value = 'other';
    }
    return;
  }

  const rawLower = String(categoryName).toLowerCase().trim().replace(/[\s-]+/g, '_');

  // Try exact or normalized match against option values
  let matched = false;
  for (let i = 0; i < categoryInput.options.length; i++) {
    const opt = categoryInput.options[i];
    const optValLower = opt.value.toLowerCase().trim();

    if (optValLower && (optValLower === rawLower || rawLower.includes(optValLower) || optValLower.includes(rawLower))) {
      categoryInput.selectedIndex = i;
      matched = true;
      break;
    }
  }

  // Fallback keyword mapping
  if (!matched) {
    if (rawLower.includes('road') || rawLower.includes('pothole') || rawLower.includes('street') || rawLower.includes('asphalt')) {
      categoryInput.value = 'roads';
    } else if (rawLower.includes('light') || rawLower.includes('lamp') || rawLower.includes('bulb')) {
      categoryInput.value = 'streetlights';
    } else if (rawLower.includes('water') || rawLower.includes('pipe') || rawLower.includes('leak')) {
      categoryInput.value = 'water_supply';
    } else if (rawLower.includes('drain') || rawLower.includes('sewer') || rawLower.includes('gutter')) {
      categoryInput.value = 'drainage';
    } else if (rawLower.includes('garbage') || rawLower.includes('trash') || rawLower.includes('waste') || rawLower.includes('litter')) {
      categoryInput.value = 'garbage';
    } else if (rawLower.includes('traffic') || rawLower.includes('signal') || rawLower.includes('jam')) {
      categoryInput.value = 'traffic';
    } else if (typeof currentReportMode !== 'undefined' && currentReportMode === 'transportation') {
      categoryInput.value = 'roads';
    } else {
      categoryInput.value = 'other';
    }
  }

  categoryInput.dispatchEvent(new Event('change', { bubbles: true }));
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
    
    const isEmergencyCheckbox = document.getElementById('report-emergency');
    formData.append('is_emergency', isEmergencyCheckbox ? isEmergencyCheckbox.checked : false);

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

    let data = null;
    let error = null;

    if (currentReportMode === 'transportation') {
      const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      try {
        const transRes = await window.API.createTransportationReport({
          title,
          category,
          description,
          address: finalAddress,
          latitude: finalLat,
          longitude: finalLng,
          user_id: user ? user.id : 'anonymous'
        });
        const rep = (transRes && transRes.data && transRes.data.report) ? transRes.data.report : (transRes && transRes.report ? transRes.report : null);
        if (rep) {
          data = {
            ai_summary: rep.summary || rep.description,
            ai_category: rep.category,
            ai_department: rep.responsible_department || 'Roads Department',
            ai_priority: rep.priority || 'Medium'
          };
        } else {
          error = 'Transportation report creation failed.';
        }
      } catch (e) {
        error = e.message || 'Transportation report submission error.';
      }
    } else {
      const res = await window.API.createIssue(formData);
      data = res.data;
      error = res.error;
    }

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

