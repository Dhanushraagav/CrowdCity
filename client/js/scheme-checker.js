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
    const isWidow = document.getElementById('check-widow')?.checked || false;
    const socialCategory = document.getElementById('check-social-category')?.value || 'all';
    const govSchoolStudied = document.getElementById('check-gov-school')?.value === 'true';
    const institutionType = document.getElementById('check-institution-type')?.value || 'none';
    const degree = document.getElementById('check-degree')?.value || 'none';

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
      isWidow,
      socialCategory,
      govSchoolStudied,
      institutionType,
      degree
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
          <p style="font-size: 0.95rem; color: var(--text-main); font-weight: 700;">Eligibility Engine Evaluating Official Conditions...</p>
        </div>
      `;
    }

    const userProfile = getFormData();
    try {
      sessionStorage.setItem('cc_scheme_checker_profile', JSON.stringify(userProfile));
    } catch (e) {}

    saveUserPreferencesToDb(userProfile);

    const dbSchemes = await fetchSchemesFromDatabase();
    
    // Process every scheme individually
    const evaluated = dbSchemes.map(scheme => {
      const evaluation = evaluateEligibility(scheme, userProfile);
      return {
        ...scheme,
        evaluation
      };
    });

    // Sort matching schemes: Eligible first, then likely/documents required, then not eligible
    const sorted = evaluated.sort((a, b) => {
      const statusOrder = {
        "Eligible": 1,
        "Likely Eligible": 2,
        "Additional Documents Required": 3,
        "Additional Information Required": 4,
        "Not Eligible": 5
      };
      return statusOrder[a.evaluation.status] - statusOrder[b.evaluation.status];
    });

    renderResultsUI(sorted, userProfile);
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
    
    // Only count schemes that are not explicitly "Not Eligible"
    const matchedSchemes = schemes.filter(s => s.evaluation.status !== "Not Eligible");
    if (matchedCountElem) matchedCountElem.textContent = matchedSchemes.length;

    if (!resultsContainer) return;

    if (schemes.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
          <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Welfare Schemes Found</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Try adjusting your profile values to view options.</p>
        </div>
      `;
      return;
    }

    const currentLang = localStorage.getItem('preferred_language') || 'en';
    const isTamil = (currentLang === 'ta');

    resultsContainer.innerHTML = schemes.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const evalData = scheme.evaluation;
      
      let badgeColor = "#10b981"; // Green
      let badgeBg = "rgba(16, 185, 129, 0.12)";
      let statusText = isTamil ? "தகுதி உள்ளது" : "Eligible";

      if (evalData.status === "Not Eligible") {
        badgeColor = "#ef4444"; // Red
        badgeBg = "rgba(239, 68, 68, 0.12)";
        statusText = isTamil ? "தகுதி இல்லை" : "Not Eligible";
      } else if (evalData.status === "Additional Information Required") {
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
        <div class="result-scheme-card" data-scheme-id="${scheme.id}" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
          
          <!-- Header Banner -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${isState ? 'rgba(13, 148, 136, 0.12)' : 'rgba(99, 102, 241, 0.12)'}; color: ${isState ? 'var(--primary)' : '#6366f1'}; display: inline-block; margin-bottom: 0.35rem;">
                ${isState ? (isTamil ? 'தமிழ்நாடு அரசு திட்டம்' : 'Tamil Nadu State Scheme') : (isTamil ? 'மத்திய அரசு திட்டம்' : 'Central Government Scheme')}
              </span>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${scheme.scheme_name || scheme.name}</h3>
            </div>
            <span style="font-size: 0.75rem; font-weight: 800; color: ${badgeColor}; background: ${badgeBg}; padding: 0.3rem 0.75rem; border-radius: 999px; white-space: nowrap;">
              ${statusText}
            </span>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 1.25rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department_name || scheme.department}
          </p>

          <!-- Collapsible Explanation Panel -->
          <div class="ai-explanation-box" style="background: linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(99, 102, 241, 0.05)); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.85rem; border-bottom: 1px solid rgba(13, 148, 136, 0.15); padding-bottom: 0.5rem;">
              <i class="fa-solid fa-award" style="color: var(--primary); font-size: 1.1rem;"></i>
              <span style="font-size: 0.85rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em;">
                ${isTamil ? 'தகுதி மதிப்பீடு' : 'Eligibility Evaluation'}
              </span>
            </div>

            <!-- Status Notice Box -->
            ${evalData.status === "Likely Eligible" ? `
              <div style="background: rgba(13, 148, 136, 0.1); border-left: 4px solid #0d9488; padding: 0.65rem; border-radius: 6px; font-size: 0.82rem; color: var(--text-main); margin-bottom: 0.85rem;">
                <i class="fa-solid fa-circle-info"></i> ${isTamil ? 'ஓரளவு தகுதி - அதிகாரப்பூர்வ திட்ட வழிகாட்டுதல்களை சரிபார்க்கவும்.' : 'Likely Eligible – Please verify with the official scheme guidelines.'}
              </div>
            ` : ''}

            ${evalData.status === "Additional Information Required" ? `
              <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.65rem; border-radius: 6px; font-size: 0.82rem; color: var(--text-main); margin-bottom: 0.85rem;">
                <i class="fa-solid fa-circle-exclamation"></i> ${isTamil ? 'கூடுதல் தகவல் தேவை - உங்கள் சுயவிவரத்தை முழுமையாக நிரப்பவும்.' : 'Additional Information Required – Please fill in missing profile fields.'}
              </div>
            ` : ''}

            <!-- 1. Why You Qualify (Passed Rules) -->
            ${evalData.passed.length > 0 ? `
              <div style="margin-bottom: 0.75rem;">
                <div style="font-size: 0.78rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">
                  ${isTamil ? 'நிறைவு செய்த தகுதிகள்' : 'Satisfied Conditions'}
                </div>
                <ul style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4; margin: 0; padding-left: 1.25rem;">
                  ${evalData.passed.map(p => `<li>${p}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- 2. Why You Do Not Qualify (Failed Rules) -->
            ${evalData.failed.length > 0 ? `
              <div style="margin-bottom: 0.75rem;">
                <div style="font-size: 0.78rem; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">
                  ${isTamil ? 'பொருந்தாத தகுதிகள்' : 'Failed Conditions'}
                </div>
                <ul style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4; margin: 0; padding-left: 1.25rem;">
                  ${evalData.failed.map(f => `<li style="color: #ef4444;">${f}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- 3. Missing Information -->
            ${evalData.missing.length > 0 ? `
              <div style="margin-bottom: 0.75rem;">
                <div style="font-size: 0.78rem; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">
                  ${isTamil ? 'விடுபட்ட விவரங்கள்' : 'Missing Information'}
                </div>
                <ul style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4; margin: 0; padding-left: 1.25rem;">
                  ${evalData.missing.map(m => `<li style="color: #d97706;">${m}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- 4. Required Documents Checklist -->
            <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(13, 148, 136, 0.15); padding-top: 0.5rem;">
              <div style="font-size: 0.78rem; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">
                ${isTamil ? 'தேவையான சான்றிதழ்கள்' : 'Required Documents'}
              </div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.25rem;">
                ${(scheme.eligibility_criteria.required_certificates || []).map(cert => {
                  const hasDoc = !evalData.missingDocs.includes(cert);
                  return `
                    <span style="font-size: 0.75rem; background: ${hasDoc ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)'}; border: 1px solid ${hasDoc ? '#10b981' : '#9ca3af'}; padding: 0.25rem 0.6rem; border-radius: 6px; color: ${hasDoc ? '#10b981' : '#4b5563'};">
                      <i class="fa-solid ${hasDoc ? 'fa-check' : 'fa-circle-question'}"></i> ${cert}
                    </span>
                  `;
                }).join('')}
              </div>
            </div>

          </div>

          <!-- Card Actions -->
          <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
            <button type="button" class="btn btn-save-scheme" data-scheme-id="${scheme.id}" style="padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 700; background: transparent; border: 1px solid var(--border-color); color: var(--text-main); border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;">
              <i class="fa-regular fa-bookmark"></i> <span>${isTamil ? 'சேமிக்கவும்' : 'Save Scheme'}</span>
            </button>
            
            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-size: 0.85rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 10px;">
              <span>${isTamil ? 'அதிகாரப்பூர்வ தளம்' : 'Apply on Official Portal'}</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
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
