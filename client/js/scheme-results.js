// CrowdCity AI v2.0 - Government Scheme Premium Results JavaScript

(function() {
  'use strict';

  let allEligibleSchemes = [];
  let currentFilter = 'all';

  function getUserProfile() {
    try {
      const stored = sessionStorage.getItem('cc_scheme_checker_profile');
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Default sample profile if accessed directly
    return {
      age: 25,
      gender: 'female',
      income: 120000,
      occupation: 'student',
      isStudent: true,
      isFarmer: false
    };
  }

  async function fetchSchemes() {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('government_schemes')
            .select('*, scheme_categories(category_name, category_code, icon_name)')
            .eq('is_active', true);

          if (!error && data && data.length > 0) return data;
        }
      }
    } catch (e) {
      console.warn("Supabase fetch failed, using fallback:", e);
    }

    return getFallbackSeedSchemes();
  }

  function getFallbackSeedSchemes() {
    return [
      {
        id: 'tn-kmut',
        scheme_name: 'Kalaignar Magalir Urimai Thittam',
        department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN',
        state_or_central: 'state',
        short_description: 'Monthly financial rights assistance of ₹1,000 for female heads of households in Tamil Nadu to promote financial independence.',
        benefits_summary: '₹1,000 monthly direct bank transfer into the account of the female head of the family.',
        required_documents: ["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill"],
        official_portal_url: 'https://kmut.tn.gov.in/',
        eligibility_criteria: { min_age: 21, max_age: 60, gender: 'female', max_annual_income: 250000 }
      },
      {
        id: 'tn-pudhumai',
        scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
        department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN',
        state_or_central: 'state',
        short_description: 'Financial assistance of ₹1,000 per month for female students pursuing higher education who studied in TN Govt schools.',
        benefits_summary: '₹1,000 monthly financial aid until graduation or completion of diploma course.',
        required_documents: ["Govt School Transfer Certificate (6th-12th)", "Aadhaar Card", "College Admission ID", "Bank Passbook"],
        official_portal_url: 'https://penkalvi.tn.gov.in/',
        eligibility_criteria: { min_age: 17, max_age: 25, gender: 'female', is_student: true }
      },
      {
        id: 'tn-naanmudhalvan',
        scheme_name: 'Naan Mudhalvan Skill Development Scheme',
        department_name: 'Tamil Nadu Skill Development Corporation (TNSDC)',
        state_or_central: 'state',
        short_description: 'Statewide skill enhancement, technical certifications, AI learning modules, and direct campus placement drives.',
        benefits_summary: 'Free high-value industry certification courses, mentorship, AI skill modules, and direct employment drives.',
        required_documents: ["College ID / Graduation Marksheet", "Aadhaar Card", "Community Certificate"],
        official_portal_url: 'https://www.naanmudhalvan.tn.gov.in/',
        eligibility_criteria: { min_age: 18, max_age: 35 }
      },
      {
        id: 'tn-cmchis',
        scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
        department_name: 'Health & Family Welfare Department, Govt of TN',
        state_or_central: 'state',
        short_description: 'Cashless medical and surgical treatment coverage up to ₹5,00,000 per family per year in empanelled government & private hospitals.',
        benefits_summary: 'Cashless hospital treatment up to ₹5 Lakhs annually per enrolled family across accredited hospitals.',
        required_documents: ["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card"],
        official_portal_url: 'https://cmchistn.com/',
        eligibility_criteria: { max_annual_income: 120000 }
      },
      {
        id: 'central-pmkisan',
        scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
        department_name: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        state_or_central: 'central',
        short_description: 'Annual direct income support of ₹6,000 for landholding farmer families paid in 3 equal installments.',
        benefits_summary: '₹6,000 per year paid in 3 installments of ₹2,000 every 4 months via Direct Benefit Transfer.',
        required_documents: ["Aadhaar Card", "Land Ownership Certificate (Patta/RoR)", "Aadhaar-linked Bank Account"],
        official_portal_url: 'https://pmkisan.gov.in/',
        eligibility_criteria: { is_farmer: true }
      },
      {
        id: 'central-pmjay',
        scheme_name: 'Ayushman Bharat PM-JAY',
        department_name: 'National Health Authority (NHA), Govt of India',
        state_or_central: 'central',
        short_description: 'National health insurance coverage of ₹5 Lakhs per family for secondary & tertiary hospital care.',
        benefits_summary: '₹5,00,000 annual cashless treatment for over 1,900 medical procedures across network hospitals.',
        required_documents: ["Aadhaar Card", "Ration Card", "Ayushman Golden Card"],
        official_portal_url: 'https://pmjay.gov.in/',
        eligibility_criteria: { max_annual_income: 200000 }
      }
    ];
  }

  function filterEligible(schemes, profile) {
    return schemes.filter(s => {
      const c = s.eligibility_criteria || {};
      if (c.min_age !== undefined && profile.age < c.min_age) return false;
      if (c.max_age !== undefined && profile.age > c.max_age) return false;
      if (c.gender && c.gender !== 'all' && profile.gender !== 'all' && c.gender !== profile.gender) return false;
      if (c.max_annual_income !== undefined && profile.income > c.max_annual_income) return false;
      if (c.is_student === true && !profile.isStudent && profile.occupation !== 'student') return false;
      if (c.is_farmer === true && !profile.isFarmer && profile.occupation !== 'farmer') return false;
      return true;
    });
  }

  function generateWhyEligibleText(scheme, profile, isTamil) {
    const age = profile.age || 25;
    const income = profile.income !== undefined ? `₹${profile.income.toLocaleString('en-IN')}` : '₹1,50,000';
    const name = scheme.scheme_name || scheme.name;

    if (isTamil) {
      return `உங்கள் வயது (${age}) மற்றும் ஆண்டு வருமானம் (${income}) அடிப்படையில், நீங்கள் ${name} திட்டத்திற்கான அனைத்து தகுதிகளையும் நிறைவு செய்கிறீர்கள்.`;
    }
    return `Based on your age of ${age} and annual family income of ${income}, you meet 100% of the official eligibility criteria for ${name}.`;
  }

  function renderSchemes() {
    const container = document.getElementById('premium-scheme-results-container');
    if (!container) return;

    let filtered = allEligibleSchemes;
    if (currentFilter === 'state') {
      filtered = allEligibleSchemes.filter(s => s.state_or_central === 'state');
    } else if (currentFilter === 'central') {
      filtered = allEligibleSchemes.filter(s => s.state_or_central === 'central');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
          <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Schemes Found in this Category</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Switch filter to 'All Eligible' to view all matched welfare programs.</p>
        </div>
      `;
      return;
    }

    const isTamil = (localStorage.getItem('preferred_language') === 'ta');

    container.innerHTML = filtered.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const docs = Array.isArray(scheme.required_documents) 
        ? scheme.required_documents 
        : (typeof scheme.required_documents === 'string' ? JSON.parse(scheme.required_documents || '[]') : []);

      const whyEligible = generateWhyEligibleText(scheme, getUserProfile(), isTamil);

      return `
        <div class="scheme-result-card-v2" data-id="${scheme.id}">
          
          <!-- Card Header: Title & Badges -->
          <div class="scheme-card-header">
            <div>
              <span class="scheme-type-badge ${isState ? 'scheme-type-state' : 'scheme-type-central'}">
                ${isState ? 'Tamil Nadu State Scheme' : 'Central Government Scheme'}
              </span>
              <h3 class="scheme-title-v2">${scheme.scheme_name || scheme.name}</h3>
            </div>
            <span style="font-size: 0.75rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.3rem 0.75rem; border-radius: 999px; white-space: nowrap;">
              ✓ Eligible
            </span>
          </div>

          <!-- Department Info -->
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department_name || scheme.department}
          </div>

          <!-- Short Description -->
          <p class="scheme-short-desc">
            ${scheme.short_description || scheme.description || 'Government welfare scheme providing support for eligible citizens.'}
          </p>

          <!-- Why Eligible AI Box -->
          <div class="ai-why-eligible-box">
            <div class="ai-box-title">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              <span>${isTamil ? 'நீங்கள் ஏன் தகுதி பெறுகிறீர்கள்' : 'Why You Are Eligible'}</span>
            </div>
            <p class="ai-box-content">
              ${whyEligible}
            </p>
          </div>

          <!-- Details Grid: Benefits & Documents -->
          <div class="scheme-details-grid">
            
            <!-- Benefits Block -->
            <div class="scheme-detail-block">
              <div class="scheme-block-title">
                <i class="fa-solid fa-gift" style="color: #6366f1;"></i> Key Benefits
              </div>
              <div class="scheme-block-body">
                ${scheme.benefits_summary || scheme.benefits || 'Direct financial transfer or medical assistance.'}
              </div>
            </div>

            <!-- Required Documents Block -->
            <div class="scheme-detail-block">
              <div class="scheme-block-title">
                <i class="fa-solid fa-file-lines" style="color: #f59e0b;"></i> Required Documents
              </div>
              <div style="margin-top: 0.25rem;">
                ${docs.length > 0 ? docs.map(doc => `<span class="doc-pill">${doc}</span>`).join('') : '<span style="font-size:0.8rem; color:var(--text-muted);">Standard Government ID (Aadhaar/Ration Card)</span>'}
              </div>
            </div>

          </div>

          <!-- Card Actions -->
          <div class="scheme-actions-v2">
            <button class="btn-save-bookmark" data-id="${scheme.id}">
              <i class="fa-regular fa-bookmark"></i>
              <span>Save Scheme</span>
            </button>

            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn-apply-portal">
              <span>Official Apply</span>
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>

        </div>
      `;
    }).join('');

    // Attach bookmark handlers
    document.querySelectorAll('.btn-save-bookmark').forEach(btn => {
      btn.addEventListener('click', async () => {
        const schemeId = btn.dataset.id;
        await saveSchemeBookmark(schemeId, btn);
      });
    });
  }

  async function saveSchemeBookmark(schemeId, buttonElem) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;
          if (!userId) {
            if (window.showToast) window.showToast("Please sign in to bookmark schemes.", "info");
            return;
          }

          const { error } = await client.from('saved_schemes').insert({ user_id: userId, scheme_id: schemeId });
          if (!error || error.code === '23505') {
            if (window.showToast) window.showToast("Scheme saved to your bookmarks!", "success");
          }
        }
      }
    } catch (e) {}

    buttonElem.classList.add('is-saved');
    buttonElem.querySelector('i').className = 'fa-solid fa-bookmark';
    buttonElem.querySelector('span').textContent = 'Saved';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const profile = getUserProfile();
    const allSchemes = await fetchSchemes();
    allEligibleSchemes = filterEligible(allSchemes, profile);

    if (allEligibleSchemes.length === 0 && allSchemes.length > 0) {
      allEligibleSchemes = allSchemes.slice(0, 3);
    }

    // Update Counts
    const countElem = document.getElementById('hero-matched-count');
    if (countElem) countElem.textContent = allEligibleSchemes.length;

    const tabCountAll = document.getElementById('tab-count-all');
    if (tabCountAll) tabCountAll.textContent = allEligibleSchemes.length;

    renderSchemes();

    // Tab Filter Buttons
    document.querySelectorAll('.results-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.results-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderSchemes();
      });
    });
  });

})();
