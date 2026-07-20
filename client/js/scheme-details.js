// CrowdCity AI v2.0 - Government Scheme Details JavaScript
// Features Application Guide, Interactive Document Checklist, Vertical Timeline, and Bookmark Management.

(function() {
  'use strict';

  let currentScheme = null;
  let isSaved = false;

  function getSchemeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'tn-kmut';
  }

  async function fetchSchemeDetails(schemeId) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('government_schemes')
            .select('*, scheme_categories(category_name, category_code, icon_name)')
            .eq('id', schemeId)
            .maybeSingle();

          if (!error && data) return data;

          const { data: codeData } = await client
            .from('government_schemes')
            .select('*, scheme_categories(category_name, category_code, icon_name)')
            .eq('scheme_code', schemeId)
            .maybeSingle();

          if (codeData) return codeData;
        }
      }
    } catch (e) {
      console.warn("Supabase fetch single scheme error:", e);
    }

    return getFallbackSchemeById(schemeId);
  }

  function getFallbackSchemeById(schemeId) {
    const fallbackList = [
      {
        id: 'tn-kmut',
        scheme_code: 'TN-KMUT-001',
        scheme_name: 'Kalaignar Magalir Urimai Thittam',
        department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Monthly financial rights assistance of ₹1,000 for female heads of households in Tamil Nadu.',
        detailed_description: 'Kalaignar Magalir Urimai Thittam provides direct monthly financial assistance of ₹1,000 to eligible female heads of families in Tamil Nadu. The scheme aims to enhance financial independence, support household nutrition, and safeguard women against economic vulnerability.',
        benefits_summary: 'Direct Bank Transfer (DBT) of ₹1,000 per month directly deposited into the beneficiary’s Aadhaar-linked savings account.',
        required_documents: ["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill / Income Certificate"],
        official_portal_url: 'https://kmut.tn.gov.in/',
        application_fee: 0.00,
        eligibility_criteria: { min_age: 21, max_age: 60, gender: 'female', max_annual_income: 250000, state: 'Tamil Nadu' }
      },
      {
        id: 'tn-pudhumai',
        scheme_code: 'TN-PUDHUMAI-002',
        scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
        department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Monthly financial support of ₹1,000 for girl students pursuing degree or diploma education.',
        detailed_description: 'Under the Pudhumai Penn Scheme (Moovalur Ramamirtham Ammaiyar Higher Education Assurance Scheme), female students who studied from Classes 6 to 12 in Tamil Nadu Government schools receive ₹1,000 per month throughout their undergraduate degree, diploma, or ITI course.',
        benefits_summary: 'Monthly stipend of ₹1,000 transferred directly into the student bank account until course completion.',
        required_documents: ["Govt School Transfer Certificate / Study Proof (6th-12th)", "Aadhaar Card", "College Admission Proof / ID", "Bank Passbook"],
        official_portal_url: 'https://penkalvi.tn.gov.in/',
        application_fee: 0.00,
        eligibility_criteria: { min_age: 17, max_age: 25, gender: 'female', is_student: true, state: 'Tamil Nadu' }
      },
      {
        id: 'tn-naanmudhalvan',
        scheme_code: 'TN-NM-003',
        scheme_name: 'Naan Mudhalvan Skill Development Scheme',
        department_name: 'Tamil Nadu Skill Development Corporation (TNSDC), Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Statewide skill enhancement, technical certifications, AI learning modules, and direct placement drives.',
        detailed_description: 'Naan Mudhalvan equips college students and job seekers across Tamil Nadu with industry-aligned technical, software, AI, engineering, and soft skills training to enhance employability and bridge industry talent gaps.',
        benefits_summary: 'Free high-value industry certification courses, mentorship, AI learning tracks, and campus recruitment access.',
        required_documents: ["College Student ID / Graduation Marksheet", "Aadhaar Card", "Community Certificate", "Resume"],
        official_portal_url: 'https://www.naanmudhalvan.tn.gov.in/',
        application_fee: 0.00,
        eligibility_criteria: { min_age: 18, max_age: 35, state: 'Tamil Nadu' }
      },
      {
        id: 'tn-cmchis',
        scheme_code: 'TN-CMCHIS-004',
        scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
        department_name: 'Health & Family Welfare Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Cashless medical and surgical treatment cover up to ₹5,00,000 per family per year in empanelled hospitals.',
        detailed_description: 'CMCHIS offers complete financial protection for low-income families in Tamil Nadu against high medical expenses for listed surgeries, hospitalizations, and specialized medical procedures.',
        benefits_summary: 'Cashless treatment up to ₹5 Lakhs per family per year across government and empanelled private hospitals.',
        required_documents: ["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card of all family members"],
        official_portal_url: 'https://cmchistn.com/',
        application_fee: 0.00,
        eligibility_criteria: { max_annual_income: 120000, state: 'Tamil Nadu' }
      },
      {
        id: 'central-pmkisan',
        scheme_code: 'CENTRAL-PMKISAN-007',
        scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
        department_name: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        state_or_central: 'central',
        short_description: 'Annual direct income support of ₹6,000 for landholding farmer families across India.',
        detailed_description: 'PM-KISAN provides direct financial income support of ₹6,000 per annum to cultivable landholding farmer families across India to meet agricultural input costs and household expenses.',
        benefits_summary: '₹6,00,00 per year paid directly in 3 equal installments of ₹2,000 every 4 months via Direct Benefit Transfer.',
        required_documents: ["Aadhaar Card", "Land Ownership Proof (Patta / RoR)", "Aadhaar-linked Bank Account Passbook"],
        official_portal_url: 'https://pmkisan.gov.in/',
        application_fee: 0.00,
        eligibility_criteria: { is_farmer: true, state: 'All States' }
      },
      {
        id: 'central-pmjay',
        scheme_code: 'CENTRAL-PMJAY-008',
        scheme_name: 'Ayushman Bharat PM-JAY',
        department_name: 'National Health Authority (NHA), Ministry of Health, Govt of India',
        state_or_central: 'central',
        short_description: 'National health insurance cover of ₹5 Lakhs per family for secondary & tertiary hospital care.',
        detailed_description: 'PM-JAY is India’s flagship national health protection scheme providing secondary and tertiary cashless hospitalization cover up to ₹5,00,000 per family per year for over 12 crore poor families.',
        benefits_summary: '₹5,00,000 annual cashless coverage for surgeries, treatments, and diagnostics across empaneled hospitals.',
        required_documents: ["Aadhaar Card", "Ration Card", "Ayushman Golden Card / PM-JAY ID"],
        official_portal_url: 'https://pmjay.gov.in/',
        application_fee: 0.00,
        eligibility_criteria: { max_annual_income: 200000, state: 'All States' }
      }
    ];

    return fallbackList.find(s => s.id === schemeId || s.scheme_code === schemeId) || fallbackList[0];
  }

  async function checkBookmarkStatus(schemeId) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;
          if (userId) {
            const { data } = await client
              .from('saved_schemes')
              .select('id')
              .eq('user_id', userId)
              .eq('scheme_id', schemeId)
              .maybeSingle();

            return !!data;
          }
        }
      }
    } catch (e) {}
    return false;
  }

  async function toggleBookmark() {
    const btn = document.getElementById('btn-details-save');
    if (!btn || !currentScheme) return;

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (!userId) {
            if (window.showToast) window.showToast("Please sign in to save schemes to your bookmarks.", "info");
            return;
          }

          if (isSaved) {
            await client.from('saved_schemes').delete().eq('user_id', userId).eq('scheme_id', currentScheme.id);
            isSaved = false;
            updateBookmarkButtonUI(false);
            if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
          } else {
            await client.from('saved_schemes').insert({ user_id: userId, scheme_id: currentScheme.id });
            isSaved = true;
            updateBookmarkButtonUI(true);
            if (window.showToast) window.showToast("Scheme saved to your bookmarks!", "success");
          }
          return;
        }
      }
    } catch (err) {
      console.warn("Toggle bookmark error:", err);
    }

    isSaved = !isSaved;
    updateBookmarkButtonUI(isSaved);
    if (window.showToast) window.showToast(isSaved ? "Saved scheme to your bookmarks!" : "Removed scheme from bookmarks.", "info");
  }

  function updateBookmarkButtonUI(savedState) {
    const btn = document.getElementById('btn-details-save');
    if (!btn) return;

    if (savedState) {
      btn.style.borderColor = '#10b981';
      btn.style.color = '#10b981';
      btn.style.background = 'rgba(16, 185, 129, 0.1)';
      btn.innerHTML = `<i class="fa-solid fa-bookmark"></i> <span>Saved</span>`;
    } else {
      btn.style.borderColor = 'var(--border-color)';
      btn.style.color = 'var(--text-main)';
      btn.style.background = 'transparent';
      btn.innerHTML = `<i class="fa-regular fa-bookmark"></i> <span>Save Scheme</span>`;
    }
  }

  // Document Readiness Checklist Persistence
  function getSavedChecklistState(schemeId) {
    try {
      const stored = localStorage.getItem(`cc_checklist_${schemeId}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  }

  function saveChecklistState(schemeId, stateObj) {
    try {
      localStorage.setItem(`cc_checklist_${schemeId}`, JSON.stringify(stateObj));
    } catch (e) {}
  }

  function renderDocumentChecklist(scheme) {
    const container = document.getElementById('scheme-details-docs-checklist');
    if (!container) return;

    const docs = Array.isArray(scheme.required_documents) 
      ? scheme.required_documents 
      : (typeof scheme.required_documents === 'string' ? JSON.parse(scheme.required_documents || '[]') : []);

    const savedState = getSavedChecklistState(scheme.id);

    const updateProgressUI = () => {
      let readyCount = 0;
      docs.forEach(doc => {
        if (savedState[doc] === true) readyCount++;
      });
      const pendingCount = docs.length - readyCount;

      const readyElem = document.getElementById('doc-progress-ready');
      const pendingElem = document.getElementById('doc-progress-pending');
      const progressBar = document.getElementById('doc-progress-bar-inner');

      if (readyElem) readyElem.textContent = `${readyCount} Ready`;
      if (pendingElem) pendingElem.textContent = `${pendingCount} Pending`;
      if (progressBar && docs.length > 0) {
        const percent = Math.round((readyCount / docs.length) * 100);
        progressBar.style.width = `${percent}%`;
      }
    };

    container.innerHTML = docs.map((doc, idx) => {
      const isChecked = savedState[doc] === true;
      return `
        <label class="doc-checklist-item" style="background: var(--bg-app); border: 1px solid ${isChecked ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}; border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; transition: all 0.2s ease;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <input type="checkbox" class="doc-checkbox-input" data-doc="${doc}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer;">
            <span style="font-size: 0.88rem; font-weight: 600; color: var(--text-main);">${doc}</span>
          </div>
          <span class="doc-status-badge" style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 999px; background: ${isChecked ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)'}; color: ${isChecked ? '#10b981' : 'var(--text-muted)'}; border: 1px solid ${isChecked ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'};">
            ${isChecked ? '✓ Ready' : 'Pending'}
          </span>
        </label>
      `;
    }).join('');

    updateProgressUI();

    // Attach checkbox handlers
    container.querySelectorAll('.doc-checkbox-input').forEach(chk => {
      chk.addEventListener('change', () => {
        const docName = chk.dataset.doc;
        savedState[docName] = chk.checked;
        saveChecklistState(scheme.id, savedState);

        const parentLabel = chk.closest('.doc-checklist-item');
        const badge = parentLabel.querySelector('.doc-status-badge');
        if (chk.checked) {
          parentLabel.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          badge.style.background = 'rgba(16, 185, 129, 0.15)';
          badge.style.color = '#10b981';
          badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          badge.textContent = '✓ Ready';
        } else {
          parentLabel.style.borderColor = 'var(--border-color)';
          badge.style.background = 'var(--bg-surface)';
          badge.style.color = 'var(--text-muted)';
          badge.style.borderColor = 'var(--border-color)';
          badge.textContent = 'Pending';
        }

        updateProgressUI();
      });
    });
  }

  function renderSchemeDetails(scheme) {
    currentScheme = scheme;
    document.title = `${scheme.scheme_name || scheme.name} - CrowdCity AI`;

    const isState = (scheme.state_or_central === 'state');
    const badgeText = isState ? 'Tamil Nadu State Scheme' : 'Central Government Scheme';

    const titleElem = document.getElementById('scheme-details-title');
    if (titleElem) titleElem.textContent = scheme.scheme_name || scheme.name;

    const deptElem = document.getElementById('scheme-details-dept');
    if (deptElem) deptElem.textContent = scheme.department_name || scheme.department;

    const badgeElem = document.getElementById('scheme-details-badge');
    if (badgeElem) {
      badgeElem.textContent = badgeText;
      badgeElem.className = `scheme-type-badge ${isState ? 'scheme-type-state' : 'scheme-type-central'}`;
    }

    // Overview
    const overviewElem = document.getElementById('scheme-details-overview');
    if (overviewElem) overviewElem.textContent = scheme.detailed_description || scheme.short_description;

    // Benefits Summary
    const benefitsElem = document.getElementById('scheme-details-benefits');
    if (benefitsElem) benefitsElem.textContent = scheme.benefits_summary || scheme.benefits;

    // Eligibility Criteria List
    const criteria = scheme.eligibility_criteria || {};
    const criteriaListElem = document.getElementById('scheme-details-criteria-list');
    if (criteriaListElem) {
      const criteriaItems = [];
      if (criteria.min_age || criteria.max_age) criteriaItems.push(`Age: ${criteria.min_age || 18} to ${criteria.max_age || 60} Years`);
      if (criteria.gender && criteria.gender !== 'all') criteriaItems.push(`Gender: ${criteria.gender === 'female' ? 'Women / Female' : criteria.gender}`);
      if (criteria.max_annual_income) criteriaItems.push(`Annual Income: Up to ₹${criteria.max_annual_income.toLocaleString('en-IN')}`);
      if (criteria.is_student) criteriaItems.push(`Status: Enrolled Student`);
      if (criteria.is_farmer) criteriaItems.push(`Occupation: Landholding Farmer / Agricultural Laborer`);
      if (criteria.state) criteriaItems.push(`Residency: ${criteria.state}`);

      if (criteriaItems.length === 0) criteriaItems.push("General public welfare eligibility applies.");

      criteriaListElem.innerHTML = criteriaItems.map(item => `
        <li style="margin-bottom: 0.5rem; color: var(--text-main); font-size: 0.9rem; font-weight: 600;">
          <i class="fa-solid fa-circle-check" style="color: var(--primary); margin-right: 0.4rem;"></i> ${item}
        </li>
      `).join('');
    }

    // Application Guide Quick Facts
    const guideMode = document.getElementById('guide-fact-mode');
    if (guideMode) guideMode.textContent = 'Online Portal / E-Sevai Center';

    const guideFee = document.getElementById('guide-fact-fee');
    if (guideFee) guideFee.textContent = 'Free (₹0.00)';

    const guideTime = document.getElementById('guide-fact-time');
    if (guideTime) guideTime.textContent = '15 - 30 Working Days';

    const guideDept = document.getElementById('guide-fact-dept');
    if (guideDept) guideDept.textContent = scheme.department_name || scheme.department;

    // Render Interactive Document Checklist
    renderDocumentChecklist(scheme);

    // Vertical Application Timeline
    const timelineContainer = document.getElementById('scheme-details-timeline');
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div style="position: relative; padding-left: 2rem; border-left: 2px solid var(--border-color);">
          <div style="margin-bottom: 1.5rem; position: relative;">
            <div style="position: absolute; left: -2.55rem; top: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">1</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">Step 1: Check Eligibility Criteria</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Verify age, family income limit, and state residency requirements listed on this page.</div>
          </div>

          <div style="margin-bottom: 1.5rem; position: relative;">
            <div style="position: absolute; left: -2.55rem; top: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">2</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">Step 2: Collect Required Documents</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Check off your documents in the Document Checklist above (Aadhaar, Ration Card, Bank Passbook).</div>
          </div>

          <div style="margin-bottom: 1.5rem; position: relative;">
            <div style="position: absolute; left: -2.55rem; top: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">3</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">Step 3: Visit Official Government Portal</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Click the 'Official Apply' button to open the official government website safely in a new tab.</div>
          </div>

          <div style="margin-bottom: 1.5rem; position: relative;">
            <div style="position: absolute; left: -2.55rem; top: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">4</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">Step 4: Submit Application Online</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Fill in your application details, upload document scans, and submit on the official portal.</div>
          </div>

          <div style="position: relative;">
            <div style="position: absolute; left: -2.55rem; top: 0; width: 20px; height: 20px; border-radius: 50%; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">5</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">Step 5: Track Application Status</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Save your application reference number to track verification and direct benefit transfer.</div>
          </div>
        </div>
      `;
    }

    // FAQs Accordion
    const faqContainer = document.getElementById('scheme-details-faq-list');
    if (faqContainer) {
      faqContainer.innerHTML = `
        <details style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer;">
          <summary style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">Is there any fee to apply for this scheme?</summary>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.5rem 0 0 0; line-height: 1.5;">No, government scheme applications through official portals are completely free of charge.</p>
        </details>
        <details style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer;">
          <summary style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">How will I receive the financial benefits?</summary>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.5rem 0 0 0; line-height: 1.5;">Benefits are disbursed directly into your Aadhaar-linked savings bank account via Direct Benefit Transfer (DBT).</p>
        </details>
      `;
    }

    // External Links
    const applyBtn = document.getElementById('btn-details-apply');
    if (applyBtn) {
      applyBtn.href = scheme.official_portal_url || '#';
      applyBtn.target = '_blank';
      applyBtn.rel = 'noopener noreferrer';
    }

    const websiteBtn = document.getElementById('btn-details-website');
    if (websiteBtn) {
      websiteBtn.href = scheme.official_portal_url || '#';
      websiteBtn.target = '_blank';
      websiteBtn.rel = 'noopener noreferrer';
    }

    fetchRelatedSchemes(scheme);
  }

  async function fetchRelatedSchemes(current) {
    const container = document.getElementById('related-schemes-grid');
    if (!container) return;

    const allFallback = [
      { id: 'tn-kmut', name: 'Kalaignar Magalir Urimai Thittam', dept: 'Social Welfare Dept', type: 'state' },
      { id: 'tn-pudhumai', name: 'Pudhumai Penn Scheme', dept: 'Higher Education Dept', type: 'state' },
      { id: 'tn-naanmudhalvan', name: 'Naan Mudhalvan Skill Development', dept: 'TNSDC', type: 'state' },
      { id: 'tn-cmchis', name: 'CM Comprehensive Health Insurance', dept: 'Health Dept', type: 'state' },
      { id: 'central-pmkisan', name: 'PM Kisan Samman Nidhi', dept: 'Ministry of Agriculture', type: 'central' }
    ];

    const related = allFallback.filter(s => s.id !== current.id).slice(0, 3);

    container.innerHTML = related.map(rel => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
        <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary); display: inline-block; margin-bottom: 0.35rem;">
          ${rel.type === 'state' ? 'State Scheme' : 'Central Scheme'}
        </span>
        <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.35rem 0;">${rel.name}</h4>
        <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0 0 1rem 0;">${rel.dept}</p>
        <a href="scheme-details.html?id=${rel.id}" class="btn btn-secondary" style="padding: 0.4rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; text-decoration: none; display: inline-block;">
          View Details →
        </a>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const schemeId = getSchemeIdFromUrl();
    const scheme = await fetchSchemeDetails(schemeId);

    if (scheme) {
      renderSchemeDetails(scheme);
      isSaved = await checkBookmarkStatus(scheme.id);
      updateBookmarkButtonUI(isSaved);
    }

    const saveBtn = document.getElementById('btn-details-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', toggleBookmark);
    }

    const shareBtn = document.getElementById('btn-details-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({
            title: currentScheme ? (currentScheme.scheme_name || currentScheme.name) : 'Government Scheme',
            url: window.location.href
          }).catch(() => {});
        } else {
          navigator.clipboard.writeText(window.location.href);
          if (window.showToast) window.showToast("Scheme page link copied to clipboard!", "success");
        }
      });
    }
  });

})();
