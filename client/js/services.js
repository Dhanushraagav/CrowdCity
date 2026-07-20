// CrowdCity AI v2.0 - Government Services (Premium Preview Experience) JavaScript

(function() {
  'use strict';

  // 8 Feature List Data (Strictly clean, NO internal roadmap/percentages/phase/milestone labels)
  const FEATURE_PREVIEWS = [
    {
      id: 'scheme-eligibility',
      title: 'Government Scheme Eligibility Checker',
      icon: 'fa-award'
    },
    {
      id: 'ai-assistant',
      title: 'AI Government Assistant',
      icon: 'fa-wand-magic-sparkles'
    },
    {
      id: 'form-filling',
      title: 'AI-assisted Form Filling',
      icon: 'fa-file-signature'
    },
    {
      id: 'doc-translation',
      title: 'Government Document Translation',
      icon: 'fa-language'
    },
    {
      id: 'doc-summarization',
      title: 'AI Document Summarization',
      icon: 'fa-file-contract'
    },
    {
      id: 'app-tracking',
      title: 'Government Application Tracking',
      icon: 'fa-diagram-project'
    },
    {
      id: 'office-locator',
      title: 'Nearby Government Office Locator',
      icon: 'fa-building-flag'
    },
    {
      id: 'deadline-reminders',
      title: 'Smart Deadline Reminders',
      icon: 'fa-bell-concierge'
    }
  ];

  function isNotifActive() {
    try {
      return localStorage.getItem('cc_services_global_notify') === 'true';
    } catch (e) {
      return false;
    }
  }

  function toggleNotif() {
    const currentState = isNotifActive();
    const newState = !currentState;
    try {
      localStorage.setItem('cc_services_global_notify', newState ? 'true' : 'false');
    } catch (e) {}

    if (window.showToast) {
      if (newState) {
        window.showToast("Notifications enabled! We will notify you when Government Services goes live.", "success");
      } else {
        window.showToast("Notifications turned off for Government Services.", "info");
      }
    }
    return newState;
  }

  function navigateToDashboard() {
    window.location.href = 'citizen-dashboard.html';
  }

  // Render Features inside Modal
  function renderFeatureList() {
    const gridContainer = document.getElementById('services-preview-feature-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = FEATURE_PREVIEWS.map(item => `
      <div class="services-feature-item" data-id="${item.id}" data-title="${item.title}">
        <div class="services-feature-item-icon">
          <i class="fa-solid ${item.icon}"></i>
        </div>
        <span class="services-feature-item-title">${item.title}</span>
        <i class="fa-solid fa-chevron-right services-feature-item-arrow"></i>
      </div>
    `).join('');

    // Attach click handlers to features to open Secondary Popup
    gridContainer.querySelectorAll('.services-feature-item').forEach(item => {
      item.addEventListener('click', () => {
        openComingSoonPopup(item.dataset.title);
      });
    });
  }

  // Secondary "Coming Soon" Popup
  function openComingSoonPopup(featureTitle) {
    let popupOverlay = document.getElementById('services-secondary-popup-overlay');
    if (!popupOverlay) {
      popupOverlay = document.createElement('div');
      popupOverlay.id = 'services-secondary-popup-overlay';
      popupOverlay.className = 'services-secondary-popup-overlay';
      document.body.appendChild(popupOverlay);
    }

    popupOverlay.innerHTML = `
      <div class="services-secondary-popup-card">
        <div class="popup-clock-icon">
          <i class="fa-solid fa-hourglass-half"></i>
        </div>
        <h3 class="popup-title">Coming Soon</h3>
        <p class="popup-message">
          This feature is currently under development and will be available in a future update.<br><br>Thank you for your interest and patience.
        </p>
        <button class="popup-got-it-btn" id="popup-got-it-btn">Got It</button>
      </div>
    `;

    popupOverlay.classList.add('active');

    const closePopup = () => {
      popupOverlay.classList.remove('active');
    };

    const gotItBtn = popupOverlay.querySelector('#popup-got-it-btn');
    if (gotItBtn) gotItBtn.addEventListener('click', closePopup);

    popupOverlay.addEventListener('click', (e) => {
      if (e.target === popupOverlay) closePopup();
    });
  }

  // Initialize Modal and Lock Background
  document.addEventListener('DOMContentLoaded', () => {
    // Lock body scrolling and apply blur to background
    document.body.classList.add('services-preview-active');
    
    const backgroundWrapper = document.getElementById('app-layout-wrapper');
    if (backgroundWrapper) {
      backgroundWrapper.classList.add('services-page-background');
    }

    renderFeatureList();

    // Notify Me Button Handler
    const notifyBtn = document.getElementById('services-notify-btn');
    if (notifyBtn) {
      const active = isNotifActive();
      if (active) {
        notifyBtn.classList.add('active-notif');
        notifyBtn.querySelector('span').textContent = '✓ Notification Set';
        notifyBtn.querySelector('i').className = 'fa-solid fa-check';
      }

      notifyBtn.addEventListener('click', () => {
        const newState = toggleNotif();
        notifyBtn.classList.toggle('active-notif', newState);
        notifyBtn.querySelector('span').textContent = newState ? '✓ Notification Set' : 'Notify Me';
        notifyBtn.querySelector('i').className = newState ? 'fa-solid fa-check' : 'fa-regular fa-bell';
      });
    }

    // Back to Dashboard Button
    const backBtn = document.getElementById('services-back-dashboard-btn');
    if (backBtn) {
      backBtn.addEventListener('click', navigateToDashboard);
    }

    // Close Icon (Top Right)
    const closeIcon = document.getElementById('services-modal-close');
    if (closeIcon) {
      closeIcon.addEventListener('click', navigateToDashboard);
    }

    // ESC Key Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const popupOverlay = document.getElementById('services-secondary-popup-overlay');
        if (popupOverlay && popupOverlay.classList.contains('active')) {
          popupOverlay.classList.remove('active');
        } else {
          navigateToDashboard();
        }
      }
    });
  });

})();
