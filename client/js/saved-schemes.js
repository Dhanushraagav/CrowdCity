// CrowdCity AI v2.0 - My Saved Schemes JavaScript
// Queries saved_schemes table for the logged-in user with save/remove capability

(function() {
  'use strict';

  const FALLBACK_SCHEMES = [
    {
      id: '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
      scheme_code: 'TN-KMUT-001',
      scheme_name: 'Kalaignar Magalir Urimai Thittam',
      department_name: 'Social Welfare & Women Empowerment Dept, TN',
      state_or_central: 'state',
      benefits_summary: 'Rs 1,000 monthly financial rights assistance directly into bank accounts of female heads of households.',
      required_documents: ['Smart Family Ration Card', 'Aadhaar Card', 'Active Bank Passbook'],
      official_portal_url: 'https://kmut.tn.gov.in/'
    },
    {
      id: '6edf49dc-795f-4369-b5ab-f72c24eddef8',
      scheme_code: 'TN-PUDHUMAI-002',
      scheme_name: 'Pudhumai Penn Scheme (Higher Education Assurance)',
      department_name: 'Higher Education Department, TN',
      state_or_central: 'state',
      benefits_summary: 'Rs 1,000 per month financial aid for girl students pursuing degree, diploma, or ITI courses.',
      required_documents: ['Govt School Study Certificate (Classes 6-12)', 'Aadhaar Card', 'College Admission Proof & ID', 'Bank Passbook'],
      official_portal_url: 'https://penkalvi.tn.gov.in/'
    },
    {
      id: 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
      scheme_code: 'TN-NM-003',
      scheme_name: 'Naan Mudhalvan Skill Development Scheme',
      department_name: 'Tamil Nadu Skill Development Corporation (TNSDC)',
      state_or_central: 'state',
      benefits_summary: 'Free technical skill training, AI & coding courses, language proficiency, and campus placement drives.',
      required_documents: ['Educational Qualification Marksheet', 'Aadhaar Card', 'College ID / Degree Certificate'],
      official_portal_url: 'https://www.naanmudhalvan.tn.gov.in/'
    },
    {
      id: '43e8ff6a-d3f3-4277-88f2-98c46491584e',
      scheme_code: 'TN-CMCHIS-004',
      scheme_name: 'Chief Minister Comprehensive Health Insurance Scheme (CMCHIS)',
      department_name: 'Health & Family Welfare Department, TN',
      state_or_central: 'state',
      benefits_summary: 'Cashless hospital treatment & surgical cover up to Rs 5,00,000 per family per year in empanelled hospitals.',
      required_documents: ['Smart Ration Card', 'Income Certificate from VAO', 'Aadhaar Cards of family members'],
      official_portal_url: 'https://cmchistn.com/'
    },
    {
      id: '43c6f25f-384b-4410-98ac-e747f0edeef7',
      scheme_code: 'TN-KKI-005',
      scheme_name: 'Kalaignar Kanavu Illam Housing Scheme',
      department_name: 'Social Welfare & Women Empowerment Dept, TN',
      state_or_central: 'state',
      benefits_summary: 'Financial assistance and support for safe housing and rural empowerment.',
      required_documents: ['House Site Patta', 'Aadhaar Card', 'Income Certificate', 'Ration Card'],
      official_portal_url: 'https://tnrd.tn.gov.in/'
    },
    {
      id: 'f0478621-f9c1-47c0-8306-af37d7ed5721',
      scheme_code: 'TN-UZHAVAR-006',
      scheme_name: 'TN Uzhavar Protection Scheme',
      department_name: 'Agriculture & Farmers Welfare Dept, TN',
      state_or_central: 'state',
      benefits_summary: 'Comprehensive social security, accident relief, scholarship for children of farmers, and pension support.',
      required_documents: ['Farmer Passbook / Uzhavar Card', 'Aadhaar Card', 'Land Adangal Extract'],
      official_portal_url: 'https://agritech.tnau.ac.in/'
    },
    {
      id: 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
      scheme_code: 'CENTRAL-PMKISAN-007',
      scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
      department_name: 'Ministry of Agriculture & Farmers Welfare',
      state_or_central: 'central',
      benefits_summary: 'Rs 6,000 per year direct income support paid in 3 equal installments of Rs 2,000 to landholding farmers.',
      required_documents: ['Land Patta / Ownership Record', 'Aadhaar Card', 'Aadhaar-linked Bank Account'],
      official_portal_url: 'https://pmkisan.gov.in/'
    },
    {
      id: 'd22faa80-2446-454f-8532-17429dcef2e6',
      scheme_code: 'CENTRAL-PMJAY-008',
      scheme_name: 'Ayushman Bharat PM-JAY',
      department_name: 'National Health Authority (NHA)',
      state_or_central: 'central',
      benefits_summary: 'Health cover of Rs 5,00,000 per family per year for secondary and tertiary care hospitalization across India.',
      required_documents: ['Aadhaar Card', 'Ration Card', 'PM-JAY Family Letter'],
      official_portal_url: 'https://pmjay.gov.in/'
    },
    {
      id: '5a00bef6-7053-4170-8604-8ac6b079a707',
      scheme_code: 'CENTRAL-PMMY-009',
      scheme_name: 'Pradhan Mantri Mudra Yojana (PMMY)',
      department_name: 'Ministry of Finance',
      state_or_central: 'central',
      benefits_summary: 'Collateral-free business loans up to Rs 10 Lakhs for micro-enterprises and small business owners.',
      required_documents: ['Business Proof', 'Identity Proof (Aadhaar)', 'Bank Account Statement'],
      official_portal_url: 'https://www.mudra.org.in/'
    },
    {
      id: '5b06ccf2-49a8-40db-99fb-b3f8fb3affe4',
      scheme_code: 'CENTRAL-SSY-010',
      scheme_name: 'Sukanya Samriddhi Yojana (Girl Child Savings)',
      department_name: 'Ministry of Finance & Department of Posts',
      state_or_central: 'central',
      benefits_summary: 'High-interest tax-exempt savings scheme for girl children up to age 10 with guaranteed returns.',
      required_documents: ['Child Birth Certificate', 'Parent Aadhaar Card', 'Address Proof'],
      official_portal_url: 'https://www.indiapost.gov.in/'
    },
    {
      id: '23914f21-21a9-4695-8784-680a9577879c',
      scheme_code: 'CENTRAL-PMAY-011',
      scheme_name: 'Pradhan Mantri Awas Yojana (PMAY)',
      department_name: 'Ministry of Housing and Urban Affairs',
      state_or_central: 'central',
      benefits_summary: 'Direct financial subsidy up to Rs 2.67 Lakhs on housing loans for first-time home buyers.',
      required_documents: ['Income Certificate', 'Aadhaar Card', 'Affidavit of No Pucca House'],
      official_portal_url: 'https://pmaymis.gov.in/'
    },
    {
      id: '8c887239-49c4-48de-8fee-5c305098b97d',
      scheme_code: 'CENTRAL-VIDYALAKSHMI-012',
      scheme_name: 'PM Vidya Lakshmi Education Loan Scheme',
      department_name: 'Department of Higher Education',
      state_or_central: 'central',
      benefits_summary: 'Single-window electronic portal for education loans and government scholarships for higher education.',
      required_documents: ['College Admission Offer Letter', 'Fee Structure', 'Income Proof', 'Mark Sheets'],
      official_portal_url: 'https://www.vidyalakshmi.co.in/'
    }
  ];

  async function fetchSavedSchemes() {
    const container = document.getElementById('saved-schemes-list');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
          <p style="font-size: 0.95rem; color: var(--text-muted);">Loading your bookmarked schemes...</p>
        </div>
      `;
    }

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (!userId) {
            renderEmptyState("Please sign in to view and manage your saved government schemes.");
            return;
          }

          // Query saved_schemes joined with government_schemes
          const { data, error } = await client
            .from('saved_schemes')
            .select('id, saved_at, scheme_id, government_schemes(*)')
            .eq('user_id', userId)
            .order('saved_at', { ascending: false });

          if (!error && data) {
            savedSchemesData = data.map(item => {
              const matched = item.government_schemes || 
                              FALLBACK_SCHEMES.find(s => s.id === item.scheme_id);
              return {
                bookmarkId: item.id,
                savedAt: item.saved_at,
                scheme_id: item.scheme_id,
                ...(matched || {})
              };
            }).filter(item => item.scheme_name || item.name || item.scheme_code);

            // Sync with CrowdCitySavedSchemes central store & local cache
            try {
              if (window.CrowdCitySavedSchemes) {
                savedSchemesData.forEach(s => {
                  if (s.scheme_id) window.CrowdCitySavedSchemes.addSaved(s.scheme_id);
                  if (s.id) window.CrowdCitySavedSchemes.addSaved(s.id);
                  if (s.scheme_code) window.CrowdCitySavedSchemes.addSaved(s.scheme_code);
                });
              }
              const savedIds = savedSchemesData.map(s => s.id || s.scheme_id).filter(Boolean);
              const savedCodes = savedSchemesData.map(s => s.scheme_code || s.code).filter(Boolean);
              localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...new Set([...savedIds, ...savedCodes])]));
            } catch (e) {}

            renderSavedSchemes(savedSchemesData);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Saved schemes database query error:", err);
    }

    // Fallback if offline or demo user
    renderEmptyState("You haven't saved any government schemes yet. Browse eligible schemes and click 'Save Scheme' to bookmark them here.");
  }

  function renderEmptyState(message) {
    const container = document.getElementById('saved-schemes-list');
    const countElem = document.getElementById('saved-count-number');
    if (countElem) countElem.textContent = '0';

    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-regular fa-bookmark" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Saved Schemes</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">${message}</p>
        <a href="scheme-checker.html" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-award"></i> <span>Check Eligible Schemes</span>
        </a>
      </div>
    `;
  }

  function renderSavedSchemes(schemes) {
    const container = document.getElementById('saved-schemes-list');
    const countElem = document.getElementById('saved-count-number');
    if (countElem) countElem.textContent = schemes.length;

    if (!container) return;

    if (schemes.length === 0) {
      renderEmptyState("You haven't saved any government schemes yet. Browse eligible schemes and click 'Save Scheme' to bookmark them here.");
      return;
    }

    container.innerHTML = schemes.map(scheme => {
      const isState = (scheme.state_or_central === 'state');
      const docs = Array.isArray(scheme.required_documents) 
        ? scheme.required_documents 
        : (typeof scheme.required_documents === 'string' ? JSON.parse(scheme.required_documents || '[]') : []);

      return `
        <div class="saved-scheme-card" data-bookmark-id="${scheme.bookmarkId}" data-scheme-id="${scheme.id}" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: ${isState ? 'rgba(13, 148, 136, 0.12)' : 'rgba(99, 102, 241, 0.12)'}; color: ${isState ? 'var(--primary)' : '#6366f1'}; display: inline-block; margin-bottom: 0.35rem;">
                ${isState ? 'Tamil Nadu State Scheme' : 'Central Government Scheme'}
              </span>
              <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${scheme.scheme_name || scheme.name}</h3>
            </div>
            
            <button type="button" class="btn-remove-saved" data-bookmark-id="${scheme.bookmarkId}" data-scheme-id="${scheme.id}" title="Remove from bookmarks" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 1rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${scheme.department_name || scheme.department}
          </p>

          <p style="font-size: 0.92rem; color: var(--text-main); line-height: 1.6; margin: 0 0 1.25rem 0;">
            ${scheme.short_description || scheme.description || 'Government welfare program.'}
          </p>

          <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">
              Benefits Summary
            </div>
            <div style="font-size: 0.88rem; color: var(--text-main); font-weight: 600;">
              ${scheme.benefits_summary || scheme.benefits || 'Government financial support and benefits.'}
            </div>
          </div>

          ${docs.length > 0 ? `
            <div style="margin-bottom: 1.25rem;">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">Document Checklist:</div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${docs.map(doc => `<span style="font-size: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.25rem 0.6rem; border-radius: 6px; color: var(--text-main);">${doc}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 0.85rem; align-items: center; justify-content: flex-end; border-top: 1px dashed var(--border-color); padding-top: 1.25rem;">
            <a href="${scheme.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.65rem 1.3rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
              <span>Apply on Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Attach Remove Button Listeners
    document.querySelectorAll('.btn-remove-saved').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookmarkId = btn.dataset.bookmarkId;
        const schemeId = btn.dataset.schemeId;
        await removeSavedScheme(bookmarkId, schemeId, btn);
      });
    });
  }

  async function removeSavedScheme(bookmarkId, schemeId, buttonElem) {
    let currentUserId = null;
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          currentUserId = session?.data?.session?.user?.id;

          if (currentUserId) {
            let query = client.from('saved_schemes').delete();
            if (bookmarkId) query = query.eq('id', bookmarkId);
            else if (schemeId) query = query.eq('user_id', currentUserId).eq('scheme_id', schemeId);

            const { error } = await query;
            if (!error) {
              if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
            }
          }
        }
      }
    } catch (err) {
      console.warn("Remove bookmark error:", err);
    }

    // Update in-memory data
    savedSchemesData = savedSchemesData.filter(s => s.bookmarkId !== bookmarkId && s.scheme_id !== schemeId && s.id !== schemeId);

    // Sync central store
    if (window.CrowdCitySavedSchemes && schemeId) {
      window.CrowdCitySavedSchemes.removeSaved(schemeId);
    }

    if (currentUserId) {
      try {
        const remainingUuids = savedSchemesData.map(s => s.id || s.scheme_id).filter(Boolean);
        const remainingCodes = savedSchemesData.map(s => s.scheme_code || s.code).filter(Boolean);
        localStorage.setItem(`cc_saved_schemes_${currentUserId}`, JSON.stringify([...new Set([...remainingUuids, ...remainingCodes])]));
      } catch (e) {}
    }

    // Animate removal from DOM
    const card = buttonElem.closest('.saved-scheme-card');
    if (card) {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => {
        card.remove();
        renderSavedSchemes(savedSchemesData);
      }, 300);
    } else {
      renderSavedSchemes(savedSchemesData);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetchSavedSchemes();
  });

})();
