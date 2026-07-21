// CrowdCity AI v2.1 - Global Command Palette (Ctrl + K)
// Provides instant search and quick navigation across all Version 1 & Version 2 features.

(function() {
  'use strict';

  const commands = [
    { title: 'Government Services Hub', subtitle: 'Explore all welfare services & schemes', url: 'services.html', category: 'Services', icon: 'fa-building-columns' },
    { title: 'Scheme Eligibility Checker', subtitle: 'Check welfare qualification algorithmically', url: 'scheme-checker.html', category: 'Services', icon: 'fa-user-check' },
    { title: 'My Saved Schemes', subtitle: 'View bookmarked government schemes', url: 'saved-schemes.html', category: 'Services', icon: 'fa-bookmark' },
    { title: 'My Document Wallet', subtitle: 'Manage certificates & verify readiness', url: 'my-documents.html', category: 'Documents', icon: 'fa-folder-closed' },
    { title: 'AI Document Verification Assistant', subtitle: 'Analyze certificate clarity & OCR text', url: 'doc-verifier.html', category: 'Documents', icon: 'fa-wand-magic-sparkles' },
    { title: 'AI Government Assistant', subtitle: 'Conversational ChatGPT-style scheme advisor', url: 'assistant.html', category: 'AI Tools', icon: 'fa-robot' },
    { title: 'AI Form Filling Assistant', subtitle: 'Guided application form preparation', url: 'form-assistant.html', category: 'AI Tools', icon: 'fa-clipboard-check' },
    { title: 'Government Office Locator', subtitle: 'Find nearby E-Sevai, Taluk & VAO offices', url: 'office-locator.html', category: 'Services', icon: 'fa-location-dot' },
    { title: 'Government Application Tracker', subtitle: 'Monitor & log submitted applications', url: 'app-tracker.html', category: 'Tracker', icon: 'fa-clock-rotate-left' },
    { title: 'Smart Reminder Center', subtitle: 'Schedule document renewals & deadlines', url: 'reminders.html', category: 'Tracker', icon: 'fa-bell' },
    { title: 'Citizen Services Dashboard', subtitle: 'Personalized central hub', url: 'services-dashboard.html', category: 'Dashboard', icon: 'fa-house-chimney' },
    { title: 'Report Civic Issue', subtitle: 'Version 1 Citizen Issue Reporting', url: 'report.html', category: 'Complaints', icon: 'fa-plus' },
    { title: 'My Complaints', subtitle: 'Track reported civic issues & status', url: 'my-complaints.html', category: 'Complaints', icon: 'fa-clipboard-list' },
    { title: 'Live Map', subtitle: 'View community issue markers', url: 'map.html', category: 'Complaints', icon: 'fa-map-location-dot' },
    { title: 'Government Services Admin Portal', subtitle: 'CMS for schemes, offices, announcements & FAQs', url: 'services-admin.html', category: 'Admin', icon: 'fa-screwdriver-wrench' }
  ];

  function createCommandPaletteUI() {
    if (document.getElementById('cc-cmd-palette-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cc-cmd-palette-overlay';
    overlay.style.cssText = `
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      backdrop-filter: blur(8px); z-index: 99999; align-items: flex-start;
      justify-content: center; padding-top: 10vh; padding-left: 1rem; padding-right: 1rem;
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 20px; max-width: 620px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.2); overflow: hidden;">
        <div style="display: flex; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color, #e5e7eb); gap: 0.75rem;">
          <i class="fa-solid fa-magnifying-glass" style="color: var(--primary, #0D9488); font-size: 1.1rem;"></i>
          <input id="cc-cmd-input" type="text" placeholder="Type a command or search feature... (Esc to close)" style="width: 100%; border: none; outline: none; background: transparent; font-size: 1rem; font-weight: 700; color: var(--text-main, #111827);" />
          <kbd style="font-size: 0.75rem; font-weight: 800; background: var(--bg-app, #f3f4f6); border: 1px solid var(--border-color, #e5e7eb); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--text-muted, #6b7280);">ESC</kbd>
        </div>

        <div id="cc-cmd-results" style="max-height: 420px; overflow-y: auto; padding: 0.75rem;">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('cc-cmd-input');
    input.addEventListener('input', (e) => {
      renderResults(e.target.value.toLowerCase().trim());
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) togglePalette(false);
    });
  }

  function renderResults(query) {
    const resultsContainer = document.getElementById('cc-cmd-results');
    if (!resultsContainer) return;

    let filtered = commands;
    if (query) {
      filtered = commands.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.subtitle.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query)
      );
    }

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted, #6b7280); font-size: 0.9rem;">
          No matching features found for "${query}".
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = filtered.map(c => `
      <a href="${c.url}" class="cc-cmd-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-main, #111827); transition: background 0.15s ease; margin-bottom: 0.25rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(13, 148, 136, 0.12); color: var(--primary, #0D9488); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
            <i class="fa-solid ${c.icon}"></i>
          </div>
          <div>
            <div style="font-size: 0.92rem; font-weight: 800;">${c.title}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted, #6b7280);">${c.subtitle}</div>
          </div>
        </div>
        <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: var(--primary, #0D9488); background: var(--bg-app, #f3f4f6); padding: 0.2rem 0.5rem; border-radius: 6px;">
          ${c.category}
        </span>
      </a>
    `).join('');

    resultsContainer.querySelectorAll('.cc-cmd-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-app, #f3f4f6)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });
  }

  function togglePalette(show) {
    createCommandPaletteUI();
    const overlay = document.getElementById('cc-cmd-palette-overlay');
    const input = document.getElementById('cc-cmd-input');

    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
      if (show && input) {
        input.value = '';
        renderResults('');
        setTimeout(() => input.focus(), 50);
      }
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePalette(true);
    } else if (e.key === 'Escape') {
      togglePalette(false);
    }
  });

  window.toggleCommandPalette = togglePalette;
})();
