/**
 * app-launcher.js - CrowdCity AI SaaS App Launcher & Service Switcher
 * Google Workspace / Microsoft 365 / Linear style launcher modal and mobile bottom-sheet.
 */

window.AppLauncher = {
  services: [
    { id: 'report', title: 'Report Issue', desc: 'Report potholes, broken lights, garbage & leaks', url: 'report.html', icon: 'fa-solid fa-triangle-exclamation', color: '#0d9488' },
    { id: 'complaints', title: 'My Complaints', desc: 'Track real-time status and resolution history', url: 'my-complaints.html', icon: 'fa-solid fa-clipboard-list', color: '#2563eb' },
    { id: 'map', title: 'City Map', desc: 'Interactive live map of community reports', url: 'map.html', icon: 'fa-solid fa-map-location-dot', color: '#059669' },
    { id: 'emergency', title: 'Emergency Help Center', desc: 'Verified responders, dispatch lines & first-aid', url: 'emergency-services.html', icon: 'fa-solid fa-truck-medical', color: '#dc2626' },
    { id: 'services', title: 'Government Services', desc: 'Check eligibility for Tamil Nadu welfare schemes', url: 'services.html', icon: 'fa-solid fa-building-columns', color: '#7c3aed' },
    { id: 'helplines', title: 'District Helplines', desc: 'Direct contact numbers for collectorates', url: 'helplines.html', icon: 'fa-solid fa-phone-volume', color: '#0284c7' },
    { id: 'offices', title: 'Public Offices', desc: 'Locate nearby taluk offices & e-Sevai centers', url: 'office-locator.html', icon: 'fa-solid fa-location-dot', color: '#d97706' },
    { id: 'documents', title: 'My Documents', desc: 'Store and verify official state certificates', url: 'my-documents.html', icon: 'fa-solid fa-file-contract', color: '#4f46e5' },
    { id: 'ministers', title: 'Council of Ministers', desc: 'Directory of Cabinet Ministers & portfolios', url: 'ministers.html', icon: 'fa-solid fa-user-tie', color: '#b45309' },
    { id: 'profile', title: 'My Profile', desc: 'Manage citizen contact details & profile', url: 'profile.html', icon: 'fa-regular fa-user', color: '#0d9488' },
    { id: 'notifications', title: 'Notifications', desc: 'Official municipal alerts & status updates', url: 'notifications.html', icon: 'fa-regular fa-bell', color: '#ea580c' },
    { id: 'settings', title: 'Settings', desc: 'App preferences, language & account privacy', url: 'settings.html', icon: 'fa-solid fa-gear', color: '#64748b' }
  ],

  init: function() {
    this.injectStyles();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  injectStyles: function() {
    if (document.getElementById('app-launcher-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-launcher-styles';
    style.textContent = `
      .app-launcher-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.42rem 0.85rem;
        background: var(--bg-surface-hover, #f8fafc);
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: var(--radius-md, 10px);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-main, #0f172a);
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
      }
      .app-launcher-btn:hover {
        background: var(--primary-light-alpha, rgba(13, 148, 136, 0.1));
        border-color: var(--primary, #0d9488);
        color: var(--primary, #0d9488);
      }
      .app-launcher-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 5rem;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .app-launcher-backdrop.active {
        opacity: 1;
        pointer-events: auto;
      }
      .app-launcher-modal {
        background: var(--bg-surface, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 16px;
        width: 100%;
        max-width: 680px;
        box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        transform: translateY(-10px) scale(0.98);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
      }
      .app-launcher-backdrop.active .app-launcher-modal {
        transform: translateY(0) scale(1);
      }
      .app-launcher-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: var(--bg-surface-gray, #f8fafc);
      }
      .app-launcher-search {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: #ffffff;
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: 10px;
        padding: 0.5rem 0.85rem;
      }
      .app-launcher-search input {
        border: none;
        outline: none;
        width: 100%;
        font-family: inherit;
        font-size: 0.9rem;
        color: var(--text-main, #0f172a);
      }
      .app-launcher-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        padding: 1.5rem;
        max-height: 440px;
        overflow-y: auto;
      }
      .launcher-app-item {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.85rem;
        border-radius: 12px;
        text-decoration: none;
        border: 1px solid transparent;
        transition: background-color 0.15s ease, border-color 0.15s ease;
      }
      .launcher-app-item:hover {
        background-color: var(--bg-surface-hover, #f8fafc);
        border-color: var(--border-color, #e2e8f0);
      }
      .launcher-app-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        background: rgba(13, 148, 136, 0.08);
      }
      .launcher-app-title {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--text-main, #0f172a);
      }
      .launcher-app-desc {
        font-size: 0.75rem;
        color: var(--text-muted, #64748b);
        line-height: 1.3;
      }
      @media (max-width: 768px) {
        .app-launcher-backdrop {
          align-items: flex-end;
          padding-top: 0;
        }
        .app-launcher-modal {
          max-width: 100%;
          border-radius: 20px 20px 0 0;
          transform: translateY(100%);
        }
        .app-launcher-backdrop.active .app-launcher-modal {
          transform: translateY(0);
        }
        .app-launcher-grid {
          grid-template-columns: repeat(2, 1fr);
          max-height: 60vh;
        }
      }
    `;
    document.head.appendChild(style);
  },

  toggle: function(e) {
    if (e) e.stopPropagation();
    let modalBackdrop = document.getElementById('app-launcher-modal-backdrop');
    if (!modalBackdrop) {
      this.createModal();
      modalBackdrop = document.getElementById('app-launcher-modal-backdrop');
    }

    if (modalBackdrop.classList.contains('active')) {
      this.close();
    } else {
      this.open();
    }
  },

  open: function() {
    let modalBackdrop = document.getElementById('app-launcher-modal-backdrop');
    if (!modalBackdrop) {
      this.createModal();
      modalBackdrop = document.getElementById('app-launcher-modal-backdrop');
    }
    modalBackdrop.classList.add('active');
    const input = document.getElementById('launcher-search-input');
    if (input) {
      input.value = '';
      this.filterServices('');
      setTimeout(() => input.focus(), 100);
    }
  },

  close: function() {
    const modalBackdrop = document.getElementById('app-launcher-modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.classList.remove('active');
    }
  },

  createModal: function() {
    const backdrop = document.createElement('div');
    backdrop.id = 'app-launcher-modal-backdrop';
    backdrop.className = 'app-launcher-backdrop';
    backdrop.onclick = (e) => {
      if (e.target === backdrop) this.close();
    };

    const itemsHtml = this.services.map(s => `
      <a href="${s.url}" class="launcher-app-item" data-title="${s.title.toLowerCase()}" data-desc="${s.desc.toLowerCase()}">
        <div class="launcher-app-icon" style="color: ${s.color}; background: ${s.color}15;">
          <i class="${s.icon}"></i>
        </div>
        <span class="launcher-app-title">${s.title}</span>
        <span class="launcher-app-desc">${s.desc}</span>
      </a>
    `).join('');

    backdrop.innerHTML = `
      <div class="app-launcher-modal" onclick="event.stopPropagation()">
        <div class="app-launcher-header">
          <div class="app-launcher-search">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted);"></i>
            <input type="text" id="launcher-search-input" placeholder="Search services..." oninput="AppLauncher.filterServices(this.value)" />
          </div>
          <button onclick="AppLauncher.close()" style="background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div class="app-launcher-grid" id="app-launcher-grid">
          ${itemsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
  },

  filterServices: function(query) {
    const q = (query || '').toLowerCase().trim();
    const items = document.querySelectorAll('#app-launcher-grid .launcher-app-item');
    items.forEach(item => {
      const title = item.getAttribute('data-title') || '';
      const desc = item.getAttribute('data-desc') || '';
      if (!q || title.includes(q) || desc.includes(q)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }
};

window.toggleAppLauncher = function(e) {
  window.AppLauncher.toggle(e);
};

document.addEventListener('DOMContentLoaded', () => {
  window.AppLauncher.init();
});
