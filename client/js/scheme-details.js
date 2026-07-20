// CrowdCity AI v2.0 - Government Scheme Details JavaScript
// Fetches scheme details, handles bookmark state, renders FAQs, application process, and related schemes.

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

          // Try matching by scheme_code if UUID query fails
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
        required_documents: ["Smart Family Ration Card", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill / Income Certificate"],
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
        benefits_summary: '₹6,000 per year paid directly in 3 equal installments of ₹2,000 every 4 months via Direct Benefit Transfer.',
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
            // Remove Bookmark
            await client.from('saved_schemes').delete().eq('user_id', userId).eq('scheme_id', currentScheme.id);
            isSaved = false;
            updateBookmarkButtonUI(false);
            if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
          } else {
            // Save Bookmark
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

    // Toggle local state fallback
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

  function renderSchemeDetails(scheme) {
    currentScheme = scheme;

    // Set Title
    document.title = `${scheme.scheme_name || scheme.name} - CrowdCity AI`;
    
    const isState = (scheme.state_or_central === 'state');
    const badgeText = isState ? 'Tamil Nadu State Scheme' : 'Central Government Scheme';

    // Hero Section
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

    // Eligibility Criteria Box
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

    // Documents List
    const docs = Array.isArray(scheme.required_documents) 
      ? scheme.required_documents 
      : (typeof scheme.required_documents === 'string' ? JSON.parse(scheme.required_documents || '[]') : []);

    const docsContainer = document.getElementById('scheme-details-docs-list');
    if (docsContainer) {
      docsContainer.innerHTML = docs.map(doc => `
        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; font-size: 0.85rem; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 0.6rem;">
          <i class="fa-solid fa-file-check" style="color: var(--primary);"></i> <span>${doc}</span>
        </div>
      `).join('');
    }

    // Application Steps
    const stepsContainer = document.getElementById('scheme-details-steps-list');
    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <div style="margin-bottom: 1rem; display: flex; gap: 0.75rem; align-items: flex-start;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">1</div>
          <div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">Gather Required Documents</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">Ensure you have valid copies of your Smart Ration Card, Aadhaar Card, and Bank Passbook.</div>
          </div>
        </div>
        <div style="margin-bottom: 1rem; display: flex; gap: 0.75rem; align-items: flex-start;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">2</div>
          <div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">Access Official Portal</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">Click the 'Apply on Official Portal' button below to open the official government website.</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">3</div>
          <div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">Complete Application & Track Status</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">Fill in your application details, upload required attachments, and note down your reference application number.</div>
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

    // External Portal Link Buttons
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

    // Fetch Related Schemes
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

    // Save Button Handler
    const saveBtn = document.getElementById('btn-details-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', toggleBookmark);
    }

    // Share Button Handler
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
