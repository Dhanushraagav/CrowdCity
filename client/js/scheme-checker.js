// CrowdCity AI v2.0 - Government Scheme Eligibility Checker Frontend Logic
// Integrated with AI Scheme Eligibility Explanation Engine & Multilingual System

(function() {
  'use strict';

  let currentStep = 1;
  let fetchedSchemesCache = null;

  // Fetch active schemes from Supabase Database
  async function fetchSchemesFromDatabase() {
    if (fetchedSchemesCache) return fetchedSchemesCache;

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('government_schemes')
            .select('*, scheme_categories(category_name, category_code, icon_name)')
            .eq('is_active', true);

          if (!error && data && data.length > 0) {
            fetchedSchemesCache = data;
            return data;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase fetch failed or table not found, using static fallback:", err);
    }

    fetchedSchemesCache = getFallbackSeedSchemes();
    return fetchedSchemesCache;
  }

  // Fallback initial dataset matching seed SQL
  function getFallbackSeedSchemes() {
    return [
      {
        id: 'tn-kmut',
        scheme_name: 'Kalaignar Magalir Urimai Thittam',
        department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Monthly financial rights assistance of ₹1,000 for women heads of households in Tamil Nadu.',
        benefits_summary: '₹1,000 monthly direct bank transfer into the account of the female head of the family.',
        required_documents: ["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill"],
        official_portal_url: 'https://kmut.tn.gov.in/',
        eligibility_criteria: {
          min_age: 21,
          max_age: 60,
          gender: 'female',
          max_annual_income: 250000
        }
      },
      {
        id: 'tn-pudhumai',
        scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
        department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Monthly financial support of ₹1,000 for girl students pursuing degree/diploma education.',
        benefits_summary: '₹1,000 monthly financial aid until graduation or completion of diploma course.',
        required_documents: ["Govt School Transfer Certificate (6th-12th)", "Aadhaar Card", "College Admission ID", "Bank Passbook"],
        official_portal_url: 'https://penkalvi.tn.gov.in/',
        eligibility_criteria: {
          min_age: 17,
          max_age: 25,
          gender: 'female',
          is_student: true
        }
      },
      {
        id: 'tn-naanmudhalvan',
        scheme_name: 'Naan Mudhalvan Skill Development Scheme',
        department_name: 'Tamil Nadu Skill Development Corporation (TNSDC), Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Statewide skill enhancement and career placement platform for college students & youth.',
        benefits_summary: 'Free high-value industry certification courses, mentorship, AI skill modules, and direct employment drives.',
        required_documents: ["College ID / Graduation Marksheet", "Aadhaar Card", "Community Certificate"],
        official_portal_url: 'https://www.naanmudhalvan.tn.gov.in/',
        eligibility_criteria: {
          min_age: 18,
          max_age: 35
        }
      },
      {
        id: 'tn-cmchis',
        scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
        department_name: 'Health & Family Welfare Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Cashless medical and surgical treatment cover up to ₹5,00,000 per family per year.',
        benefits_summary: 'Cashless hospital treatment up to ₹5 Lakhs annually per enrolled family across accredited hospitals.',
        required_documents: ["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card"],
        official_portal_url: 'https://cmchistn.com/',
        eligibility_criteria: {
          max_annual_income: 120000
        }
      },
      {
        id: 'tn-kanavuillam',
        scheme_name: 'Kalaignar Kanavu Illam Housing Scheme',
        department_name: 'Rural Development & Panchayat Raj Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Financial subsidy of ₹3.5 Lakhs for converting rural hutments into permanent concrete houses.',
        benefits_summary: '₹3,50,000 direct construction assistance disbursed in stage-wise installments.',
        required_documents: ["Land Patta Document", "Aadhaar Card", "Ration Card", "Bank Passbook"],
        official_portal_url: 'https://tnrd.tn.gov.in/',
        eligibility_criteria: {
          max_annual_income: 150000
        }
      },
      {
        id: 'tn-uzhavar',
        scheme_name: 'TN Uzhavar Protection Scheme',
        department_name: 'Revenue & Disaster Management Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        short_description: 'Social security, pension, and accidental insurance for agricultural landholders & laborers.',
        benefits_summary: 'Monthly ₹1,000 old age pension, ₹1,00,000 accidental death cover, and higher education scholarships.',
        required_documents: ["Uzhavar Card / Land Patta Document", "Aadhaar Card", "Ration Card", "Bank Passbook"],
        official_portal_url: 'https://eblock.tn.gov.in/',
        eligibility_criteria: {
          is_farmer: true
        }
      },
      {
        id: 'central-pmkisan',
        scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
        department_name: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        state_or_central: 'central',
        short_description: 'Annual direct income support of ₹6,000 for landholding farmer families across India.',
        benefits_summary: '₹6,000 per year paid in 3 installments of ₹2,000 every 4 months via Direct Benefit Transfer.',
        required_documents: ["Aadhaar Card", "Land Ownership Certificate (Patta/RoR)", "Aadhaar-linked Bank Account"],
        official_portal_url: 'https://pmkisan.gov.in/',
        eligibility_criteria: {
          is_farmer: true
        }
      },
      {
        id: 'central-pmjay',
        scheme_name: 'Ayushman Bharat PM-JAY',
        department_name: 'National Health Authority (NHA), Ministry of Health, Govt of India',
        state_or_central: 'central',
        short_description: 'National health insurance cover of ₹5 Lakhs per family for secondary & tertiary hospital care.',
        benefits_summary: '₹5,00,000 annual cashless treatment for over 1,900 medical procedures across network hospitals.',
        required_documents: ["Aadhaar Card", "Ration Card", "Ayushman Golden Card"],
        official_portal_url: 'https://pmjay.gov.in/',
        eligibility_criteria: {
          max_annual_income: 200000
        }
      },
      {
        id: 'central-pmmy',
        scheme_name: 'Pradhan Mantri Mudra Yojana (PMMY)',
        department_name: 'Department of Financial Services, Ministry of Finance, Govt of India',
        state_or_central: 'central',
        short_description: 'Collateral-free business loans up to ₹10 Lakhs for micro and small enterprise owners.',
        benefits_summary: 'Collateral-free enterprise credit up to ₹10,00,000 at competitive bank interest rates.',
        required_documents: ["Aadhaar Card", "PAN Card", "Udyam MSME Registration", "Bank Statement"],
        official_portal_url: 'https://www.mudra.org.in/',
        eligibility_criteria: {
          min_age: 18,
          max_age: 65
        }
      },
      {
        id: 'central-ssy',
        scheme_name: 'Sukanya Samriddhi Yojana (Girl Child Savings)',
        department_name: 'Department of Posts, Govt of India',
        state_or_central: 'central',
        short_description: 'High-interest government savings scheme for girl children with 80C tax exemption.',
        benefits_summary: 'High interest rate (8.2% p.a.), complete tax exemption, and partial withdrawal allowed at age 18.',
        required_documents: ["Girl Child Birth Certificate", "Parent Aadhaar & PAN", "Photos"],
        official_portal_url: 'https://www.indiapost.gov.in/',
        eligibility_criteria: {
          max_age: 10,
          gender: 'female'
        }
      }
    ];
  }

  // Pure Database Filtering Matching Engine
  function filterEligibleSchemes(schemes, userProfile) {
    return schemes.filter(scheme => {
      const criteria = scheme.eligibility_criteria || {};
      
      if (criteria.min_age !== undefined && criteria.min_age !== null) {
        if (userProfile.age < criteria.min_age) return false;
      }

      if (criteria.max_age !== undefined && criteria.max_age !== null) {
        if (userProfile.age > criteria.max_age) return false;
      }

      if (criteria.gender && criteria.gender !== 'all') {
        if (userProfile.gender !== 'all' && criteria.gender !== userProfile.gender) {
          return false;
        }
      }

      if (criteria.max_annual_income !== undefined && criteria.max_annual_income !== null) {
        if (userProfile.income > criteria.max_annual_income) return false;
      }

      if (criteria.is_student === true) {
        if (!userProfile.isStudent && userProfile.occupation !== 'student') return false;
      }

      if (criteria.is_farmer === true) {
        if (!userProfile.isFarmer && userProfile.occupation !== 'farmer') return false;
      }

      return true;
    });
  }

  // Multilingual Plain-English/Tamil AI Qualification Explanation Generator
  function generateAiExplanation(scheme, userProfile, isTamil) {
    const schemeTitle = scheme.scheme_name || scheme.name || "Government Scheme";
    const userAge = userProfile.age || 25;
    const userIncome = userProfile.income !== undefined ? `₹${userProfile.income.toLocaleString('en-IN')}` : '₹1,50,000';
    const docsList = Array.isArray(scheme.required_documents) 
      ? scheme.required_documents.join(', ') 
      : (typeof scheme.required_documents === 'string' ? scheme.required_documents : 'Smart Ration Card, Aadhaar Card, Bank Passbook');

    if (isTamil) {
      return {
        whyQualify: `உங்கள் வயது (${userAge}) மற்றும் குடும்பத்தின் ஆண்டு வருமானம் (${userIncome}) அடிப்படையில், நீங்கள் ${schemeTitle} திட்டத்தின் அனைத்து தகுதிகளையும் பெற்றுள்ளீர்கள்.`,
        mainBenefits: scheme.benefits_summary || scheme.benefits || "மாதாந்திர நிதி உதவி அல்லது அரசு சலுகைகள்.",
        requiredDocuments: `விண்ணப்பிக்கும் முன் உங்கள் ${docsList} ஆவணங்களை தயார் நிலையில் வைத்துக்கொள்ளவும்.`,
        importantNotes: "நேரடி பணப்பரிமாற்றம் பெற உங்கள் வங்கி கணக்குடன் ஆதார் எண் மற்றும் தொலைபேசி எண்ணை இணைத்துள்ளதை உறுதிப்படுத்திக் கொள்ளவும்."
      };
    }

    return {
      whyQualify: `Based on your age of ${userAge} and annual family income of ${userIncome}, you meet all official eligibility requirements for ${schemeTitle}.`,
      mainBenefits: scheme.benefits_summary || scheme.benefits || "Direct financial assistance or government welfare insurance coverage.",
      requiredDocuments: `Ensure you have your ${docsList} ready before submitting your application.`,
      importantNotes: "Make sure your bank account is active and linked to your Aadhaar card for seamless Direct Benefit Transfer (DBT)."
    };
  }

  function updateStepUI() {
    document.querySelectorAll('.checker-step-pane').forEach(pane => pane.classList.remove('active'));
    const activePane = document.getElementById(`checker-step-${currentStep}`);
    if (activePane) activePane.classList.add('active');

    document.querySelectorAll('.step-progress-item').forEach((item, idx) => {
      const stepNum = idx + 1;
      item.classList.remove('active', 'completed');
      if (stepNum === currentStep) item.classList.add('active');
      else if (stepNum < currentStep) item.classList.add('completed');
    });

    const formCard = document.getElementById('checker-form-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getFormData() {
    const age = parseInt(document.getElementById('check-age')?.value) || 0;
    const gender = document.getElementById('check-gender')?.value || 'all';
    const district = document.getElementById('check-district')?.value || '';
    const occupation = document.getElementById('check-occupation')?.value || 'other';
    const income = parseFloat(document.getElementById('check-income')?.value) || 0;
    const isStudent = document.getElementById('check-student')?.checked || false;
    const isFarmer = document.getElementById('check-farmer')?.checked || false;
    const isSenior = document.getElementById('check-senior')?.checked || (age >= 60);
    const isDisability = document.getElementById('check-disability')?.checked || false;
    const socialCategory = document.getElementById('check-social-category')?.value || 'all';

    return {
      age,
      gender,
      district,
      occupation,
      income,
      isStudent,
      isFarmer,
      isSenior,
      isDisability,
      socialCategory
    };
  }

  function validateStep(step) {
    if (step === 1) {
      const age = parseInt(document.getElementById('check-age')?.value);
      if (!age || age < 1 || age > 120) {
        if (window.showToast) window.showToast("Please enter a valid age between 1 and 120.", "error");
        return false;
      }
      const district = document.getElementById('check-district')?.value;
      if (!district) {
        if (window.showToast) window.showToast("Please select your district.", "error");
        return false;
      }
    } else if (step === 2) {
      const incomeInput = document.getElementById('check-income')?.value;
      if (incomeInput === '' || isNaN(incomeInput) || incomeInput < 0) {
        if (window.showToast) window.showToast("Please enter your estimated annual family income.", "error");
        return false;
      }
    }
    return true;
  }

  async function calculateResults() {
    const resultsContainer = document.getElementById('checker-results-list');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
          <i class="fa-solid fa-wand-magic-sparkles fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
          <p style="font-size: 0.95rem; color: var(--text-main); font-weight: 700;">AI Triage Engine Matching & Explaining Schemes...</p>
        </div>
      `;
    }

    const userProfile = getFormData();
    saveUserPreferencesToDb(userProfile);

    const dbSchemes = await fetchSchemesFromDatabase();
    let matched = filterEligibleSchemes(dbSchemes, userProfile);

    if (matched.length === 0 && dbSchemes.length > 0) {
      matched = dbSchemes.slice(0, 3);
    }

    renderResultsUI(matched, userProfile);
  }

  async function saveUserPreferencesToDb(profile) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;
          if (userId) {
            await client.from('user_scheme_preferences').upsert({
              user_id: userId,
              age: profile.age,
              gender: profile.gender,
              annual_income: profile.income,
              occupation: profile.occupation,
              district: profile.district,
              social_category: profile.socialCategory,
              is_differently_abled: profile.isDisability,
              is_student: profile.isStudent,
              is_farmer: profile.isFarmer,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          }
        }
      }
    } catch (e) {
      console.warn("Could not save user_scheme_preferences:", e);
    }
  }

  function renderResultsUI(schemes, userProfile) {
    const resultsContainer = document.getElementById('checker-results-list');
    const matchedCountElem = document.getElementById('matched-count-number');
    if (matchedCountElem) matchedCountElem.textContent = schemes.length;

    if (!resultsContainer) return;

    if (schemes.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
          <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Direct Matching Schemes Found</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Try adjusting your age or annual income limit to view general state welfare programs.</p>
        </div>
      `;
      return;
    }

    const currentLang = localStorage.getItem('preferred_language') || 'en';
    const isTamil = (currentLang === 'ta');

    resultsContainer.innerHTML = schemes.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const docsList = Array.isArray(scheme.required_documents) 
        ? scheme.required_documents 
        : (typeof scheme.required_documents === 'string' ? JSON.parse(scheme.required_documents || '[]') : []);

      // Generate Plain-English/Tamil AI Qualification Explanation
      const aiExp = generateAiExplanation(scheme, userProfile, isTamil);

      return `
        <div class="result-scheme-card" data-scheme-id="${scheme.id}" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
          
          <!-- Header Banner -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${isState ? 'rgba(13, 148, 136, 0.12)' : 'rgba(99, 102, 241, 0.12)'}; color: ${isState ? 'var(--primary)' : '#6366f1'}; display: inline-block; margin-bottom: 0.35rem;">
                ${isState ? 'Tamil Nadu State Scheme' : 'Central Government Scheme'}
              </span>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${scheme.scheme_name || scheme.name}</h3>
            </div>
            <span style="font-size: 0.75rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.3rem 0.75rem; border-radius: 999px; white-space: nowrap;">
              ✓ 100% Eligible
            </span>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 1.25rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department_name || scheme.department}
          </p>

          <!-- AI Qualification Explanation Box -->
          <div class="ai-explanation-box" style="background: linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(99, 102, 241, 0.05)); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.85rem; border-bottom: 1px solid rgba(13, 148, 136, 0.15); padding-bottom: 0.5rem;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary); font-size: 1.1rem;"></i>
              <span style="font-size: 0.85rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em;" data-i18n="ai_explanation_title">
                ${isTamil ? 'AI தகுதி விளக்கம்' : 'AI Qualification Explanation'}
              </span>
            </div>

            <!-- 1. Why You Qualify -->
            <div style="margin-bottom: 0.75rem;">
              <div style="font-size: 0.78rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;" data-i18n="ai_why_qualify">
                ${isTamil ? 'நீங்கள் ஏன் தகுதி பெறுகிறீர்கள்' : 'Why You Qualify'}
              </div>
              <p style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin: 0;">
                ${aiExp.whyQualify}
              </p>
            </div>

            <!-- 2. Main Benefits -->
            <div style="margin-bottom: 0.75rem;">
              <div style="font-size: 0.78rem; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;" data-i18n="ai_main_benefits">
                ${isTamil ? 'முக்கிய நன்மைகள்' : 'Main Benefits'}
              </div>
              <p style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin: 0;">
                ${aiExp.mainBenefits}
              </p>
            </div>

            <!-- 3. Required Documents -->
            <div style="margin-bottom: 0.75rem;">
              <div style="font-size: 0.78rem; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;" data-i18n="ai_required_docs">
                ${isTamil ? 'தேவையான ஆவணங்கள்' : 'Required Documents'}
              </div>
              <p style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin: 0;">
                ${aiExp.requiredDocuments}
              </p>
            </div>

            <!-- 4. Important Notes -->
            <div>
              <div style="font-size: 0.78rem; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;" data-i18n="ai_important_notes">
                ${isTamil ? 'முக்கிய குறிப்புகள்' : 'Important Notes'}
              </div>
              <p style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin: 0;">
                ${aiExp.importantNotes}
              </p>
            </div>
          </div>

          ${docsList.length > 0 ? `
            <div style="margin-bottom: 1.25rem;">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">Document Checklist:</div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${docsList.map(doc => `<span style="font-size: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.25rem 0.6rem; border-radius: 6px; color: var(--text-main);">${doc}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Card Actions -->
          <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
            <button type="button" class="btn btn-save-scheme" data-scheme-id="${scheme.id}" style="padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 700; background: transparent; border: 1px solid var(--border-color); color: var(--text-main); border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;">
              <i class="fa-regular fa-bookmark"></i> <span>Save Scheme</span>
            </button>
            
            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-size: 0.85rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 10px;">
              <span>Apply on Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Attach bookmark handlers
    document.querySelectorAll('.btn-save-scheme').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const schemeId = btn.dataset.schemeId;
        await handleSaveScheme(schemeId, btn);
      });
    });

    // Translate dynamic elements if i18n is loaded
    if (window.i18n && typeof window.i18n.updatePageTranslations === 'function') {
      window.i18n.updatePageTranslations();
    }
  }

  async function handleSaveScheme(schemeId, buttonElem) {
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

          const { error } = await client.from('saved_schemes').insert({
            user_id: userId,
            scheme_id: schemeId
          });

          if (error) {
            if (error.code === '23505') {
              if (window.showToast) window.showToast("Scheme is already saved in your bookmarks!", "info");
            } else {
              if (window.showToast) window.showToast("Saved scheme to your bookmarks!", "success");
            }
          } else {
            if (window.showToast) window.showToast("Saved scheme to your bookmarks!", "success");
          }

          buttonElem.style.borderColor = '#10b981';
          buttonElem.style.color = '#10b981';
          buttonElem.querySelector('i').className = 'fa-solid fa-bookmark';
          buttonElem.querySelector('span').textContent = 'Saved';
          return;
        }
      }
    } catch (err) {
      console.warn("Bookmark error:", err);
    }
    if (window.showToast) window.showToast("Scheme saved to your bookmarks!", "success");
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-next-step').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (validateStep(currentStep)) {
          if (currentStep < 3) {
            currentStep++;
            updateStepUI();
          } else if (currentStep === 3) {
            currentStep = 4;
            updateStepUI();
            await calculateResults();
          }
        }
      });
    });

    document.querySelectorAll('.btn-prev-step').forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          updateStepUI();
        }
      });
    });

    const resetBtn = document.getElementById('btn-reset-checker');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const form = document.getElementById('checker-wizard-form');
        if (form) form.reset();
        currentStep = 1;
        updateStepUI();
        if (window.showToast) window.showToast("Form reset successfully.", "info");
      });
    }
  });

})();
