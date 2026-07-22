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
    
    const verifiedDocs = [];
    const expiredDocs = [];
    const renewingDocs = [];
    const missingDocsList = [];

    const currentLang = localStorage.getItem('preferred_language') || 'en';
    const isTamil = (currentLang === 'ta');

    // 1. Age check
    if ((criteria.min_age !== undefined && criteria.min_age !== null) || (criteria.max_age !== undefined && criteria.max_age !== null)) {
      const min = criteria.min_age || 18;
      const max = criteria.max_age || 120;
      if (!profile.age) {
        missing.push(isTamil ? `? வயது விவரம் தேவை (வயது ${min}–${max}க்குள் இருக்க வேண்டும்)` : `? Age information still required (Must be between ${min}–${max})`);
      } else if (profile.age < min || profile.age > max) {
        failed.push(isTamil 
          ? `✗ வயது வரம்பு ${min}–${max}க்குள் இருக்க வேண்டும் (தற்போதைய வயது: ${profile.age})` 
          : `✗ Age must be between ${min}–${max} (Current: ${profile.age})`);
      } else {
        passed.push(isTamil 
          ? `✓ வயது ${min}–${max}க்குள் உள்ளது` 
          : `✓ Age between ${min}–${max}`);
      }
    }

    // 2. Gender check
    if (criteria.gender && criteria.gender !== 'all') {
      if (!profile.gender || profile.gender === 'all') {
        missing.push(isTamil ? "? பாலினம் விவரம் தேவை" : "? Gender information still required");
      } else if (profile.gender !== criteria.gender) {
        const expected = criteria.gender === 'female' ? (isTamil ? 'பெண்' : 'Female') : (isTamil ? 'ஆண்' : 'Male');
        failed.push(isTamil 
          ? `✗ பாலினம் ${expected} ஆக இருக்க வேண்டும்` 
          : `✗ Gender must be ${expected}`);
      } else {
        const genderVal = criteria.gender === 'female' ? (isTamil ? 'பெண்' : 'Female') : (isTamil ? 'ஆண்' : 'Male');
        passed.push(isTamil 
          ? `✓ பாலினம்: ${genderVal}` 
          : `✓ Gender is ${genderVal}`);
      }
    }

    // 3. Income check
    if (criteria.max_annual_income !== undefined && criteria.max_annual_income !== null) {
      if (profile.income === undefined || profile.income === null || profile.income === 0) {
        missing.push(isTamil 
          ? `? ஆண்டு வருமானம் விவரம் தேவை (₹${criteria.max_annual_income.toLocaleString('en-IN')}க்குள் இருக்க வேண்டும்)` 
          : `? Family income information still required (Must be under ₹${criteria.max_annual_income.toLocaleString('en-IN')})`);
      } else if (profile.income > criteria.max_annual_income) {
        failed.push(isTamil 
          ? `✗ ஆண்டு குடும்ப வருமானம் ₹${criteria.max_annual_income.toLocaleString('en-IN')}க்கு மேல் உள்ளது (தற்போதைய வருமானம்: ₹${profile.income.toLocaleString('en-IN')})` 
          : `✗ Family income exceeds ₹${criteria.max_annual_income.toLocaleString('en-IN')} (Current: ₹${profile.income.toLocaleString('en-IN')})`);
      } else {
        passed.push(isTamil 
          ? `✓ குடும்ப வருமானம் ₹${criteria.max_annual_income.toLocaleString('en-IN')}க்குள் உள்ளது` 
          : `✓ Family income is under ₹${criteria.max_annual_income.toLocaleString('en-IN')}`);
      }
    }

    // 4. Student status
    if (criteria.student_required) {
      if (!profile.isStudent && profile.occupation !== 'student') {
        failed.push(isTamil ? "✗ மாணவர் நிலை தேவை" : "✗ Enrolled Student status required");
      } else {
        passed.push(isTamil ? "✓ மாணவர் நிலை சரிபார்க்கப்பட்டது" : "✓ Enrolled Student status verified");
      }
    }

    // 5. Gov School studied
    if (criteria.gov_school_required) {
      if (profile.govSchoolStudied === undefined || profile.govSchoolStudied === null) {
        missing.push(isTamil ? "? அரசு பள்ளி கல்வி விவரம் தேவை" : "? Government school schooling information still required");
      } else if (!profile.govSchoolStudied) {
        failed.push(isTamil ? "✗ அரசு பள்ளியில் படித்திருக்க வேண்டும்" : "✗ Government School schooling required");
      } else {
        passed.push(isTamil ? "✓ அரசு பள்ளியில் படித்தது சரிபார்க்கப்பட்டது" : "✓ Studied in Government School");
      }
    }

    // 6. Gov College studied
    if (criteria.gov_college_required) {
      if (profile.govCollegeStudied === undefined || profile.govCollegeStudied === null) {
        missing.push(isTamil ? "? அரசு கல்லூரி கல்வி விவரம் தேவை" : "? Government college enrollment information still required");
      } else if (!profile.govCollegeStudied) {
        failed.push(isTamil ? "✗ அரசு கல்லூரியில் படித்திருக்க வேண்டும்" : "✗ Government College enrollment required");
      } else {
        passed.push(isTamil ? "✓ அரசு கல்லூரியில் படித்தது சரிபார்க்கப்பட்டது" : "✓ Enrolled in Government College");
      }
    }

    // 7. Disability status
    if (criteria.disability_required) {
      if (!profile.isDisability) {
        failed.push(isTamil ? "✗ மாற்றுத்திறனாளி தகுதி தேவை" : "✗ Differently-abled status required");
      } else {
        passed.push(isTamil ? "✓ மாற்றுத்திறனாளி தகுதி சரிபார்க்கப்பட்டது" : "✓ Differently-abled status satisfied");
      }
    }

    // 8. Widow / Single Parent status
    if (criteria.widow_required) {
      if (!profile.isWidow) {
        failed.push(isTamil ? "✗ விதவை அல்லது ஒற்றை பெற்றோர் தகுதி தேவை" : "✗ Widow / Single Parent status required");
      } else {
        passed.push(isTamil ? "✓ விதவை / ஒற்றை பெற்றோர் தகுதி சரிபார்க்கப்பட்டது" : "✓ Widow / Single Parent status satisfied");
      }
    }

    // 9. Farmer family status
    if (criteria.farmer_required) {
      if (!profile.isFarmer && profile.occupation !== 'farmer') {
        failed.push(isTamil ? "✗ விவசாயி தகுதி தேவை" : "✗ Farmer / Landholder family status required");
      } else {
        passed.push(isTamil ? "✓ விவசாயி தகுதி சரிபார்க்கப்பட்டது" : "✓ Farmer / Landholder family status verified");
      }
    }

    // 10. Residency state check
    if (criteria.native_state) {
      if (!profile.district) {
        missing.push(isTamil ? "? இருப்பிட/மாவட்ட விவரங்கள் தேவை" : "? Residency district information still required");
      } else {
        passed.push(isTamil 
          ? `✓ தமிழக இருப்பிட தகுதி (${profile.district} மாவட்டம்)` 
          : `✓ resident of ${criteria.native_state} (${profile.district} District)`);
      }
    }

    // 11. Cross-check documents & renewals
    const reqCerts = criteria.required_certificates || [];
    let uploadedDocs = [];
    try {
      const stored = localStorage.getItem('cc_user_uploaded_docs');
      if (stored) uploadedDocs = JSON.parse(stored);
    } catch (e) {}

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    reqCerts.forEach(cert => {
      const matchingUploaded = uploadedDocs.find(d => {
        const t = (d.doc_type || "").toLowerCase();
        const c = cert.toLowerCase();
        return t.includes(c) || c.includes(t);
      });

      if (!matchingUploaded) {
        missingDocsList.push(cert);
        missing.push(isTamil ? `? ${cert} ஆவணம் சமர்ப்பிக்கப்படவில்லை` : `? ${cert} not provided in document wallet`);
      } else {
        let isExpired = false;
        let isRenewalSoon = false;
        let expiryDateStr = "";

        if (matchingUploaded.expiry_date) {
          const exp = new Date(matchingUploaded.expiry_date);
          expiryDateStr = exp.toLocaleDateString(isTamil ? 'ta-IN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          if (exp < now) {
            isExpired = true;
          } else if (exp <= thirtyDaysFromNow) {
            isRenewalSoon = true;
          }
        }

        if (isExpired) {
          expiredDocs.push({ name: cert, expiry: expiryDateStr });
          failed.push(isTamil ? `✗ ${cert} காலாவதியாகிவிட்டது (முடிந்த தேதி: ${expiryDateStr})` : `✗ ${cert} is expired (Expired on ${expiryDateStr})`);
        } else if (isRenewalSoon) {
          renewingDocs.push({ name: cert, expiry: expiryDateStr });
          passed.push(isTamil ? `✓ ${cert} சரிபார்க்கப்பட்டது (ஆனால் புதுப்பிக்க வேண்டும்: ${expiryDateStr})` : `✓ ${cert} verified (But needs renewal soon: ${expiryDateStr})`);
        } else {
          verifiedDocs.push({ name: cert, expiry: expiryDateStr });
          passed.push(isTamil ? `✓ ${cert} ஆவணம் சரிபார்க்கப்பட்டது` : `✓ ${cert} provided and verified`);
        }
      }
    });

    // 12. Calculate Eligibility Status
    let status = "Eligible";
    if (failed.length > 0) {
      status = "Not Eligible";
    } else if (missing.length > 0) {
      status = "Additional Information Required";
    } else if (missingDocsList.length > 0) {
      status = "Additional Documents Required";
    } else {
      status = "Eligible";
    }

    // 13. Calculate Confidence Score / Rating
    let confidence = "High Confidence";
    const confidenceReasons = [];

    if (failed.length > 0) {
      confidence = "Needs Verification";
      confidenceReasons.push(isTamil ? "திட்ட தகுதி விதிகள் பொருந்தவில்லை" : "Eligibility criteria failed");
    } else if (missing.some(m => !m.includes("not provided") && !m.includes("சமர்ப்பிக்கப்படவில்லை"))) {
      confidence = "Needs Verification";
      confidenceReasons.push(isTamil ? "சுயவிவர தகவல் விடுபட்டுள்ளது" : "Missing profile information");
    } else if (expiredDocs.length > 0) {
      confidence = "Needs Verification";
      confidenceReasons.push(isTamil ? "காலாவதியான ஆவணங்கள் உள்ளன" : "Expired documents");
    }

    if (confidence !== "Needs Verification") {
      if (missingDocsList.length > 0) {
        confidence = "Medium Confidence";
        confidenceReasons.push(isTamil ? "கூடுதல் ஆவணங்கள் தேவை" : "Incomplete document verification");
      }
      if (renewingDocs.length > 0) {
        confidence = "Medium Confidence";
        confidenceReasons.push(isTamil ? "ஆவணங்கள் விரைவில் புதுப்பிக்கப்பட வேண்டும்" : "Documents needing renewal soon");
      }
      
      // Check if rules updated recently (within 7 days)
      if (scheme.updated_at) {
        const updateDate = new Date(scheme.updated_at);
        const diffTime = Math.abs(now - updateDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          confidence = "Medium Confidence";
          confidenceReasons.push(isTamil ? "திட்ட விதிகள் சமீபத்தில் புதுப்பிக்கப்பட்டன" : "Scheme rules recently updated");
        }
      }
    }

    return {
      status,
      passed,
      failed,
      missing,
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
      const evalData = scheme.evaluation || { status: 'Eligible', passed: [], failed: [], missing: [], verifiedDocs: [], expiredDocs: [], renewingDocs: [], missingDocsList: [], confidence: 'High Confidence', confidenceReasons: [] };
      
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

            <button class="btn-save-bookmark" data-id="${scheme.id}" style="padding: 0.6rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 0.4rem; background: transparent; cursor: pointer;">
              <i class="fa-regular fa-bookmark"></i>
              <span>${isTamil ? 'சேமிக்கவும்' : 'Save Scheme'}</span>
            </button>

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
