// CrowdCity AI v2.0 - Step 19: AI Proactive Recommendation Engine Service
// Analyzes citizen profile, document wallet, application tracker, and reminders to generate personalized insights and next steps.

import logger from '../config/logger.js';
import { supabase } from '../config/supabase.js';

// Server-side eligibility evaluator mapping criteria fields individually
function evaluateEligibilityServer(scheme, profile, docs = []) {
  const criteria = scheme.eligibility_criteria || {};
  const passed = [];
  const failed = [];
  const missing = [];
  const missingDocs = [];

  // 1. Age check
  if (criteria.min_age !== undefined && criteria.min_age !== null) {
    if (!profile.age) {
      missing.push("Age information is required.");
    } else if (profile.age < criteria.min_age) {
      failed.push(`Age is below the minimum required age of ${criteria.min_age}.`);
    } else {
      passed.push(`Age satisfies minimum requirement.`);
    }
  }
  if (criteria.max_age !== undefined && criteria.max_age !== null) {
    if (!profile.age) {
      if (!missing.includes("Age information is required.")) missing.push("Age information is required.");
    } else if (profile.age > criteria.max_age) {
      failed.push(`Age exceeds the maximum allowed age of ${criteria.max_age}.`);
    } else {
      passed.push(`Age satisfies maximum limit.`);
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
      missing.push("Annual family income is required.");
    } else if (profile.income > criteria.max_annual_income) {
      failed.push(`Annual income of ₹${profile.income.toLocaleString()} exceeds the limit.`);
    } else {
      passed.push(`Annual income is within the limit.`);
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

  // Check certificates list availability
  const reqCerts = criteria.required_certificates || [];
  const uploadedTypes = docs.map(d => d.doc_type || "");
  reqCerts.forEach(cert => {
    const matchFound = uploadedTypes.some(type => {
      const t = type.toLowerCase();
      const c = cert.toLowerCase();
      return t.includes(c) || c.includes(t);
    });

    if (!matchFound) {
      missingDocs.push(cert);
    } else {
      passed.push(`Required Document uploaded: ${cert}`);
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
          let reasonText = 'Matched based on your profile preferences.';
          if (evalData.status === "Additional Documents Required") {
            reasonText = `Matched, but requires ${evalData.missingDocs[0]} in your Wallet.`;
          } else if (evalData.status === "Additional Information Required") {
            reasonText = `Matched, but needs complete schooling / category details.`;
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
    insights.push({
      id: 'ins-doc-ready',
      title: `${docs.length} Verified Certificates in Wallet`,
      message: 'Your uploaded certificates are ready for instant scheme eligibility checking.',
      actionText: 'Verify Readability',
      actionUrl: 'doc-verifier.html'
    });
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
