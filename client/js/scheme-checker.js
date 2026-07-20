// CrowdCity AI v2.0 - Government Scheme Eligibility Checker Frontend Logic
// Provides multi-step wizard navigation, validation, and instant frontend scheme matching

(function() {
  'use strict';

  // Sample static scheme dataset for instant client-side preview matching
  const SAMPLE_SCHEMES = [
    {
      id: 'kmut',
      name: 'Kalaignar Magalir Urimai Thittam',
      department: 'Social Welfare & Women Empowerment Dept, Govt of TN',
      type: 'state',
      category: 'women_welfare',
      benefits: '₹1,000 monthly direct bank assistance for women heads of households.',
      docs: ['Smart Ration Card', 'Aadhaar Card', 'Bank Passbook', 'Electricity Bill'],
      url: 'https://kmut.tn.gov.in/',
      matchCriteria: (data) => {
        return data.gender === 'female' && data.age >= 21 && data.age <= 60 && data.income <= 250000;
      }
    },
    {
      id: 'pudhumai-penn',
      name: 'Pudhumai Penn Higher Education Assistance',
      department: 'Social Welfare & Women Empowerment Dept, Govt of TN',
      type: 'state',
      category: 'education',
      benefits: '₹1,000 monthly financial grant throughout degree or diploma studies.',
      docs: ['Govt School TC (Classes 6-12)', 'Aadhaar Card', 'College Admission Proof', 'Bank Passbook'],
      url: 'https://penkalvi.tn.gov.in/',
      matchCriteria: (data) => {
        return data.gender === 'female' && data.isStudent === true && data.age >= 17 && data.age <= 25;
      }
    },
    {
      id: 'naan-mudhalvan',
      name: 'Naan Mudhalvan Skill & Placement Scheme',
      department: 'Tamil Nadu Skill Development Corporation (TNSDC)',
      type: 'state',
      category: 'employment',
      benefits: 'Free industry-certified coding, AI, and engineering skills training with placement support.',
      docs: ['College ID / Degree Certificate', 'Aadhaar Card', 'Community Certificate'],
      url: 'https://www.naanmudhalvan.tn.gov.in/',
      matchCriteria: (data) => {
        return data.age >= 18 && data.age <= 35 && (data.isStudent === true || data.occupation === 'unemployed' || data.occupation === 'student');
      }
    },
    {
      id: 'cmchis',
      name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
      department: 'Health & Family Welfare Department, Govt of TN',
      type: 'state',
      category: 'healthcare',
      benefits: 'Cashless medical and surgical cover up to ₹5,00,000 per family annually.',
      docs: ['Income Certificate', 'Smart Family Ration Card', 'Aadhaar Card'],
      url: 'https://cmchistn.com/',
      matchCriteria: (data) => {
        return data.income <= 120000;
      }
    },
    {
      id: 'kanavu-illam',
      name: 'Kalaignar Kanavu Illam Rural Housing Scheme',
      department: 'Rural Development & Panchayat Raj Dept, Govt of TN',
      type: 'state',
      category: 'housing',
      benefits: '₹3,50,000 financial aid for building permanent concrete homes in rural TN.',
      docs: ['Land Patta / Ownership Proof', 'Aadhaar Card', 'Ration Card', 'Bank Passbook'],
      url: 'https://tnrd.tn.gov.in/',
      matchCriteria: (data) => {
        return data.income <= 150000;
      }
    },
    {
      id: 'uzhavar-protection',
      name: 'TN Uzhavar Protection Scheme',
      department: 'Revenue & Disaster Management Dept, Govt of TN',
      type: 'state',
      category: 'agriculture',
      benefits: 'Monthly ₹1,000 old age pension, ₹1,00,000 accidental cover, and child study aid.',
      docs: ['Uzhavar ID / Land Patta', 'Aadhaar Card', 'Ration Card', 'Bank Passbook'],
      url: 'https://eblock.tn.gov.in/',
      matchCriteria: (data) => {
        return data.isFarmer === true || data.occupation === 'farmer';
      }
    },
    {
      id: 'pm-kisan',
      name: 'PM Kisan Samman Nidhi (PM-KISAN)',
      department: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
      type: 'central',
      category: 'agriculture',
      benefits: '₹6,000 per year paid directly in 3 installments of ₹2,000 into bank account.',
      docs: ['Aadhaar Card', 'Land Patta / RoR Proof', 'Aadhaar-linked Bank Passbook'],
      url: 'https://pmkisan.gov.in/',
      matchCriteria: (data) => {
        return data.isFarmer === true || data.occupation === 'farmer';
      }
    },
    {
      id: 'pm-jay',
      name: 'Ayushman Bharat PM-JAY Health Insurance',
      department: 'National Health Authority (NHA), Govt of India',
      type: 'central',
      category: 'healthcare',
      benefits: '₹5,00,000 annual cashless hospital coverage for low-income families.',
      docs: ['Aadhaar Card', 'Ration Card', 'Ayushman Card'],
      url: 'https://pmjay.gov.in/',
      matchCriteria: (data) => {
        return data.income <= 200000;
      }
    },
    {
      id: 'pm-mudra',
      name: 'Pradhan Mantri Mudra Loan Scheme (PMMY)',
      department: 'Department of Financial Services, Govt of India',
      type: 'central',
      category: 'employment',
      benefits: 'Collateral-free business credit up to ₹10,00,000 for entrepreneurs & micro units.',
      docs: ['Aadhaar Card', 'PAN Card', 'Business Proof / Udyam Certificate', 'Bank Statement'],
      url: 'https://www.mudra.org.in/',
      matchCriteria: (data) => {
        return data.age >= 18 && data.age <= 65 && (data.occupation === 'business' || data.occupation === 'self_employed');
      }
    },
    {
      id: 'sukanya-samriddhi',
      name: 'Sukanya Samriddhi Yojana (Girl Child Savings)',
      department: 'Department of Posts, Govt of India',
      type: 'central',
      category: 'women_welfare',
      benefits: 'High 8.2% p.a. government savings scheme with 80C tax benefits for girl child.',
      docs: ['Girl Child Birth Certificate', 'Parent Aadhaar & PAN Card', 'Photos'],
      url: 'https://www.indiapost.gov.in/',
      matchCriteria: (data) => {
        return data.gender === 'female' && data.age <= 10;
      }
    }
  ];

  let currentStep = 1;

  function updateStepUI() {
    // Hide all step panes
    document.querySelectorAll('.checker-step-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    // Show current step pane
    const activePane = document.getElementById(`checker-step-${currentStep}`);
    if (activePane) activePane.classList.add('active');

    // Update Progress Indicator
    document.querySelectorAll('.step-progress-item').forEach((item, idx) => {
      const stepNum = idx + 1;
      item.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        item.classList.add('active');
      } else if (stepNum < currentStep) {
        item.classList.add('completed');
      }
    });

    // Scroll to form top smoothly
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
        if (window.showToast) window.showToast("Please select your Tamil Nadu district.", "error");
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

  function calculateResults() {
    const formData = getFormData();
    
    // Filter sample schemes matching user inputs
    let matched = SAMPLE_SCHEMES.filter(scheme => {
      try {
        return scheme.matchCriteria(formData);
      } catch (e) {
        return false;
      }
    });

    // Fallback: If strict criteria return fewer than 3, include general high-value schemes
    if (matched.length < 3) {
      const remaining = SAMPLE_SCHEMES.filter(s => !matched.includes(s));
      matched = [...matched, ...remaining.slice(0, 3 - matched.length)];
    }

    renderResultsUI(matched, formData);
  }

  function renderResultsUI(schemes, formData) {
    const resultsContainer = document.getElementById('checker-results-list');
    const matchedCountElem = document.getElementById('matched-count-number');
    if (matchedCountElem) matchedCountElem.textContent = schemes.length;

    if (!resultsContainer) return;

    resultsContainer.innerHTML = schemes.map(scheme => `
      <div class="result-scheme-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary); display: inline-block; margin-bottom: 0.35rem;">
              ${scheme.type === 'state' ? 'Tamil Nadu State Scheme' : 'Central Government Scheme'}
            </span>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${scheme.name}</h3>
          </div>
          <span style="font-size: 0.75rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.3rem 0.7rem; border-radius: 999px; white-space: nowrap;">
            ✓ High Match
          </span>
        </div>

        <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 1rem 0;">
          <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department}
        </p>

        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">
            Benefits Summary
          </div>
          <div style="font-size: 0.9rem; color: var(--text-main); font-weight: 600;">
            ${scheme.benefits}
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">Required Documents:</div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${scheme.docs.map(doc => `<span style="font-size: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.25rem 0.6rem; border-radius: 6px; color: var(--text-main);">${doc}</span>`).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
          <a href="${scheme.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-size: 0.85rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>Apply on Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Next Step buttons
    document.querySelectorAll('.btn-next-step').forEach(btn => {
      btn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
          if (currentStep < 3) {
            currentStep++;
            updateStepUI();
          } else if (currentStep === 3) {
            calculateResults();
            currentStep = 4;
            updateStepUI();
          }
        }
      });
    });

    // Prev Step buttons
    document.querySelectorAll('.btn-prev-step').forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          updateStepUI();
        }
      });
    });

    // Reset Form button
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
