// CrowdCity AI v2.2 - Government Services Admin Portal JavaScript
// Manages Government Schemes, Departments, Offices, Announcements, FAQs, Knowledge Base, and Audit Logs.

(function() {
  'use strict';

  let currentTab = 'schemes';
  let schemes = [];
  let offices = [];
  let announcements = [];
  let faqs = [];
  let selectedScheme = null;

  const defaultSchemes = [
    { id: 'tn-kmut', scheme_name: 'Kalaignar Magalir Urimai Thittam', department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN', is_active: true, eligibility_criteria: { min_age: 21, max_age: 60, gender: 'female', max_annual_income: 250000 } },
    { id: 'tn-pudhumai', scheme_name: 'Pudhumai Penn Higher Education Assistance', department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN', is_active: true, eligibility_criteria: { min_age: 17, max_age: 25, gender: 'female', student_required: true, gov_school_required: true } }
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

  async function fetchAllSchemes() {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('government_schemes')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            schemes = data;
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Supabase fetch failed in admin, using static fallbacks:", e);
    }
    schemes = [...defaultSchemes];
  }

  async function initAdminData() {
    await fetchAllSchemes();
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
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${schemes.map(s => {
            const isActive = s.is_active;
            return `
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <div>
                  <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: ${isActive ? '#10b981' : '#6b7280'}; background: ${isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(107, 114, 128, 0.12)'}; padding: 0.2rem 0.55rem; border-radius: 999px;">
                    ${isActive ? 'Published' : 'Archived'}
                  </span>
                  <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${s.scheme_name}</h4>
                  <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${s.department_name}</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <button type="button" class="btn btn-primary btn-edit-rules" data-id="${s.id}" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px;">
                    <i class="fa-solid fa-gear"></i> Edit Rules
                  </button>
                  <button type="button" class="btn btn-secondary btn-archive-scheme" data-id="${s.id}" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; color: ${isActive ? '#ef4444' : '#10b981'};">
                    ${isActive ? 'Archive' : 'Activate'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Attach rule edit click handlers
      document.querySelectorAll('.btn-edit-rules').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const scheme = schemes.find(x => x.id === id);
          if (scheme) {
            openEditModal(scheme);
          }
        });
      });

      // Attach archive status update handlers
      document.querySelectorAll('.btn-archive-scheme').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const scheme = schemes.find(x => x.id === id);
          if (scheme) {
            await toggleSchemeStatus(scheme);
          }
        });
      });

    } else if (currentTab === 'offices') {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Government Offices Management (${offices.length})</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${offices.map(o => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: var(--primary); background: rgba(13, 148, 136, 0.12); padding: 0.2rem 0.55rem; border-radius: 999px;">${o.type}</span>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${o.name}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${o.district} District • ${o.phone}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentTab === 'announcements') {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">Citizen Broadcast Announcements (${announcements.length})</h3>
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

  function openEditModal(scheme) {
    selectedScheme = scheme;
    const modal = document.getElementById('modal-edit-eligibility');
    if (!modal) return;

    const criteria = scheme.eligibility_criteria || {};
    
    document.getElementById('edit-scheme-id').value = scheme.id;
    document.getElementById('edit-scheme-name').value = scheme.scheme_name;
    document.getElementById('edit-min-age').value = criteria.min_age || '';
    document.getElementById('edit-max-age').value = criteria.max_age || '';
    document.getElementById('edit-max-income').value = criteria.max_annual_income || '';
    document.getElementById('edit-gender').value = criteria.gender || 'all';
    document.getElementById('edit-student-req').value = criteria.student_required ? 'true' : 'false';
    document.getElementById('edit-gov-school').value = criteria.gov_school_required ? 'true' : 'false';
    document.getElementById('edit-gov-college').value = criteria.gov_college_required ? 'true' : 'false';
    document.getElementById('edit-disability').value = criteria.disability_required ? 'true' : 'false';
    document.getElementById('edit-widow').value = criteria.widow_required ? 'true' : 'false';
    document.getElementById('edit-farmer').value = criteria.farmer_required ? 'true' : 'false';
    document.getElementById('edit-native-state').value = criteria.native_state || '';
    document.getElementById('edit-certificates').value = (criteria.required_certificates || []).join(', ');

    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('modal-edit-eligibility');
    if (modal) modal.style.display = 'none';
    selectedScheme = null;
  }

  async function toggleSchemeStatus(scheme) {
    const newStatus = !scheme.is_active;
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { error } = await client
            .from('government_schemes')
            .update({ is_active: newStatus })
            .eq('id', scheme.id);

          if (!error) {
            if (window.showToast) window.showToast(`Scheme status updated successfully!`, "success");
            await fetchAllSchemes();
            renderTabContent();
            return;
          }
        }
      }
    } catch (e) {}

    // Fallback status update locally
    scheme.is_active = newStatus;
    renderTabContent();
    if (window.showToast) window.showToast(`Local fallback status updated successfully!`, "success");
  }

  async function handleSaveRules(e) {
    e.preventDefault();
    if (!selectedScheme) return;

    const id = document.getElementById('edit-scheme-id').value;
    const min_age = parseInt(document.getElementById('edit-min-age').value) || null;
    const max_age = parseInt(document.getElementById('edit-max-age').value) || null;
    const max_annual_income = parseFloat(document.getElementById('edit-max-income').value) || null;
    const gender = document.getElementById('edit-gender').value;
    const student_required = document.getElementById('edit-student-req').value === 'true';
    const gov_school_required = document.getElementById('edit-gov-school').value === 'true';
    const gov_college_required = document.getElementById('edit-gov-college').value === 'true';
    const disability_required = document.getElementById('edit-disability').value === 'true';
    const widow_required = document.getElementById('edit-widow').value === 'true';
    const farmer_required = document.getElementById('edit-farmer').value === 'true';
    const native_state = document.getElementById('edit-native-state').value || null;
    
    const certString = document.getElementById('edit-certificates').value;
    const required_certificates = certString.split(',')
      .map(x => x.trim())
      .filter(x => x.length > 0);

    const updatedCriteria = {
      min_age,
      max_age,
      max_annual_income,
      gender,
      student_required,
      gov_school_required,
      gov_college_required,
      disability_required,
      widow_required,
      farmer_required,
      native_state,
      required_certificates
    };

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { error } = await client
            .from('government_schemes')
            .update({ eligibility_criteria: updatedCriteria })
            .eq('id', id);

          if (!error) {
            if (window.showToast) window.showToast("Scheme eligibility rules updated successfully in database!", "success");
            closeModal();
            await fetchAllSchemes();
            renderTabContent();
            return;
          } else {
            console.error("Save rules error:", error);
          }
        }
      }
    } catch (e) {
      console.warn("Database update error:", e);
    }

    // Local fallback update
    selectedScheme.eligibility_criteria = updatedCriteria;
    closeModal();
    renderTabContent();
    if (window.showToast) window.showToast("Local fallback eligibility rules updated!", "success");
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

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-edit')?.addEventListener('click', closeModal);
    document.getElementById('form-edit-eligibility')?.addEventListener('submit', handleSaveRules);
  });

})();
