// CrowdCity AI v2.0 - Government Services Admin Portal JavaScript
// Manages Government Schemes, Departments, Offices, Announcements, FAQs, Knowledge Base, and Audit Logs.

(function() {
  'use strict';

  let currentTab = 'schemes';
  let schemes = [];
  let offices = [];
  let announcements = [];
  let faqs = [];

  const defaultSchemes = [
    { id: 'tn-kmut', scheme_name: 'Kalaignar Magalir Urimai Thittam', department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN', status: 'Published' },
    { id: 'tn-pudhumai', scheme_name: 'Pudhumai Penn Higher Education Assistance', department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN', status: 'Published' },
    { id: 'central-pmkisan', scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)', department_name: 'Ministry of Agriculture, Govt of India', status: 'Published' },
    { id: 'tn-cmchis', scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme', department_name: 'Health & Family Welfare Dept, Govt of TN', status: 'Published' }
  ];

  const defaultOffices = [
    { id: 'off-1', name: 'Taluk Office Guindy', type: 'Taluk Office', district: 'Chennai', phone: '044-22345678' },
    { id: 'off-2', name: 'TNEGA E-Sevai Center T. Nagar', type: 'E-Sevai Center', district: 'Chennai', phone: '044-24341122' }
  ];

  const defaultAnnouncements = [
    { id: 'ann-1', title: 'Pudhumai Penn Phase 4 Registration Extended', description: 'Application deadline for college female students extended to August 31, 2026.', priority: 'High', is_published: true },
    { id: 'ann-2', title: 'Special E-Sevai Camps in District Collectorates', description: 'Special camps organized across all Tamil Nadu districts for Aadhaar-Bank account linking.', priority: 'Normal', is_published: true }
  ];

  const defaultFaqs = [
    { id: 'faq-1', question: 'How do I link Aadhaar to my bank account for KMUT?', answer: 'Visit your home bank branch with your original Aadhaar Card and fill the DBT consent form.', category: 'Eligibility & Aadhaar' },
    { id: 'faq-2', question: 'What is the annual income limit for Pudhumai Penn?', answer: 'Female students who completed Classes 6 to 12 in Government schools are eligible regardless of family income.', category: 'Student Assistance' }
  ];

  async function initAdminData() {
    schemes = [...defaultSchemes];
    offices = [...defaultOffices];
    announcements = [...defaultAnnouncements];
    faqs = [...defaultFaqs];

    renderSummaryCards();
    renderTabContent();
  }

  function renderSummaryCards() {
    const totalSchemesElem = document.getElementById('stat-total-schemes');
    const totalOfficesElem = document.getElementById('stat-total-offices');
    const totalAnnouncementsElem = document.getElementById('stat-total-announcements');
    const totalFaqsElem = document.getElementById('stat-total-faqs');

    if (totalSchemesElem) totalSchemesElem.textContent = schemes.length;
    if (totalOfficesElem) totalOfficesElem.textContent = offices.length;
    if (totalAnnouncementsElem) totalAnnouncementsElem.textContent = announcements.length;
    if (totalFaqsElem) totalFaqsElem.textContent = faqs.length;
  }

  function renderTabContent() {
    const container = document.getElementById('admin-tab-content');
    if (!container) return;

    if (currentTab === 'schemes') {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Government Schemes Management (${schemes.length})</h3>
          <button type="button" class="btn btn-primary" onclick="alert('Scheme Creation Modal Enabled')" style="padding: 0.55rem 1.1rem; font-size: 0.82rem; font-weight: 800; border-radius: 10px;">
            <i class="fa-solid fa-plus"></i> Add New Scheme
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${schemes.map(s => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.2rem 0.55rem; border-radius: 999px;">${s.status}</span>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${s.scheme_name}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${s.department_name}</p>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-secondary" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px;">Edit</button>
                <button type="button" class="btn btn-secondary" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; color: #ef4444;">Archive</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentTab === 'offices') {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Government Offices Management (${offices.length})</h3>
          <button type="button" class="btn btn-primary" style="padding: 0.55rem 1.1rem; font-size: 0.82rem; font-weight: 800; border-radius: 10px;">
            <i class="fa-solid fa-plus"></i> Register New Office
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${offices.map(o => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: var(--primary); background: rgba(13, 148, 136, 0.12); padding: 0.2rem 0.55rem; border-radius: 999px;">${o.type}</span>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${o.name}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${o.district} District • ${o.phone}</p>
              </div>
              <button type="button" class="btn btn-secondary" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px;">Edit Office</button>
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentTab === 'announcements') {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Citizen Broadcast Announcements (${announcements.length})</h3>
          <button type="button" class="btn btn-primary" style="padding: 0.55rem 1.1rem; font-size: 0.82rem; font-weight: 800; border-radius: 10px;">
            <i class="fa-solid fa-bullhorn"></i> New Broadcast Announcement
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${announcements.map(a => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">${a.title}</h4>
                <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: #ef4444; background: rgba(239, 68, 68, 0.12); padding: 0.2rem 0.55rem; border-radius: 999px;">${a.priority} Priority</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${a.description}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentTab === 'faqs') {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">AI Assistant Knowledge Base FAQs (${faqs.length})</h3>
          <button type="button" class="btn btn-primary" style="padding: 0.55rem 1.1rem; font-size: 0.82rem; font-weight: 800; border-radius: 10px;">
            <i class="fa-solid fa-plus"></i> Add FAQ Article
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${faqs.map(f => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem;">
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: #6366f1; background: rgba(99, 102, 241, 0.12); padding: 0.2rem 0.55rem; border-radius: 999px;">${f.category}</span>
              <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0.4rem 0 0.25rem 0;">Q: ${f.question}</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">A: ${f.answer}</p>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAdminData();

    document.querySelectorAll('.admin-nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-tab').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
        });
        tabBtn.style.background = 'var(--primary)';
        tabBtn.style.color = '#ffffff';

        currentTab = tabBtn.dataset.tab;
        renderTabContent();
      });
    });
  });

})();
