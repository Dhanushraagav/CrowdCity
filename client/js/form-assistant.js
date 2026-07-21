// CrowdCity AI v2.0 - AI Form Filling Assistant JavaScript
// Features field-by-field guidance, explicit prefill consent, draft saving, validation, and review summary.

(function() {
  'use strict';

  let currentSchemeId = 'tn-kmut';
  let formDataDraft = {};

  const schemeFormsMap = {
    'tn-kmut': {
      name: 'Kalaignar Magalir Urimai Thittam Application',
      dept: 'Social Welfare & Women Empowerment Dept, Govt of TN',
      portal: 'https://kmut.tn.gov.in/',
      fields: [
        { id: 'applicant_name', label: 'Full Applicant Name', required: true, type: 'text', placeholder: 'Kavitha R', hint: 'Enter name exactly as printed on Smart Ration Card and Aadhaar Card.' },
        { id: 'smart_card_no', label: 'Smart Family Ration Card Number', required: true, type: 'text', placeholder: '03/N/0123456', hint: 'Family card number printed on top right corner of smart card.' },
        { id: 'aadhaar_no', label: 'Aadhaar Card Number', required: true, type: 'text', placeholder: '1234 5678 9012', hint: '12-digit Aadhaar number linked to your primary bank account.' },
        { id: 'bank_acc_no', label: 'Aadhaar-Linked Savings Bank Account Number', required: true, type: 'text', placeholder: '987654321012', hint: 'Active savings account for Direct Benefit Transfer (DBT).' },
        { id: 'ifsc_code', label: 'Bank IFSC Code', required: true, type: 'text', placeholder: 'SBIN0001234', hint: '11-character bank branch code printed on passbook.' },
        { id: 'eb_consumer_no', label: 'Electricity Consumer Connection Number', required: false, type: 'text', placeholder: '01-123-4567', hint: 'Home electricity service number for annual consumption verification.' }
      ]
    },
    'tn-pudhumai': {
      name: 'Pudhumai Penn Higher Education Assistance Form',
      dept: 'Social Welfare & Women Empowerment Dept, Govt of TN',
      portal: 'https://penkalvi.tn.gov.in/',
      fields: [
        { id: 'student_name', label: 'Female Student Full Name', required: true, type: 'text', placeholder: 'Divya M', hint: 'As printed on 10th/12th Marksheet.' },
        { id: 'school_emis_id', label: 'Government School EMIS Student ID', required: true, type: 'text', placeholder: '33021500101', hint: '11-digit EMIS number provided by your Government school.' },
        { id: 'college_name', label: 'Current Higher Education College / Institution', required: true, type: 'text', placeholder: 'Presidency College, Chennai', hint: 'Name of degree/diploma college enrolled in.' },
        { id: 'bank_acc_no', label: 'Student Savings Bank Account Number', required: true, type: 'text', placeholder: '987654321012', hint: 'Student direct bank account.' }
      ]
    },
    'central-pmkisan': {
      name: 'PM Kisan Samman Nidhi Farmer Registration Form',
      dept: 'Ministry of Agriculture, Govt of India',
      portal: 'https://pmkisan.gov.in/',
      fields: [
        { id: 'farmer_name', label: 'Farmer Full Name', required: true, type: 'text', placeholder: 'Murugan K', hint: 'As per land Patta and Aadhaar.' },
        { id: 'patta_no', label: 'Land Ownership Patta / Chitta Number', required: true, type: 'text', placeholder: 'Patta No. 1452', hint: 'Revenue land ownership patta reference.' },
        { id: 'district_name', label: 'Agricultural District', required: true, type: 'text', placeholder: 'Salem', hint: 'District where cultivable land is located.' }
      ]
    }
  };

  function getSchemeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('scheme') || 'tn-kmut';
  }

  function loadDraft() {
    try {
      const stored = localStorage.getItem(`cc_form_draft_${currentSchemeId}`);
      if (stored) formDataDraft = JSON.parse(stored);
    } catch (e) {}
  }

  function saveDraft() {
    try {
      localStorage.setItem(`cc_form_draft_${currentSchemeId}`, JSON.stringify(formDataDraft));
      if (window.showToast) window.showToast("Form draft saved successfully!", "info");
    } catch (e) {}
  }

  function prefillFromWalletAndProfile() {
    let profile = {};
    try {
      profile = JSON.parse(sessionStorage.getItem('cc_scheme_checker_profile') || '{}');
    } catch (e) {}

    const formDef = schemeFormsMap[currentSchemeId] || schemeFormsMap['tn-kmut'];

    formDef.fields.forEach(field => {
      const inputElem = document.getElementById(`field_${field.id}`);
      if (!inputElem) return;

      if (field.id.includes('name') && profile.fullName) {
        inputElem.value = profile.fullName;
        formDataDraft[field.id] = profile.fullName;
      } else if (field.id.includes('district') && profile.district) {
        inputElem.value = profile.district;
        formDataDraft[field.id] = profile.district;
      }
    });

    saveDraft();
    renderReviewSummary();
    if (window.showToast) window.showToast("Fields auto-prefilled from your profile!", "success");
  }

  function renderFormFields() {
    const container = document.getElementById('form-fields-container');
    const formDef = schemeFormsMap[currentSchemeId] || schemeFormsMap['tn-kmut'];

    if (!container) return;

    document.getElementById('form-title').textContent = formDef.name;
    document.getElementById('form-dept').textContent = formDef.dept;

    loadDraft();

    container.innerHTML = formDef.fields.map(field => {
      const val = formDataDraft[field.id] || '';

      return `
        <div class="form-field-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <label style="font-size: 0.95rem; font-weight: 800; color: var(--text-main);">
              ${field.label} ${field.required ? '<span style="color:#ef4444;">*</span>' : '<span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(Optional)</span>'}
            </label>
            <button type="button" class="btn-field-ai-help" data-field="${field.label}" style="background: rgba(13, 148, 136, 0.1); border: 1px solid rgba(13, 148, 136, 0.25); color: var(--primary); font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 8px; cursor: pointer;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> AI Guidance
            </button>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 0.85rem 0;">${field.hint}</p>

          <input id="field_${field.id}" type="${field.type}" class="form-control field-input-item" data-field-id="${field.id}" value="${val}" placeholder="${field.placeholder}" style="padding: 0.75rem 1rem; font-size: 0.9rem; border-radius: 10px; background: var(--bg-app); border: 1px solid var(--border-color); color: var(--text-main); width: 100%;" />
        </div>
      `;
    }).join('');

    // Field change listeners
    container.querySelectorAll('.field-input-item').forEach(inp => {
      inp.addEventListener('input', () => {
        const fieldId = inp.dataset.fieldId;
        formDataDraft[fieldId] = inp.value;
        renderReviewSummary();
      });
    });

    // AI guidance buttons
    container.querySelectorAll('.btn-field-ai-help').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fieldLabel = btn.dataset.field;
        await fetchFieldGuidance(fieldLabel);
      });
    });

    renderReviewSummary();
  }

  async function fetchFieldGuidance(fieldLabel) {
    const modal = document.getElementById('ai-guidance-modal');
    const content = document.getElementById('ai-guidance-content');

    if (modal) modal.style.display = 'flex';
    if (content) {
      content.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 0.75rem;"></i>
          <p style="font-size: 0.9rem; color: var(--text-muted);">AI Assistant looking up guidance for '${fieldLabel}'...</p>
        </div>
      `;
    }

    try {
      const res = await fetch('/api/ai/form-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeName: currentSchemeId, fieldName: fieldLabel })
      });
      const data = await res.json();
      if (data.success && data.guidance) {
        renderGuidanceModalContent(data.guidance, fieldLabel);
        return;
      }
    } catch (e) {}

    renderGuidanceModalContent({
      explanation: `Enter your official ${fieldLabel.toLowerCase()} exactly as printed on your government identity cards.`,
      whyRequired: "Required for identity verification and direct benefit transfer eligibility.",
      commonMistakes: ["Spelling mismatch between Ration Card and Aadhaar Card.", "Entering joint bank account without primary holder name."],
      exampleValue: "Sample Official Entry"
    }, fieldLabel);
  }

  function renderGuidanceModalContent(g, fieldLabel) {
    const content = document.getElementById('ai-guidance-content');
    if (!content) return;

    content.innerHTML = `
      <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0 0 1rem 0;">
        <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary);"></i> AI Guidance: ${fieldLabel}
      </h3>
      <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6; margin-bottom: 1rem;">${g.explanation}</p>
      
      <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Why This Field Is Required</div>
        <div style="font-size: 0.88rem; color: var(--text-main); font-weight: 600; margin-top: 0.2rem;">${g.whyRequired}</div>
      </div>

      <div style="margin-bottom: 1rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #ef4444; text-transform: uppercase; margin-bottom: 0.35rem;">Common Mistakes to Avoid</div>
        <ul style="padding-left: 1.2rem; margin: 0; font-size: 0.85rem; color: var(--text-main);">
          ${(g.commonMistakes || []).map(m => `<li style="margin-bottom: 0.3rem;">${m}</li>`).join('')}
        </ul>
      </div>

      <div style="font-size: 0.82rem; color: var(--text-muted);">
        <strong>Example Input:</strong> <code style="background: var(--bg-surface); padding: 0.2rem 0.4rem; border-radius: 4px;">${g.exampleValue}</code>
      </div>
    `;
  }

  function renderReviewSummary() {
    const formDef = schemeFormsMap[currentSchemeId] || schemeFormsMap['tn-kmut'];
    let completedCount = 0;

    formDef.fields.forEach(f => {
      if (formDataDraft[f.id] && formDataDraft[f.id].trim() !== '') {
        completedCount++;
      }
    });

    const readyElem = document.getElementById('review-ready-count');
    const portalBtn = document.getElementById('btn-portal-submit');

    if (readyElem) readyElem.textContent = `${completedCount} of ${formDef.fields.length} Fields Prepared`;
    if (portalBtn) {
      portalBtn.href = formDef.portal;
      portalBtn.target = '_blank';
      portalBtn.rel = 'noopener noreferrer';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    currentSchemeId = getSchemeIdFromUrl();
    renderFormFields();

    const prefillBtn = document.getElementById('btn-auto-prefill');
    if (prefillBtn) prefillBtn.addEventListener('click', prefillFromWalletAndProfile);

    const saveDraftBtn = document.getElementById('btn-save-draft');
    if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraft);

    const closeModalBtn = document.getElementById('btn-close-guidance-modal');
    const modal = document.getElementById('ai-guidance-modal');
    if (closeModalBtn && modal) {
      closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  });

})();
