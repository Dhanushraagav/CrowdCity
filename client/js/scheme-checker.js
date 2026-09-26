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

  // Fallback initial dataset aligned with supabase/v2_government_schemes_seed.sql and v2_eligibility_engine_schema.sql
  function getFallbackSeedSchemes() {
    return [
      {
        id: 'tn-kmut',
        scheme_code: 'TN-KMUT-001',
        scheme_name: 'Kalaignar Magalir Urimai Thittam',
        department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'Tamil Nadu Government Portal (kmut.tn.gov.in)',
        short_description: 'Monthly financial rights assistance of ₹1,000 for women heads of households in Tamil Nadu.',
        benefits_summary: '₹1,000 monthly direct bank transfer into the account of the female head of the family.',
        required_documents: ["Smart Family Card (Ration Card)", "Aadhaar Card", "Active Bank Passbook", "Electricity Bill"],
        official_portal_url: 'https://kmut.tn.gov.in/',
        eligibility_criteria: {
          min_age: 21,
          max_age: 60,
          gender: 'female',
          max_annual_income: 250000,
          native_state: 'Tamil Nadu',
          electricity_consumption_max_units_per_year: 3600
        }
      },
      {
        id: 'tn-pudhumai',
        scheme_code: 'TN-PUDHUMAI-002',
        scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
        department_name: 'Social Welfare & Women Empowerment Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'Tamil Nadu e-Governance / Penkalvi Portal',
        short_description: 'Monthly financial support of ₹1,000 for girl students pursuing degree/diploma education who studied in TN Govt schools (Classes 6–12).',
        benefits_summary: '₹1,000 monthly financial aid until graduation or completion of diploma course.',
        required_documents: ["Govt School Transfer Certificate (6th-12th)", "Aadhaar Card", "College Admission ID", "Bank Passbook"],
        official_portal_url: 'https://penkalvi.tn.gov.in/',
        eligibility_criteria: {
          min_age: 17,
          max_age: 25,
          gender: 'female',
          student_required: true,
          is_student: true,
          gov_school_required: true,
          native_state: 'Tamil Nadu'
        }
      },
      {
        id: 'tn-naanmudhalvan',
        scheme_code: 'TN-NM-003',
        scheme_name: 'Naan Mudhalvan Skill Development Scheme',
        department_name: 'Tamil Nadu Skill Development Corporation (TNSDC), Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'Tamil Nadu Skill Development Corporation (TNSDC) Official Portal (naanmudhalvan.tn.gov.in)',
        last_verified_date: '2026-09-26',
        short_description: 'Statewide skill enhancement and career placement platform for college students & youth.',
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
        scheme_code: 'TN-CMCHIS-004',
        scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
        department_name: 'Health & Family Welfare Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'CMCHIS Tamil Nadu Official Portal',
        short_description: 'Cashless medical and surgical treatment cover up to ₹5,00,000 per family per year.',
        benefits_summary: 'Cashless hospital treatment up to ₹5 Lakhs annually per enrolled family across accredited hospitals.',
        required_documents: ["Income Certificate from VAO / Tahsildar", "Smart Family Card", "Aadhaar Card"],
        official_portal_url: 'https://cmchistn.com/',
        eligibility_criteria: {
          gender: 'all',
          max_annual_income: 120000,
          native_state: 'Tamil Nadu'
        }
      },
      {
        id: 'tn-kanavuillam',
        scheme_code: 'TN-KKI-005',
        scheme_name: 'Kalaignar Kanavu Illam Housing Scheme',
        department_name: 'Rural Development & Panchayat Raj Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'TN Rural Development Portal (tnrd.tn.gov.in)',
        short_description: 'Financial subsidy of ₹3.5 Lakhs for converting rural hutments into permanent concrete houses.',
        benefits_summary: '₹3,50,000 direct construction assistance disbursed in stage-wise installments.',
        required_documents: ["Land Patta Document", "Aadhaar Card", "Ration Card", "Bank Passbook"],
        official_portal_url: 'https://tnrd.tn.gov.in/',
        eligibility_criteria: {
          gender: 'all',
          max_annual_income: 150000,
          native_state: 'Tamil Nadu',
          residence_type: 'Kutcha House / Hutment Owner in Rural Area',
          own_land_patta: true
        }
      },
      {
        id: 'tn-uzhavar',
        scheme_code: 'TN-UZHAVAR-006',
        scheme_name: 'TN Uzhavar Protection Scheme',
        department_name: 'Revenue & Disaster Management Department, Govt of Tamil Nadu',
        state_or_central: 'state',
        data_source: 'Tamil Nadu Revenue Department',
        short_description: 'Social security, pension, and accidental insurance for agricultural landholders & laborers.',
        benefits_summary: 'Monthly ₹1,000 old age pension, ₹1,00,000 accidental death cover, and higher education scholarships.',
        required_documents: ["Uzhavar Card / Land Patta Document", "Aadhaar Card", "Ration Card", "Bank Passbook"],
        official_portal_url: 'https://eblock.tn.gov.in/',
        eligibility_criteria: {
          min_age: 18,
          gender: 'all',
          farmer_required: true,
          is_farmer: true,
          native_state: 'Tamil Nadu'
        }
      },
      {
        id: 'central-pmkisan',
        scheme_code: 'CENTRAL-PMKISAN-007',
        scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
        department_name: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        state_or_central: 'central',
        data_source: 'PM-KISAN Official Portal (pmkisan.gov.in)',
        short_description: 'Annual direct income support of ₹6,000 for landholding farmer families across India.',
        benefits_summary: '₹6,000 per year paid in 3 installments of ₹2,000 every 4 months via Direct Benefit Transfer.',
        required_documents: ["Aadhaar Card", "Land Ownership Certificate (Patta/RoR)", "Aadhaar-linked Bank Account"],
        official_portal_url: 'https://pmkisan.gov.in/',
        eligibility_criteria: {
          min_age: 18,
          gender: 'all',
          farmer_required: true,
          is_farmer: true,
          landholding: 'Cultivable landholder'
        }
      },
      {
        id: 'central-pmjay',
        scheme_code: 'CENTRAL-PMJAY-008',
        scheme_name: 'Ayushman Bharat PM-JAY',
        department_name: 'National Health Authority (NHA), Ministry of Health, Govt of India',
        state_or_central: 'central',
        data_source: 'National Health Authority (pmjay.gov.in)',
        short_description: 'National health insurance cover of ₹5 Lakhs per family for secondary & tertiary hospital care.',
        benefits_summary: '₹5,00,000 annual cashless treatment for over 1,900 medical procedures across network hospitals.',
        required_documents: ["Aadhaar Card", "Ration Card", "Ayushman Golden Card"],
        official_portal_url: 'https://pmjay.gov.in/',
        eligibility_criteria: {
          gender: 'all',
          max_annual_income: 200000,
          secc_criteria: 'Identified deprived family under SECC 2011 / eligible ration card'
        }
      },
      {
        id: 'central-pmmy',
        scheme_code: 'CENTRAL-PMMY-009',
        scheme_name: 'Pradhan Mantri Mudra Yojana (PMMY)',
        department_name: 'Department of Financial Services, Ministry of Finance, Govt of India',
        state_or_central: 'central',
        data_source: 'MUDRA Portal (mudra.org.in)',
        short_description: 'Collateral-free business loans up to ₹10 Lakhs for micro and small enterprise owners.',
        benefits_summary: 'Collateral-free enterprise credit up to ₹10,00,000 at competitive bank interest rates.',
        required_documents: ["Aadhaar Card", "PAN Card", "Udyam MSME Registration", "Bank Statement"],
        official_portal_url: 'https://www.mudra.org.in/',
        eligibility_criteria: {
          min_age: 18,
          max_age: 65,
          gender: 'all'
        }
      },
      {
        id: 'central-ssy',
        scheme_code: 'CENTRAL-SSY-010',
        scheme_name: 'Sukanya Samriddhi Yojana (Girl Child Savings)',
        department_name: 'Department of Posts, Govt of India',
        state_or_central: 'central',
        data_source: 'India Post / Ministry of Women & Child Development',
        short_description: 'High-interest government savings scheme for girl children with 80C tax exemption.',
        benefits_summary: 'High interest rate (8.2% p.a.), complete tax exemption, and partial withdrawal allowed at age 18.',
        required_documents: ["Girl Child Birth Certificate", "Parent Aadhaar & PAN", "Photos"],
        official_portal_url: 'https://www.indiapost.gov.in/',
        eligibility_criteria: {
          min_age: 0,
          max_age: 10,
          gender: 'female'
        }
      },
      {
        id: 'central-pmay',
        scheme_code: 'CENTRAL-PMAY-011',
        scheme_name: 'Pradhan Mantri Awas Yojana (PMAY)',
        department_name: 'Ministry of Housing & Urban Affairs / Ministry of Rural Development, Govt of India',
        state_or_central: 'central',
        data_source: 'PMAY Portal (pmaymis.gov.in)',
        short_description: 'Interest subsidy and construction assistance for affordable housing for EWS/LIG citizens.',
        benefits_summary: 'Up to ₹2.67 Lakhs interest subsidy on home loan or ₹1.5 Lakhs direct construction grant.',
        required_documents: ["Aadhaar Card", "Income Certificate / Salary Slip", "Affidavit for not owning a pucca house", "Bank Passbook"],
        official_portal_url: 'https://pmaymis.gov.in/',
        eligibility_criteria: {
          min_age: 18,
          gender: 'all',
          max_annual_income: 600000,
          pucca_house_owned: false
        }
      },
      {
        id: 'central-vidyalakshmi',
        scheme_code: 'CENTRAL-VIDYALAKSHMI-012',
        scheme_name: 'PM Vidya Lakshmi Education Loan Scheme',
        department_name: 'Department of Higher Education, Ministry of Education, Govt of India',
        state_or_central: 'central',
        data_source: 'Vidya Lakshmi Portal (vidyalakshmi.co.in)',
        short_description: 'Single-window portal to apply for education loans & central interest subsidy for higher studies.',
        benefits_summary: 'Access to educational loans up to ₹15 Lakhs without collateral for listed institutions.',
        required_documents: ["10th & 12th Marksheet", "College Admission Offer Letter & Fee Structure", "Parent Income Certificate", "Aadhaar Card"],
        official_portal_url: 'https://www.vidyalakshmi.co.in/',
        eligibility_criteria: {
          min_age: 16,
          gender: 'all',
          student_required: true,
          is_student: true
        }
      }
    ];
  }

  /**
   * Strictly Scheme-Specific Eligibility Evaluator
   * Evaluates a single scheme against the citizen's supplied profile without universal formulas or silent defaults.
   * Returns one of three distinct conceptual states:
   * - "Eligible" (statusCode: "ELIGIBLE") -> All mandatory criteria for this scheme are satisfied.
   * - "Not Eligible" (statusCode: "NOT_ELIGIBLE") -> At least one mandatory criterion for this scheme is violated.
   * - "Additional Information Required" (statusCode: "INSUFFICIENT_INFORMATION") -> Required information is missing.
   */
  function evaluateEligibility(scheme, profileInput) {
    const profile = profileInput || {};
    const criteria = (scheme && typeof scheme.eligibility_criteria === 'object' && scheme.eligibility_criteria)
      ? scheme.eligibility_criteria
      : {};

    const passed = [];
    const failed = [];
    const missing = [];
    const verificationNotes = [];

    const verifiedDocs = [];
    const expiredDocs = [];
    const renewingDocs = [];
    const missingDocsList = [];

    const currentLang = (typeof window !== 'undefined' && window.i18n && typeof window.i18n.getLanguage === 'function')
      ? window.i18n.getLanguage()
      : (typeof localStorage !== 'undefined' ? (localStorage.getItem('crowdcity_language') || localStorage.getItem('cc_lang') || localStorage.getItem('preferred_language') || 'en') : 'en');
    const isTamil = (currentLang === 'ta');

    const formatGenderLabel = (g) => {
      const norm = String(g || '').toLowerCase();
      if (norm === 'female') return isTamil ? 'பெண்' : 'Female';
      if (norm === 'male') return isTamil ? 'ஆண்' : 'Male';
      if (norm === 'transgender') return isTamil ? 'திருநங்கை / திருநம்பி' : 'Transgender';
      return g;
    };

    // Guard: If scheme has zero structured criteria (or only vague free-text), do not fabricate rules or auto-approve
    const criteriaKeys = Object.keys(criteria);
    if (criteriaKeys.length === 0) {
      missing.push(isTamil
        ? '? இந்த திட்டத்திற்கான கட்டமைக்கப்பட்ட தகுதி விவரங்கள் இல்லை; கூடுதல் சரிபார்ப்பு தேவை'
        : '? Structured eligibility criteria unavailable; additional information required to determine eligibility');
    }

    // 1. Age Check (supports min_age === 0 for child schemes like Sukanya Samriddhi Yojana)
    const hasMinAge = (criteria.min_age !== undefined && criteria.min_age !== null && criteria.min_age !== '');
    const hasMaxAge = (criteria.max_age !== undefined && criteria.max_age !== null && criteria.max_age !== '');
    if (hasMinAge || hasMaxAge) {
      const min = hasMinAge ? Number(criteria.min_age) : null;
      const max = hasMaxAge ? Number(criteria.max_age) : null;
      const rangeDesc = (hasMinAge && hasMaxAge)
        ? `${min}–${max}`
        : (hasMinAge ? `${min}+` : `up to ${max}`);

      const hasValidUserAge = (profile.age !== undefined && profile.age !== null && profile.age !== '' && !Number.isNaN(Number(profile.age)) && Number(profile.age) >= 0);
      if (!hasValidUserAge) {
        missing.push(isTamil
          ? `? வயது விவரம் தேவை (தேவை: ${rangeDesc} வயது)`
          : `? Age information required (Required: ${rangeDesc} years)`);
      } else {
        const userAge = Number(profile.age);
        if ((hasMinAge && userAge < min) || (hasMaxAge && userAge > max)) {
          failed.push(isTamil
            ? `✗ வயது தகுதி பூர்த்தி செய்யப்படவில்லை (தேவை: ${rangeDesc}, தற்போதைய வயது: ${userAge})`
            : `✗ Age requirement not satisfied (Required: ${rangeDesc} years, Provided: ${userAge})`);
        } else {
          passed.push(isTamil
            ? `✓ வயது தகுதி பூர்த்தி செய்யப்பட்டது (${userAge} வயது; வரம்பு: ${rangeDesc})`
            : `✓ Age requirement satisfied (${userAge} years within ${rangeDesc})`);
        }
      }
    }

    // 2. Gender Check (never assumes a default gender; supports female, male, transgender, or array)
    const schemeGender = criteria.gender;
    const isGenderRestricted = Boolean(
      schemeGender &&
      schemeGender !== 'all' &&
      schemeGender !== 'any' &&
      (!Array.isArray(schemeGender) || schemeGender.length > 0)
    );

    const userGenderRaw = (profile.gender !== undefined && profile.gender !== null)
      ? String(profile.gender).trim().toLowerCase()
      : '';
    const isUserGenderProvided = Boolean(
      userGenderRaw &&
      userGenderRaw !== 'all' &&
      userGenderRaw !== 'prefer_not_to_say' &&
      userGenderRaw !== 'select'
    );

    if (isGenderRestricted) {
      const allowedGenders = Array.isArray(schemeGender)
        ? schemeGender.map(g => String(g).trim().toLowerCase())
        : [String(schemeGender).trim().toLowerCase()];
      const expectedLabel = allowedGenders.map(formatGenderLabel).join(' / ');

      if (!isUserGenderProvided) {
        missing.push(isTamil
          ? `? பாலினம் விவரம் தேவை (தேவை: ${expectedLabel})`
          : `? Gender information required (Scheme restricted to: ${expectedLabel})`);
      } else if (!allowedGenders.includes(userGenderRaw)) {
        failed.push(isTamil
          ? `✗ பாலின தகுதி பூர்த்தி செய்யப்படவில்லை (தேவை: ${expectedLabel})`
          : `✗ Gender requirement not satisfied (Requires: ${expectedLabel})`);
      } else {
        passed.push(isTamil
          ? `✓ பாலின தகுதி பூர்த்தி செய்யப்பட்டது (${formatGenderLabel(userGenderRaw)})`
          : `✓ Gender requirement satisfied (${formatGenderLabel(userGenderRaw)})`);
      }
    } else if (schemeGender === 'all' || schemeGender === 'any') {
      // Gender-neutral scheme: never excludes male, female, or transgender users
      if (isUserGenderProvided) {
        passed.push(isTamil
          ? `✓ பாலின தகுதி பூர்த்தி செய்யப்பட்டது (அனைத்து பாலினத்தவருக்கும் பொருந்தும்)`
          : `✓ Gender requirement satisfied (Open to all genders)`);
      }
    }

    // 3. Income Check (distinguishes missing null/undefined income from explicit ₹0 income)
    const hasMaxIncome = (criteria.max_annual_income !== undefined && criteria.max_annual_income !== null && criteria.max_annual_income !== '');
    if (hasMaxIncome) {
      const maxIncome = Number(criteria.max_annual_income);
      const hasValidIncome = (
        profile.income !== undefined &&
        profile.income !== null &&
        profile.income !== '' &&
        !Number.isNaN(Number(profile.income)) &&
        Number(profile.income) >= 0
      );

      if (!hasValidIncome) {
        missing.push(isTamil
          ? `? ஆண்டு குடும்ப வருமான விவரம் தேவை (வரம்பு: ₹${maxIncome.toLocaleString('en-IN')})`
          : `? Income information required (Annual limit: ₹${maxIncome.toLocaleString('en-IN')})`);
      } else {
        const userIncome = Number(profile.income);
        if (userIncome > maxIncome) {
          failed.push(isTamil
            ? `✗ வருமான தகுதி பூர்த்தி செய்யப்படவில்லை (வரம்பு: ₹${maxIncome.toLocaleString('en-IN')}, தற்போதைய வருமானம்: ₹${userIncome.toLocaleString('en-IN')})`
            : `✗ Income requirement not satisfied (Exceeds ₹${maxIncome.toLocaleString('en-IN')} limit; Provided: ₹${userIncome.toLocaleString('en-IN')})`);
        } else {
          passed.push(isTamil
            ? `✓ வருமான தகுதி பூர்த்தி செய்யப்பட்டது (₹${userIncome.toLocaleString('en-IN')} ≤ ₹${maxIncome.toLocaleString('en-IN')})`
            : `✓ Income requirement satisfied (₹${userIncome.toLocaleString('en-IN')} within ₹${maxIncome.toLocaleString('en-IN')} limit)`);
        }
      }
    }

    // 4. Student Status Check (supports both student_required and is_student keys)
    const requiresStudent = (criteria.student_required === true || criteria.is_student === true);
    if (requiresStudent) {
      const studentExplicitlyKnown = (profile.isStudent !== undefined && profile.isStudent !== null) ||
        (profile.occupation !== undefined && profile.occupation !== null && profile.occupation !== '');

      if (!studentExplicitlyKnown) {
        missing.push(isTamil ? '? மாணவர் நிலை விவரம் தேவை' : '? Student status information required');
      } else if (profile.isStudent === true || String(profile.occupation || '').toLowerCase() === 'student') {
        passed.push(isTamil ? '✓ மாணவர் தகுதி பூர்த்தி செய்யப்பட்டது' : '✓ Student requirement satisfied');
      } else {
        failed.push(isTamil ? '✗ மாணவர் நிலை தகுதி பூர்த்தி செய்யப்படவில்லை' : '✗ Student requirement not satisfied (Enrolled Student required)');
      }
    }

    // 5. TN Government School (Classes 6–12) Check
    const requiresGovSchool = (criteria.gov_school_required === true || Boolean(criteria.govt_school_studied_classes));
    if (requiresGovSchool) {
      if (profile.govSchoolStudied === undefined || profile.govSchoolStudied === null || profile.govSchoolStudied === '') {
        missing.push(isTamil
          ? '? அரசு பள்ளி கல்வி விவரம் தேவை (6 முதல் 12 ஆம் வகுப்பு வரை)'
          : '? TN Government School (Classes 6–12) schooling information required');
      } else if (profile.govSchoolStudied === true || profile.govSchoolStudied === 'true') {
        passed.push(isTamil
          ? '✓ அரசு பள்ளி கல்வி தகுதி பூர்த்தி செய்யப்பட்டது'
          : '✓ TN Government School (Classes 6–12) requirement satisfied');
      } else {
        failed.push(isTamil
          ? '✗ அரசு பள்ளி கல்வி தகுதி பூர்த்தி செய்யப்படவில்லை'
          : '✗ TN Government School (Classes 6–12) requirement not satisfied');
      }
    }

    // 6. Government College Check
    if (criteria.gov_college_required === true) {
      const inst = profile.institutionType;
      const govCollegeFlag = profile.govCollegeStudied;
      if ((govCollegeFlag === undefined || govCollegeFlag === null) && (!inst || inst === 'none')) {
        missing.push(isTamil ? '? அரசு கல்லூரி கல்வி விவரம் தேவை' : '? Government college enrollment information required');
      } else if (govCollegeFlag === true || inst === 'Government') {
        passed.push(isTamil ? '✓ அரசு கல்லூரி தகுதி பூர்த்தி செய்யப்பட்டது' : '✓ Government college enrollment requirement satisfied');
      } else {
        failed.push(isTamil ? '✗ அரசு கல்லூரியில் படித்திருக்க வேண்டும்' : '✗ Government college enrollment requirement not satisfied');
      }
    }

    // 7. Disability Condition Check (distinguishes missing undefined/null from false)
    const requiresDisability = (criteria.disability_required === true || criteria.is_disabled === true);
    if (requiresDisability) {
      if (profile.isDisability === undefined || profile.isDisability === null) {
        missing.push(isTamil ? '? மாற்றுத்திறனாளி நிலை குறித்த விவரம் தேவை' : '? Disability condition information required');
      } else if (profile.isDisability === true) {
        passed.push(isTamil ? '✓ மாற்றுத்திறனாளி தகுதி பூர்த்தி செய்யப்பட்டது' : '✓ Disability condition requirement satisfied');
      } else {
        failed.push(isTamil ? '✗ மாற்றுத்திறனாளி தகுதி பூர்த்தி செய்யப்படவில்லை' : '✗ Disability condition requirement not satisfied');
      }
    }

    // 8. Widow / Single Parent Condition Check
    const requiresWidow = (criteria.widow_required === true || criteria.single_parent_required === true || criteria.is_widow === true);
    if (requiresWidow) {
      if (profile.isWidow === undefined || profile.isWidow === null) {
        missing.push(isTamil ? '? விதவை / ஒற்றை பெற்றோர் நிலை விவரம் தேவை' : '? Widow / Single Parent status information required');
      } else if (profile.isWidow === true) {
        passed.push(isTamil ? '✓ விதவை / ஒற்றை பெற்றோர் தகுதி பூர்த்தி செய்யப்பட்டது' : '✓ Widow / Single Parent requirement satisfied');
      } else {
        failed.push(isTamil ? '✗ விதவை / ஒற்றை பெற்றோர் தகுதி பூர்த்தி செய்யப்படவில்லை' : '✗ Widow / Single Parent requirement not satisfied');
      }
    }

    // 9. Farmer / Agricultural Status Check (supports both farmer_required and is_farmer)
    const requiresFarmer = (criteria.farmer_required === true || criteria.is_farmer === true);
    if (requiresFarmer) {
      const farmerExplicitlyKnown = (profile.isFarmer !== undefined && profile.isFarmer !== null) ||
        (profile.occupation !== undefined && profile.occupation !== null && profile.occupation !== '');

      if (!farmerExplicitlyKnown) {
        missing.push(isTamil ? '? விவசாயி நிலை குறித்த விவரம் தேவை' : '? Farmer / agricultural status information required');
      } else if (profile.isFarmer === true || String(profile.occupation || '').toLowerCase() === 'farmer') {
        passed.push(isTamil ? '✓ விவசாயி தகுதி பூர்த்தி செய்யப்பட்டது' : '✓ Farmer / agricultural family requirement satisfied');
      } else {
        failed.push(isTamil ? '✗ விவசாயி தகுதி பூர்த்தி செய்யப்படவில்லை' : '✗ Farmer / agricultural family requirement not satisfied');
      }
    }

    // 10. Community / Social Category Check
    const allowedCategories = Array.isArray(criteria.social_categories) ? criteria.social_categories : null;
    if (allowedCategories && allowedCategories.length > 0) {
      if (!profile.socialCategory || profile.socialCategory === '' || profile.socialCategory === 'all') {
        missing.push(isTamil ? '? சமூகப் பிரிவு விவரம் தேவை' : `? Community / social category information required (${allowedCategories.join(', ')})`);
      } else if (!allowedCategories.map(c => String(c).toUpperCase()).includes(String(profile.socialCategory).toUpperCase())) {
        failed.push(isTamil ? '✗ சமூகப் பிரிவு தகுதி பூர்த்தி செய்யப்படவில்லை' : `✗ Community / social category requirement not satisfied (Requires: ${allowedCategories.join(', ')})`);
      } else {
        passed.push(isTamil ? `✓ சமூகப் பிரிவு தகுதி பூர்த்தி செய்யப்பட்டது (${profile.socialCategory})` : `✓ Community / social category requirement satisfied (${profile.socialCategory})`);
      }
    }

    // 11. District / Residency State Check
    const reqState = criteria.native_state || (criteria.state && criteria.state !== 'All States / UTs' ? criteria.state : null);
    if (reqState) {
      if (!profile.district || !String(profile.district).trim()) {
        missing.push(isTamil ? '? மாவட்டம் / இருப்பிட விவரம் தேவை (தமிழ்நாடு)' : `? District / residence information required (${reqState})`);
      } else if (profile.district === 'Other' || profile.district === 'Non-TN' || (Array.isArray(criteria.allowed_districts) && criteria.allowed_districts.length > 0 && !criteria.allowed_districts.includes(profile.district))) {
        failed.push(isTamil ? `✗ இருப்பிட தகுதி பூர்த்தி செய்யப்படவில்லை (${reqState})` : `✗ District/residence requirement not satisfied (${reqState} residency required)`);
      } else {
        passed.push(isTamil
          ? `✓ இருப்பிட தகுதி பூர்த்தி செய்யப்பட்டது (${profile.district}, ${reqState})`
          : `✓ District/residence requirement satisfied (${profile.district}, ${reqState})`);
      }
    }

    // 12. Distinguish Umbrella Programme (e.g. Naan Mudhalvan) vs Specific Programme / Course Tracks
    const isUmbrellaProgramme = Boolean(
      criteria.programme_level === 'umbrella' ||
      criteria.requires_course_selection === true ||
      scheme.is_umbrella_programme === true ||
      scheme.scheme_code === 'TN-NM-003' ||
      scheme.id === 'tn-naanmudhalvan'
    );

    if (isUmbrellaProgramme) {
      // Evaluate schooling background for general Naan Mudhalvan programme (open to both Govt & Private)
      if (profile.govSchoolStudied === true) {
        passed.push(isTamil
          ? '✓ பள்ளி கல்வி பின்னணி சரிபார்க்கப்பட்டது (அரசு பள்ளி மாணவர்கள் தகுதியுடையவர்கள்)'
          : '✓ Schooling background verified (Government school background eligible)');
      } else if (profile.govSchoolStudied === false) {
        passed.push(isTamil
          ? '✓ பள்ளி கல்வி பின்னணி சரிபார்க்கப்பட்டது (பொது திட்டத்திற்கு அரசு மற்றும் தனியார் பள்ளி மாணவர்கள் இருவருக்கும் பொருந்தும்)'
          : '✓ Schooling background verified (Both Government and Private schooling eligible for general programme)');
      } else {
        verificationNotes.push(isTamil
          ? 'பள்ளி கல்வி பின்னணி: பொது திட்டத்திற்கு அரசு மற்றும் தனியார் பள்ளி மாணவர்கள் இருவருக்கும் பொருந்தும்.'
          : 'Schooling background: Open to both Government and Private school students; specific school-level coaching tracks may have tailored criteria.');
      }

      // Evaluate college institution type for college skilling tracks (open to Govt, Aided, and Private/Self-Financing)
      if (profile.institutionType === 'Government' || profile.institutionType === 'Aided') {
        passed.push(isTamil
          ? `✓ கல்லூரி நிறுவனம் சரிபார்க்கப்பட்டது (${profile.institutionType} கல்லூரி நிறுவனங்கள் தகுதியுடையவை)`
          : `✓ College institution verified (${profile.institutionType} institution eligible for college skilling tracks)`);
      } else if (profile.institutionType === 'Private') {
        passed.push(isTamil
          ? '✓ கல்லூரி நிறுவனம் சரிபார்க்கப்பட்டது (அரசு மற்றும் தனியார்/சுயநிதி கல்லூரிகள் இரண்டிற்கும் பொருந்தும்)'
          : '✓ College institution verified (Both Government and Private/Self-Financing institutions eligible for college skilling tracks)');
      } else if (profile.institutionType === 'none' || !profile.institutionType) {
        verificationNotes.push(isTamil
          ? 'கல்லூரி நிறுவனம்: கல்லூரியில் பயிலும் மாணவர்கள் (அரசு/உதவிபெறும்/தனியார்) மற்றும் வேலை தேடும் இளைஞர்கள் இருவருக்கும் பொருந்தும்.'
          : 'College institution: Open to enrolled college students (Govt/Aided/Private) as well as job seekers and unemployed youth.');
      }

      // Departmental verification caveat for broad umbrella skilling
      verificationNotes.push(isTamil
        ? 'வழங்கப்பட்ட தகவலின் அடிப்படையில் பொது திட்ட தகுதி பொருந்துகிறது. குறிப்பிட்ட பாடப்பிரிவு அல்லது பயிற்சிக்கு (கல்லூரி சேர்க்கை, குறிப்பிட்ட பட்டப்படிப்பு அல்லது நுழைவுத் தேர்வு) கூடுதல் நிபந்தனைகள் பொருந்தக்கூடும்.'
        : 'Matches the currently verified general programme criteria based on the information provided. Additional programme-specific or course-level prerequisites (such as specific degree, college affiliation, or entrance qualification) may apply.');
    }

    // 13. Specific Course-Level Criteria (independent rules for non-umbrella specific tracks)
    if (criteria.degree_required) {
      const userDegree = profile.degree || 'none';
      if (userDegree === 'none') {
        missing.push(isTamil ? '? பட்டப்படிப்பு விவரம் தேவை' : '? Degree qualification information required');
      } else {
        passed.push(isTamil ? `✓ பட்டப்படிப்பு தகுதி சரிபார்க்கப்பட்டது (${userDegree})` : `✓ Degree qualification verified (${userDegree})`);
      }
    }
    if (criteria.entrance_exam_required) {
      if (profile.passedEntranceExam === undefined || profile.passedEntranceExam === null) {
        missing.push(isTamil ? '? நுழைவுத் தேர்வு தேர்ச்சி விவரம் தேவை' : '? Entrance examination qualification proof required');
      } else if (profile.passedEntranceExam === true) {
        passed.push(isTamil ? '✓ நுழைவுத் தேர்வு தேர்ச்சி சரிபார்க்கப்பட்டது' : '✓ Entrance examination qualification verified');
      } else {
        failed.push(isTamil ? '✗ நுழைவுத் தேர்வில் தேர்ச்சி பெற்றிருக்க வேண்டும்' : '✗ Must pass the official screening entrance test');
      }
    }

    // 14. Unknown Criteria Guard (never silently assume true/false for unverified criteria)
    const recognizedCriteriaKeys = new Set([
      'min_age', 'max_age', 'gender', 'max_annual_income',
      'student_required', 'is_student', 'gov_school_required', 'govt_school_studied_classes',
      'gov_college_required', 'disability_required', 'is_disabled',
      'widow_required', 'single_parent_required', 'is_widow',
      'farmer_required', 'is_farmer', 'social_categories',
      'native_state', 'state', 'allowed_districts',
      'own_land_patta', 'residence_type', 'pucca_house_owned',
      'secc_criteria', 'electricity_consumption_max_units_per_year', 'landholding',
      'required_certificates', 'programme_level', 'requires_course_selection',
      'school_types_allowed', 'institution_types_allowed', 'course_specific_note',
      'degree_required', 'entrance_exam_required'
    ]);
    const unknownKeys = criteriaKeys.filter(k => !recognizedCriteriaKeys.has(k) && !k.startsWith('_'));
    if (unknownKeys.length > 0) {
      missing.push(isTamil
        ? `? கூடுதல் சரிபார்க்கப்படாத நிபந்தனைகள் உள்ளன (${unknownKeys.join(', ')}); கூடுதல் விவரங்கள் தேவை`
        : `? Unverified scheme-specific criteria present (${unknownKeys.join(', ')}); additional information required`);
    }

    // 15. Additional Departmental Conditions Not Directly Collected in Basic Wizard
    if (criteria.own_land_patta !== undefined || criteria.residence_type) {
      verificationNotes.push(isTamil
        ? 'கிராமப்புற குடிசை வீடு மற்றும் சொந்த வீட்டு மனை பட்டா சரிபார்ப்புக்கு உட்பட்டது.'
        : 'Requires rural hutment ownership and valid Land Patta document verification.');
    }
    if (criteria.pucca_house_owned === false) {
      verificationNotes.push(isTamil
        ? 'விண்ணப்பதாரர் குடும்பத்திற்கு சொந்தமாக கான்கிரீட் (பக்கா) வீடு இருக்கக்கூடாது.'
        : 'Applicant family must not already own a pucca (permanent concrete) house.');
    }
    if (criteria.secc_criteria) {
      verificationNotes.push(isTamil
        ? 'SECC 2011 பட்டியல் அல்லது தகுதியான குடும்ப அட்டை சரிபார்ப்புக்கு உட்பட்டது.'
        : `Requires departmental verification: ${criteria.secc_criteria}.`);
      if (passed.length === 0 && failed.length === 0) {
        missing.push(`? ${criteria.secc_criteria} verification required`);
      }
    }
    if (criteria.electricity_consumption_max_units_per_year) {
      verificationNotes.push(isTamil
        ? `ஆண்டு குடும்ப மின் பயன்பாடு ${criteria.electricity_consumption_max_units_per_year} யூனிட்டுகளுக்குள் இருக்க வேண்டும்.`
        : `Household annual electricity consumption must be under ${criteria.electricity_consumption_max_units_per_year} units.`);
    }
    if (criteria.landholding) {
      verificationNotes.push(isTamil
        ? 'வேளாண் நில உடமை சான்று (பட்டா/சிட்டா) சரிபார்ப்பு தேவை.'
        : `Requires agricultural landholding verification (${criteria.landholding}).`);
    }

    // 16. Document Wallet Cross-Check (tracked separately from profile eligibility criteria)
    const reqCerts = criteria.required_certificates || scheme.required_documents || [];
    let uploadedDocs = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('cc_user_uploaded_docs');
        if (stored) uploadedDocs = JSON.parse(stored);
      }
    } catch (e) {}

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    reqCerts.forEach(cert => {
      const matchingUploaded = uploadedDocs.find(d => {
        const t = (d.doc_type || '').toLowerCase();
        const c = String(cert).toLowerCase();
        return t && (t.includes(c) || c.includes(t));
      });

      if (!matchingUploaded) {
        missingDocsList.push(cert);
      } else {
        let isExpired = false;
        let isRenewalSoon = false;
        let expiryDateStr = '';

        if (matchingUploaded.expiry_date) {
          const exp = new Date(matchingUploaded.expiry_date);
          expiryDateStr = exp.toLocaleDateString(isTamil ? 'ta-IN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          if (exp < now) isExpired = true;
          else if (exp <= thirtyDaysFromNow) isRenewalSoon = true;
        }

        if (isExpired) {
          expiredDocs.push({ name: cert, expiry: expiryDateStr });
        } else if (isRenewalSoon) {
          renewingDocs.push({ name: cert, expiry: expiryDateStr });
        } else {
          verifiedDocs.push({ name: cert, expiry: expiryDateStr });
        }
      }
    });

    // 17. Determine Four-State Eligibility Status
    // - NOT_ELIGIBLE ("Not Eligible"): At least one mandatory criterion failed
    // - INSUFFICIENT_INFORMATION ("Additional Information Required"): No criterion failed, but required criteria are missing
    // - POTENTIALLY_RELEVANT ("Potentially Relevant"): Matches broad programme-level criteria, but individual course/track prerequisites apply
    // - ELIGIBLE ("Eligible"): All known required criteria for the selected programme/course are evaluated and satisfied
    let status = 'Eligible';
    let statusCode = 'ELIGIBLE';

    if (failed.length > 0) {
      status = 'Not Eligible';
      statusCode = 'NOT_ELIGIBLE';
    } else if (missing.length > 0 || passed.length === 0) {
      status = 'Additional Information Required';
      statusCode = 'INSUFFICIENT_INFORMATION';
    } else if (isUmbrellaProgramme) {
      status = 'Potentially Relevant';
      statusCode = 'POTENTIALLY_RELEVANT';
    } else {
      status = 'Eligible';
      statusCode = 'ELIGIBLE';
    }

    // 18. Confidence Rating
    let confidence = 'High Confidence';
    const confidenceReasons = [];

    if (statusCode === 'NOT_ELIGIBLE') {
      confidence = 'Needs Verification';
      confidenceReasons.push(isTamil ? 'திட்ட தகுதி விதிகள் பொருந்தவில்லை' : 'Mandatory eligibility criteria not satisfied');
    } else if (statusCode === 'INSUFFICIENT_INFORMATION') {
      confidence = 'Needs Verification';
      confidenceReasons.push(isTamil ? 'கூடுதல் விவரங்கள் தேவை' : 'Additional information required to determine eligibility');
    } else if (statusCode === 'POTENTIALLY_RELEVANT') {
      confidence = 'Medium Confidence';
      confidenceReasons.push(isTamil
        ? 'பொது திட்ட தகுதி பொருந்தியது; குறிப்பிட்ட பாடப்பிரிவு நிபந்தனைகள் சரிபார்க்கப்பட வேண்டும்'
        : 'Broad programme criteria matched; course-specific prerequisites apply');
    } else if (verificationNotes.length > 0 || missingDocsList.length > 0) {
      confidence = 'Medium Confidence';
      if (verificationNotes.length > 0) {
        confidenceReasons.push(isTamil ? 'துறை சார்ந்த கூடுதல் நிபந்தனைகள் உள்ளன' : 'Subject to departmental field/document verification');
      }
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
    if (formCard) {
      if (currentStep === 4) {
        formCard.classList.add('step-results-active');
      } else {
        formCard.classList.remove('step-results-active');
      }
      if (typeof formCard.scrollIntoView === 'function') {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function getFormData() {
    const ageRaw = document.getElementById('check-age')?.value?.trim();
    const age = (ageRaw !== undefined && ageRaw !== '' && /^\d+$/.test(ageRaw)) ? parseInt(ageRaw, 10) : null;

    // Never silently default gender to 'female' or 'male'
    const genderRaw = document.getElementById('check-gender')?.value?.trim() || '';
    const gender = genderRaw || null;

    const district = document.getElementById('check-district')?.value?.trim() || '';
    const occupation = document.getElementById('check-occupation')?.value?.trim() || '';

    // Distinguish empty/missing income (null) from explicit 0 income (0)
    const incomeRaw = document.getElementById('check-income')?.value?.trim();
    const income = (incomeRaw !== undefined && incomeRaw !== null && incomeRaw !== '' && !Number.isNaN(parseFloat(incomeRaw)))
      ? parseFloat(incomeRaw)
      : null;

    const isStudent = Boolean(document.getElementById('check-student')?.checked) || occupation === 'student';
    const isFarmer = Boolean(document.getElementById('check-farmer')?.checked) || occupation === 'farmer';
    const isSenior = Boolean(document.getElementById('check-senior')?.checked) || (age !== null && age >= 60);
    const isDisability = Boolean(document.getElementById('check-disability')?.checked);
    const isWidow = Boolean(document.getElementById('check-widow')?.checked);
    const socialCategory = document.getElementById('check-social-category')?.value || 'all';

    const govSchoolVal = document.getElementById('check-gov-school')?.value;
    const govSchoolStudied = govSchoolVal === 'true' ? true : (govSchoolVal === 'false' ? false : null);

    const institutionType = document.getElementById('check-institution-type')?.value || 'none';
    const degree = document.getElementById('check-degree')?.value || 'none';

    return {
      schemaVersion: 'v3',
      explicitlySelectedGender: Boolean(genderRaw),
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
      const ageRaw = document.getElementById('check-age')?.value?.trim();
      if (ageRaw === undefined || ageRaw === '' || !/^\d+$/.test(ageRaw)) {
        if (window.showToast) window.showToast("Please enter a valid whole number for your age.", "error");
        return false;
      }
      const age = parseInt(ageRaw, 10);
      if (isNaN(age) || age < 0 || age > 120) {
        if (window.showToast) window.showToast("Please enter a valid age between 0 and 120 years.", "error");
        return false;
      }
      const gender = document.getElementById('check-gender')?.value?.trim();
      if (!gender) {
        if (window.showToast) window.showToast("Please select your gender.", "error");
        return false;
      }
      const district = document.getElementById('check-district')?.value?.trim();
      if (!district) {
        if (window.showToast) window.showToast("Please select your district.", "error");
        return false;
      }
    } else if (step === 2) {
      const occupation = document.getElementById('check-occupation')?.value?.trim();
      if (!occupation) {
        if (window.showToast) window.showToast("Please select your primary occupation.", "error");
        return false;
      }
      const incomeInput = document.getElementById('check-income')?.value?.trim();
      if (incomeInput === undefined || incomeInput === '' || isNaN(parseFloat(incomeInput)) || parseFloat(incomeInput) < 0) {
        if (window.showToast) window.showToast("Please enter your annual family income.", "error");
        return false;
      }
    }
    return true;
  }

  async function calculateResults() {
    const resultsContainer = document.getElementById('checker-results-list');
    if (resultsContainer) {
      const currentLang = (window.i18n ? window.i18n.getLanguage() : (localStorage.getItem('crowdcity_language') || localStorage.getItem('cc_lang') || localStorage.getItem('preferred_language') || 'ta'));
      const isTamil = (currentLang === 'ta');
      
      resultsContainer.innerHTML = `
        <div class="ai-scanning-wrapper" style="text-align: center; padding: 4rem 2rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.25rem;">
          
          <!-- Injected local animation styles -->
          <style>
            @keyframes ai-pulse-ring {
              0% { transform: scale(0.65); opacity: 0; }
              50% { opacity: 0.25; }
              100% { transform: scale(1.3); opacity: 0; }
            }
            @keyframes ai-sparkle-float {
              0% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
              50% { transform: translateY(-10px) rotate(180deg); opacity: 1; }
              100% { transform: translateY(0px) rotate(360deg); opacity: 0.3; }
            }
            @keyframes ai-glow-bar {
              0% { left: -100%; }
              100% { left: 200%; }
            }
            .ai-glow-bar-el {
              position: absolute;
              top: 0;
              height: 3px;
              width: 50%;
              background: linear-gradient(90deg, transparent, var(--primary), transparent);
              animation: ai-glow-bar 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
          </style>

          <div class="ai-glow-bar-el"></div>

          <!-- Pulsating Core Circle -->
          <div style="position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: var(--primary); animation: ai-pulse-ring 2.5s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;"></div>
            <div style="position: absolute; width: 80%; height: 80%; border-radius: 50%; background: rgba(13, 148, 136, 0.15); animation: ai-pulse-ring 2.5s cubic-bezier(0.215, 0.610, 0.355, 1) infinite; animation-delay: 0.6s;"></div>
            <div style="position: relative; width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #6366f1); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(13, 148, 136, 0.4); z-index: 2;">
              <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 1.5rem; color: #ffffff; animation: ai-sparkle-float 3s ease-in-out infinite;"></i>
            </div>
          </div>

          <div>
            <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.25rem 0; font-family: var(--font-heading, system-ui); letter-spacing: -0.02em;">
              ${isTamil ? 'அதிநவீன தகுதி ஆய்வு' : 'AI Eligibility Engine Analysis'}
            </h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; font-weight: 600;">
              ${isTamil ? 'அதிகாரப்பூர்வ நிபந்தனைகள் சரிபார்க்கப்படுகின்றன...' : 'Evaluating official government guidelines and rules...'}
            </p>
          </div>
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

    // Sort matching schemes: Eligible first, then Potentially Relevant, then docs/info, then not eligible
    const sorted = evaluated.sort((a, b) => {
      const statusOrder = {
        "ELIGIBLE": 1,
        "Eligible": 1,
        "POTENTIALLY_RELEVANT": 2,
        "Potentially Relevant": 2,
        "Likely Eligible": 2,
        "Additional Documents Required": 3,
        "INSUFFICIENT_INFORMATION": 4,
        "Additional Information Required": 4,
        "NOT_ELIGIBLE": 5,
        "Not Eligible": 5
      };
      const orderA = statusOrder[a.evaluation.statusCode] || statusOrder[a.evaluation.status] || 99;
      const orderB = statusOrder[b.evaluation.statusCode] || statusOrder[b.evaluation.status] || 99;
      return orderA - orderB;
    });

    await loadCheckerSavedIds();
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

  // Scheme Code to UUID mapping for checker bookmark resolution
  const CHECKER_SCHEME_CODE_TO_UUID = {
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

  const CHECKER_LEGACY_SLUG_TO_UUID = {
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

  function resolveCheckerSchemeUuid(identifier) {
    if (!identifier) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) return identifier;
    const upper = String(identifier).toUpperCase();
    if (CHECKER_SCHEME_CODE_TO_UUID[upper]) return CHECKER_SCHEME_CODE_TO_UUID[upper];
    const lower = String(identifier).toLowerCase();
    if (CHECKER_LEGACY_SLUG_TO_UUID[lower]) return CHECKER_LEGACY_SLUG_TO_UUID[lower];
    return null;
  }

  let checkerUserSavedIds = new Set();
  const inFlightCheckerBookmarks = new Set();

  function syncCheckerSavedIdsFromCache() {
    try {
      if (window.CrowdCitySavedSchemes?.getSavedIds) {
        const set = window.CrowdCitySavedSchemes.getSavedIds();
        if (set && set.size > 0) {
          checkerUserSavedIds = set;
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
          if (Array.isArray(arr) && arr.length > 0) {
            checkerUserSavedIds = new Set(arr);
          }
        }
      }
    } catch (e) {}
  }
  syncCheckerSavedIdsFromCache();

  if (window.CrowdCitySavedSchemes?.onStateChange) {
    window.CrowdCitySavedSchemes.onStateChange((newSet) => {
      checkerUserSavedIds = new Set(newSet);
    });
  }

  async function loadCheckerSavedIds() {
    try {
      if (window.CrowdCitySavedSchemes?.ensureHydrated) {
        const hydrated = await window.CrowdCitySavedSchemes.ensureHydrated();
        if (hydrated) {
          checkerUserSavedIds = new Set(hydrated);
          return checkerUserSavedIds;
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
                if (Array.isArray(arr) && arr.length > 0) {
                  checkerUserSavedIds = new Set(arr);
                }
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
              checkerUserSavedIds = freshSet;
              try {
                localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...checkerUserSavedIds]));
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {}
    return checkerUserSavedIds;
  }

  function isCheckerSchemeSaved(scheme) {
    if (!scheme) return false;
    if (window.CrowdCitySavedSchemes?.isSaved) {
      if (scheme.id && window.CrowdCitySavedSchemes.isSaved(scheme.id)) return true;
      if (scheme.scheme_code && window.CrowdCitySavedSchemes.isSaved(scheme.scheme_code)) return true;
    }
    if (scheme.id && checkerUserSavedIds.has(scheme.id)) return true;
    if (scheme.scheme_code && checkerUserSavedIds.has(scheme.scheme_code)) return true;
    if (scheme.scheme_code && checkerUserSavedIds.has(scheme.scheme_code.toLowerCase())) return true;
    const resolved = resolveCheckerSchemeUuid(scheme.id || scheme.scheme_code);
    if (resolved && (checkerUserSavedIds.has(resolved) || (window.CrowdCitySavedSchemes?.isSaved && window.CrowdCitySavedSchemes.isSaved(resolved)))) return true;
    return false;
  }

  function renderResultsUI(schemes, userProfile) {
    const resultsContainer = document.getElementById('checker-results-list');
    const matchedCountElem = document.getElementById('matched-count-number');
    const summarySubtext = document.getElementById('checker-results-summary-subtext');
    
    // Count ONLY schemes where all mandatory criteria are satisfied ("Eligible") — NO FALSE ELIGIBILITY
    const eligibleSchemes = schemes.filter(s => s.evaluation.statusCode === "ELIGIBLE");
    const potentiallyRelevantSchemes = schemes.filter(s => s.evaluation.statusCode === "POTENTIALLY_RELEVANT" || s.evaluation.status === "Potentially Relevant");
    const infoRequiredSchemes = schemes.filter(s => s.evaluation.statusCode === "INSUFFICIENT_INFORMATION" || s.evaluation.status === "Additional Information Required" || s.evaluation.status === "Additional Documents Required");
    const notEligibleSchemes = schemes.filter(s => s.evaluation.statusCode === "NOT_ELIGIBLE" || s.evaluation.status === "Not Eligible");

    const currentLang = (window.i18n ? window.i18n.getLanguage() : (localStorage.getItem('crowdcity_language') || localStorage.getItem('cc_lang') || localStorage.getItem('preferred_language') || 'ta'));
    const isTamil = (currentLang === 'ta');

    if (matchedCountElem) matchedCountElem.textContent = eligibleSchemes.length;
    if (summarySubtext) {
      const parts = [];
      parts.push(`${eligibleSchemes.length} ${isTamil ? 'தகுதியுடையவை' : 'Eligible'}`);
      if (potentiallyRelevantSchemes.length > 0) {
        parts.push(`${potentiallyRelevantSchemes.length} ${isTamil ? 'பொருத்தமாக இருக்கக்கூடும்' : 'Potentially Relevant'}`);
      }
      if (infoRequiredSchemes.length > 0) {
        parts.push(`${infoRequiredSchemes.length} ${isTamil ? 'கூடுதல் தகவல் தேவை' : 'Require Additional Information'}`);
      }
      parts.push(`${notEligibleSchemes.length} ${isTamil ? 'தகுதி இல்லை' : 'Not Eligible'}`);

      summarySubtext.textContent = `${parts.join(' • ')} (${isTamil ? 'இறுதி முடிவு சம்பந்தப்பட்ட அரசுத் துறையையே சார்ந்தது' : 'Final decision rests with the respective government department'}).`;
    }

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

    resultsContainer.innerHTML = schemes.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const evalData = scheme.evaluation;
      
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
        statusText = isTamil ? "கூடுதல் தகவல் தேவை" : "Additional Info Required";
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

          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 0.75rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department_name || scheme.department}
          </p>

          ${scheme.benefits_summary ? `
          <div style="background: rgba(13, 148, 136, 0.06); border-left: 3px solid var(--primary, #0d9488); padding: 0.65rem 0.9rem; border-radius: 6px; margin-bottom: 1.15rem; font-size: 0.84rem; color: var(--text-main);">
            <strong style="color: var(--primary, #0d9488);">${isTamil ? 'திட்டப் பயன்:' : 'Benefit:'}</strong> ${scheme.benefits_summary}
          </div>
          ` : ''}

          <!-- Collapsible Explanation Panel -->
          <div class="ai-explanation-box" style="background: linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(99, 102, 241, 0.05)); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem;">
            
            <!-- Metadata & Sources Trust Section -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.85rem; border-radius: 10px; margin-bottom: 1rem; font-size: 0.78rem;">
              <div>
                <span style="color: var(--text-muted); display: block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">${isTamil ? 'அதிகாரப்பூர்வ மூலம்' : 'Official Source'}</span>
                <span style="color: var(--text-main); font-weight: 800;"><i class="fa-solid fa-server" style="color: var(--primary); margin-right: 0.25rem;"></i>${scheme.data_source || 'Official Government Portal'}</span>
              </div>
              <div>
                <span style="color: var(--text-muted); display: block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">${isTamil ? 'கடைசியாக சரிபார்க்கப்பட்டது' : 'Last Verified'}</span>
                <span style="color: var(--text-main); font-weight: 800;"><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 0.25rem;"></i>${scheme.last_verified_date ? new Date(scheme.last_verified_date).toLocaleDateString(isTamil ? 'ta-IN' : 'en-US', {year: 'numeric', month: 'short', day: 'numeric'}) : 'Official Seed Rules'}</span>
              </div>
              <div>
                <span style="color: var(--text-muted); display: block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">${isTamil ? 'திட்டக் குறியீடு' : 'Scheme Code'}</span>
                <span style="color: var(--text-main); font-weight: 800;"><i class="fa-solid fa-file-contract" style="color: #6366f1; margin-right: 0.25rem;"></i>${scheme.scheme_code || scheme.official_notification_number || scheme.id}</span>
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
                ${isTamil ? 'இந்த திட்டம் ஏன் பொருந்தியது / தகுதி நிபந்தனைகள்' : 'Why This Scheme Matched (Scheme-Specific Criteria)'}
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

                <!-- Departmental Verification Notes -->
                ${(evalData.verificationNotes || []).map(note => `
                  <li style="margin-bottom: 0.4rem; display: flex; align-items: flex-start; gap: 0.4rem; color: #475569;">
                    <i class="fa-solid fa-circle-info" style="margin-top: 0.2rem; flex-shrink: 0; color: #3b82f6;"></i>
                    <span>${note}</span>
                  </li>
                `).join('')}
              </ul>
            </div>

            <!-- Detailed Document Verification Checklist -->
            <div style="border-top: 1px dashed rgba(13, 148, 136, 0.15); padding-top: 0.85rem;">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
                ${isTamil ? 'தேவையான ஆவணங்கள் / சான்றிதழ் சரிபார்ப்பு' : 'Required Documents & Wallet Status'}
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

                <!-- Required / Unuploaded Docs -->
                ${evalData.missingDocsList.map(name => `
                  <span style="font-size: 0.72rem; background: rgba(107, 114, 128, 0.08); border: 1px solid #9ca3af; padding: 0.2rem 0.5rem; border-radius: 6px; color: #4b5563; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fa-solid fa-file-lines"></i> ${name} (${isTamil ? 'விண்ணப்பிக்கும்போது தேவை' : 'Required at Application'})
                  </span>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- Professional Assessment Disclaimer -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.75rem; color: var(--text-muted); line-height: 1.45;">
            <i class="fa-solid fa-shield-halved" style="color: var(--primary); margin-right: 0.4rem; font-size: 0.85rem;"></i>
            <span>${isTamil 
              ? 'வழங்கப்பட்ட தகவல்களின் அடிப்படையில் இந்த திட்டம் பொருத்தமானதாகத் தோன்றுகிறது. இறுதி தகுதி மற்றும் ஒப்புதல் சம்பந்தப்பட்ட அரசுத் துறையின் அதிகாரப்பூர்வ சரிபார்ப்புக்கு உட்பட்டது.' 
              : 'Based on the information provided, this scheme assessment reflects official scheme rules. CrowdCity AI is an informational portal; final eligibility decision rests with the concerned Government Authority.'}</span>
          </div>

          <!-- Card Actions -->
          <div style="display: flex; gap: 0.65rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
            ${(() => {
              const saved = isCheckerSchemeSaved(scheme);
              const tSave = isTamil ? 'சேமிக்கவும்' : 'Save Scheme';
              const tSaved = isTamil ? 'சேமிக்கப்பட்டது' : 'Saved';
              return `
                <button type="button" class="btn btn-save-scheme ${saved ? 'is-saved' : ''}" data-scheme-id="${scheme.id}" data-scheme-code="${scheme.scheme_code || ''}" style="padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 700; background: ${saved ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}; border: 1px solid ${saved ? '#10b981' : 'var(--border-color)'}; color: ${saved ? '#10b981' : 'var(--text-main)'}; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;">
                  <i class="${saved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i> <span>${saved ? tSaved : tSave}</span>
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
            
            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-size: 0.82rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 10px;">
              <span>${isTamil ? 'விண்ணப்பிக்க' : 'Official Apply'}</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Attach bookmark handlers
    document.querySelectorAll('.btn-save-scheme').forEach(btn => {
      btn.addEventListener('click', async () => {
        const schemeId = btn.dataset.schemeId || btn.dataset.schemeCode;
        await handleSaveScheme(schemeId, btn);
      });
    });

    // Translate dynamic elements if i18n is loaded
    if (window.i18n && typeof window.i18n.updatePageTranslations === 'function') {
      window.i18n.updatePageTranslations();
    }
  }

  async function handleSaveScheme(schemeId, buttonElem) {
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
        if (window.showToast) window.showToast("Please sign in to save schemes to your bookmarks.", "info");
        return;
      }
      if (res.action === 'saved') {
        updateBtn(true);
        if (window.showToast) window.showToast("Saved scheme to your bookmarks!", "success");
      } else if (res.action === 'already_saved') {
        updateBtn(true);
        if (window.showToast) window.showToast("Scheme is already saved in your bookmarks!", "info");
      } else if (res.action === 'removed') {
        updateBtn(false);
        if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
      } else {
        updateBtn(res.isSaved);
        if (window.showToast) window.showToast("Failed to update bookmark. Please try again.", "error");
      }
      return;
    }

    const targetUuid = resolveCheckerSchemeUuid(schemeId);
    if (!targetUuid) {
      if (window.showToast) window.showToast("Could not bookmark scheme. Invalid scheme reference.", "error");
      return;
    }

    if (inFlightCheckerBookmarks.has(targetUuid)) return;
    inFlightCheckerBookmarks.add(targetUuid);

    try {
      if (typeof window.getOrInitSupabaseClient !== 'function') {
        if (window.showToast) window.showToast("Please sign in to save schemes to your bookmarks.", "info");
        return;
      }

      const client = await window.getOrInitSupabaseClient();
      if (!client) {
        if (window.showToast) window.showToast("Please sign in to save schemes to your bookmarks.", "info");
        return;
      }

      const session = await client.auth.getSession();
      const userId = session?.data?.session?.user?.id;
      if (!userId) {
        if (window.showToast) window.showToast("Please sign in to save schemes to your bookmarks.", "info");
        return;
      }

      const isCurrentlySaved = checkerUserSavedIds.has(targetUuid) || (buttonElem && buttonElem.classList.contains('is-saved'));

      if (isCurrentlySaved) {
        const { error: delErr } = await client
          .from('saved_schemes')
          .delete()
          .eq('user_id', userId)
          .eq('scheme_id', targetUuid);

        if (!delErr) {
          checkerUserSavedIds.delete(targetUuid);
          updateBtn(false);
          if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
        } else {
          if (window.showToast) window.showToast("Failed to remove bookmark. Please try again.", "error");
        }
      } else {
        const { error: insErr } = await client
          .from('saved_schemes')
          .insert({ user_id: userId, scheme_id: targetUuid });

        if (!insErr || insErr.code === '23505') {
          checkerUserSavedIds.add(targetUuid);
          updateBtn(true);
          if (window.showToast) window.showToast(insErr?.code === '23505' ? "Scheme is already saved in your bookmarks!" : "Saved scheme to your bookmarks!", "success");
        } else {
          if (window.showToast) window.showToast("Failed to save scheme. Please try again.", "error");
        }
      }
    } catch (err) {
      console.warn("Handle save scheme error:", err);
      if (window.showToast) window.showToast("Could not update bookmark.", "error");
    } finally {
      inFlightCheckerBookmarks.delete(targetUuid);
    }
  }

  function restoreSessionProfile() {
    try {
      // Ensure gender always starts at the placeholder ("Select your gender") unless explicitly selected in a v3 session
      const genderSelect = document.getElementById('check-gender');
      if (genderSelect) {
        genderSelect.value = '';
      }

      const stored = sessionStorage.getItem('cc_scheme_checker_profile');
      if (!stored) return;

      const profile = JSON.parse(stored);
      // Purge legacy session data that may have silently auto-defaulted gender to 'female'
      if (!profile || profile.schemaVersion !== 'v3') {
        sessionStorage.removeItem('cc_scheme_checker_profile');
        return;
      }

      const ageInput = document.getElementById('check-age');
      if (ageInput && profile.age !== undefined && profile.age !== null && profile.age !== '') {
        ageInput.value = profile.age;
      }
      if (profile.explicitlySelectedGender && profile.gender && genderSelect) {
        genderSelect.value = profile.gender;
      }
      if (profile.district) {
        const districtSelect = document.getElementById('check-district');
        if (districtSelect) districtSelect.value = profile.district;
      }
      if (profile.occupation) {
        const occupationSelect = document.getElementById('check-occupation');
        if (occupationSelect) occupationSelect.value = profile.occupation;
      }
      if (profile.income !== undefined && profile.income !== null && profile.income !== '') {
        const incomeInput = document.getElementById('check-income');
        if (incomeInput) incomeInput.value = profile.income;
      }
      if (profile.govSchoolStudied !== undefined && profile.govSchoolStudied !== null) {
        const govSchoolSelect = document.getElementById('check-gov-school');
        if (govSchoolSelect) govSchoolSelect.value = String(profile.govSchoolStudied);
      }
      if (profile.institutionType) {
        const instSelect = document.getElementById('check-institution-type');
        if (instSelect) instSelect.value = profile.institutionType;
      }
      if (profile.degree) {
        const degreeSelect = document.getElementById('check-degree');
        if (degreeSelect) degreeSelect.value = profile.degree;
      }
      if (profile.socialCategory) {
        const socialSelect = document.getElementById('check-social-category');
        if (socialSelect) socialSelect.value = profile.socialCategory;
      }
      const studentCb = document.getElementById('check-student');
      if (studentCb && profile.isStudent !== undefined) studentCb.checked = Boolean(profile.isStudent);
      const farmerCb = document.getElementById('check-farmer');
      if (farmerCb && profile.isFarmer !== undefined) farmerCb.checked = Boolean(profile.isFarmer);
      const seniorCb = document.getElementById('check-senior');
      if (seniorCb && profile.isSenior !== undefined) seniorCb.checked = Boolean(profile.isSenior);
      const disCb = document.getElementById('check-disability');
      if (disCb && profile.isDisability !== undefined) disCb.checked = Boolean(profile.isDisability);
      const widowCb = document.getElementById('check-widow');
      if (widowCb && profile.isWidow !== undefined) widowCb.checked = Boolean(profile.isWidow);
    } catch (e) {
      console.warn("Could not restore session profile:", e);
    }
  }

  // Expose engine for testing and cross-page consistency
  if (typeof window !== 'undefined') {
    window.CrowdCitySchemeEngine = {
      evaluateEligibility,
      getFallbackSeedSchemes,
      getFormData,
      validateStep
    };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
    // Restrict age input to non-negative whole integers (0 to 120)
    const ageInput = document.getElementById('check-age');
    if (ageInput) {
      ageInput.addEventListener('keydown', (e) => {
        if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) {
          e.preventDefault();
        }
      });

      ageInput.addEventListener('input', (e) => {
        let val = e.target.value;
        val = val.replace(/[^0-9]/g, '');
        if (val !== '' && parseInt(val, 10) > 120) {
          val = '120';
        }
        e.target.value = val;
      });
    }

    // Restore active v3 session entered profile values (never auto-selects Female)
    restoreSessionProfile();

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
        try {
          sessionStorage.removeItem('cc_scheme_checker_profile');
        } catch (e) {}
        if (ageInput) ageInput.value = '';
        const genderSelect = document.getElementById('check-gender');
        if (genderSelect) genderSelect.value = '';
        const districtSelect = document.getElementById('check-district');
        if (districtSelect) districtSelect.value = '';
        const occupationSelect = document.getElementById('check-occupation');
        if (occupationSelect) occupationSelect.value = '';
        const govSchoolSelect = document.getElementById('check-gov-school');
        if (govSchoolSelect) govSchoolSelect.value = '';
        const instSelect = document.getElementById('check-institution-type');
        if (instSelect) instSelect.value = 'none';
        const degreeSelect = document.getElementById('check-degree');
        if (degreeSelect) degreeSelect.value = 'none';
        const socialSelect = document.getElementById('check-social-category');
        if (socialSelect) socialSelect.value = 'all';
        ['check-student', 'check-farmer', 'check-senior', 'check-disability', 'check-widow'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.checked = false;
        });
        currentStep = 1;
        updateStepUI();
        if (window.showToast) window.showToast("Form reset successfully.", "info");
      });
    }
  });
  }

})();
