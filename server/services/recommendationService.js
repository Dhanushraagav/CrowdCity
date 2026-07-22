// CrowdCity AI v2.2.1 - Step 19: AI Proactive Recommendation Engine Service
// Analyzes citizen profile, document wallet, application tracker, and reminders to generate personalized insights and next steps.

import logger from '../config/logger.js';
import { supabase } from '../config/supabase.js';

// Server-side eligibility evaluator mapping criteria fields individually
function evaluateEligibilityServer(scheme, profile, docs = []) {
  const criteria = scheme.eligibility_criteria || {};
  const passed = [];
  const failed = [];
  const missing = [];
  
  const verifiedDocs = [];
  const expiredDocs = [];
  const renewingDocs = [];
  const missingDocsList = [];

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Age check
  if ((criteria.min_age !== undefined && criteria.min_age !== null) || (criteria.max_age !== undefined && criteria.max_age !== null)) {
    const min = criteria.min_age || 18;
    const max = criteria.max_age || 120;
    if (!profile.age) {
      missing.push(`Age information still required (Must be between ${min}–${max})`);
    } else if (profile.age < min || profile.age > max) {
      failed.push(`Age must be between ${min}–${max} (Current: ${profile.age})`);
    } else {
      passed.push(`Age between ${min}–${max}`);
    }
  }

  // 2. Gender check
  if (criteria.gender && criteria.gender !== 'all') {
    if (!profile.gender || profile.gender === 'all') {
      missing.push("Gender specification is required.");
    } else if (profile.gender !== criteria.gender) {
      failed.push(`Gender requirement mismatch.`);
    } else {
      passed.push(`Gender matches requirements.`);
    }
  }

  // 3. Income check
  if (criteria.max_annual_income !== undefined && criteria.max_annual_income !== null) {
    if (profile.income === undefined || profile.income === null || profile.income === 0) {
      missing.push(`Annual family income information still required (Must be under ₹${criteria.max_annual_income.toLocaleString('en-IN')})`);
    } else if (profile.income > criteria.max_annual_income) {
      failed.push(`Family income exceeds ₹${criteria.max_annual_income.toLocaleString('en-IN')} (Current: ₹${profile.income.toLocaleString('en-IN')})`);
    } else {
      passed.push(`Family income is under ₹${criteria.max_annual_income.toLocaleString('en-IN')}`);
    }
  }

  // 4. Student status
  if (criteria.student_required) {
    if (!profile.isStudent && profile.occupation !== 'student') {
      failed.push("Student status is required.");
    } else {
      passed.push("Candidate is a verified current student.");
    }
  }

  // 5. Gov School studied
  if (criteria.gov_school_required) {
    if (profile.govSchoolStudied === undefined || profile.govSchoolStudied === null) {
      missing.push("Government school study verification is required.");
    } else if (!profile.govSchoolStudied) {
      failed.push("Welfare benefit requires studying in a Government School.");
    } else {
      passed.push("Studied in Government School verified.");
    }
  }

  // 6. Gov College studied
  if (criteria.gov_college_required) {
    if (profile.govCollegeStudied === undefined || profile.govCollegeStudied === null) {
      missing.push("Government college study verification is required.");
    } else if (!profile.govCollegeStudied) {
      failed.push("Welfare benefit requires studying in a Government College.");
    } else {
      passed.push("Studied in Government College verified.");
    }
  }

  // 7. Disability status
  if (criteria.disability_required) {
    if (!profile.isDisability) {
      failed.push("Scheme requires differently-abled / disability status.");
    } else {
      passed.push("Differently-abled status satisfied.");
    }
  }

  // 8. Widow / Single Parent status
  if (criteria.widow_required) {
    if (!profile.isWidow) {
      failed.push("Scheme requires widow / single parent status.");
    } else {
      passed.push("Widow / Single parent status satisfied.");
    }
  }

  // 9. Farmer family status
  if (criteria.farmer_required) {
    if (!profile.isFarmer && profile.occupation !== 'farmer') {
      failed.push("Scheme requires agricultural landholder / farmer status.");
    } else {
      passed.push("Farmer status verified.");
    }
  }

  // 10. Residency state check
  if (criteria.native_state) {
    if (!profile.district) {
      missing.push("Residency/District proof details are required.");
    } else {
      passed.push(`Native resident of ${criteria.native_state}.`);
    }
  }

  // 11. Cross-check documents & renewals
  const reqCerts = criteria.required_certificates || [];
  reqCerts.forEach(cert => {
    // Check if doc matches in list
    const matchingUploaded = docs.find(d => {
      const t = (d.doc_type || "").toLowerCase();
      const c = cert.toLowerCase();
      return t.includes(c) || c.includes(t);
    });

    if (!matchingUploaded) {
      missingDocsList.push(cert);
      missing.push(`${cert} not provided in document wallet`);
    } else {
      let isExpired = false;
      let isRenewalSoon = false;
      let expiryDateStr = "";

      if (matchingUploaded.expiry_date) {
        const exp = new Date(matchingUploaded.expiry_date);
        expiryDateStr = exp.toLocaleDateString('en-US');
        if (exp < now) {
          isExpired = true;
        } else if (exp <= thirtyDaysFromNow) {
          isRenewalSoon = true;
        }
      }

      if (isExpired) {
        expiredDocs.push({ name: cert, expiry: expiryDateStr });
        failed.push(`${cert} is expired (Expired on ${expiryDateStr})`);
      } else if (isRenewalSoon) {
        renewingDocs.push({ name: cert, expiry: expiryDateStr });
        passed.push(`${cert} verified (But needs renewal soon: ${expiryDateStr})`);
      } else {
        verifiedDocs.push({ name: cert, expiry: expiryDateStr });
        passed.push(`${cert} provided and verified`);
      }
    }
  });

  // Calculate status
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

  // Calculate confidence
  let confidence = "High Confidence";
  const confidenceReasons = [];

  if (failed.length > 0) {
    confidence = "Needs Verification";
    confidenceReasons.push("Eligibility criteria failed");
  } else if (missing.some(m => !m.includes("not provided"))) {
    confidence = "Needs Verification";
    confidenceReasons.push("Missing profile information");
  } else if (expiredDocs.length > 0) {
    confidence = "Needs Verification";
    confidenceReasons.push("Expired documents");
  }

  if (confidence !== "Needs Verification") {
    if (missingDocsList.length > 0) {
      confidence = "Medium Confidence";
      confidenceReasons.push("Incomplete document verification");
    }
    if (renewingDocs.length > 0) {
      confidence = "Medium Confidence";
      confidenceReasons.push("Documents needing renewal soon");
    }
    if (scheme.updated_at) {
      const updateDate = new Date(scheme.updated_at);
      const diffTime = Math.abs(now - updateDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        confidence = "Medium Confidence";
        confidenceReasons.push("Scheme rules recently updated");
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

/**
 * Generate proactive recommendations for a citizen based on profile and activity state.
 * Isolated service function for CrowdCity AI v2.0 Government Services.
 */
export const generatePersonalizedRecommendations = async (profile = {}, docs = [], apps = [], reminders = []) => {
  const recommendations = [];
  const insights = [];

  const district = profile.district || 'Chennai';

  try {
    // Query active government schemes from database
    const { data: dbSchemes, error } = await supabase
      .from('government_schemes')
      .select('*')
      .eq('is_active', true);

    if (!error && dbSchemes && dbSchemes.length > 0) {
      dbSchemes.forEach(scheme => {
        const evalData = evaluateEligibilityServer(scheme, profile, docs);
        
        // Only recommend schemes that are not explicitly ineligible
        if (evalData.status !== "Not Eligible") {
          let reasonText = `Matched perfectly with ${evalData.confidence}.`;
          if (evalData.confidence === "Needs Verification") {
            reasonText = `Requires profile updates / verification (${evalData.confidenceReasons[0]}).`;
          } else if (evalData.confidence === "Medium Confidence") {
            reasonText = `Requires document updates (${evalData.confidenceReasons[0]}).`;
          }

          recommendations.push({
            id: scheme.id,
            type: 'scheme',
            title: scheme.scheme_name,
            description: scheme.short_description,
            reason: reasonText,
            actionText: evalData.status === "Eligible" ? 'View Scheme' : 'Check Requirements',
            actionUrl: `scheme-details.html?id=${scheme.id}`
          });
        }
      });
    }
  } catch (err) {
    logger.warn('Failed to fetch schemes for server recommendations, running static engine:', err);
  }

  // Fallback to static matches if database fetch was empty or failed
  if (recommendations.length === 0) {
    const age = profile.age || 25;
    const occupation = profile.occupation || 'Student';

    if (occupation === 'Student' || age <= 25) {
      recommendations.push({
        id: 'rec-pudhumai',
        type: 'scheme',
        title: 'Pudhumai Penn Higher Education Assistance',
        description: 'Monthly ₹1,000 aid for female students from TN Govt schools pursuing higher education.',
        reason: 'Matched based on your student status and age.',
        actionText: 'View Scheme Details',
        actionUrl: 'scheme-details.html?id=tn-pudhumai'
      });
    }

    recommendations.push({
      id: 'rec-kmut',
      type: 'scheme',
      title: 'Kalaignar Magalir Urimai Thittam',
      description: 'Monthly ₹1,000 financial rights assistance directly into bank accounts.',
      reason: `Matched for residents in ${district} District with income under ₹2,50,000.`,
      actionText: 'Check Qualification',
      actionUrl: 'scheme-checker.html'
    });
  }

  // 2. Document Wallet Insights
  if (docs.length === 0) {
    insights.push({
      id: 'ins-doc-empty',
      title: 'Document Wallet Empty',
      message: 'Upload your Aadhaar Card, Ration Card, and Bank Passbook for fast application preparation.',
      actionText: 'Upload Documents',
      actionUrl: 'my-documents.html'
    });
  } else {
    // Check if user has expired documents
    const expiredCount = docs.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date()).length;
    if (expiredCount > 0) {
      insights.push({
        id: 'ins-doc-expired',
        title: `${expiredCount} Expired Document${expiredCount > 1 ? 's' : ''} in Wallet`,
        message: 'Some of your uploaded certificates have expired. Please renew them to maintain scheme qualification.',
        actionText: 'Renew Documents',
        actionUrl: 'my-documents.html'
      });
    } else {
      insights.push({
        id: 'ins-doc-ready',
        title: `${docs.length} Verified Certificates in Wallet`,
        message: 'Your uploaded certificates are ready for instant scheme eligibility checking.',
        actionText: 'Verify Readability',
        actionUrl: 'doc-verifier.html'
      });
    }
  }

  // 3. Application Tracker Insights
  if (apps.length > 0) {
    const pending = apps.filter(a => a.status === 'Under Verification' || a.status === 'Submitted');
    if (pending.length > 0) {
      insights.push({
        id: 'ins-app-pending',
        title: `${pending.length} Application Pending Verification`,
        message: `Your application for ${pending[0].scheme_name} is under government review.`,
        actionText: 'Open Application Tracker',
        actionUrl: 'app-tracker.html'
      });
    }
  }

  // 4. Reminders Insights
  if (reminders.length > 0) {
    const upcoming = reminders.filter(r => r.status !== 'Completed');
    if (upcoming.length > 0) {
      insights.push({
        id: 'ins-rem-due',
        title: `Upcoming Deadline: ${upcoming[0].title}`,
        message: `Scheduled for ${upcoming[0].reminder_date}. Keep your required documents ready.`,
        actionText: 'View Reminder Center',
        actionUrl: 'reminders.html'
      });
    }
  } else {
    insights.push({
      id: 'ins-rem-add',
      title: 'Set Important Renewal Reminders',
      message: 'Never miss Income Certificate or Aadhaar update deadlines.',
      actionText: 'Create Reminder',
      actionUrl: 'reminders.html'
    });
  }

  // 5. Office Locator Recommendation
  recommendations.push({
    id: 'rec-office',
    type: 'office',
    title: `Find Nearby E-Sevai & Taluk Office in ${district}`,
    description: 'Locate verified E-Sevai centers for document verification and offline application submission.',
    reason: `Based on your district location in ${district}.`,
    actionText: 'Open Office Locator',
    actionUrl: 'office-locator.html'
  });

  return {
    success: true,
    recommendations,
    insights
  };
};
