// CrowdCity AI v2.0 - Smart City Alerts & Weather Risk Assessment Module
// Fetches live weather data from free Open-Meteo API, queries nearby waterlogging complaints,
// and calls Groq AI to display real-time safety recommendations and flood caution banners.

(function() {
  'use strict';

  const DEFAULT_LAT = 13.0827; // Chennai / Tamil Nadu default latitude
  const DEFAULT_LON = 80.2707; // Chennai / Tamil Nadu default longitude

  let currentCoords = { lat: DEFAULT_LAT, lon: DEFAULT_LON, locationName: 'Chennai Metropolitan' };

  async function initSmartCityAlerts() {
    const container = document.getElementById('smart-alerts-container');
    if (!container) return;

    renderSkeletonAlert(container);

    // Try acquiring browser location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentCoords.lat = pos.coords.latitude;
          currentCoords.lon = pos.coords.longitude;
          currentCoords.locationName = 'Your Live Location';
          loadAlertsData(container);
        },
        () => {
          loadAlertsData(container); // Fallback coords
        },
        { timeout: 5000 }
      );
    } else {
      loadAlertsData(container);
    }
  }

  function renderSkeletonAlert(container) {
    container.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 16px; padding: 1.15rem 1.35rem; margin-bottom: 1.5rem; box-shadow: 0 4px 14px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(13, 148, 136, 0.12); color: #0d9488; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>
          <div style="flex: 1;">
            <div style="height: 14px; width: 180px; background: #e2e8f0; border-radius: 4px; margin-bottom: 6px;"></div>
            <div style="height: 11px; width: 280px; background: #f1f5f9; border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadAlertsData(container) {
    try {
      // 1. Fetch live weather from free Open-Meteo API
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,showers_sum,precipitation_hours,precipitation_probability_max&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      const weatherJson = await weatherRes.json();
      
      const currentWeather = weatherJson.current || {};
      const dailyWeather = weatherJson.daily || {};
      
      const weatherPayload = {
        precipitation: currentWeather.precipitation || 0,
        rain: currentWeather.rain || 0,
        temperature: currentWeather.temperature_2m || 28,
        weather_code: currentWeather.weather_code || 0,
        precipitation_probability_max: (dailyWeather.precipitation_probability_max && dailyWeather.precipitation_probability_max[0]) || 0
      };

      // 2. Count nearby waterlogging complaints from local cache or Supabase
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
          body: JSON.stringify({ weatherData: weatherPayload, waterloggingCount })
        });
        if (apiRes.ok) {
          aiResult = await apiRes.json();
        }
      } catch (e) {
        console.warn("Groq AI endpoint offline, using client fallback calculation:", e);
      }

      if (!aiResult) {
        aiResult = getClientLocalAlertsFallback(weatherPayload.rain, waterloggingCount, weatherPayload.temperature);
      }

      // 4. Render UI Component
      renderAlertCard(container, aiResult, weatherPayload, currentCoords);

    } catch (err) {
      console.warn("Weather API unreachable, rendering safe default alert:", err);
      const defaultResult = getClientLocalAlertsFallback(0, 0, 28);
      renderAlertCard(container, defaultResult, { temperature: 28, rain: 0 }, currentCoords);
    }
  }

  function getClientLocalAlertsFallback(rainMm, waterloggingCount, tempC) {
    const rain = parseFloat(rainMm || 0);
    if (rain >= 25 || waterloggingCount >= 5) {
      return {
        riskLevel: 'Critical',
        alertHeadline: 'Critical Flood & Inundation Warning',
        alertBannerRequired: true,
        safetyRecommendation: `Heavy rainfall (${rain}mm) and multiple waterlogging reports detected. Avoid low-lying subways and underpasses. Postpone non-essential commute until drainage clears.`,
        precautionarySteps: ['Avoid flooded subways & underpasses', 'Park vehicles on elevated ground', 'Dial 1913 for municipal assistance']
      };
    } else if (rain >= 10 || waterloggingCount >= 2) {
      return {
        riskLevel: 'High',
        alertHeadline: 'Heavy Rainfall & Drainage Caution',
        alertBannerRequired: true,
        safetyRecommendation: `Significant rainfall (${rain}mm) and active waterlogging reports detected nearby. Drive cautiously with headlights on and use elevated bypass routes.`,
        precautionarySteps: ['Use elevated bypass corridors', 'Maintain extra braking distance', 'Watch out for submerged manholes']
      };
    } else if (rain >= 2 || waterloggingCount >= 1) {
      return {
        riskLevel: 'Medium',
        alertHeadline: 'Moderate Rain & Wet Road Caution',
        alertBannerRequired: false,
        safetyRecommendation: `Light to moderate rainfall in progress. Road surfaces may be slick; exercise standard caution during travel.`,
        precautionarySteps: ['Keep umbrella accessible', 'Reduce speed on sharp turns', 'Report blocked drains on CrowdCity']
      };
    }
    return {
      riskLevel: 'Low',
      alertHeadline: 'Favorable City Weather',
      alertBannerRequired: false,
      safetyRecommendation: 'Live weather conditions are favorable across the municipal sector. Drive safely and enjoy your day.',
      precautionarySteps: ['Drive within municipal speed limits', 'Ensure vehicle headlights are functional', 'Report civic hazards via the Report tab']
    };
  }

  function renderAlertCard(container, alertData, weatherData, coords) {
    const risk = alertData.riskLevel || 'Low';
    
    let badgeBg = 'rgba(16, 185, 129, 0.12)';
    let badgeColor = '#10b981';
    let badgeBorder = 'rgba(16, 185, 129, 0.3)';
    let cardLeftBorder = '4px solid #10b981';
    let riskIcon = 'fa-solid fa-shield-cat';

    if (risk === 'Critical') {
      badgeBg = 'rgba(239, 68, 68, 0.14)';
      badgeColor = '#ef4444';
      badgeBorder = 'rgba(239, 68, 68, 0.35)';
      cardLeftBorder = '4px solid #ef4444';
      riskIcon = 'fa-solid fa-triangle-exclamation';
    } else if (risk === 'High') {
      badgeBg = 'rgba(245, 158, 11, 0.14)';
      badgeColor = '#f59e0b';
      badgeBorder = 'rgba(245, 158, 11, 0.35)';
      cardLeftBorder = '4px solid #f59e0b';
      riskIcon = 'fa-solid fa-cloud-showers-water';
    } else if (risk === 'Medium') {
      badgeBg = 'rgba(59, 130, 246, 0.12)';
      badgeColor = '#3b82f6';
      badgeBorder = 'rgba(59, 130, 246, 0.3)';
      cardLeftBorder = '4px solid #3b82f6';
      riskIcon = 'fa-solid fa-cloud-rain';
    }

    const temp = Math.round(weatherData.temperature || 28);
    const rain = (weatherData.rain || weatherData.precipitation || 0).toFixed(1);

    const stepsHtml = (alertData.precautionarySteps || []).map(step => `
      <li style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; color: var(--text-main, #334155);">
        <i class="fa-solid fa-check" style="color: ${badgeColor}; font-size: 0.72rem;"></i> ${step}
      </li>
    `).join('');

    container.innerHTML = `
      <div class="smart-city-alert-card" style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-left: ${cardLeftBorder}; border-radius: 16px; padding: 1.15rem 1.35rem; margin-bottom: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03); transition: all 0.25s ease;">
        
        <!-- Header Row -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.85rem;">
          
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-size: 1.05rem;">
              <i class="${riskIcon}"></i>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main, #0f172a); margin: 0;">${alertData.alertHeadline || 'Smart City Alert'}</h3>
                <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.15rem 0.55rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                  ${risk} Risk
                </span>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted, #64748b); font-weight: 600;">
                <i class="fa-solid fa-location-dot" style="font-size: 0.7rem; color: var(--primary);"></i> ${coords.locationName} &bull; ${temp}&deg;C &bull; ${rain}mm Rain
              </span>
            </div>
          </div>

          <button type="button" onclick="window.refreshSmartCityAlerts()" style="background: var(--bg-app, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); color: var(--text-muted, #64748b); padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-arrows-rotate"></i> Update Location
          </button>

        </div>

        <!-- AI Recommendation Section -->
        <div style="background: var(--bg-app, #f8fafc); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 0.85rem; border: 1px solid var(--border-color, #f1f5f9);">
          <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem;">
            <i class="fa-solid fa-wand-magic-sparkles" style="color: #8b5cf6; font-size: 0.8rem;"></i>
            <strong style="font-size: 0.78rem; font-weight: 800; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.04em;">Groq AI Safety Recommendation</strong>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-main, #334155); margin: 0; line-height: 1.5; font-weight: 500;">
            ${alertData.safetyRecommendation}
          </p>
        </div>

        <!-- Actionable Precautionary Bullet Points -->
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${stepsHtml}
        </ul>

      </div>
    `;

    // Trigger toast notification for High or Critical risk
    if ((risk === 'High' || risk === 'Critical') && typeof window.showToast === 'function') {
      window.showToast(`🚨 ${alertData.alertHeadline}: ${alertData.safetyRecommendation}`, risk === 'Critical' ? 'error' : 'warning');
    }
  }

  window.refreshSmartCityAlerts = function() {
    initSmartCityAlerts();
  };

  document.addEventListener('DOMContentLoaded', () => {
    initSmartCityAlerts();
  });

})();
