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

  // Redesigned database eligibility evaluator mapping criteria fields individually
  function evaluateEligibility(scheme, profile) {
    const criteria = scheme.eligibility_criteria || {};
    const passed = [];
    const failed = [];
    const missing = [];
    const missingDocs = [];

    const currentLang = localStorage.getItem('preferred_language') || 'en';
    const isTamil = (currentLang === 'ta');

    // 1. Age check
    if (criteria.min_age !== undefined && criteria.min_age !== null) {
      if (!profile.age) {
        missing.push(isTamil ? "வயது விவரம் தேவை." : "Age information is required.");
      } else if (profile.age < criteria.min_age) {
        failed.push(isTamil 
          ? `வயது வரம்பு ${criteria.min_age}க்கு குறைவாக உள்ளது.` 
          : `Age is below the minimum required age of ${criteria.min_age}.`);
      } else {
        passed.push(isTamil 
          ? `வயது தகுதி பூர்த்தி செய்யப்பட்டது (${profile.age} >= ${criteria.min_age}).` 
          : `Age satisfies minimum requirement (${profile.age} >= ${criteria.min_age}).`);
      }
    }
    if (criteria.max_age !== undefined && criteria.max_age !== null) {
      if (!profile.age) {
        const msg = isTamil ? "வயது விவரம் தேவை." : "Age information is required.";
        if (!missing.includes(msg)) missing.push(msg);
      } else if (profile.age > criteria.max_age) {
        failed.push(isTamil 
          ? `வயது வரம்பு ${criteria.max_age}க்கு அதிகமாக உள்ளது.` 
          : `Age exceeds the maximum allowed age of ${criteria.max_age}.`);
      } else {
        passed.push(isTamil 
          ? `வயது தகுதி பூர்த்தி செய்யப்பட்டது (${profile.age} <= ${criteria.max_age}).` 
          : `Age satisfies maximum limit (${profile.age} <= ${criteria.max_age}).`);
      }
    }

    // 2. Gender check
    if (criteria.gender && criteria.gender !== 'all') {
      if (!profile.gender || profile.gender === 'all') {
        missing.push(isTamil ? "பாலினம் விவரம் தேவை." : "Gender specification is required.");
      } else if (profile.gender !== criteria.gender) {
        failed.push(isTamil 
          ? `பாலின தகுதி பொருந்தவில்லை (இத்திட்டம் ${criteria.gender === 'female' ? 'பெண்களுக்கு' : criteria.gender} மட்டுமே).` 
          : `Gender requirement mismatch (Available for ${criteria.gender} only).`);
      } else {
        passed.push(isTamil 
          ? `பாலின தகுதி பொருந்துகிறது (${profile.gender}).` 
          : `Gender matches requirements (${profile.gender}).`);
      }
    }

    // 3. Income check
    if (criteria.max_annual_income !== undefined && criteria.max_annual_income !== null) {
      if (profile.income === undefined || profile.income === null || profile.income === 0) {
        missing.push(isTamil ? "ஆண்டு வருமானம் விவரம் தேவை." : "Annual family income is required.");
      } else if (profile.income > criteria.max_annual_income) {
        failed.push(isTamil 
          ? `ஆண்டு வருமானம் ₹${profile.income.toLocaleString('en-IN')} வரம்பைவிட (₹${criteria.max_annual_income.toLocaleString('en-IN')}) அதிகமாக உள்ளது.` 
          : `Annual income of ₹${profile.income.toLocaleString()} exceeds the limit of ₹${criteria.max_annual_income.toLocaleString()}.`);
      } else {
        passed.push(isTamil 
          ? `ஆண்டு வருமானம் வரம்பிற்குள் உள்ளது (₹${profile.income.toLocaleString('en-IN')} <= ₹${criteria.max_annual_income.toLocaleString('en-IN')}).` 
          : `Annual income is within the limit (₹${profile.income.toLocaleString()} <= ₹${criteria.max_annual_income.toLocaleString()}).`);
      }
    }

    // 4. Student status
    if (criteria.student_required) {
      if (!profile.isStudent && profile.occupation !== 'student') {
        failed.push(isTamil ? "மாணவர் நிலை தேவை." : "Student status is required.");
      } else {
        passed.push(isTamil ? "மாணவர் நிலை சரிபார்க்கப்பட்டது." : "Candidate is a verified current student.");
      }
    }

    // 5. Gov School studied
    if (criteria.gov_school_required) {
      if (profile.govSchoolStudied === undefined || profile.govSchoolStudied === null) {
        missing.push(isTamil ? "அரசு பள்ளி கல்வி விவரம் தேவை." : "Government school study verification is required.");
      } else if (!profile.govSchoolStudied) {
        failed.push(isTamil ? "அரசு பள்ளியில் படித்திருக்க வேண்டும்." : "Welfare benefit requires studying in a Government School.");
      } else {
        passed.push(isTamil ? "அரசு பள்ளியில் படித்தது சரிபார்க்கப்பட்டது." : "Studied in Government School verified.");
      }
    }

    // 6. Gov College studied
    if (criteria.gov_college_required) {
      if (profile.govCollegeStudied === undefined || profile.govCollegeStudied === null) {
        missing.push(isTamil ? "அரசு கல்லூரி கல்வி விவரம் தேவை." : "Government college study verification is required.");
      } else if (!profile.govCollegeStudied) {
        failed.push(isTamil ? "அரசு கல்லூரியில் படித்திருக்க வேண்டும்." : "Welfare benefit requires studying in a Government College.");
      } else {
        passed.push(isTamil ? "அரசு கல்லூரியில் படித்தது சரிபார்க்கப்பட்டது." : "Studied in Government College verified.");
      }
    }

    // 7. Disability status
    if (criteria.disability_required) {
      if (!profile.isDisability) {
        failed.push(isTamil ? "மாற்றுத்திறனாளி தகுதி தேவை." : "Scheme requires differently-abled / disability status.");
      } else {
        passed.push(isTamil ? "மாற்றுத்திறனாளி தகுதி பொருந்துகிறது." : "Differently-abled status satisfied.");
      }
    }

    // 8. Widow / Single Parent status
    if (criteria.widow_required) {
      if (!profile.isWidow) {
        failed.push(isTamil ? "விதவை அல்லது ஒற்றை பெற்றோர் தகுதி தேவை." : "Scheme requires widow / single parent status.");
      } else {
        passed.push(isTamil ? "விதவை / ஒற்றை பெற்றோர் தகுதி பொருந்துகிறது." : "Widow / Single parent status satisfied.");
      }
    }

    // 9. Farmer family status
    if (criteria.farmer_required) {
      if (!profile.isFarmer && profile.occupation !== 'farmer') {
        failed.push(isTamil ? "விவசாயி தகுதி தேவை." : "Scheme requires agricultural landholder / farmer status.");
      } else {
        passed.push(isTamil ? "விவசாயி தகுதி சரிபார்க்கப்பட்டது." : "Farmer status verified.");
      }
    }

    // 10. Residency state check
    if (criteria.native_state) {
      if (!profile.district) {
        missing.push(isTamil ? "இருப்பிட/மாவட்ட விவரங்கள் தேவை." : "Residency/District proof details are required.");
      } else {
        passed.push(isTamil 
          ? `தமிழக இருப்பிட தகுதி (${profile.district} மாவட்டம்).` 
          : `Native resident of ${criteria.native_state} (${profile.district} District).`);
      }
    }

    // Check certificates list availability
    const reqCerts = criteria.required_certificates || [];
    let uploadedDocs = [];
    try {
      const stored = localStorage.getItem('cc_user_uploaded_docs');
      if (stored) uploadedDocs = JSON.parse(stored);
    } catch (e) {}

    const uploadedTypes = uploadedDocs.map(d => d.doc_type || "");
    reqCerts.forEach(cert => {
      const matchFound = uploadedTypes.some(type => {
        const t = type.toLowerCase();
        const c = cert.toLowerCase();
        return t.includes(c) || c.includes(t);
      });

      if (!matchFound) {
        missingDocs.push(cert);
      } else {
        passed.push(isTamil ? `ஆவணம் பதிவேற்றப்பட்டது: ${cert}` : `Required Document uploaded: ${cert}`);
      }
    });

    let status = "Eligible";
    if (failed.length > 0) {
      status = "Not Eligible";
    } else if (missing.length > 0) {
      status = "Additional Information Required";
    } else if (missingDocs.length > 0) {
      status = "Additional Documents Required";
    } else {
      status = "Eligible";
    }

    return {
      status,
      passed,
      failed,
      missing,
      missingDocs
    };
  }

  function filterEligible(schemes, profile) {
    // Map evaluations to all schemes
    const evaluated = schemes.map(scheme => {
      const evaluation = evaluateEligibility(scheme, profile);
      return {
        ...scheme,
        evaluation
      };
    });

    // Exclude schemes where user is explicitly Not Eligible
    const eligibleList = evaluated.filter(s => s.evaluation.status !== "Not Eligible");

    // Sort by status priority: Eligible first, then Likely, then Docs, then Info
    return eligibleList.sort((a, b) => {
      const statusOrder = {
        "Eligible": 1,
        "Likely Eligible": 2,
        "Additional Documents Required": 3,
        "Additional Information Required": 4
      };
      return statusOrder[a.evaluation.status] - statusOrder[b.evaluation.status];
    });
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
      const evalData = scheme.evaluation || { status: 'Eligible', passed: [], failed: [], missing: [], missingDocs: [] };
      
      let badgeColor = "#10b981"; // Green
      let badgeBg = "rgba(16, 185, 129, 0.12)";
      let statusText = isTamil ? "தகுதி உள்ளது" : "Eligible";

      if (evalData.status === "Additional Information Required") {
        badgeColor = "#f59e0b"; // Yellow/Orange
        badgeBg = "rgba(245, 158, 11, 0.12)";
        statusText = isTamil ? "கூடுதல் தகவல் தேவை" : "Info Required";
      } else if (evalData.status === "Additional Documents Required") {
        badgeColor = "#3b82f6"; // Blue
        badgeBg = "rgba(59, 130, 246, 0.12)";
        statusText = isTamil ? "கூடுதல் ஆவணம் தேவை" : "Docs Required";
      } else if (evalData.status === "Likely Eligible") {
        badgeColor = "#0d9488"; // Teal
        badgeBg = "rgba(13, 148, 136, 0.12)";
        statusText = isTamil ? "தகுதி இருக்கக்கூடும்" : "Likely Eligible";
      }

      return `
        <div class="scheme-result-card-v2" data-id="${scheme.id}">
          
          <!-- Card Header: Title & Badges -->
          <div class="scheme-card-header">
            <div>
              <span class="scheme-type-badge ${isState ? 'scheme-type-state' : 'scheme-type-central'}">
                ${isState ? (isTamil ? 'தமிழ்நாடு அரசு திட்டம்' : 'Tamil Nadu State Scheme') : (isTamil ? 'மத்திய அரசு திட்டம்' : 'Central Government Scheme')}
              </span>
              <h3 class="scheme-title-v2">${scheme.scheme_name || scheme.name}</h3>
            </div>
            <span style="font-size: 0.75rem; font-weight: 800; color: ${badgeColor}; background: ${badgeBg}; padding: 0.3rem 0.75rem; border-radius: 999px; white-space: nowrap;">
              ${statusText}
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

          <!-- Collapsible Explanation Panel -->
          <div class="ai-why-eligible-box" style="margin-bottom: 1.25rem; background: linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(99, 102, 241, 0.05)); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 12px; padding: 1.25rem;">
            <div class="ai-box-title" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 800; color: var(--text-main); font-size: 0.9rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(13, 148, 136, 0.15); padding-bottom: 0.4rem;">
              <i class="fa-solid fa-award" style="color: var(--primary);"></i>
              <span>${isTamil ? 'தகுதி மதிப்பீடு' : 'Eligibility Evaluation'}</span>
            </div>

            <!-- Status Notice Box -->
            ${evalData.status === "Likely Eligible" ? `
              <div style="background: rgba(13, 148, 136, 0.1); border-left: 4px solid #0d9488; padding: 0.5rem; border-radius: 4px; font-size: 0.8rem; color: var(--text-main); margin-bottom: 0.75rem;">
                <i class="fa-solid fa-circle-info"></i> ${isTamil ? 'ஓரளவு தகுதி - அதிகாரப்பூர்வ திட்ட வழிகாட்டுதல்களை சரிபார்க்கவும்.' : 'Likely Eligible – Please verify with the official scheme guidelines.'}
              </div>
            ` : ''}

            ${evalData.status === "Additional Information Required" ? `
              <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.5rem; border-radius: 4px; font-size: 0.8rem; color: var(--text-main); margin-bottom: 0.75rem;">
                <i class="fa-solid fa-circle-exclamation"></i> ${isTamil ? 'கூடுதல் தகவல் தேவை - உங்கள் சுயவிவரத்தை முழுமையாக நிரப்பவும்.' : 'Additional Information Required – Please fill in missing profile fields.'}
              </div>
            ` : ''}

            <!-- 1. Why You Qualify (Passed Rules) -->
            ${evalData.passed.length > 0 ? `
              <div style="margin-bottom: 0.65rem;">
                <div style="font-size: 0.75rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">
                  ${isTamil ? 'நிறைவு செய்த தகுதிகள்' : 'Satisfied Conditions'}
                </div>
                <ul style="font-size: 0.82rem; color: var(--text-main); line-height: 1.4; margin: 0; padding-left: 1.1rem;">
                  ${evalData.passed.map(p => `<li>${p}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- 2. Missing Information -->
            ${evalData.missing.length > 0 ? `
              <div style="margin-bottom: 0.65rem;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">
                  ${isTamil ? 'விடுபட்ட விவரங்கள்' : 'Missing Information'}
                </div>
                <ul style="font-size: 0.82rem; color: var(--text-main); line-height: 1.4; margin: 0; padding-left: 1.1rem;">
                  ${evalData.missing.map(m => `<li style="color: #d97706;">${m}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- 3. Required Documents Checklist -->
            <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(13, 148, 136, 0.15); padding-top: 0.5rem;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">
                ${isTamil ? 'தேவையான சான்றிதழ்கள்' : 'Required Documents'}
              </div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.25rem;">
                ${(scheme.eligibility_criteria.required_certificates || []).map(cert => {
                  const hasDoc = !evalData.missingDocs.includes(cert);
                  return `
                    <span style="font-size: 0.72rem; background: ${hasDoc ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)'}; border: 1px solid ${hasDoc ? '#10b981' : '#9ca3af'}; padding: 0.2rem 0.5rem; border-radius: 6px; color: ${hasDoc ? '#10b981' : '#4b5563'};">
                      <i class="fa-solid ${hasDoc ? 'fa-check' : 'fa-circle-question'}"></i> ${cert}
                    </span>
                  `;
                }).join('')}
              </div>
            </div>

          </div>

          <!-- Details Grid: Benefits & Documents -->
          <div class="scheme-details-grid">
            
            <!-- Benefits Block -->
            <div class="scheme-detail-block">
              <div class="scheme-block-title">
                <i class="fa-solid fa-gift" style="color: #6366f1;"></i> ${isTamil ? 'முக்கிய நன்மைகள்' : 'Key Benefits'}
              </div>
              <div class="scheme-block-body">
                ${scheme.benefits_summary || scheme.benefits || 'Direct financial transfer or medical assistance.'}
              </div>
            </div>

          </div>

          <!-- Card Actions -->
          <div class="scheme-actions-v2">
            <a href="scheme-details.html?id=${scheme.id}" class="btn-save-bookmark" style="text-decoration: none;">
              <i class="fa-solid fa-circle-info"></i>
              <span>${isTamil ? 'விவரங்கள் பார்' : 'View Details'}</span>
            </a>

            <button class="btn-save-bookmark" data-id="${scheme.id}">
              <i class="fa-regular fa-bookmark"></i>
              <span>${isTamil ? 'சேமிக்கவும்' : 'Save Scheme'}</span>
            </button>

            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn-apply-portal">
              <span>${isTamil ? 'விண்ணப்பிக்க' : 'Official Apply'}</span>
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
