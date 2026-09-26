// CrowdCity AI v2.0 - Government Scheme Premium Results JavaScript

(function() {
  'use strict';

  let allEligibleSchemes = [];
  let currentFilter = 'all';

  function getUserProfile() {
    try {
      const stored = sessionStorage.getItem('cc_scheme_checker_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed._schemaVersion >= 3) {
          return parsed;
        }
      }
    } catch (e) {}

    return {
      age: null,
      gender: '',
      income: null,
      occupation: '',
      district: '',
      isStudent: undefined,
      isFarmer: undefined,
      isDisability: undefined,
      isWidow: undefined,
      govSchoolStudied: undefined
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
        scheme_code: 'TN-KMUT-2023',
        scheme_name: 'Kalaignar Magalir Urimai Thittam',
        department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN',
        state_or_central: 'state',
        data_source: 'tn.gov.in',
        short_description: 'Monthly financial rights assistance of ₹1,000 for female heads of households in Tamil Nadu to promote financial independence.',
        benefits_summary: '₹1,000 monthly direct bank transfer into the account of the female head of the family.',
        required_documents: ["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill"],
        official_portal_url: 'https://kmut.tn.gov.in/',
        eligibility_criteria: { min_age: 21, max_age: 60, gender: 'female', max_annual_income: 250000, native_state: 'Tamil Nadu' }
      },
      {
        id: 'tn-pudhumai',
        scheme_code: 'TN-PP-2022',
        scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
        department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN',
        state_or_central: 'state',
        data_source: 'tn.gov.in',
        short_description: 'Financial assistance of ₹1,000 per month for female students pursuing higher education who studied in TN Govt schools.',
        benefits_summary: '₹1,000 monthly financial aid until graduation or completion of diploma course.',
        required_documents: ["Govt School Transfer Certificate (6th-12th)", "Aadhaar Card", "College Admission ID", "Bank Passbook"],
        official_portal_url: 'https://penkalvi.tn.gov.in/',
        eligibility_criteria: { min_age: 17, max_age: 25, gender: 'female', is_student: true, student_required: true, gov_school_required: true, native_state: 'Tamil Nadu' }
      },
      {
        id: 'tn-naanmudhalvan',
        scheme_code: 'TN-NM-003',
        scheme_name: 'Naan Mudhalvan Skill Development Scheme',
        department_name: 'Tamil Nadu Skill Development Corporation (TNSDC), Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'Tamil Nadu Skill Development Corporation (TNSDC) Official Portal (naanmudhalvan.tn.gov.in)',
        last_verified_date: '2026-09-26',
        short_description: 'Statewide skill enhancement, technical certifications, AI learning modules, and direct campus placement drives.',
        benefits_summary: 'Free high-value industry certification courses, mentorship, AI skill modules, and direct employment drives.',
        required_documents: ["College ID / Graduation Marksheet", "Aadhaar Card", "Community Certificate"],
        official_portal_url: 'https://www.naanmudhalvan.tn.gov.in/',
        eligibility_criteria: {
          min_age: 18,
          max_age: 35,
          gender: 'all',
          native_state: 'Tamil Nadu',
          programme_level: 'umbrella',
          requires_course_selection: true
        }
      },
      {
        id: 'tn-cmchis',
        scheme_code: 'TN-CMCHIS-2012',
        scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
        department_name: 'Health & Family Welfare Department, Govt of TN',
        state_or_central: 'state',
        data_source: 'tn.gov.in',
        short_description: 'Cashless medical and surgical treatment coverage up to ₹5,00,000 per family per year in empanelled government & private hospitals.',
        benefits_summary: 'Cashless hospital treatment up to ₹5 Lakhs annually per enrolled family across accredited hospitals.',
        required_documents: ["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card"],
        official_portal_url: 'https://cmchistn.com/',
        eligibility_criteria: { max_annual_income: 120000, native_state: 'Tamil Nadu' }
      },
      {
        id: 'central-pmkisan',
        scheme_code: 'CENTRAL-PMKISAN',
        scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
        department_name: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        state_or_central: 'central',
        data_source: 'myscheme.gov.in',
        short_description: 'Annual direct income support of ₹6,000 for landholding farmer families paid in 3 equal installments.',
        benefits_summary: '₹6,000 per year paid in 3 installments of ₹2,000 every 4 months via Direct Benefit Transfer.',
        required_documents: ["Aadhaar Card", "Land Ownership Certificate (Patta/RoR)", "Aadhaar-linked Bank Account"],
        official_portal_url: 'https://pmkisan.gov.in/',
        eligibility_criteria: { is_farmer: true, farmer_required: true }
      },
      {
        id: 'central-pmjay',
        scheme_code: 'CENTRAL-PMJAY',
        scheme_name: 'Ayushman Bharat PM-JAY',
        department_name: 'National Health Authority (NHA), Govt of India',
        state_or_central: 'central',
        data_source: 'myscheme.gov.in',
        short_description: 'National health insurance coverage of ₹5 Lakhs per family for secondary & tertiary hospital care.',
        benefits_summary: '₹5,00,000 annual cashless treatment for over 1,900 medical procedures across network hospitals.',
        required_documents: ["Aadhaar Card", "Ration Card", "Ayushman Golden Card"],
        official_portal_url: 'https://pmjay.gov.in/',
        eligibility_criteria: { max_annual_income: 200000 }
      }
    ];
  }

  function evaluateEligibility(scheme, profile) {
    if (window.CrowdCitySchemeEngine && typeof window.CrowdCitySchemeEngine.evaluateEligibility === 'function') {
      return window.CrowdCitySchemeEngine.evaluateEligibility(scheme, profile);
    }

    const criteria = scheme.eligibility_criteria || {};
    const passed = [];
    const failed = [];
    const missing = [];
    const verificationNotes = [];

    const verifiedDocs = [];
    const expiredDocs = [];
    const renewingDocs = [];
    const missingDocsList = [];

    const currentLang = (window.i18n ? window.i18n.getLanguage() : (localStorage.getItem('crowdcity_language') || localStorage.getItem('cc_lang') || localStorage.getItem('preferred_language') || 'en'));
    const isTamil = (currentLang === 'ta');

    // 1. Age check (preserving min_age: 0)
    const hasMinAge = criteria.min_age !== undefined && criteria.min_age !== null;
    const hasMaxAge = criteria.max_age !== undefined && criteria.max_age !== null;
    if (hasMinAge || hasMaxAge) {
      const min = hasMinAge ? Number(criteria.min_age) : 0;
      const max = hasMaxAge ? Number(criteria.max_age) : 120;
      const hasUserAge = profile && profile.age !== undefined && profile.age !== null && profile.age !== '' && !Number.isNaN(Number(profile.age));
      if (!hasUserAge) {
        missing.push(isTamil ? `? வயது விவரம் தேவை (வயது ${min}–${max}க்குள் இருக்க வேண்டும்)` : `? Age information required (Must be between ${min}–${max})`);
      } else {
        const userAge = Number(profile.age);
        if (userAge < min || userAge > max) {
          failed.push(isTamil ? `✗ வயது வரம்பு ${min}–${max}க்குள் இருக்க வேண்டும் (தற்போதைய வயது: ${userAge})` : `✗ Age must be between ${min}–${max} (Current: ${userAge})`);
        } else {
          passed.push(isTamil ? `✓ வயது ${min}–${max}க்குள் உள்ளது` : `✓ Age between ${min}–${max}`);
        }
      }
    }

    // 2. Gender check
    if (criteria.gender && criteria.gender !== 'all') {
      const normalizedGender = (profile && typeof profile.gender === 'string') ? profile.gender.trim().toLowerCase() : '';
      const validGenders = ['female', 'male', 'transgender'];
      if (!normalizedGender || !validGenders.includes(normalizedGender)) {
        missing.push(isTamil ? "? பாலினம் விவரம் தேவை" : "? Gender information required");
      } else if (normalizedGender !== String(criteria.gender).toLowerCase()) {
        const expected = criteria.gender === 'female' ? (isTamil ? 'பெண்' : 'Female') : (criteria.gender === 'male' ? (isTamil ? 'ஆண்' : 'Male') : 'Transgender');
        failed.push(isTamil ? `✗ பாலினம் ${expected} ஆக இருக்க வேண்டும்` : `✗ Gender must be ${expected}`);
      } else {
        const genderVal = criteria.gender === 'female' ? (isTamil ? 'பெண்' : 'Female') : (criteria.gender === 'male' ? (isTamil ? 'ஆண்' : 'Male') : 'Transgender');
        passed.push(isTamil ? `✓ பாலினம்: ${genderVal}` : `✓ Gender is ${genderVal}`);
      }
    }

    // 3. Income check (₹0 is valid; null/undefined/"" is missing)
    if (criteria.max_annual_income !== undefined && criteria.max_annual_income !== null) {
      const maxInc = Number(criteria.max_annual_income);
      const hasIncome = profile && profile.income !== undefined && profile.income !== null && profile.income !== '' && !Number.isNaN(Number(profile.income));
      if (!hasIncome) {
        missing.push(isTamil ? `? ஆண்டு வருமானம் விவரம் தேவை (₹${maxInc.toLocaleString('en-IN')}க்குள் இருக்க வேண்டும்)` : `? Annual family income required (Must be under ₹${maxInc.toLocaleString('en-IN')})`);
      } else {
        const userInc = Number(profile.income);
        if (userInc > maxInc) {
          failed.push(isTamil ? `✗ ஆண்டு குடும்ப வருமானம் ₹${maxInc.toLocaleString('en-IN')}க்கு மேல் உள்ளது (தற்போதைய வருமானம்: ₹${userInc.toLocaleString('en-IN')})` : `✗ Family income exceeds ₹${maxInc.toLocaleString('en-IN')} (Current: ₹${userInc.toLocaleString('en-IN')})`);
        } else {
          passed.push(isTamil ? `✓ குடும்ப வருமானம் ₹${maxInc.toLocaleString('en-IN')}க்குள் உள்ளது` : `✓ Family income is within ₹${maxInc.toLocaleString('en-IN')}`);
        }
      }
    }

    // 4. Student status
    const requiresStudent = Boolean(criteria.student_required || criteria.is_student);
    if (requiresStudent) {
      const studentExplicitTrue = (profile && (profile.isStudent === true || profile.occupation === 'student'));
      const studentExplicitFalse = (profile && profile.isStudent === false && profile.occupation && profile.occupation !== 'student');
      if (studentExplicitTrue) {
        passed.push(isTamil ? "✓ மாணவர் நிலை சரிபார்க்கப்பட்டது" : "✓ Enrolled Student status verified");
      } else if (studentExplicitFalse) {
        failed.push(isTamil ? "✗ மாணவர் நிலை தேவை" : "✗ Enrolled Student status required");
      } else {
        missing.push(isTamil ? "? மாணவர் நிலை விவரம் தேவை" : "? Student enrollment status required");
      }
    }

    // 5. Gov School
    if (criteria.gov_school_required) {
      if (!profile || profile.govSchoolStudied === undefined || profile.govSchoolStudied === null || profile.govSchoolStudied === '') {
        missing.push(isTamil ? "? அரசு பள்ளி கல்வி விவரம் தேவை" : "? Government school schooling information (Classes 6–12) required");
      } else if (profile.govSchoolStudied === false) {
        failed.push(isTamil ? "✗ அரசு பள்ளியில் படித்திருக்க வேண்டும்" : "✗ Government School schooling (Classes 6–12) required");
      } else {
        passed.push(isTamil ? "✓ அரசு பள்ளியில் படித்தது சரிபார்க்கப்பட்டது" : "✓ Studied in Government School");
      }
    }

    // 6. Disability
    const requiresDisability = Boolean(criteria.disability_required || criteria.is_disabled);
    if (requiresDisability) {
      if (!profile || profile.isDisability === undefined || profile.isDisability === null || profile.isDisability === '') {
        missing.push(isTamil ? "? மாற்றுத்திறனாளி தகுதி விவரம் தேவை" : "? Differently-abled / disability status information required");
      } else if (profile.isDisability === false) {
        failed.push(isTamil ? "✗ மாற்றுத்திறனாளி தகுதி தேவை" : "✗ Differently-abled status required");
      } else {
        passed.push(isTamil ? "✓ மாற்றுத்திறனாளி தகுதி சரிபார்க்கப்பட்டது" : "✓ Differently-abled status satisfied");
      }
    }

    // 7. Widow / Single Parent
    const requiresWidow = Boolean(criteria.widow_required || criteria.is_widow);
    if (requiresWidow) {
      if (!profile || profile.isWidow === undefined || profile.isWidow === null || profile.isWidow === '') {
        missing.push(isTamil ? "? விதவை அல்லது ஒற்றை பெற்றோர் விவரம் தேவை" : "? Widow / Single Parent status information required");
      } else if (profile.isWidow === false) {
        failed.push(isTamil ? "✗ விதவை அல்லது ஒற்றை பெற்றோர் தகுதி தேவை" : "✗ Widow / Single Parent status required");
      } else {
        passed.push(isTamil ? "✓ விதவை / ஒற்றை பெற்றோர் தகுதி சரிபார்க்கப்பட்டது" : "✓ Widow / Single Parent status satisfied");
      }
    }

    // 8. Farmer status
    const requiresFarmer = Boolean(criteria.farmer_required || criteria.is_farmer);
    if (requiresFarmer) {
      const farmerExplicitTrue = (profile && (profile.isFarmer === true || profile.occupation === 'farmer'));
      const farmerExplicitFalse = (profile && profile.isFarmer === false && profile.occupation && profile.occupation !== 'farmer');
      if (farmerExplicitTrue) {
        passed.push(isTamil ? "✓ விவசாயி தகுதி சரிபார்க்கப்பட்டது" : "✓ Farmer / Landholder family status verified");
      } else if (farmerExplicitFalse) {
        failed.push(isTamil ? "✗ விவசாயி தகுதி தேவை" : "✗ Farmer / Landholder family status required");
      } else {
        missing.push(isTamil ? "? விவசாயி / நில உரிமையாளர் விவரம் தேவை" : "? Farmer / landholding status information required");
      }
    }

    // 9. Residency
    if (criteria.native_state) {
      if (!profile || !profile.district || String(profile.district).trim() === '') {
        missing.push(isTamil ? "? இருப்பிட/மாவட்ட விவரங்கள் தேவை" : "? Residency district information required");
      } else {
        passed.push(isTamil ? `✓ தமிழக இருப்பிட தகுதி (${profile.district} மாவட்டம்)` : `✓ Resident of ${criteria.native_state} (${profile.district} District)`);
      }
    }

    // 10. Distinguish Umbrella Programme (e.g. Naan Mudhalvan)
    const isUmbrellaProgramme = Boolean(
      criteria.programme_level === 'umbrella' ||
      criteria.requires_course_selection === true ||
      scheme.is_umbrella_programme === true ||
      scheme.scheme_code === 'TN-NM-003' ||
      scheme.id === 'tn-naanmudhalvan'
    );

    if (isUmbrellaProgramme) {
      verificationNotes.push(isTamil
        ? 'வழங்கப்பட்ட தகவலின் அடிப்படையில் பொது திட்ட தகுதி பொருந்துகிறது. குறிப்பிட்ட பாடப்பிரிவு அல்லது பயிற்சிக்கு (கல்லூரி சேர்க்கை, குறிப்பிட்ட பட்டப்படிப்பு அல்லது நுழைவுத் தேர்வு) கூடுதல் நிபந்தனைகள் பொருந்தக்கூடும்.'
        : 'Matches the currently verified general programme criteria based on the information provided. Additional programme-specific or course-level prerequisites (such as specific degree, college affiliation, or entrance qualification) may apply.');
    }

    let statusCode = "ELIGIBLE";
    let status = "Eligible";
    if (failed.length > 0) {
      statusCode = "NOT_ELIGIBLE";
      status = "Not Eligible";
    } else if (missing.length > 0) {
      statusCode = "INSUFFICIENT_INFORMATION";
      status = "Additional Information Required";
    } else if (isUmbrellaProgramme) {
      statusCode = "POTENTIALLY_RELEVANT";
      status = "Potentially Relevant";
    }

    let confidence = "High Confidence";
    const confidenceReasons = [];
    if (statusCode === "NOT_ELIGIBLE" || statusCode === "INSUFFICIENT_INFORMATION") {
      confidence = "Needs Verification";
      confidenceReasons.push(statusCode === "NOT_ELIGIBLE" ? "Eligibility criteria not satisfied" : "Additional information required");
    } else if (statusCode === "POTENTIALLY_RELEVANT") {
      confidence = "Medium Confidence";
      confidenceReasons.push(isTamil ? "பொது திட்ட தகுதி பொருந்தியது; குறிப்பிட்ட பாடப்பிரிவு நிபந்தனைகள் சரிபார்க்கப்பட வேண்டும்" : "Broad programme criteria matched; course-specific prerequisites apply");
    }

    return {
      status,
      statusCode,
      passed,
      failed,
      missing,
      verificationNotes,
      verifiedDocs,
      expiredDocs,
      renewingDocs,
      missingDocsList,
      confidence,
      confidenceReasons
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
    const eligibleList = evaluated.filter(s => s.evaluation.statusCode !== "NOT_ELIGIBLE" && s.evaluation.status !== "Not Eligible");

    // Sort by status priority: Eligible first, then Potentially Relevant, then Docs, then Info
    return eligibleList.sort((a, b) => {
      const statusOrder = {
        "ELIGIBLE": 1,
        "Eligible": 1,
        "POTENTIALLY_RELEVANT": 2,
        "Potentially Relevant": 2,
        "Likely Eligible": 2,
        "Additional Documents Required": 3,
        "INSUFFICIENT_INFORMATION": 4,
        "Additional Information Required": 4
      };
      const orderA = statusOrder[a.evaluation.statusCode] || statusOrder[a.evaluation.status] || 99;
      const orderB = statusOrder[b.evaluation.statusCode] || statusOrder[b.evaluation.status] || 99;
      return orderA - orderB;
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

    const currentLang = (window.i18n ? window.i18n.getLanguage() : (localStorage.getItem('crowdcity_language') || localStorage.getItem('cc_lang') || localStorage.getItem('preferred_language') || 'ta'));
    const isTamil = (currentLang === 'ta');

    container.innerHTML = filtered.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const evalData = scheme.evaluation || { status: 'Eligible', statusCode: 'ELIGIBLE', passed: [], failed: [], missing: [], verifiedDocs: [], expiredDocs: [], renewingDocs: [], missingDocsList: [], confidence: 'High Confidence', confidenceReasons: [] };
      
      let badgeColor = "#10b981"; // Green
      let badgeBg = "rgba(16, 185, 129, 0.12)";
      let statusText = isTamil ? "தகுதி உள்ளது" : "Eligible";

      if (evalData.statusCode === "NOT_ELIGIBLE" || evalData.status === "Not Eligible") {
        badgeColor = "#ef4444"; // Red
        badgeBg = "rgba(239, 68, 68, 0.12)";
        statusText = isTamil ? "தகுதி இல்லை" : "Not Eligible";
      } else if (evalData.statusCode === "POTENTIALLY_RELEVANT" || evalData.status === "Potentially Relevant" || evalData.status === "Likely Eligible") {
        badgeColor = "#0d9488"; // Teal
        badgeBg = "rgba(13, 148, 136, 0.12)";
        statusText = isTamil ? "பொருத்தமாக இருக்கக்கூடும்" : "Potentially Relevant";
      } else if (evalData.statusCode === "INSUFFICIENT_INFORMATION" || evalData.status === "Additional Information Required") {
        badgeColor = "#f59e0b"; // Yellow/Orange
        badgeBg = "rgba(245, 158, 11, 0.12)";
        statusText = isTamil ? "கூடுதல் தகவல் தேவை" : "Info Required";
      } else if (evalData.status === "Additional Documents Required") {
        badgeColor = "#3b82f6"; // Blue
        badgeBg = "rgba(59, 130, 246, 0.12)";
        statusText = isTamil ? "கூடுதல் ஆவணம் தேவை" : "Docs Required";
      }

      // Confidence badge color
      let confColor = "#10b981";
      let confBg = "rgba(16, 185, 129, 0.08)";
      let confIcon = "fa-circle-check";
      let confLabel = isTamil ? "அதிநம்பிக்கை" : "High Confidence";

      if (evalData.confidence === "Medium Confidence") {
        confColor = "#3b82f6";
        confBg = "rgba(59, 130, 246, 0.08)";
        confIcon = "fa-circle-info";
        confLabel = isTamil ? "நடுத்தர நம்பிக்கை" : "Medium Confidence";
      } else if (evalData.confidence === "Needs Verification") {
        confColor = "#f59e0b";
        confBg = "rgba(245, 158, 11, 0.08)";
        confIcon = "fa-triangle-exclamation";
        confLabel = isTamil ? "சரிபார்ப்பு தேவை" : "Needs Verification";
      }

      // Metadata formats
      let lastVerifiedDateStr = isTamil ? "குறிப்பிடப்படவில்லை" : "Not specified";
      if (scheme.last_verified_date) {
        const d = new Date(scheme.last_verified_date);
        lastVerifiedDateStr = d.toLocaleDateString(isTamil ? 'ta-IN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }

      const notifNumber = scheme.official_notification_number || (isTamil ? "வழங்கப்படவில்லை" : "Not specified");
      const dataSourceVal = scheme.data_source || (isTamil ? "அரசாங்கம்" : "Official Govt Source");

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
            <i class="fa-solid fa-building-columns" style="color: var(--primary); margin-right: 0.25rem;"></i> ${scheme.department_name || scheme.department}
          </div>

          <!-- Short Description -->
          <p class="scheme-short-desc">
            ${scheme.short_description || scheme.description || 'Government welfare scheme providing support for eligible citizens.'}
          </p>

          <!-- Collapsible Explanation Panel -->
          <div class="ai-why-eligible-box" style="margin-bottom: 1.25rem; background: linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(99, 102, 241, 0.05)); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 12px; padding: 1.25rem;">
            
            <!-- Metadata & Sources Trust Section -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.85rem; border-radius: 10px; margin-bottom: 1rem; font-size: 0.78rem;">
              <div>
                <span style="color: var(--text-muted); display: block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">${isTamil ? 'தரவு மூலம்' : 'Data Source'}</span>
                <span style="color: var(--text-main); font-weight: 800;"><i class="fa-solid fa-server" style="color: var(--primary); margin-right: 0.25rem;"></i>${dataSourceVal}</span>
              </div>
              <div>
                <span style="color: var(--text-muted); display: block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">${isTamil ? 'கடைசியாக சரிபார்க்கப்பட்டது' : 'Last Verified'}</span>
                <span style="color: var(--text-main); font-weight: 800;"><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 0.25rem;"></i>${lastVerifiedDateStr}</span>
              </div>
              <div>
                <span style="color: var(--text-muted); display: block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">${isTamil ? 'அரசாணை எண்' : 'Notification No.'}</span>
                <span style="color: var(--text-main); font-weight: 800;"><i class="fa-solid fa-file-contract" style="color: #6366f1; margin-right: 0.25rem;"></i>${notifNumber}</span>
              </div>
            </div>

            <!-- Eligibility Confidence Rating -->
            <div style="background: ${confBg}; border: 1px solid ${confColor}; border-radius: 10px; padding: 0.85rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid ${confIcon}" style="color: ${confColor}; font-size: 1.2rem;"></i>
                <div>
                  <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-main);">${isTamil ? 'மதிப்பீட்டு நம்பிக்கை அளவு' : 'Assessment Confidence'}</div>
                  ${evalData.confidenceReasons.length > 0 ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${isTamil ? 'காரணங்கள்' : 'Reasons'}: ${evalData.confidenceReasons.join(', ')}</div>` : ''}
                </div>
              </div>
              <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: ${confColor}; background: ${confBg}; border: 1px solid ${confColor}; padding: 0.25rem 0.6rem; border-radius: 999px;">
                ${confLabel}
              </span>
            </div>

            <!-- Rule-by-rule Checklist Explanation -->
            <div style="margin-bottom: 1rem;">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.25rem;">
                ${isTamil ? 'தகுதி நிபந்தனைகள் விவரம்' : 'Rule-by-Rule Evaluation'}
              </div>
              
              <ul style="font-size: 0.85rem; color: var(--text-main); line-height: 1.5; margin: 0; padding: 0; list-style: none;">
                <!-- Passed Rules -->
                ${evalData.passed.map(p => `
                  <li style="margin-bottom: 0.4rem; display: flex; align-items: flex-start; gap: 0.4rem; color: #047857;">
                    <i class="fa-solid fa-circle-check" style="margin-top: 0.2rem; flex-shrink: 0;"></i>
                    <span>${p.replace('✓ ', '')}</span>
                  </li>
                `).join('')}
                
                <!-- Failed Rules -->
                ${evalData.failed.map(f => `
                  <li style="margin-bottom: 0.4rem; display: flex; align-items: flex-start; gap: 0.4rem; color: #b91c1c;">
                    <i class="fa-solid fa-circle-xmark" style="margin-top: 0.2rem; flex-shrink: 0;"></i>
                    <span>${f.replace('✗ ', '')}</span>
                  </li>
                `).join('')}

                <!-- Missing Rules -->
                ${evalData.missing.map(m => `
                  <li style="margin-bottom: 0.4rem; display: flex; align-items: flex-start; gap: 0.4rem; color: #b45309;">
                    <i class="fa-solid fa-circle-question" style="margin-top: 0.2rem; flex-shrink: 0;"></i>
                    <span>${m.replace('? ', '')}</span>
                  </li>
                `).join('')}
              </ul>
            </div>

            <!-- Detailed Document Verification Checklist -->
            <div style="border-top: 1px dashed rgba(13, 148, 136, 0.15); padding-top: 0.85rem;">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
                ${isTamil ? 'சான்றிதழ் சரிபார்ப்பு நிலை' : 'Document Wallet Verification'}
              </div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <!-- Verified Docs -->
                ${evalData.verifiedDocs.map(d => `
                  <span style="font-size: 0.72rem; background: rgba(16, 185, 129, 0.08); border: 1px solid #10b981; padding: 0.2rem 0.5rem; border-radius: 6px; color: #10b981; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fa-solid fa-circle-check"></i> ${d.name} (${isTamil ? 'சரிபார்க்கப்பட்டது' : 'Verified'})
                  </span>
                `).join('')}

                <!-- Renewals needed soon -->
                ${evalData.renewingDocs.map(d => `
                  <span style="font-size: 0.72rem; background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; padding: 0.2rem 0.5rem; border-radius: 6px; color: #3b82f6; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fa-solid fa-clock-rotate-left"></i> ${d.name} (${isTamil ? 'புதுப்பிக்கப்பட வேண்டும்' : 'Renewal Needed'}: ${d.expiry})
                  </span>
                `).join('')}

                <!-- Expired Docs -->
                ${evalData.expiredDocs.map(d => `
                  <span style="font-size: 0.72rem; background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; padding: 0.2rem 0.5rem; border-radius: 6px; color: #ef4444; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fa-solid fa-triangle-exclamation"></i> ${d.name} (${isTamil ? 'காலாவதியானது' : 'Expired'}: ${d.expiry})
                  </span>
                `).join('')}

                <!-- Missing Docs -->
                ${evalData.missingDocsList.map(name => `
                  <span style="font-size: 0.72rem; background: rgba(107, 114, 128, 0.08); border: 1px solid #9ca3af; padding: 0.2rem 0.5rem; border-radius: 6px; color: #4b5563; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fa-solid fa-circle-question"></i> ${name} (${isTamil ? 'இல்லை' : 'Missing'})
                  </span>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- Professional Assessment Disclaimer -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.75rem; color: var(--text-muted); line-height: 1.45;">
            <i class="fa-solid fa-shield-halved" style="color: var(--primary); margin-right: 0.4rem; font-size: 0.85rem;"></i>
            <span>${isTamil 
              ? 'இந்த தகுதி மதிப்பீடு CrowdCity AI-ல் உள்ள தற்போதைய விதிகளின் அடிப்படையில் உருவாக்கப்பட்டது. இறுதி ஒப்புதல் சம்பந்தப்பட்ட அரசுத் துறையின் சரிபார்ப்புக்கு உட்பட்டது.' 
              : 'This eligibility assessment is generated using the latest rules available in CrowdCity AI. Final approval is subject to verification by the concerned Government Department.'}</span>
          </div>

          <!-- Card Actions -->
          <div class="scheme-actions-v2" style="display: flex; gap: 0.65rem; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
            <a href="scheme-details.html?id=${scheme.id}" class="btn-save-bookmark" style="text-decoration: none; padding: 0.6rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-circle-info"></i>
              <span>${isTamil ? 'விவரங்கள் பார்' : 'View Details'}</span>
            </a>

            <!-- Form Assistant / Prepare Application Button -->
            <a href="form-assistant.html?scheme=${scheme.scheme_code || scheme.id}" class="btn" style="text-decoration: none; padding: 0.6rem 1rem; border-radius: 10px; border: 1px solid var(--primary); color: var(--primary); background: rgba(13, 148, 136, 0.08); display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700; font-size: 0.82rem;">
              <i class="fa-solid fa-file-signature"></i>
              <span>${isTamil ? 'விண்ணப்ப வழிகாட்டி' : 'Prepare Application'}</span>
            </a>

            ${(() => {
              const saved = isResultsSchemeSaved(scheme);
              const tSave = isTamil ? 'சேமிக்கவும்' : 'Save Scheme';
              const tSaved = isTamil ? 'சேமிக்கப்பட்டது' : 'Saved';
              return `
                <button type="button" class="btn-save-bookmark ${saved ? 'is-saved' : ''}" data-id="${scheme.id}" data-scheme-code="${scheme.scheme_code || ''}" style="padding: 0.6rem 1rem; border-radius: 10px; border: 1px solid ${saved ? '#10b981' : 'var(--border-color)'}; color: ${saved ? '#10b981' : 'var(--text-main)'}; background: ${saved ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                  <i class="${saved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                  <span>${saved ? tSaved : tSave}</span>
                </button>
              `;
            })()}

            <!-- Official Source Button -->
            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn" style="padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 700; text-decoration: none; border: 1px solid var(--primary); color: var(--primary); background: transparent; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-building-columns"></i> <span>${isTamil ? 'அதிகாரப்பூர்வ மூலம்' : 'Official Source'}</span>
            </a>

            <!-- View Official Guidelines Button -->
            ${scheme.official_pdf_link ? `
              <a href="${scheme.official_pdf_link}" target="_blank" rel="noopener noreferrer" class="btn" style="padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 700; text-decoration: none; border: 1px solid #6366f1; color: #6366f1; background: transparent; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-file-pdf"></i> <span>${isTamil ? 'வழிகாட்டுதல்கள்' : 'View Guidelines'}</span>
              </a>
            ` : ''}

            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn-apply-portal" style="padding: 0.6rem 1.25rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;">
              <span>${isTamil ? 'விண்ணப்பிக்க' : 'Official Apply'}</span>
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>

        </div>
      `;
    }).join('');

    // Attach bookmark handlers
    document.querySelectorAll('.btn-save-bookmark[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const schemeId = btn.dataset.id || btn.dataset.schemeCode;
        await saveSchemeBookmark(schemeId, btn);
      });
    });
  }

  // Scheme Code to UUID mapping for results bookmark resolution
  const RESULTS_SCHEME_CODE_TO_UUID = {
    'TN-KMUT-001': '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
    'TN-PUDHUMAI-002': '6edf49dc-795f-4369-b5ab-f72c24eddef8',
    'TN-NM-003': 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
    'TN-CMCHIS-004': '43e8ff6a-d3f3-4277-88f2-98c46491584e',
    'TN-KKI-005': '43c6f25f-384b-4410-98ac-e747f0edeef7',
    'TN-UZHAVAR-006': 'f0478621-f9c1-47c0-8306-af37d7ed5721',
    'CENTRAL-PMKISAN-007': 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
    'CENTRAL-PMJAY-008': 'd22faa80-2446-454f-8532-17429dcef2e6',
    'CENTRAL-PMMY-009': '5a00bef6-7053-4170-8604-8ac6b079a707',
    'CENTRAL-SSY-010': '5b06ccf2-49a8-40db-99fb-b3f8fb3affe4',
    'CENTRAL-PMAY-011': '23914f21-21a9-4695-8784-680a9577879c',
    'CENTRAL-VIDYALAKSHMI-012': '8c887239-49c4-48de-8fee-5c305098b97d'
  };

  const RESULTS_LEGACY_SLUG_TO_UUID = {
    'tn-kmut': '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
    'tn-kmut-001': '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
    'tn-pudhumai': '6edf49dc-795f-4369-b5ab-f72c24eddef8',
    'tn-pudhumai-002': '6edf49dc-795f-4369-b5ab-f72c24eddef8',
    'tn-nm-003': 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
    'tn-naanmudhalvan': 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
    'tn-cmchis': '43e8ff6a-d3f3-4277-88f2-98c46491584e',
    'tn-cmchis-004': '43e8ff6a-d3f3-4277-88f2-98c46491584e',
    'tn-kki': '43c6f25f-384b-4410-98ac-e747f0edeef7',
    'tn-mra-005': '43c6f25f-384b-4410-98ac-e747f0edeef7',
    'tn-uzhavar': 'f0478621-f9c1-47c0-8306-af37d7ed5721',
    'central-pmkisan': 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
    'central-pmkisan-007': 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
    'central-pmjay': 'd22faa80-2446-454f-8532-17429dcef2e6',
    'central-pmjay-008': 'd22faa80-2446-454f-8532-17429dcef2e6',
    'central-pmmy': '5a00bef6-7053-4170-8604-8ac6b079a707',
    'central-pmmy-009': '5a00bef6-7053-4170-8604-8ac6b079a707',
    'central-ssy': '5b06ccf2-49a8-40db-99fb-b3f8fb3affe4',
    'central-ssy-010': '5b06ccf2-49a8-40db-99fb-b3f8fb3affe4',
    'central-pmay': '23914f21-21a9-4695-8784-680a9577879c',
    'central-pmay-011': '23914f21-21a9-4695-8784-680a9577879c',
    'central-vidyalakshmi': '8c887239-49c4-48de-8fee-5c305098b97d',
    'central-vidyalakshmi-012': '8c887239-49c4-48de-8fee-5c305098b97d'
  };

  function resolveResultsSchemeUuid(identifier) {
    if (!identifier) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) return identifier;
    const upper = String(identifier).toUpperCase();
    if (RESULTS_SCHEME_CODE_TO_UUID[upper]) return RESULTS_SCHEME_CODE_TO_UUID[upper];
    const lower = String(identifier).toLowerCase();
    if (RESULTS_LEGACY_SLUG_TO_UUID[lower]) return RESULTS_LEGACY_SLUG_TO_UUID[lower];
    return null;
  }

  let resultsUserSavedIds = new Set();
  const inFlightResultsBookmarks = new Set();

  function syncResultsSavedIdsFromCache() {
    try {
      if (window.CrowdCitySavedSchemes?.getSavedIds) {
        const set = window.CrowdCitySavedSchemes.getSavedIds();
        if (set && set.size > 0) {
          resultsUserSavedIds = set;
          return;
        }
      }
      const u = (typeof window.getCurrentUser === 'function') ? window.getCurrentUser() : null;
      let uid = u?.id;
      if (!uid) {
        const rawSess = localStorage.getItem('cc_session') || sessionStorage.getItem('cc_session');
        if (rawSess) uid = JSON.parse(rawSess)?.user?.id;
      }
      if (uid) {
        const cached = localStorage.getItem(`cc_saved_schemes_${uid}`);
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr) && arr.length > 0) resultsUserSavedIds = new Set(arr);
        }
      }
    } catch (e) {}
  }
  syncResultsSavedIdsFromCache();

  if (window.CrowdCitySavedSchemes?.onStateChange) {
    window.CrowdCitySavedSchemes.onStateChange((newSet) => {
      resultsUserSavedIds = new Set(newSet);
    });
  }

  async function loadResultsSavedIds() {
    try {
      if (window.CrowdCitySavedSchemes?.ensureHydrated) {
        const hydrated = await window.CrowdCitySavedSchemes.ensureHydrated();
        if (hydrated) {
          resultsUserSavedIds = new Set(hydrated);
          return resultsUserSavedIds;
        }
      }

      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;
          if (userId) {
            try {
              const cached = localStorage.getItem(`cc_saved_schemes_${userId}`);
              if (cached) {
                const arr = JSON.parse(cached);
                if (Array.isArray(arr) && arr.length > 0) resultsUserSavedIds = new Set(arr);
              }
            } catch (e) {}

            const { data } = await client
              .from('saved_schemes')
              .select('id, scheme_id, government_schemes(id, scheme_code)')
              .eq('user_id', userId);

            if (data) {
              const freshSet = new Set();
              data.forEach(r => {
                if (r.scheme_id) freshSet.add(r.scheme_id);
                if (r.government_schemes?.id) freshSet.add(r.government_schemes.id);
                if (r.government_schemes?.scheme_code) {
                  freshSet.add(r.government_schemes.scheme_code);
                  freshSet.add(r.government_schemes.scheme_code.toLowerCase());
                }
              });
              resultsUserSavedIds = freshSet;
              try {
                localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...resultsUserSavedIds]));
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {}
    return resultsUserSavedIds;
  }

  function isResultsSchemeSaved(scheme) {
    if (!scheme) return false;
    if (window.CrowdCitySavedSchemes?.isSaved) {
      if (scheme.id && window.CrowdCitySavedSchemes.isSaved(scheme.id)) return true;
      if (scheme.scheme_code && window.CrowdCitySavedSchemes.isSaved(scheme.scheme_code)) return true;
    }
    if (scheme.id && resultsUserSavedIds.has(scheme.id)) return true;
    if (scheme.scheme_code && resultsUserSavedIds.has(scheme.scheme_code)) return true;
    if (scheme.scheme_code && resultsUserSavedIds.has(scheme.scheme_code.toLowerCase())) return true;
    const resolved = resolveResultsSchemeUuid(scheme.id || scheme.scheme_code);
    if (resolved && (resultsUserSavedIds.has(resolved) || (window.CrowdCitySavedSchemes?.isSaved && window.CrowdCitySavedSchemes.isSaved(resolved)))) return true;
    return false;
  }

  async function saveSchemeBookmark(schemeId, buttonElem) {
    const isTamil = (window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === 'ta');
    const tSave = isTamil ? 'சேமிக்கவும்' : 'Save Scheme';
    const tSaved = isTamil ? 'சேமிக்கப்பட்டது' : 'Saved';

    const updateBtn = (saved) => {
      if (!buttonElem) return;
      if (saved) {
        buttonElem.classList.add('is-saved');
        buttonElem.style.borderColor = '#10b981';
        buttonElem.style.color = '#10b981';
        buttonElem.style.background = 'rgba(16, 185, 129, 0.1)';
        buttonElem.innerHTML = `<i class="fa-solid fa-bookmark"></i> <span>${tSaved}</span>`;
      } else {
        buttonElem.classList.remove('is-saved');
        buttonElem.style.borderColor = 'var(--border-color)';
        buttonElem.style.color = 'var(--text-main)';
        buttonElem.style.background = 'transparent';
        buttonElem.innerHTML = `<i class="fa-regular fa-bookmark"></i> <span>${tSave}</span>`;
      }
    };

    if (window.CrowdCitySavedSchemes?.toggleSave) {
      const res = await window.CrowdCitySavedSchemes.toggleSave(schemeId);
      if (res.inFlight) return;
      if (!res.success && res.error === 'Sign-in required') {
        if (window.showToast) window.showToast("Please sign in to bookmark schemes.", "info");
        return;
      }
      if (res.action === 'saved') {
        updateBtn(true);
        if (window.showToast) window.showToast("Scheme saved to your bookmarks!", "success");
      } else if (res.action === 'already_saved') {
        updateBtn(true);
        if (window.showToast) window.showToast("Scheme is already saved in your bookmarks!", "info");
      } else if (res.action === 'removed') {
        updateBtn(false);
        if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
      } else {
        updateBtn(res.isSaved);
        if (window.showToast) window.showToast("Failed to update bookmark.", "error");
      }
      return;
    }

    const targetUuid = resolveResultsSchemeUuid(schemeId);
    if (!targetUuid) {
      if (window.showToast) window.showToast("Could not bookmark scheme. Invalid scheme reference.", "error");
      return;
    }

    if (inFlightResultsBookmarks.has(targetUuid)) return;
    inFlightResultsBookmarks.add(targetUuid);

    try {
      if (typeof window.getOrInitSupabaseClient !== 'function') {
        if (window.showToast) window.showToast("Please sign in to bookmark schemes.", "info");
        return;
      }

      const client = await window.getOrInitSupabaseClient();
      if (!client) {
        if (window.showToast) window.showToast("Please sign in to bookmark schemes.", "info");
        return;
      }

      const session = await client.auth.getSession();
      const userId = session?.data?.session?.user?.id;
      if (!userId) {
        if (window.showToast) window.showToast("Please sign in to bookmark schemes.", "info");
        return;
      }

      const isCurrentlySaved = resultsUserSavedIds.has(targetUuid) || (buttonElem && buttonElem.classList.contains('is-saved'));

      if (isCurrentlySaved) {
        const { error: delErr } = await client
          .from('saved_schemes')
          .delete()
          .eq('user_id', userId)
          .eq('scheme_id', targetUuid);

        if (!delErr) {
          resultsUserSavedIds.delete(targetUuid);
          updateBtn(false);
          if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
        } else {
          if (window.showToast) window.showToast("Failed to remove bookmark.", "error");
        }
      } else {
        const { error: insErr } = await client
          .from('saved_schemes')
          .insert({ user_id: userId, scheme_id: targetUuid });

        if (!insErr || insErr.code === '23505') {
          resultsUserSavedIds.add(targetUuid);
          updateBtn(true);
          if (window.showToast) window.showToast(insErr?.code === '23505' ? "Scheme is already saved in your bookmarks!" : "Scheme saved to your bookmarks!", "success");
        } else {
          if (window.showToast) window.showToast("Failed to save scheme.", "error");
        }
      }
    } catch (err) {
      console.warn("Save bookmark error:", err);
      if (window.showToast) window.showToast("Could not update bookmark.", "error");
    } finally {
      inFlightResultsBookmarks.delete(targetUuid);
    }
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

    // Load current user's saved scheme bookmarks before rendering
    await loadResultsSavedIds();

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
