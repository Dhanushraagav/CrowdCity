// CrowdCity AI v2.0 - Smart City Alerts & Weather Risk Assessment Module
// Embeds a sleek weather alert card directly inside the Left Sidebar Navigation, which expands into a full Groq AI Risk Assessment modal.

(function() {
  'use strict';

  const DEFAULT_LAT = 13.0827; // Chennai / Tamil Nadu default latitude
  const DEFAULT_LON = 80.2707; // Chennai / Tamil Nadu default longitude

  let currentCoords = { lat: DEFAULT_LAT, lon: DEFAULT_LON, locationName: 'Chennai Metropolitan' };
  let cachedAlertData = null;
  let cachedWeatherData = null;
  let isModalOpen = false;

  async function initSmartCityAlerts() {
    const root = ensureFloatingContainer();
    renderSkeletonSidebarWidget();

    // Acquire browser geolocation if permitted
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentCoords.lat = pos.coords.latitude;
          currentCoords.lon = pos.coords.longitude;
          currentCoords.locationName = 'Your Live Location';
          loadAlertsData();
        },
        () => {
          loadAlertsData(); // Fallback coordinates
        },
        { timeout: 5000 }
      );
    } else {
      loadAlertsData();
    }
  }

  function ensureFloatingContainer() {
    let container = document.getElementById('smart-alerts-floating-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'smart-alerts-floating-root';
      document.body.appendChild(container);
    }
    return container;
  }

  function renderSkeletonSidebarWidget() {
    const sidebarNav = document.querySelector('.app-sidebar-nav') || document.querySelector('.app-sidebar') || document.querySelector('.sidebar');
    if (!sidebarNav) return;

    let widget = document.getElementById('smart-alerts-sidebar-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'smart-alerts-sidebar-widget';
      sidebarNav.appendChild(widget);
    }

    widget.innerHTML = `
      <div style="margin: 1.25rem 0.75rem 0.75rem 0.75rem; padding: 0.75rem 0.85rem; border-radius: 14px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e2e8f0); display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-spinner fa-spin" style="color: var(--primary, #0d9488); font-size: 0.85rem;"></i>
        <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-muted, #64748b);">Checking weather alerts...</span>
      </div>
    `;
  }

  async function loadAlertsData() {
    const root = ensureFloatingContainer();

    try {
      // 1. Fetch live weather from free Open-Meteo API
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,showers_sum,precipitation_hours,precipitation_probability_max&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      const weatherJson = await weatherRes.json();
      
      const currentWeather = weatherJson.current || {};
      const dailyWeather = weatherJson.daily || {};
      
      cachedWeatherData = {
        precipitation: currentWeather.precipitation || 0,
        rain: currentWeather.rain || 0,
        temperature: currentWeather.temperature_2m || 28,
        weather_code: currentWeather.weather_code || 0,
        precipitation_probability_max: (dailyWeather.precipitation_probability_max && dailyWeather.precipitation_probability_max[0]) || 0
      };

      // 2. Count nearby waterlogging complaints
      let waterloggingCount = 0;
      try {
        const storedDocs = JSON.parse(localStorage.getItem('cc_user_uploaded_docs') || '[]');
        waterloggingCount = storedDocs.filter(d => (d.doc_name || '').toLowerCase().includes('waterlog') || (d.doc_type || '').includes('drain')).length;
      } catch (e) {}

      // 3. Request Groq AI Smart City Risk Assessment
      let aiResult = null;
      try {
        const apiRes = await fetch('/api/ai/smart-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weatherData: cachedWeatherData, waterloggingCount })
        });
        if (apiRes.ok) {
          aiResult = await apiRes.json();
        }
      } catch (e) {
        console.warn("Groq AI endpoint offline, using client fallback calculation:", e);
      }

      if (!aiResult) {
        aiResult = getClientLocalAlertsFallback(cachedWeatherData.rain, waterloggingCount, cachedWeatherData.temperature);
      }

      cachedAlertData = aiResult;

      // 4. Render Sidebar Card & Modal
      renderSidebarAndModalUI(root, cachedAlertData, cachedWeatherData, currentCoords);

    } catch (err) {
      console.warn("Weather API unreachable, rendering safe default alert:", err);
      cachedAlertData = getClientLocalAlertsFallback(0, 0, 28);
      cachedWeatherData = { temperature: 28, rain: 0 };
      renderSidebarAndModalUI(root, cachedAlertData, cachedWeatherData, currentCoords);
    }
  }

  function getClientLocalAlertsFallback(rainMm, waterloggingCount, tempC) {
    const rain = parseFloat(rainMm || 0);
    if (rain >= 25 || waterloggingCount >= 5) {
      return {
        riskLevel: 'Critical',
        alertHeadline: 'Critical Flood Warning',
        alertBannerRequired: true,
        safetyRecommendation: `Heavy rainfall (${rain}mm) and multiple waterlogging reports detected. Avoid low-lying subways and underpasses. Postpone non-essential commute until drainage clears.`,
        precautionarySteps: ['Avoid flooded subways & underpasses', 'Park vehicles on elevated ground', 'Dial 1913 for municipal assistance']
      };
    } else if (rain >= 10 || waterloggingCount >= 2) {
      return {
        riskLevel: 'High',
        alertHeadline: 'Heavy Rainfall Caution',
        alertBannerRequired: true,
        safetyRecommendation: `Significant rainfall (${rain}mm) and active waterlogging reports detected nearby. Drive cautiously with headlights on and use elevated bypass routes.`,
        precautionarySteps: ['Use elevated bypass corridors', 'Maintain extra braking distance', 'Watch out for submerged manholes']
      };
    } else if (rain >= 2 || waterloggingCount >= 1) {
      return {
        riskLevel: 'Medium',
        alertHeadline: 'Moderate Rain Caution',
        alertBannerRequired: false,
        safetyRecommendation: `Light to moderate rainfall in progress. Road surfaces may be slick; exercise standard caution during travel.`,
        precautionarySteps: ['Keep umbrella accessible', 'Reduce speed on sharp turns', 'Report blocked drains on CrowdCity']
      };
    }
    return {
      riskLevel: 'Low',
      alertHeadline: 'Favorable Weather',
      alertBannerRequired: false,
      safetyRecommendation: 'Live weather conditions are favorable across the municipal sector. Drive safely and enjoy your day.',
      precautionarySteps: ['Drive within municipal speed limits', 'Ensure vehicle headlights are functional', 'Report civic hazards via the Report tab']
    };
  }

  function renderSidebarAndModalUI(root, alertData, weatherData, coords) {
    const risk = alertData.riskLevel || 'Low';
    
    let badgeBg = 'rgba(16, 185, 129, 0.14)';
    let badgeColor = '#10b981';
    let badgeBorder = 'rgba(16, 185, 129, 0.35)';
    let riskIcon = 'fa-solid fa-shield-cat';

    if (risk === 'Critical') {
      badgeBg = 'rgba(239, 68, 68, 0.14)';
      badgeColor = '#ef4444';
      badgeBorder = 'rgba(239, 68, 68, 0.35)';
      riskIcon = 'fa-solid fa-triangle-exclamation';
    } else if (risk === 'High') {
      badgeBg = 'rgba(245, 158, 11, 0.14)';
      badgeColor = '#f59e0b';
      badgeBorder = 'rgba(245, 158, 11, 0.35)';
      riskIcon = 'fa-solid fa-cloud-showers-water';
    } else if (risk === 'Medium') {
      badgeBg = 'rgba(59, 130, 246, 0.14)';
      badgeColor = '#3b82f6';
      badgeBorder = 'rgba(59, 130, 246, 0.35)';
      riskIcon = 'fa-solid fa-cloud-rain';
    }

    const temp = Math.round(weatherData.temperature || 28);
    const rain = (weatherData.rain || weatherData.precipitation || 0).toFixed(1);

    const stepsHtml = (alertData.precautionarySteps || []).map(step => `
      <li style="margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-main, #334155);">
        <i class="fa-solid fa-check" style="color: ${badgeColor}; font-size: 0.75rem;"></i> ${step}
      </li>
    `).join('');

    // Inject into Sidebar Nav Container
    const sidebarNav = document.querySelector('.app-sidebar-nav') || document.querySelector('.app-sidebar') || document.querySelector('.sidebar');
    
    if (sidebarNav) {
      let existingWidget = document.getElementById('smart-alerts-sidebar-widget');
      if (!existingWidget) {
        existingWidget = document.createElement('div');
        existingWidget.id = 'smart-alerts-sidebar-widget';
        sidebarNav.appendChild(existingWidget);
      }

      existingWidget.innerHTML = `
        <div onclick="window.toggleSmartAlertsModal()" 
             style="margin: 1.25rem 0.75rem 0.75rem 0.75rem; padding: 0.75rem 0.85rem; border-radius: 14px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-left: 4px solid ${badgeColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s ease; user-select: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <i class="${riskIcon}" style="color: ${badgeColor}; font-size: 0.85rem;"></i>
              <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-main, #0f172a);">${alertData.alertHeadline || 'City Alert'}</span>
            </div>
            <span style="font-size: 0.62rem; font-weight: 800; text-transform: uppercase; padding: 0.1rem 0.4rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">${risk} Risk</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted, #64748b); font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
            <span>${temp}&deg;C &bull; ${rain}mm Rain</span>
            <span style="color: var(--primary, #0d9488); font-size: 0.68rem; font-weight: 700;">AI Guide &rarr;</span>
          </div>
        </div>
      `;
    }

    // Always render Expandable Detail Modal Backdrop on body
    root.innerHTML = `
      <div id="smart-alerts-modal-backdrop" onclick="if(event.target === this) window.toggleSmartAlertsModal(false)" 
           style="position: fixed; inset: 0; z-index: 9995; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 1rem;">
        
        <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-left: 5px solid ${badgeColor}; border-radius: 20px; width: 100%; max-width: 500px; padding: 1.35rem 1.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.18); position: relative; animation: alertModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <button type="button" onclick="window.toggleSmartAlertsModal(false)" 
                  style="position: absolute; top: 1.1rem; right: 1.1rem; background: var(--bg-app, #f1f5f9); border: none; width: 30px; height: 30px; border-radius: 50%; color: var(--text-muted, #64748b); font-size: 0.95rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            &times;
          </button>

          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem; padding-right: 2rem;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: ${badgeBg}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
              <i class="${riskIcon}"></i>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main, #0f172a); margin: 0;">${alertData.alertHeadline || 'Smart City Risk Assessment'}</h3>
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.15rem 0.55rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                  ${risk} Risk
                </span>
              </div>
              <span style="font-size: 0.78rem; color: var(--text-muted, #64748b); font-weight: 600;">
                <i class="fa-solid fa-location-dot" style="font-size: 0.72rem; color: var(--primary);"></i> ${coords.locationName} &bull; ${temp}&deg;C &bull; ${rain}mm Rain
              </span>
            </div>
          </div>

          <div style="background: var(--bg-app, #f8fafc); border-radius: 14px; padding: 0.95rem 1.1rem; margin-bottom: 1rem; border: 1px solid var(--border-color, #e2e8f0);">
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.35rem;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: #8b5cf6; font-size: 0.85rem;"></i>
              <strong style="font-size: 0.78rem; font-weight: 800; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.04em;">Groq AI Safety Recommendation</strong>
            </div>
            <p style="font-size: 0.86rem; color: var(--text-main, #334155); margin: 0; line-height: 1.55; font-weight: 500;">
              ${alertData.safetyRecommendation}
            </p>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <h4 style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #64748b); margin: 0 0 0.5rem 0;">Key Safety Precautions</h4>
            <ul style="margin: 0; padding-left: 0; list-style: none;">
              ${stepsHtml}
            </ul>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color, #e2e8f0); padding-top: 0.85rem;">
            <button type="button" onclick="window.refreshSmartCityAlerts()" style="background: var(--bg-app, #f8fafc); border: 1px solid var(--border-color, #cbd5e1); color: var(--text-muted, #64748b); padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
              <i class="fa-solid fa-arrows-rotate"></i> Update Location
            </button>

            <button type="button" onclick="window.toggleSmartAlertsModal(false)" class="btn btn-primary" style="padding: 0.45rem 1.1rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px;">
              Got It
            </button>
          </div>

        </div>
      </div>
    `;

    // Trigger toast notification for High or Critical risk
    if ((risk === 'High' || risk === 'Critical') && typeof window.showToast === 'function') {
      window.showToast(`🚨 ${alertData.alertHeadline}: ${alertData.safetyRecommendation}`, risk === 'Critical' ? 'error' : 'warning');
    }
  }

  window.toggleSmartAlertsModal = function(show) {
    const backdrop = document.getElementById('smart-alerts-modal-backdrop');
    if (!backdrop) return;
    if (typeof show === 'boolean') {
      isModalOpen = show;
    } else {
      isModalOpen = !isModalOpen;
    }
    backdrop.style.display = isModalOpen ? 'flex' : 'none';
  };

  window.refreshSmartCityAlerts = function() {
    initSmartCityAlerts();
  };

  document.addEventListener('DOMContentLoaded', () => {
    initSmartCityAlerts();
  });

})();
