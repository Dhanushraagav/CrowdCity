/**
 * CrowdCity AI — Dedicated Authority Civic Intelligence Module
 * Version: 1.0.0
 * Pure JavaScript analytics engine with strict RBAC adherence.
 */

(function () {
  'use strict';

  // 38 Official Tamil Nadu Districts for filter population
  const TN_DISTRICTS = [
    { id: 'ariyalur', name: 'Ariyalur' },
    { id: 'chengalpattu', name: 'Chengalpattu' },
    { id: 'chennai', name: 'Chennai' },
    { id: 'coimbatore', name: 'Coimbatore' },
    { id: 'cuddalore', name: 'Cuddalore' },
    { id: 'dharmapuri', name: 'Dharmapuri' },
    { id: 'dindigul', name: 'Dindigul' },
    { id: 'erode', name: 'Erode' },
    { id: 'kallakurichi', name: 'Kallakurichi' },
    { id: 'kancheepuram', name: 'Kancheepuram' },
    { id: 'karur', name: 'Karur' },
    { id: 'krishnagiri', name: 'Krishnagiri' },
    { id: 'madurai', name: 'Madurai' },
    { id: 'mayiladuthurai', name: 'Mayiladuthurai' },
    { id: 'nagapattinam', name: 'Nagapattinam' },
    { id: 'kanniyakumari', name: 'Kanniyakumari' },
    { id: 'namakkal', name: 'Namakkal' },
    { id: 'perambalur', name: 'Perambalur' },
    { id: 'pudukkottai', name: 'Pudukkottai' },
    { id: 'ramanathapuram', name: 'Ramanathapuram' },
    { id: 'ranipet', name: 'Ranipet' },
    { id: 'salem', name: 'Salem' },
    { id: 'sivaganga', name: 'Sivaganga' },
    { id: 'tenkasi', name: 'Tenkasi' },
    { id: 'thanjavur', name: 'Thanjavur' },
    { id: 'theni', name: 'Theni' },
    { id: 'thiruvallur', name: 'Thiruvallur' },
    { id: 'thiruvarur', name: 'Thiruvarur' },
    { id: 'thoothukudi', name: 'Thoothukudi' },
    { id: 'tiruchirappalli', name: 'Tiruchirappalli' },
    { id: 'tirunelveli', name: 'Tirunelveli' },
    { id: 'tirupathur', name: 'Tirupathur' },
    { id: 'tiruppur', name: 'Tiruppur' },
    { id: 'tiruvannamalai', name: 'Tiruvannamalai' },
    { id: 'the_nilgiris', name: 'The Nilgiris' },
    { id: 'vellore', name: 'Vellore' },
    { id: 'viluppuram', name: 'Viluppuram' },
    { id: 'virudhunagar', name: 'Virudhunagar' }
  ];

  // Official Municipal Departments
  const MUNICIPAL_DEPARTMENTS = [
    'Road Department',
    'Electricity & Streetlights',
    'Water Supply & Sewerage',
    'Sanitation & Solid Waste',
    'Drainage & Flood Control',
    'Traffic & Transportation',
    'Parks & Recreation',
    'Public Health & Safety',
    'General Administration'
  ];

  let currentIntelData = null;
  let currentSortColumn = 'total_issues';
  let sortDirection = 'desc';

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const AuthorityCivicIntel = {
    init: async function () {
      // 1. Check Authority Authentication
      const user = window.getCurrentUser ? window.getCurrentUser() : null;
      const rawRole = (typeof getUserRole === 'function') ? getUserRole() : (localStorage.getItem('cc_user_role') || 'authority');
      const isAuth = rawRole === 'authority' || rawRole === 'admin';

      if (!isAuth) {
        window.location.replace('authority-login.html');
        return;
      }

      // 2. Set Officer Identity in Header
      const officerNameEl = document.getElementById('header-user-name');
      if (officerNameEl) {
        const name = (user && (user.full_name || user.email)) || localStorage.getItem('cc_user_name') || 'Municipal Officer';
        officerNameEl.textContent = name;
      }

      // 3. Populate Dropdowns
      this.populateDistrictDropdown();
      this.populateDepartmentDropdown();

      // 4. Fetch and Render Live Data
      await this.loadData();

      // 5. Check Unread Notifications
      this.checkUnreadNotifications();
    },

    populateDistrictDropdown: function () {
      const select = document.getElementById('filter-intel-district');
      if (!select) return;

      select.innerHTML = '<option value="all">All 38 Districts</option>';
      TN_DISTRICTS.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        select.appendChild(opt);
      });
    },

    populateDepartmentDropdown: function () {
      const select = document.getElementById('filter-intel-department');
      if (!select) return;

      select.innerHTML = '<option value="all">All Departments</option>';
      MUNICIPAL_DEPARTMENTS.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        select.appendChild(opt);
      });
    },

    loadData: async function () {
      const getVal = id => {
        const el = document.getElementById(id);
        return el ? el.value : 'all';
      };

      const filters = {
        date_range: getVal('filter-intel-daterange'),
        district: getVal('filter-intel-district'),
        department: getVal('filter-intel-department'),
        category: getVal('filter-intel-category'),
        priority: getVal('filter-intel-priority'),
        status: getVal('filter-intel-status')
      };

      try {
        let res;
        if (window.API && typeof window.API.getAuthorityCivicIntelligence === 'function') {
          res = await window.API.getAuthorityCivicIntelligence(filters);
        } else {
          // Fallback direct request
          const token = localStorage.getItem('supabase.auth.token') || localStorage.getItem('cc_access_token');
          const qs = new URLSearchParams(filters).toString();
          const r = await fetch(`/api/analytics/authority/civic-intelligence?${qs}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          res = await r.json();
        }

        const data = res && res.data ? res.data : res;
        if (!data || !data.overview) {
          throw new Error('Invalid analytics response format');
        }

        currentIntelData = data;
        this.renderAll(data);
      } catch (err) {
        console.error('[Authority Civic Intel] Error loading data:', err);
        const banner = document.getElementById('intel-last-updated');
        if (banner) banner.textContent = 'Failed to load live data. Retrying...';
      }
    },

    renderAll: function (data) {
      // 1. Meta / Scope Banner
      const jurisdictionEl = document.getElementById('intel-jurisdiction-label');
      if (jurisdictionEl && data.meta && data.meta.scope) {
        const s = data.meta.scope;
        if (s.is_admin) {
          jurisdictionEl.textContent = s.active_district === 'all' 
            ? 'Statewide Console (All 38 Districts)' 
            : `District Filtered: ${s.active_district.toUpperCase()}`;
        } else if (s.enforced_district) {
          jurisdictionEl.textContent = `Authorized District: ${s.enforced_district.toUpperCase()} (Restricted)`;
          // Lock district select for district-scoped authority
          const distSelect = document.getElementById('filter-intel-district');
          if (distSelect) {
            distSelect.value = s.enforced_district;
            distSelect.disabled = true;
          }
        } else {
          jurisdictionEl.textContent = 'Municipal Operations Console';
        }
      }

      const updatedEl = document.getElementById('intel-last-updated');
      if (updatedEl) {
        updatedEl.textContent = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST';
      }

      // 2. Overview KPIs
      const o = data.overview || {};
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val !== undefined && val !== null ? val : 0;
      };

      setVal('kpi-intel-total', o.total_complaints);
      setVal('kpi-intel-active', o.active_complaints);
      setVal('kpi-intel-resolved', o.resolved_complaints);
      setVal('kpi-intel-resolution-rate', o.resolution_rate || '0.0%');
      setVal('kpi-intel-critical', o.critical_complaints);
      setVal('kpi-intel-overdue', o.overdue_complaints);
      setVal('kpi-intel-escalated', o.escalated_complaints);
      setVal('kpi-intel-sla-compliance', o.sla_compliance || '100%');

      // 3. Category Analytics Chart
      this.renderCategoryChart(data.category_analytics || []);

      // 4. Hotspots Location Analysis
      this.renderHotspots(data.top_hotspots || []);

      // 5. SLA & Resolution Performance
      this.renderSlaPerformance(data.sla_intelligence || {}, o);

      // 6. Time Trends Chart
      this.renderTimeline(data.timeline || []);

      // 7. District Table / Comparison
      this.renderDistrictTable(data.district_intelligence || [], data.district_comparison);

      // 8. Department Performance Table
      this.renderDepartmentTable(data.department_performance || []);
    },

    renderCategoryChart: function (categories) {
      const container = document.getElementById('chart-intel-categories');
      const countLabel = document.getElementById('intel-cat-total-count');
      if (!container) return;

      if (!categories || categories.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-light); font-size: 0.85rem; padding: 2rem 0;">No category complaints recorded in this scope.</div>';
        if (countLabel) countLabel.textContent = '0 Categories';
        return;
      }

      if (countLabel) countLabel.textContent = `${categories.length} Categories Logged`;

      const maxCount = Math.max(...categories.map(c => c.count), 1);
      const categoryColors = {
        roads: '#2563eb',
        streetlights: '#d97706',
        water_supply: '#0284c7',
        drainage: '#7c3aed',
        garbage: '#059669',
        traffic: '#ea580c',
        public_property: '#475569',
        parks: '#10b981',
        sanitation: '#0d9488',
        safety_hazard: '#dc2626',
        environment: '#16a34a',
        other: '#64748b'
      };

      const bars = categories.map(cat => {
        const color = categoryColors[cat.category.toLowerCase()] || '#0284c7';
        const formattedName = cat.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const widthPct = Math.max(Math.round((cat.count / maxCount) * 100), 2);

        return `
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; font-size: 0.82rem;">
            <div style="width: 110px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(formattedName)}">${escapeHTML(formattedName)}</div>
            <div style="flex: 1; background: var(--bg-canvas); border-radius: 4px; height: 16px; overflow: hidden; border: 1px solid var(--border-light);">
              <div style="width: ${widthPct}%; background: ${color}; height: 100%; border-radius: 2px; transition: width 0.3s ease;"></div>
            </div>
            <div style="width: 40px; font-weight: 700; color: var(--text-main); text-align: right;">${cat.count}</div>
            <div style="width: 45px; font-size: 0.72rem; color: var(--text-light); text-align: right;">${cat.percentage}%</div>
          </div>
        `;
      }).join('');

      container.innerHTML = `<div style="width: 100%;">${bars}</div>`;
    },

    renderHotspots: function (hotspots) {
      const container = document.getElementById('chart-intel-hotspots');
      const countLabel = document.getElementById('intel-hotspots-count');
      if (!container) return;

      if (!hotspots || hotspots.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-light); font-size: 0.85rem; padding: 2rem 0;">No geographic hotspot clusters detected.</div>';
        return;
      }

      if (countLabel) countLabel.textContent = `${hotspots.length} Priority Hotspots`;

      const maxCount = Math.max(...hotspots.map(h => h.count), 1);
      const items = hotspots.map((spot, idx) => {
        const widthPct = Math.max(Math.round((spot.count / maxCount) * 100), 2);
        return `
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; font-size: 0.82rem;">
            <div style="width: 22px; font-weight: 800; color: var(--text-light); font-size: 0.72rem; text-align: center;">#${idx + 1}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                <span style="font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(spot.area)}">${escapeHTML(spot.area)}</span>
                <span style="font-weight: 700; color: var(--text-main); margin-left: 0.5rem;">${spot.count} cases</span>
              </div>
              <div style="background: var(--bg-canvas); border-radius: 4px; height: 6px; overflow: hidden; border: 1px solid var(--border-light);">
                <div style="width: ${widthPct}%; background: #ea580c; height: 100%; border-radius: 2px;"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `<div style="width: 100%;">${items}</div>`;
    },

    renderSlaPerformance: function (sla, overview) {
      const container = document.getElementById('chart-intel-sla');
      if (!container) return;

      const avgTimeEl = document.getElementById('intel-avg-resolution-time');
      if (avgTimeEl) avgTimeEl.textContent = sla.avg_resolution_time || '0 hrs';

      const pendingQueueEl = document.getElementById('intel-pending-sla-count');
      if (pendingQueueEl) pendingQueueEl.textContent = sla.pending_sla || 0;

      const total = (overview && overview.total_complaints) || (sla.on_track + sla.overdue) || 1;
      const onTrack = sla.on_track || 0;
      const overdue = sla.overdue || 0;
      const escalated = sla.escalated || 0;

      const onTrackPct = total > 0 ? Math.round((onTrack / total) * 100) : 100;
      const overduePct = total > 0 ? Math.round((overdue / total) * 100) : 0;
      const escalatedPct = total > 0 ? Math.round((escalated / total) * 100) : 0;

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
          <!-- Multi-segment bar -->
          <div style="width: 100%; height: 22px; display: flex; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-canvas);">
            <div style="width: ${onTrackPct}%; background: #059669;" title="On Track: ${onTrack} (${onTrackPct}%)"></div>
            <div style="width: ${overduePct}%; background: #d97706;" title="Overdue: ${overdue} (${overduePct}%)"></div>
            <div style="width: ${escalatedPct}%; background: #dc2626;" title="Escalated: ${escalated} (${escalatedPct}%)"></div>
          </div>

          <!-- Legend Row -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; text-align: center; font-size: 0.8rem;">
            <div style="background: var(--bg-canvas); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="color: #059669; font-weight: 800; font-size: 1.1rem;">${onTrack}</div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Within SLA</div>
            </div>
            <div style="background: var(--bg-canvas); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="color: #d97706; font-weight: 800; font-size: 1.1rem;">${overdue}</div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">SLA Breached</div>
            </div>
            <div style="background: var(--bg-canvas); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-light);">
              <div style="color: #dc2626; font-weight: 800; font-size: 1.1rem;">${escalated}</div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Escalated</div>
            </div>
          </div>
        </div>
      `;
    },

    renderTimeline: function (timeline) {
      const container = document.getElementById('chart-intel-timeline');
      if (!container) return;

      if (!timeline || timeline.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-light); font-size: 0.85rem; padding: 2rem 0;">No activity timeline logs available for selected date window.</div>';
        return;
      }

      const recentTimeline = timeline.slice(-10);
      const maxVal = Math.max(...recentTimeline.map(t => Math.max(t.reported, t.resolved)), 1);

      const items = recentTimeline.map(t => {
        const repHeight = Math.max(Math.round((t.reported / maxVal) * 100), 8);
        const resHeight = Math.max(Math.round((t.resolved / maxVal) * 100), 8);
        const dateFormatted = new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

        return `
          <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 0.25rem;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-main);">${t.reported}</div>
            <div style="width: 100%; height: 95px; display: flex; align-items: flex-end; justify-content: center; gap: 3px; background: var(--bg-canvas); border-radius: 4px; padding: 2px;">
              <div style="width: 45%; height: ${repHeight}%; background: var(--primary); border-radius: 2px;" title="Reported: ${t.reported}"></div>
              <div style="width: 45%; height: ${resHeight}%; background: #059669; border-radius: 2px;" title="Resolved: ${t.resolved}"></div>
            </div>
            <div style="font-size: 0.68rem; color: var(--text-light); white-space: nowrap;">${dateFormatted}</div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="display: flex; gap: 0.4rem; align-items: flex-end; width: 100%; height: 130px;">${items}</div>
          <div style="display: flex; justify-content: center; gap: 1rem; font-size: 0.72rem; font-weight: 600;">
            <span style="display: inline-flex; align-items: center; gap: 0.3rem;"><span style="width: 8px; height: 8px; background: var(--primary); border-radius: 2px;"></span> Complaints Registered</span>
            <span style="display: inline-flex; align-items: center; gap: 0.3rem;"><span style="width: 8px; height: 8px; background: #059669; border-radius: 2px;"></span> Cases Resolved</span>
          </div>
        </div>
      `;
    },

    renderDistrictTable: function (districts, comparison) {
      const tbody = document.getElementById('tbody-district-intelligence');
      const heading = document.getElementById('district-table-heading');
      if (!tbody) return;

      const list = (comparison && Array.isArray(comparison)) ? comparison : districts;
      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-light); padding: 2rem;">No district data available for current scope.</td></tr>';
        return;
      }

      if (heading) {
        heading.textContent = list.length === 1 
          ? `District Operational Intelligence: ${list[0].district}`
          : `Tamil Nadu 38-District Operational Intelligence (${list.length} Districts)`;
      }

      // Sort list according to currentSortColumn and sortDirection
      const sorted = [...list].sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];

        if (typeof valA === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      });

      const rows = sorted.map(d => {
        const topCat = d.most_reported_category ? d.most_reported_category.replace(/_/g, ' ') : 'None';
        const rateNumeric = parseFloat(d.resolution_rate_numeric) || 0;
        const rateColor = rateNumeric >= 75 ? '#059669' : (rateNumeric >= 40 ? '#d97706' : '#dc2626');

        return `
          <tr>
            <td style="font-weight: 700; color: var(--text-main);">
              ${escapeHTML(d.district)}
              <span style="font-size: 0.7rem; color: var(--text-light); margin-left: 0.3rem; font-weight: 600;">[${escapeHTML(d.district_code || '')}]</span>
            </td>
            <td style="text-align: right; font-weight: 700;">${d.total_issues}</td>
            <td style="text-align: right; color: #059669; font-weight: 600;">${d.resolved_issues}</td>
            <td style="text-align: right; font-weight: 800; color: ${rateColor};">${d.resolution_rate || '0.0%'}</td>
            <td style="text-align: right; color: ${d.critical_issues > 0 ? '#dc2626' : 'var(--text-light)'}; font-weight: 700;">${d.critical_issues}</td>
            <td style="text-align: right; color: ${d.overdue_issues > 0 ? '#d97706' : 'var(--text-light)'}; font-weight: 700;">${d.overdue_issues}</td>
            <td style="text-align: right; color: ${d.escalated_issues > 0 ? '#991b1b' : 'var(--text-light)'}; font-weight: 700;">${d.escalated_issues}</td>
            <td style="text-transform: capitalize; color: var(--text-muted);">${escapeHTML(topCat)}</td>
            <td style="text-align: right; color: var(--text-light); font-size: 0.8rem;">${d.avg_resolution_time || '0 hrs'}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;
    },

    sortDistrictTable: function (column) {
      if (currentSortColumn === column) {
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      } else {
        currentSortColumn = column;
        sortDirection = 'desc';
      }

      if (currentIntelData) {
        this.renderDistrictTable(currentIntelData.district_intelligence, currentIntelData.district_comparison);
      }
    },

    renderDepartmentTable: function (departments) {
      const tbody = document.getElementById('tbody-department-performance');
      if (!tbody) return;

      if (!departments || departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-light); padding: 2rem;">No department activity logged.</td></tr>';
        return;
      }

      const rows = departments.map(d => {
        const resRate = parseFloat(d.resolution_rate_numeric) || 0;
        const resColor = resRate >= 75 ? '#059669' : (resRate >= 40 ? '#d97706' : '#dc2626');

        const slaRate = parseFloat(d.sla_compliance_numeric) || 0;
        const slaColor = slaRate >= 90 ? '#0284c7' : (slaRate >= 70 ? '#d97706' : '#dc2626');

        return `
          <tr>
            <td style="font-weight: 700; color: var(--text-main);">${escapeHTML(d.department)}</td>
            <td style="text-align: right; font-weight: 700;">${d.total_assigned}</td>
            <td style="text-align: right; color: #059669; font-weight: 600;">${d.resolved}</td>
            <td style="text-align: right; color: #2563eb; font-weight: 600;">${d.pending}</td>
            <td style="text-align: right; color: ${d.overdue > 0 ? '#d97706' : 'var(--text-light)'}; font-weight: 700;">${d.overdue}</td>
            <td style="text-align: right; color: ${d.escalated > 0 ? '#dc2626' : 'var(--text-light)'}; font-weight: 700;">${d.escalated}</td>
            <td style="text-align: right; font-weight: 800; color: ${resColor};">${d.resolution_rate || '0.0%'}</td>
            <td style="text-align: right; font-weight: 800; color: ${slaColor};">${d.sla_compliance || '100%'}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;
    },

    resetFilters: function () {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      setVal('filter-intel-daterange', 'all_time');
      const distSelect = document.getElementById('filter-intel-district');
      if (distSelect && !distSelect.disabled) distSelect.value = 'all';
      setVal('filter-intel-department', 'all');
      setVal('filter-intel-category', 'all');
      setVal('filter-intel-priority', 'all');
      setVal('filter-intel-status', 'all');

      this.loadData();
    },

    toggleMobileSidebar: function (open) {
      const sidebar = document.getElementById('portal-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (!sidebar) return;

      if (open) {
        sidebar.classList.add('mobile-open');
        if (backdrop) backdrop.style.display = 'block';
      } else {
        sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.style.display = 'none';
      }
    },

    toggleProfileDropdown: function (event) {
      if (event) event.stopPropagation();
      const dropdown = document.getElementById('header-profile-dropdown');
      if (!dropdown) return;
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    },

    checkUnreadNotifications: async function () {
      try {
        const badge = document.getElementById('header-notif-badge');
        if (!badge) return;

        if (window.API && typeof window.API.getNotifications === 'function') {
          const res = await window.API.getNotifications();
          const list = res && res.data ? res.data : (Array.isArray(res) ? res : []);
          const unreadCount = list.filter(n => !n.is_read).length;
          if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      } catch (e) {
        // Non-critical background fetch
      }
    }
  };

  // Close dropdown on outside click
  document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('header-profile-dropdown');
    const trigger = document.getElementById('header-profile-btn');
    if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Expose module globally
  window.AuthorityCivicIntel = AuthorityCivicIntel;

  // Auto-initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    AuthorityCivicIntel.init();
  });
})();
