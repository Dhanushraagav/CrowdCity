// CrowdCity AI v2.0 - Smart Mobility & Intelligent Transit JavaScript
// Controls Leaflet maps, live bus animations, EV charging station directories,
// congestion heat maps, accident blackspot AI analysis, smart parking, and Groq AI Route Planner.

(function() {
  'use strict';

  const CITY_COORDS = {
    ariyalur: { lat: 11.1401, lon: 79.0786, name: 'Ariyalur District' },
    chengalpattu: { lat: 12.6841, lon: 79.9836, name: 'Chengalpattu District' },
    chennai: { lat: 13.0827, lon: 80.2707, name: 'Chennai Metropolitan' },
    coimbatore: { lat: 11.0168, lon: 76.9558, name: 'Coimbatore District' },
    cuddalore: { lat: 11.7480, lon: 79.7714, name: 'Cuddalore District' },
    dharmapuri: { lat: 12.1357, lon: 78.1560, name: 'Dharmapuri District' },
    dindigul: { lat: 10.3673, lon: 77.9803, name: 'Dindigul District' },
    erode: { lat: 11.3410, lon: 77.7172, name: 'Erode District' },
    kallakurichi: { lat: 11.7384, lon: 78.9639, name: 'Kallakurichi District' },
    kanchipuram: { lat: 12.8342, lon: 79.7036, name: 'Kanchipuram District' },
    kanyakumari: { lat: 8.0883, lon: 77.5385, name: 'Kanyakumari (Nagercoil)' },
    karur: { lat: 10.9601, lon: 78.0766, name: 'Karur District' },
    krishnagiri: { lat: 12.5186, lon: 78.2137, name: 'Krishnagiri District' },
    madurai: { lat: 9.9252, lon: 78.1198, name: 'Madurai District' },
    mayiladuthurai: { lat: 11.1085, lon: 79.6568, name: 'Mayiladuthurai District' },
    nagapattinam: { lat: 10.7656, lon: 79.8424, name: 'Nagapattinam District' },
    namakkal: { lat: 11.2189, lon: 78.1674, name: 'Namakkal District' },
    nilgiris: { lat: 11.4102, lon: 76.6950, name: 'Nilgiris (Ooty)' },
    perambalur: { lat: 11.2342, lon: 78.8820, name: 'Perambalur District' },
    pudukkottai: { lat: 10.3833, lon: 78.8000, name: 'Pudukkottai District' },
    ramanathapuram: { lat: 9.3639, lon: 78.8395, name: 'Ramanathapuram District' },
    ranipet: { lat: 12.9272, lon: 79.3331, name: 'Ranipet District' },
    salem: { lat: 11.6643, lon: 78.1460, name: 'Salem District' },
    sivaganga: { lat: 9.8433, lon: 78.4809, name: 'Sivaganga District' },
    tenkasi: { lat: 8.9593, lon: 77.3150, name: 'Tenkasi District' },
    thanjavur: { lat: 10.7870, lon: 79.1378, name: 'Thanjavur District' },
    theni: { lat: 10.0104, lon: 77.4768, name: 'Theni District' },
    thoothukudi: { lat: 8.7642, lon: 78.1348, name: 'Thoothukudi (Tuticorin)' },
    trichy: { lat: 10.7905, lon: 78.7047, name: 'Tiruchirappalli (Trichy)' },
    tirunelveli: { lat: 8.7139, lon: 77.7567, name: 'Tirunelveli District' },
    tirupathur: { lat: 12.4925, lon: 78.5678, name: 'Tirupathur District' },
    tiruppur: { lat: 11.1085, lon: 77.3411, name: 'Tiruppur District' },
    tiruvallur: { lat: 13.1439, lon: 79.9056, name: 'Tiruvallur District' },
    tiruvannamalai: { lat: 12.2253, lon: 79.0747, name: 'Tiruvannamalai District' },
    tiruvarur: { lat: 10.7726, lon: 79.6365, name: 'Tiruvarur District' },
    vellore: { lat: 12.9165, lon: 79.1325, name: 'Vellore District' },
    viluppuram: { lat: 11.9401, lon: 79.4861, name: 'Viluppuram District' },
    virudhunagar: { lat: 9.5872, lon: 77.9570, name: 'Virudhunagar District' }
  };

  let activeCity = 'coimbatore';
  let activeTab = 'traffic';
  let map = null;
  let mapLayerGroup = null;
  let busAnimationInterval = null;

  // Mock Telemetry Data
  const EV_STATIONS = [
    { id: 1, name: 'T. Nagar Smart EV Charging Hub', lat: 13.0418, lon: 80.2341, city: 'chennai', plugs: '4/6 Free', power: '60kW Fast DC', price: '₹15/kWh' },
    { id: 2, name: 'Gandhipuram Bus Stand Fast EV Depot', lat: 11.0183, lon: 76.9644, city: 'coimbatore', plugs: '8/10 Free', power: '120kW Supercharger', price: '₹14/kWh' },
    { id: 3, name: 'RS Puram Green Mobility Hub', lat: 11.0069, lon: 76.9515, city: 'coimbatore', plugs: '2/4 Free', power: '30kW Fast DC', price: '₹12/kWh' },
    { id: 4, name: 'Madurai Junction EV Express', lat: 9.9195, lon: 78.1126, city: 'madurai', plugs: '5/6 Free', power: '50kW DC', price: '₹13/kWh' }
  ];

  const SMART_PARKING = [
    { name: 'Gandhipuram Multi-Level Car Parking', open: 142, total: 250, rate: '₹20/hr', status: 'Available', city: 'coimbatore' },
    { name: 'RS Puram Commercial Plaza Parking', open: 18, total: 120, rate: '₹30/hr', status: 'Filling Fast', city: 'coimbatore' },
    { name: 'T. Nagar Pedestrian Building Parking', open: 85, total: 400, rate: '₹40/hr', status: 'Available', city: 'chennai' },
    { name: 'Meenakshi Temple Visitor Parking', open: 34, total: 180, rate: '₹25/hr', status: 'Available', city: 'madurai' }
  ];

  const BUS_ROUTES = [
    { route: 'Route 12B (Avinashi Rd Express)', busId: 'TN-38-N-2415', lat: 11.0250, lon: 76.9800, deltaLat: -0.0005, deltaLon: -0.0008, speed: '34 km/h', eta: '4 mins to Fun Republic', city: 'coimbatore' },
    { route: 'Route 45A (Trichy Rd Circular)', busId: 'TN-38-N-1890', lat: 11.0020, lon: 76.9600, deltaLat: 0.0006, deltaLon: 0.0005, speed: '28 km/h', eta: '7 mins to Railway Station', city: 'coimbatore' }
  ];

  const ACCIDENT_HOTSPOTS = [
    { location: 'LKM Junction (Avinashi Road Flyover Merge)', risk: 'High', cause: 'High Speed Weaving & Signal Bypass', recommendation: 'Enforce Automated Speed Cameras & Reduce Speed Limit to 40km/h.', city: 'coimbatore' },
    { location: 'Singanallur Bus Stand Crossing', risk: 'Critical', cause: 'Pedestrian Crossing Inundation & Blind Curve', recommendation: 'Install High-Mast Pedestrian Signal & Foot Overbridge.', city: 'coimbatore' },
    { location: 'Kathipara Cloverleaf Outer Loop', risk: 'High', cause: 'Wet Surface Skidding & Sharp Radius Exit', recommendation: 'Apply Anti-Skid Thermoplastic Friction Grip Layer.', city: 'chennai' }
  ];

  const ROAD_CLOSURES = [
    { title: 'Stormwater Drain Construction - DB Road', status: 'Closed for 48 Hours', detour: 'Divert via Lawley Road Corridor', city: 'coimbatore' },
    { title: 'Metro Rail Pillar Erection - Anna Salai', status: 'Single Lane Restricted', detour: 'Use Mount-Poonamallee Bypass', city: 'chennai' }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    renderTabContent();
  });

  function initMap() {
    const mapEl = document.getElementById('mobility-map');
    if (!mapEl) return;

    const coords = CITY_COORDS[activeCity];
    map = L.map('mobility-map', { zoomControl: true }).setView([coords.lat, coords.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | CrowdCity AI Smart Mobility'
    }).addTo(map);

    mapLayerGroup = L.layerGroup().addTo(map);
  }

  function setupEventListeners() {
    // City Selector
    const citySelect = document.getElementById('select-city-sector');
    if (citySelect) {
      citySelect.addEventListener('change', (e) => {
        activeCity = e.target.value;
        const coords = CITY_COORDS[activeCity];
        if (map && coords) {
          map.setView([coords.lat, coords.lon], 13);
        }
        renderTabContent();
      });
    }

    // Tabs Switcher
    const tabs = document.querySelectorAll('.mobility-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        renderTabContent();
      });
    });
  }

  function renderTabContent() {
    if (!mapLayerGroup) return;
    mapLayerGroup.clearLayers();

    if (busAnimationInterval) {
      clearInterval(busAnimationInterval);
      busAnimationInterval = null;
    }

    const container = document.getElementById('mobility-tab-content');
    if (!container) return;

    if (activeTab === 'traffic') {
      renderTrafficView(container);
    } else if (activeTab === 'ev') {
      renderEVView(container);
    } else if (activeTab === 'bus') {
      renderBusView(container);
    } else if (activeTab === 'hotspots') {
      renderHotspotsView(container);
    } else if (activeTab === 'parking') {
      renderParkingView(container);
    } else if (activeTab === 'closures') {
      renderClosuresView(container);
    } else if (activeTab === 'route') {
      renderRoutePlannerView(container);
    }
  }

  // 1. Live Traffic & Heat Map
  function renderTrafficView(container) {
    const coords = CITY_COORDS[activeCity];
    
    // Draw traffic corridors on map
    const greenPoly = L.polyline([
      [coords.lat + 0.01, coords.lon - 0.02],
      [coords.lat + 0.005, coords.lon],
      [coords.lat - 0.005, coords.lon + 0.015]
    ], { color: '#10b981', weight: 6, opacity: 0.85 }).addTo(mapLayerGroup);
    greenPoly.bindPopup("<b>Avinashi Arterial Bypass:</b> Smooth Traffic Flow (48 km/h)");

    const redPoly = L.polyline([
      [coords.lat - 0.01, coords.lon - 0.01],
      [coords.lat, coords.lon],
      [coords.lat + 0.015, coords.lon + 0.005]
    ], { color: '#ef4444', weight: 6, opacity: 0.85 }).addTo(mapLayerGroup);
    redPoly.bindPopup("<b>Commercial Junction Corridor:</b> Heavy Congestion (12 km/h)");

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        <div class="mobility-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
            <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">City Traffic Telemetry</h3>
            <span class="status-pill" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">Live Monitoring</span>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0 0 1rem 0;">Average inner-city vehicular speed is 32 km/h across major arterial corridors.</p>
          <div style="display: flex; gap: 0.75rem;">
            <div style="flex: 1; background: var(--bg-app); padding: 0.75rem; border-radius: 10px; text-align: center;">
              <div style="font-size: 1.15rem; font-weight: 800; color: #10b981;">78%</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Smooth Flow</div>
            </div>
            <div style="flex: 1; background: var(--bg-app); padding: 0.75rem; border-radius: 10px; text-align: center;">
              <div style="font-size: 1.15rem; font-weight: 800; color: #ef4444;">22%</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Congested</div>
            </div>
          </div>
        </div>

        <div class="mobility-card">
          <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.75rem 0;">Primary Bottleneck Sectors</h3>
          <ul style="margin: 0; padding-left: 0; list-style: none;">
            <li style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.5rem;">
              <span><strong>Gandhipuram Signal Flyover</strong></span>
              <span style="color: #ef4444; font-weight: 700;">14 km/h Delay</span>
            </li>
            <li style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.5rem;">
              <span><strong>Trichy Road Underpass</strong></span>
              <span style="color: #f59e0b; font-weight: 700;">22 km/h Moderate</span>
            </li>
            <li style="display: flex; justify-content: space-between; font-size: 0.82rem;">
              <span><strong>Western Bypass Road</strong></span>
              <span style="color: #10b981; font-weight: 700;">52 km/h Clear</span>
            </li>
          </ul>
        </div>
      </div>
    `;
  }

  // 2. EV Charging Stations
  function renderEVView(container) {
    const stations = EV_STATIONS.filter(s => s.city === activeCity || activeCity === 'coimbatore');
    
    stations.forEach(st => {
      const marker = L.marker([st.lat, st.lon]).addTo(mapLayerGroup);
      marker.bindPopup(`
        <div style="font-family: var(--font-body); padding: 0.2rem;">
          <h4 style="margin: 0 0 0.35rem 0; font-size: 0.9rem; color: #0d9488;">${st.name}</h4>
          <p style="margin: 0 0 0.35rem 0; font-size: 0.78rem;"><b>Plugs:</b> ${st.plugs} | <b>Speed:</b> ${st.power}</p>
          <p style="margin: 0; font-size: 0.78rem; color: #64748b;"><b>Tariff:</b> ${st.price}</p>
        </div>
      `);
    });

    const cardsHtml = stations.map(st => `
      <div class="mobility-card">
        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(13, 148, 136, 0.12); color: #0d9488; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
            <i class="fa-solid fa-bolt"></i>
          </div>
          <div>
            <h4 style="font-size: 0.92rem; font-weight: 800; margin: 0; color: var(--text-main);">${st.name}</h4>
            <span style="font-size: 0.74rem; color: var(--text-muted);">${st.power} &bull; ${st.price}</span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 0.6rem; margin-top: 0.6rem;">
          <span class="status-pill" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">${st.plugs}</span>
          <button type="button" class="btn btn-secondary" onclick="window.showToast('Navigating to ${st.name}', 'info')" style="padding: 0.35rem 0.75rem; font-size: 0.76rem; border-radius: 8px;">
            <i class="fa-solid fa-location-arrow"></i> Navigate
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        ${cardsHtml}
      </div>
    `;
  }

  // 3. Live Bus Tracking
  function renderBusView(container) {
    const buses = BUS_ROUTES;

    let busMarkers = [];
    buses.forEach(b => {
      const marker = L.marker([b.lat, b.lon], {
        icon: L.divIcon({
          className: 'bus-marker-icon',
          html: `<div style="background: #0d9488; color: #fff; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><i class="fa-solid fa-bus"></i></div>`,
          iconSize: [32, 32]
        })
      }).addTo(mapLayerGroup);
      marker.bindPopup(`<b>${b.route}</b><br/>Bus Reg: ${b.busId}<br/>ETA: ${b.eta}`);
      busMarkers.push({ marker, data: b });
    });

    // Animate bus position on map
    busAnimationInterval = setInterval(() => {
      busMarkers.forEach(item => {
        item.data.lat += item.data.deltaLat * 0.1;
        item.data.lon += item.data.deltaLon * 0.1;
        item.marker.setLatLng([item.data.lat, item.data.lon]);
      });
    }, 2000);

    const busCardsHtml = buses.map(b => `
      <div class="mobility-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
          <div>
            <h4 style="font-size: 0.92rem; font-weight: 800; margin: 0; color: var(--text-main);">${b.route}</h4>
            <span style="font-size: 0.74rem; color: var(--text-muted);">${b.busId} &bull; ${b.speed}</span>
          </div>
          <span class="status-pill" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6;">Live Tracking</span>
        </div>
        <div style="background: var(--bg-app); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.78rem; color: var(--text-main); font-weight: 600;">
          <i class="fa-solid fa-clock" style="color: var(--primary);"></i> ${b.eta}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        ${busCardsHtml}
      </div>
    `;
  }

  // 4. Accident Hotspots (AI)
  function renderHotspotsView(container) {
    const spots = ACCIDENT_HOTSPOTS;

    spots.forEach(sp => {
      const circle = L.circle([11.0150, 76.9600], {
        color: sp.risk === 'Critical' ? '#ef4444' : '#f59e0b',
        fillColor: sp.risk === 'Critical' ? '#ef4444' : '#f59e0b',
        fillOpacity: 0.35,
        radius: 400
      }).addTo(mapLayerGroup);
      circle.bindPopup(`<b>${sp.location}</b><br/>Risk: ${sp.risk}<br/>Cause: ${sp.cause}`);
    });

    const cardsHtml = spots.map(sp => `
      <div class="mobility-card" style="border-left: 4px solid ${sp.risk === 'Critical' ? '#ef4444' : '#f59e0b'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="font-size: 0.92rem; font-weight: 800; margin: 0; color: var(--text-main);">${sp.location}</h4>
          <span class="status-pill" style="background: ${sp.risk === 'Critical' ? 'rgba(239, 68, 68, 0.14)' : 'rgba(245, 158, 11, 0.14)'}; color: ${sp.risk === 'Critical' ? '#ef4444' : '#f59e0b'};">${sp.risk} Risk</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.6rem 0;"><b>Primary Hazard Cause:</b> ${sp.cause}</p>
        <div style="background: var(--bg-app); padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.78rem; color: var(--text-main);">
          <i class="fa-solid fa-wand-magic-sparkles" style="color: #8b5cf6;"></i> <b>Groq AI Mitigation Recommendation:</b> ${sp.recommendation}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
        ${cardsHtml}
      </div>
    `;
  }

  // 5. Smart Parking
  function renderParkingView(container) {
    const cardsHtml = SMART_PARKING.map(p => `
      <div class="mobility-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
          <div>
            <h4 style="font-size: 0.92rem; font-weight: 800; margin: 0; color: var(--text-main);">${p.name}</h4>
            <span style="font-size: 0.74rem; color: var(--text-muted);">${p.rate}</span>
          </div>
          <span class="status-pill" style="background: rgba(16, 185, 129, 0.14); color: #10b981;">${p.status}</span>
        </div>
        <div style="margin-bottom: 0.6rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.35rem;">
            <span>Available Capacity</span>
            <span style="color: var(--primary);">${p.open} / ${p.total} Slots</span>
          </div>
          <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
            <div style="height: 100%; width: ${(p.open / p.total) * 100}%; background: var(--primary); border-radius: 999px;"></div>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        ${cardsHtml}
      </div>
    `;
  }

  // 6. Road Closures
  function renderClosuresView(container) {
    const cardsHtml = ROAD_CLOSURES.map(cl => `
      <div class="mobility-card" style="border-left: 4px solid #ef4444;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="font-size: 0.92rem; font-weight: 800; margin: 0; color: var(--text-main);">${cl.title}</h4>
          <span class="status-pill" style="background: rgba(239, 68, 68, 0.14); color: #ef4444;">${cl.status}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;"><b>Recommended Detour:</b> ${cl.detour}</p>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
        ${cardsHtml}
      </div>
    `;
  }

  // 7. AI Route Planner
  function renderRoutePlannerView(container) {
    container.innerHTML = `
      <div style="max-width: 680px; margin: 0 auto;" class="mobility-card">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
          <i class="fa-solid fa-wand-magic-sparkles" style="color: #8b5cf6; font-size: 1.2rem;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--text-main);">Groq AI Route & Traffic Navigator</h3>
        </div>

        <form id="form-ai-route-planner" style="display: grid; gap: 0.9rem; margin-bottom: 1.25rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">Origin Location</label>
              <input type="text" id="route-origin" class="form-control" placeholder="e.g. Gandhipuram Bus Stand" value="Gandhipuram Bus Stand" required style="padding: 0.6rem 0.85rem; font-size: 0.85rem; border-radius: 10px;" />
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">Destination</label>
              <input type="text" id="route-destination" class="form-control" placeholder="e.g. Coimbatore Airport" value="Coimbatore Airport" required style="padding: 0.6rem 0.85rem; font-size: 0.85rem; border-radius: 10px;" />
            </div>
          </div>

          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">Mode of Travel</label>
            <select id="route-mode" class="form-control" style="padding: 0.6rem 0.85rem; font-size: 0.85rem; border-radius: 10px;">
              <option value="Car">Car / Cab</option>
              <option value="EV Vehicle">Electric Vehicle (EV)</option>
              <option value="Two-Wheeler">Two-Wheeler / Bike</option>
              <option value="Public Bus">Public Bus Transit</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="padding: 0.7rem 1.4rem; font-size: 0.88rem; font-weight: 700; border-radius: 10px; width: 100%;">
            <i class="fa-solid fa-route"></i> Generate Groq AI Optimal Route
          </button>
        </form>

        <div id="ai-route-results-container" style="display: none;"></div>
      </div>
    `;

    const form = document.getElementById('form-ai-route-planner');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const origin = document.getElementById('route-origin').value.trim();
        const destination = document.getElementById('route-destination').value.trim();
        const travelMode = document.getElementById('route-mode').value;

        const resultsEl = document.getElementById('ai-route-results-container');
        resultsEl.style.display = 'block';
        resultsEl.innerHTML = `
          <div style="text-align: center; padding: 1.5rem;">
            <i class="fa-solid fa-circle-notch fa-spin" style="color: #8b5cf6; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Groq AI analyzing live traffic, flood risks, and road closures...</p>
          </div>
        `;

        try {
          const res = await fetch('/api/ai/route-planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination, travelMode })
          });
          const routeData = await res.json();
          renderRouteResult(resultsEl, routeData);
        } catch (err) {
          const fallbackData = {
            recommendedRouteName: `${origin} to ${destination} Direct Flyover Corridor`,
            estimatedTimeMinutes: 22,
            distanceKm: 12.4,
            trafficCondition: 'Smooth',
            avoidanceAdvice: 'Bypass market intersection signal during peak commute hours.',
            turnDirections: [
              `Depart ${origin} heading east on main arterial road`,
              `Merge onto Elevated Flyover Bypass`,
              `Take exit towards ${destination}`,
              `Arrive safely at ${destination}`
            ],
            safetyNote: `Optimal for ${travelMode}. Maintain safe driving distance.`
          };
          renderRouteResult(resultsEl, fallbackData);
        }
      });
    }
  }

  function renderRouteResult(resultsEl, data) {
    const stepsHtml = (data.turnDirections || []).map((step, idx) => `
      <li style="margin-bottom: 0.4rem; display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; color: var(--text-main);">
        <span style="width: 20px; height: 20px; border-radius: 50%; background: rgba(13, 148, 136, 0.15); color: var(--primary); font-weight: 800; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${idx + 1}</span>
        ${step}
      </li>
    `).join('');

    resultsEl.innerHTML = `
      <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.1rem; margin-top: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <h4 style="font-size: 0.98rem; font-weight: 800; color: var(--primary); margin: 0;">${data.recommendedRouteName}</h4>
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">${data.distanceKm} km &bull; ${data.estimatedTimeMinutes} mins est.</span>
          </div>
          <span class="status-pill" style="background: rgba(16, 185, 129, 0.14); color: #10b981;">${data.trafficCondition} Traffic</span>
        </div>

        <p style="font-size: 0.82rem; color: var(--text-main); margin: 0 0 0.85rem 0; font-weight: 500;">
          <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> <b>Avoidance Advice:</b> ${data.avoidanceAdvice}
        </p>

        <div style="margin-bottom: 0.85rem;">
          <strong style="font-size: 0.78rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.4rem;">Turn-by-Turn Navigation</strong>
          <ul style="margin: 0; padding-left: 0; list-style: none;">${stepsHtml}</ul>
        </div>

        <div style="background: rgba(139, 92, 246, 0.08); padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.78rem; color: #6d28d9; font-weight: 600;">
          <i class="fa-solid fa-shield-halved"></i> <b>Safety Note:</b> ${data.safetyNote}
        </div>
      </div>
    `;
  }

  window.refreshMobilityData = function() {
    renderTabContent();
    if (typeof window.showToast === 'function') {
      window.showToast('Smart Mobility telemetry synchronized!', 'success');
    }
  };

})();
