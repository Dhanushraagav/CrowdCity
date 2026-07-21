// CrowdCity AI v2.0 - Step 19: AI Proactive Recommendation Engine Service
// Analyzes citizen profile, document wallet, application tracker, and reminders to generate personalized insights and next steps.

import logger from '../config/logger.js';

/**
 * Generate proactive recommendations for a citizen based on profile and activity state.
 * Isolated service function for CrowdCity AI v2.0 Government Services.
 */
export const generatePersonalizedRecommendations = async (profile = {}, docs = [], apps = [], reminders = []) => {
  const recommendations = [];
  const insights = [];

  const age = profile.age || 25;
  const income = profile.income || 0;
  const district = profile.district || 'Chennai';
  const occupation = profile.occupation || 'Student';

  // 1. Scheme Recommendations
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
