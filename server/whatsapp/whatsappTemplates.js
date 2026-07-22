// CrowdCity AI v2.3 - WhatsApp Notification Templates (Student Project Edition)
// Professional templates configured in English and Tamil. No emojis, minimal, official government format.

export const templates = {
  // 1. Complaint Created
  complaint_created: {
    en: (data) => `CrowdCity AI Notification
-----------------------------
Hello ${data.name || 'Citizen'},

Your civic complaint has been registered successfully.
Complaint ID: ${data.complaint_id}
Category: ${data.category}
Status: Registered / Pending Verification

You can track your complaint status in real-time on CrowdCity AI.
Thank you for helping improve your community.`,
    ta: (data) => `நகர மக்கள் விழிப்புணர்வு செய்தி
-----------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

தங்களின் புகார் வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளது.
புகார் எண்: ${data.complaint_id}
வகை: ${data.category}
நிலை: பதிவு செய்யப்பட்டுள்ளது / சரிபார்ப்பில் உள்ளது

உங்கள் புகாரின் நிலையை அறிய நகர மக்கள் விழிப்புணர்வு (CrowdCity AI) செயலியைப் பார்க்கவும்.`
  },

  // 2. Complaint Status Updated
  complaint_status_updated: {
    en: (data) => `CrowdCity AI Notification
-----------------------------
Hello ${data.name || 'Citizen'},

Your complaint status has been updated.
Complaint ID: ${data.complaint_id}
New Status: ${data.status}
Assigned Department: ${data.department || 'N/A'}

View detailed remarks inside the CrowdCity AI portal.`,
    ta: (data) => `நகர மக்கள் விழிப்புணர்வு செய்தி
-----------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

தங்கள் புகாரின் தற்போதைய நிலை புதுப்பிக்கப்பட்டுள்ளது.
புகார் எண்: ${data.complaint_id}
புதிய நிலை: ${data.status}
ஒதுக்கப்பட்ட துறை: ${data.department || 'N/A'}

கூடுதல் விவரங்களை அறிய CrowdCity AI இணையதளத்தில் பார்க்கவும்.`
  },

  // 3. Complaint Resolved
  complaint_resolved: {
    en: (data) => `CrowdCity AI Notification
-----------------------------
Hello ${data.name || 'Citizen'},

Your complaint has been successfully resolved.
Complaint ID: ${data.complaint_id}
Resolution Remarks: ${data.remarks || 'Issues resolved by municipal department.'}

If you are satisfied, please rate the resolution on your dashboard.
Thank you for your civic contribution.`,
    ta: (data) => `நகர மக்கள் விழிப்புணர்வு செய்தி
-----------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

தங்கள் புகார் வெற்றிகரமாக தீர்க்கப்பட்டுள்ளது.
புகார் எண்: ${data.complaint_id}
முடிவு விவரம்: ${data.remarks || 'சம்பந்தப்பட்ட நகராட்சி துறையால் தீர்க்கப்பட்டது.'}

செயல்பாட்டை மதிப்பிட தங்கள் CrowdCity AI பக்கத்தைப் பார்வையிடவும்.`
  },

  // 4. Government Application Submitted
  application_submitted: {
    en: (data) => `CrowdCity AI - Government Services
---------------------------------
Hello ${data.name || 'Citizen'},

Your application for ${data.scheme_name} has been submitted.
Application ID: ${data.application_id}
Status: Under Department Review

You will receive updates once verification is completed.`,
    ta: (data) => `அரசு சேவைகள் - CrowdCity AI
---------------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

${data.scheme_name} திட்டத்திற்கான விண்ணப்பம் சமர்ப்பிக்கப்பட்டது.
விண்ணப்ப எண்: ${data.application_id}
நிலை: தகுதி சரிபார்ப்பில் உள்ளது

முடிவுகள் கிடைத்தவுடன் தங்களுக்கு அறிவிக்கப்படும்.`
  },

  // 5. Government Application Approved
  application_approved: {
    en: (data) => `CrowdCity AI - Government Services
---------------------------------
Hello ${data.name || 'Citizen'},

Your application for ${data.scheme_name} has been approved.
Application ID: ${data.application_id}
Status: Approved

Benefits will be disbursed as per department guidelines.
Log in to CrowdCity AI to view sanction details.`,
    ta: (data) => `அரசு சேவைகள் - CrowdCity AI
---------------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

${data.scheme_name} திட்டத்திற்கான விண்ணப்பம் அங்கீகரிக்கப்பட்டது.
விண்ணப்ப எண்: ${data.application_id}
நிலை: அங்கீகரிக்கப்பட்டது (Approved)

இணையதளத்தில் தங்கள் ஒப்புதல் கடிதத்தைப் பதிவிறக்கவும்.`
  },

  // 6. Government Application Rejected
  application_rejected: {
    en: (data) => `CrowdCity AI - Government Services
---------------------------------
Hello ${data.name || 'Citizen'},

Your application for ${data.scheme_name} was rejected.
Application ID: ${data.application_id}
Reason: ${data.reason || 'Criteria mismatch or invalid document proof.'}

Please review guidelines and resubmit with correct documents.`,
    ta: (data) => `அரசு சேவைகள் - CrowdCity AI
---------------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

${data.scheme_name} திட்டத்திற்கான தங்கள் விண்ணப்பம் நிராகரிக்கப்பட்டது.
விண்ணப்ப எண்: ${data.application_id}
காரணம்: ${data.reason || 'விதிகள் பொருந்தவில்லை அல்லது தவறான ஆவணங்கள்.'}

விதிமுறைகளைச் சரிபார்த்து சரியான ஆவணங்களுடன் மீண்டும் விண்ணப்பிக்கவும்.`
  },

  // 7. Reminder Due
  reminder_due: {
    en: (data) => `CrowdCity AI Notification
-----------------------------
Reminder: Action Required

Title: ${data.title}
Description: ${data.description}
Due Date: ${data.due_date}

Please check your dashboard to complete this action.`,
    ta: (data) => `நகர மக்கள் விழிப்புணர்வு செய்தி
-----------------------------
நினைவூட்டல்: அவசர நடவடிக்கை தேவை

தலைப்பு: ${data.title}
விவரம்: ${data.description}
முடிவு தேதி: ${data.due_date}

தங்கள் நினைவூட்டல் பக்கத்தைப் பார்த்து உரிய நடவடிக்கை எடுக்கவும்.`
  },

  // 8. Document Expiry
  document_expired: {
    en: (data) => `CrowdCity AI - Document Wallet
--------------------------------
Hello ${data.name || 'Citizen'},

Your uploaded certificate (${data.document_name}) has expired.
Expired On: ${data.expiry_date}

Please update your Document Wallet with a valid renewal copy to maintain eligibility for welfare schemes.`,
    ta: (data) => `ஆவணப் பெட்டகம் - CrowdCity AI
--------------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

தாங்கள் பதிவேற்றிய சான்றிதழ் (${data.document_name}) காலாவதியாகிவிட்டது.
முடிந்த தேதி: ${data.expiry_date}

திட்டங்களுக்கான தகுதியைத் தக்கவைக்க புதிய சான்றிதழைப் பதிவேற்றவும்.`
  },

  // 9. Document Renewal Reminder
  document_renewal_warning: {
    en: (data) => `CrowdCity AI - Document Wallet
--------------------------------
Hello ${data.name || 'Citizen'},

Your uploaded certificate (${data.document_name}) expires in ${data.days_remaining || '15'} days.
Expiry Date: ${data.expiry_date}

Please renew this document to prevent scheme eligibility issues.`,
    ta: (data) => `ஆவணப் பெட்டகம் - CrowdCity AI
--------------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

தங்கள் சான்றிதழ் (${data.document_name}) இன்னும் ${data.days_remaining || '15'} நாட்களில் காலாவதியாகிறது.
காலாவதியாகும் தேதி: ${data.expiry_date}

திட்டத் தகுதி குறையாமல் இருக்க முன்கூட்டியே புதுப்பிக்கவும்.`
  },

  // 10. Government Scheme Match
  scheme_match: {
    en: (data) => `CrowdCity AI - New Scheme Match
--------------------------------
Congratulations ${data.name || 'Citizen'},

Based on your updated profile, you appear eligible for a new scheme:
Scheme Name: ${data.scheme_name}
Department: ${data.department}

Log in to your CrowdCity AI Citizen Services dashboard to view rules and apply.`,
    ta: (data) => `அரசு சேவைகள் - CrowdCity AI
--------------------------------
வணக்கம் ${data.name || 'குடிமகன்'},

தங்கள் சுயவிவரத்திற்குப் பொருந்தும் புதிய அரசு நலத்திட்டம் கண்டறியப்பட்டுள்ளது:
திட்டத்தின் பெயர்: ${data.scheme_name}
துறை: ${data.department}

விவரங்களைப் பார்க்க மற்றும் விண்ணப்பிக்க CrowdCity AI பக்கத்திற்குச் செல்லவும்.`
  },

  // 11. Admin Broadcast Announcement
  announcement_broadcast: {
    en: (data) => `CrowdCity AI - Public Notice
------------------------------
Broadcast Announcement:

Title: ${data.title}
Description: ${data.description}

Issued By: CrowdCity Administrator`,
    ta: (data) => `பொது அறிவிப்பு - CrowdCity AI
------------------------------
அரசு அறிவிப்பு:

தலைப்பு: ${data.title}
விவரம்: ${data.description}

வெளியீடு: CrowdCity நிர்வாகி`
  }
};
