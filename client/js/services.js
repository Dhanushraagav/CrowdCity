// CrowdCity AI v2.0 - Government Services Module JavaScript
// Provides interactive preview, tab filtering, notification subscriptions, and modal details

(function() {
  'use strict';

  // Feature Data Catalog for Phase 1
  const SERVICES_CATALOG = [
    {
      id: 'scheme-eligibility',
      title: 'Government Scheme Eligibility Checker',
      category: 'ai',
      icon: 'fa-award',
      badgeText: 'Phase 1 - Active Dev',
      badgeClass: 'badge-active',
      desc: 'Instant AI matching for citizens with 120+ Tamil Nadu state & central welfare schemes, agricultural grants, educational scholarships, and housing subsidies based on household demographics.',
      progress: 85,
      releaseDate: 'Phase 2 (Q3 2026)',
      features: [
        'Demographic & income-based multi-scheme matching',
        'Tamil & English instant eligibility score card',
        'Direct links to official e-Seva application forms',
        'Automatic document readiness checklist'
      ]
    },
    {
      id: 'ai-assistant',
      title: 'AI Government Assistant',
      category: 'ai',
      icon: 'fa-wand-magic-sparkles',
      badgeText: 'Planned Release Q3 2026',
      badgeClass: 'badge-planned',
      desc: 'Conversational 24/7 AI companion capable of answering questions regarding municipal laws, building approval rules, RTO procedures, and civic documentation requirements.',
      progress: 60,
      releaseDate: 'Phase 2 (Q3 2026)',
      features: [
        'Bilingual conversational interface (English & Tamil)',
        'Grounded in official TN Government Gazettes and Department guidelines',
        'Voice query & audio responses for accessibility',
        'Step-by-step procedure breakdown for any citizen service'
      ]
    },
    {
      id: 'form-filler',
      title: 'AI-Assisted Form Filling',
      category: 'docs',
      icon: 'fa-file-signature',
      badgeText: 'Planned Release Q4 2026',
      badgeClass: 'badge-planned',
      desc: 'Smart auto-filler for complex government applications, marriage/birth/death registrations, and trade licenses with real-time error prevention.',
      progress: 40,
      releaseDate: 'Phase 3 (Q4 2026)',
      features: [
        'Smart PDF form field extraction and auto-fill',
        'Instant Tamil to English transliteration assistance',
        'Validation of Aadhaar, Smart Card, and Community Cert numbers',
        'Download pre-filled ready-to-submit official PDFs'
      ]
    },
    {
      id: 'doc-translator',
      title: 'Government Document Translator',
      category: 'docs',
      icon: 'fa-language',
      badgeText: 'Planned Release Q4 2026',
      badgeClass: 'badge-planned',
      desc: 'High-accuracy AI translation tool specialized in legal Tamil & English government gazettes, court orders, department circulars, and tax notices.',
      progress: 35,
      releaseDate: 'Phase 3 (Q4 2026)',
      features: [
        'Preserves legal terminology & formatting',
        'Supports camera scan of paper documents',
        'Side-by-side Tamil and English view',
        'Audio narration in clear Tamil dialect'
      ]
    },
    {
      id: 'doc-summarizer',
      title: 'AI Document Summarizer',
      category: 'docs',
      icon: 'fa-file-contract',
      badgeText: 'Planned Release Q4 2026',
      badgeClass: 'badge-planned',
      desc: 'Simplifies multi-page complex government PDFs, municipal master plans, public tenders, and policy documents into 1-minute key takeaway summaries.',
      progress: 30,
      releaseDate: 'Phase 3 (Q4 2026)',
      features: [
        '1-page executive summary generation',
        'Key citizen rights & deadlines highlighting',
        'Simplifies complex legal jargon into plain language',
        'Export summary as WhatsApp message or PDF'
      ]
    },
    {
      id: 'app-tracker',
      title: 'Government Application Tracker',
      category: 'tracker',
      icon: 'fa-diagram-project',
      badgeText: 'Planned Release Q1 2027',
      badgeClass: 'badge-planned',
      desc: 'Unified citizen tracking portal to follow Patta/Chitta transfers, Ration Card modifications, Encumbrance Certificates, and Corporation approvals in one screen.',
      progress: 20,
      releaseDate: 'Phase 4 (Q1 2027)',
      features: [
        'Multi-department application status sync',
        'SMS & WhatsApp status change alerts',
        'Escalation button for delayed government processing',
        'Estimated completion timeline prediction engine'
      ]
    },
    {
      id: 'office-locator',
      title: 'Nearby Government Office Locator',
      category: 'tracker',
      icon: 'fa-building-flag',
      badgeText: 'Planned Release Q1 2027',
      badgeClass: 'badge-planned',
      desc: 'Interactive map locator finding nearby e-Seva centers, Taluk offices, Revenue divisional offices, and Corporation zonal offices with working hours & officer details.',
      progress: 15,
      releaseDate: 'Phase 4 (Q1 2027)',
      features: [
        'Real-time GPS proximity routing',
        'Official opening/closing times & holiday schedules',
        'Officer contact phone numbers & email directory',
        'Citizen rating & queue waiting time indicator'
      ]
    },
    {
      id: 'deadline-reminders',
      title: 'Service Deadline Reminders',
      category: 'tracker',
      icon: 'fa-bell-concierge',
      badgeText: 'Planned Release Q1 2027',
      badgeClass: 'badge-planned',
      desc: 'Automated SMS, email, & push notification reminders for property tax due dates, water charges, trade license renewals, and welfare scheme windows.',
      progress: 10,
      releaseDate: 'Phase 4 (Q1 2027)',
      features: [
        'Personalized calendar for civic liabilities & taxes',
        'Direct one-click payment portal redirects',
        'Avoid late penalty fee alerts',
        'Custom notification preferences (Push / SMS / Email)'
      ]
    }
  ];

  // Helper to read subscription status from LocalStorage
  function getSubscriptions() {
    try {
      const raw = localStorage.getItem('cc_service_notifications');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function toggleSubscription(serviceId, serviceTitle) {
    const subs = getSubscriptions();
    const isSubbed = !!subs[serviceId];
    subs[serviceId] = !isSubbed;
    try {
      localStorage.setItem('cc_service_notifications', JSON.stringify(subs));
    } catch (e) {}

    if (window.showToast) {
      if (!isSubbed) {
        window.showToast(`Notification active for "${serviceTitle}"! We'll alert you on launch.`, 'success');
      } else {
        window.showToast(`Notification turned off for "${serviceTitle}".`, 'info');
      }
    }
    return !isSubbed;
  }

  // Render Feature Cards
  function renderServicesGrid(filterCategory = 'all', searchQuery = '') {
    const gridContainer = document.getElementById('services-cards-grid');
    if (!gridContainer) return;

    const subs = getSubscriptions();
    const query = searchQuery.trim().toLowerCase();

    const filtered = SERVICES_CATALOG.filter(service => {
      const matchesCategory = (filterCategory === 'all') || (service.category === filterCategory);
      const matchesQuery = !query || 
        service.title.toLowerCase().includes(query) || 
        service.desc.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
          <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="margin: 0 0 0.5rem 0; color: var(--text-main); font-weight: 700;">No services found</h3>
          <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">Try searching for different keywords like "scheme", "translator", "tracker", or "form".</p>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = filtered.map(service => {
      const isSubbed = !!subs[service.id];
      return `
        <div class="service-card" data-id="${service.id}">
          <div class="service-card-accent"></div>
          
          <div>
            <div class="service-card-top">
              <div class="service-icon-wrapper">
                <i class="fa-solid ${service.icon}"></i>
              </div>
              <span class="service-status-badge ${service.badgeClass}">
                ${service.badgeText}
              </span>
            </div>

            <div class="service-card-body" style="margin-top: 1rem;">
              <h3 class="service-card-title">${service.title}</h3>
              <p class="service-card-desc">${service.desc}</p>
            </div>
          </div>

          <div class="service-card-footer">
            <div class="service-progress-widget" style="padding: 0.75rem; background: rgba(0,0,0,0.03);">
              <div class="progress-header-row" style="font-size: 0.75rem;">
                <span>Development Progress</span>
                <span class="progress-pct-text">${service.progress}%</span>
              </div>
              <div class="progress-track-bg" style="height: 6px;">
                <div class="progress-fill-anim" style="width: ${service.progress}%;"></div>
              </div>
            </div>

            <div class="service-meta-row">
              <span class="service-meta-item">
                <i class="fa-regular fa-calendar-check" style="color: var(--primary);"></i> Target: ${service.releaseDate}
              </span>
              <button class="btn-preview-details" data-id="${service.id}" style="background: none; border: none; color: var(--primary); font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                Preview <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>

            <button class="notify-btn ${isSubbed ? 'subscribed' : ''}" data-id="${service.id}" data-title="${service.title}">
              <i class="${isSubbed ? 'fa-solid fa-check' : 'fa-regular fa-bell'}"></i>
              <span>${isSubbed ? '✓ Notification Set' : 'Notify Me on Launch'}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach Event Listeners to rendered cards
    gridContainer.querySelectorAll('.notify-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        const activeNow = toggleSubscription(id, title);
        btn.classList.toggle('subscribed', activeNow);
        btn.querySelector('span').textContent = activeNow ? '✓ Notification Set' : 'Notify Me on Launch';
        btn.querySelector('i').className = activeNow ? 'fa-solid fa-check' : 'fa-regular fa-bell';
      });
    });

    gridContainer.querySelectorAll('.btn-preview-details, .service-card-title').forEach(elem => {
      elem.addEventListener('click', (e) => {
        const card = elem.closest('.service-card');
        if (card) {
          const id = card.dataset.id;
          openPreviewModal(id);
        }
      });
    });
  }

  // Feature Details Modal
  function openPreviewModal(serviceId) {
    const service = SERVICES_CATALOG.find(s => s.id === serviceId);
    if (!service) return;

    let overlay = document.getElementById('services-preview-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'services-preview-modal-overlay';
      overlay.className = 'service-preview-overlay';
      document.body.appendChild(overlay);
    }

    const subs = getSubscriptions();
    const isSubbed = !!subs[service.id];

    overlay.innerHTML = `
      <div class="service-preview-modal">
        <button class="modal-close-btn" id="close-services-modal"><i class="fa-solid fa-xmark"></i></button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
          <div class="service-icon-wrapper" style="width: 56px; height: 56px; font-size: 1.5rem;">
            <i class="fa-solid ${service.icon}"></i>
          </div>
          <div>
            <span class="service-status-badge ${service.badgeClass}" style="margin-bottom: 0.35rem; display: inline-block;">
              ${service.badgeText}
            </span>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin: 0;">${service.title}</h2>
          </div>
        </div>

        <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 1.5rem;">
          ${service.desc}
        </p>

        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.85rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.85rem 0; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-microchip" style="color: var(--primary);"></i> Key Planned Capabilities (Phase 1 Blueprint)
          </h4>
          <ul style="margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.88rem; color: var(--text-muted);">
            ${service.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>

        <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            <strong>Target Delivery:</strong> ${service.releaseDate}
          </div>
          <button class="notify-btn ${isSubbed ? 'subscribed' : ''}" id="modal-notify-btn" style="width: auto; padding: 0.65rem 1.5rem;">
            <i class="${isSubbed ? 'fa-solid fa-check' : 'fa-regular fa-bell'}"></i>
            <span>${isSubbed ? '✓ Notification Set' : 'Notify Me on Launch'}</span>
          </button>
        </div>
      </div>
    `;

    overlay.classList.add('active');

    const closeBtn = overlay.querySelector('#close-services-modal');
    closeBtn.addEventListener('click', () => overlay.classList.remove('active'));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });

    const modalNotifyBtn = overlay.querySelector('#modal-notify-btn');
    modalNotifyBtn.addEventListener('click', () => {
      const activeNow = toggleSubscription(service.id, service.title);
      modalNotifyBtn.classList.toggle('subscribed', activeNow);
      modalNotifyBtn.querySelector('span').textContent = activeNow ? '✓ Notification Set' : 'Notify Me on Launch';
      modalNotifyBtn.querySelector('i').className = activeNow ? 'fa-solid fa-check' : 'fa-regular fa-bell';
      // Sync card button on main grid
      renderServicesGrid(window.currentServiceCategory || 'all', window.currentServiceQuery || '');
    });
  }

  // Initialize Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    window.currentServiceCategory = 'all';
    window.currentServiceQuery = '';

    renderServicesGrid('all', '');

    // Search Box
    const searchInput = document.getElementById('services-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        window.currentServiceQuery = e.target.value;
        renderServicesGrid(window.currentServiceCategory, window.currentServiceQuery);
      });
    }

    // Category Tabs
    const tabBtns = document.querySelectorAll('.services-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.currentServiceCategory = btn.dataset.category || 'all';
        renderServicesGrid(window.currentServiceCategory, window.currentServiceQuery);
      });
    });

    // Spotlight card "Get Early Access" button
    const spotlightBtn = document.getElementById('spotlight-notify-btn');
    if (spotlightBtn) {
      spotlightBtn.addEventListener('click', () => {
        const activeNow = toggleSubscription('scheme-eligibility', 'Government Scheme Eligibility Checker');
        spotlightBtn.classList.toggle('subscribed', activeNow);
        spotlightBtn.querySelector('span').textContent = activeNow ? '✓ Notification Set' : 'Notify Me on Launch';
        renderServicesGrid(window.currentServiceCategory, window.currentServiceQuery);
      });
    }
  });

})();
