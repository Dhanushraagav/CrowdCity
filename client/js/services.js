/**
 * CrowdCity AI v2.0 - Government Services Portal JavaScript
 * Manages scheme directory search, category filtering, scheme bookmarking, and dedicated Floating AI Scheme Advisor Chatbot.
 * STRICT POLICY: NO ICONS, NO EMOJIS, ZERO BUGS.
 */

(function () {
  'use strict';

  // Comprehensive Scheme Code to UUID mapping for database integrity
  const SCHEME_CODE_TO_UUID = {
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

  const LEGACY_SLUG_TO_UUID = {
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

  function resolveSchemeUuid(identifier) {
    if (!identifier) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (isUuid) return identifier;

    const upper = String(identifier).toUpperCase();
    if (SCHEME_CODE_TO_UUID[upper]) return SCHEME_CODE_TO_UUID[upper];

    const lower = String(identifier).toLowerCase();
    if (LEGACY_SLUG_TO_UUID[lower]) return LEGACY_SLUG_TO_UUID[lower];

    const found = activeSchemesList.find(s => 
      s.id === identifier || 
      s.code === upper || 
      s.code === identifier || 
      (s.scheme_code && s.scheme_code === upper)
    );
    if (found && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(found.id)) {
      return found.id;
    }
    return null;
  }

  // Government Welfare Schemes Database (Aligned with database UUIDs)
  const GOVERNMENT_SCHEMES = [
    {
      id: '10fbf8f6-3e4a-4c7e-be07-f19eb7e39f7a',
      code: 'TN-KMUT-001',
      name: 'Kalaignar Magalir Urimai Thittam',
      dept: 'Social Welfare & Women Empowerment Dept, TN',
      category: 'social',
      govtType: 'Tamil Nadu State Govt',
      benefits: 'Rs 1,000 monthly financial rights assistance directly into bank accounts of female heads of households.',
      ageLimit: '21 to 60 years',
      incomeLimit: 'Annual family income up to Rs 2,50,000',
      documents: ['Smart Family Ration Card', 'Aadhaar Card', 'Active Bank Passbook'],
      portal: 'https://kmut.tn.gov.in/'
    },
    {
      id: '6edf49dc-795f-4369-b5ab-f72c24eddef8',
      code: 'TN-PUDHUMAI-002',
      name: 'Pudhumai Penn Scheme',
      dept: 'Higher Education Department, TN',
      category: 'education',
      govtType: 'Tamil Nadu State Govt',
      benefits: 'Rs 1,000 per month financial aid for girl students pursuing degree, diploma, or ITI courses.',
      ageLimit: '17 to 25 years',
      incomeLimit: 'Studied in Govt Schools (Classes 6 to 12)',
      documents: ['Govt School Study Certificate (Classes 6-12)', 'Aadhaar Card', 'College Admission Proof & ID', 'Bank Passbook'],
      portal: 'https://penkalvi.tn.gov.in/'
    },
    {
      id: 'ab5d39c0-d7e0-4c74-9de3-30a087d54123',
      code: 'TN-NM-003',
      name: 'Naan Mudhalvan Skill Scheme',
      dept: 'Tamil Nadu Skill Development Corporation (TNSDC)',
      category: 'skill',
      govtType: 'Tamil Nadu State Govt',
      benefits: 'Free technical skill training, AI & coding courses, language proficiency, and campus placement drives.',
      ageLimit: '18 to 35 years',
      incomeLimit: 'Open to college students & youth in Tamil Nadu',
      documents: ['Educational Qualification Marksheet', 'Aadhaar Card', 'College ID / Degree Certificate'],
      portal: 'https://www.naanmudhalvan.tn.gov.in/'
    },
    {
      id: '43e8ff6a-d3f3-4277-88f2-98c46491584e',
      code: 'TN-CMCHIS-004',
      name: 'Chief Minister Comprehensive Health Insurance (CMCHIS)',
      dept: 'Health & Family Welfare Department, TN',
      category: 'health',
      govtType: 'Tamil Nadu State Govt',
      benefits: 'Cashless hospital treatment & surgical cover up to Rs 5,00,000 per family per year in empanelled hospitals.',
      ageLimit: 'All age groups in family',
      incomeLimit: 'Annual family income under Rs 1,20,000',
      documents: ['Smart Ration Card', 'Income Certificate from VAO', 'Aadhaar Cards of family members'],
      portal: 'https://cmchistn.com/'
    },
    {
      id: '43c6f25f-384b-4410-98ac-e747f0edeef7',
      code: 'TN-KKI-005',
      name: 'Kalaignar Kanavu Illam Housing Scheme',
      dept: 'Social Welfare & Women Empowerment Dept, TN',
      category: 'social',
      govtType: 'Tamil Nadu State Govt',
      benefits: 'Financial assistance and support for safe housing and rural empowerment.',
      ageLimit: 'Adult heads of households',
      incomeLimit: 'Eligible rural families',
      documents: ['House Site Patta', 'Aadhaar Card', 'Income Certificate', 'Ration Card'],
      portal: 'https://tnrd.tn.gov.in/'
    },
    {
      id: 'aa6d9c6a-29df-4486-ada5-b70977ccf61c',
      code: 'CENTRAL-PMKISAN-007',
      name: 'PM Kisan Samman Nidhi (PM-KISAN)',
      dept: 'Ministry of Agriculture & Farmers Welfare',
      category: 'agriculture',
      govtType: 'Central Govt',
      benefits: 'Rs 6,00,000 per year direct income support paid in 3 equal installments of Rs 2,000 to landholding farmers.',
      ageLimit: 'Adult landholding farmers',
      incomeLimit: 'Cultivable landholding in farmer name',
      documents: ['Land Patta / Ownership Record', 'Aadhaar Card', 'Aadhaar-linked Bank Account'],
      portal: 'https://pmkisan.gov.in/'
    },
    {
      id: 'd22faa80-2446-454f-8532-17429dcef2e6',
      code: 'CENTRAL-PMJAY-008',
      name: 'Ayushman Bharat PM-JAY',
      dept: 'National Health Authority (NHA)',
      category: 'health',
      govtType: 'Central Govt',
      benefits: 'Health cover of Rs 5,00,000 per family per year for secondary and tertiary care hospitalization across India.',
      ageLimit: 'All age groups',
      incomeLimit: 'Listed in SECC database / Ayushman Card holders',
      documents: ['Aadhaar Card', 'Ration Card', 'PM-JAY Family Letter'],
      portal: 'https://pmjay.gov.in/'
    }
  ];

  let activeSchemesList = GOVERNMENT_SCHEMES;
  let userSavedSchemeIds = new Set();
  let currentUserId = null;
  const inFlightBookmarks = new Set();
  let currentCategory = 'all';
  let searchQuery = '';
  let conversationHistory = [];

  document.addEventListener('DOMContentLoaded', () => {
    initSchemeDirectory();
    initFloatingChatbot();
  });

  // Check whether a scheme is saved using stable ID / scheme code (Never display name)
  function isSchemeSaved(scheme) {
    if (!scheme) return false;
    if (scheme.id && userSavedSchemeIds.has(scheme.id)) return true;
    if (scheme.code && userSavedSchemeIds.has(scheme.code)) return true;
    if (scheme.code && userSavedSchemeIds.has(scheme.code.toLowerCase())) return true;
    if (scheme.scheme_code && userSavedSchemeIds.has(scheme.scheme_code)) return true;
    if (scheme.scheme_code && userSavedSchemeIds.has(scheme.scheme_code.toLowerCase())) return true;
    const resolved = resolveSchemeUuid(scheme.id || scheme.code || scheme.scheme_code);
    if (resolved && userSavedSchemeIds.has(resolved)) return true;
    return false;
  }

  // Render Schemes Directory
  async function initSchemeDirectory() {
    const searchInput = document.getElementById('scheme-search-input');
    const categoryPills = document.querySelectorAll('.services-pill');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderSchemes();
      });
    }

    categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.dataset.category || 'all';
        renderSchemes();
      });
    });

    window.addEventListener('language-change', () => {
      renderSchemes();
    });

    // 1. Initial immediate render
    renderSchemes();

    // 2. Hydrate bookmarks and schemes from database
    await hydrateSchemesAndBookmarks();
  }

  // Hydrate schemes and current user's saved bookmarks from Supabase
  async function hydrateSchemesAndBookmarks() {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;
          currentUserId = userId || null;

          if (userId) {
            // First hydrate instantly from user-scoped local cache
            try {
              const cached = localStorage.getItem(`cc_saved_schemes_${userId}`);
              if (cached) {
                const arr = JSON.parse(cached);
                if (Array.isArray(arr) && arr.length > 0) {
                  arr.forEach(id => userSavedSchemeIds.add(id));
                  renderSchemes();
                }
              }
            } catch (e) {}

            // Query authoritative bookmarks for current user from database
            const { data: savedRows, error: saveErr } = await client
              .from('saved_schemes')
              .select('id, scheme_id, government_schemes(id, scheme_code)')
              .eq('user_id', userId);

            if (!saveErr && savedRows) {
              const freshSet = new Set();
              savedRows.forEach(r => {
                if (r.scheme_id) freshSet.add(r.scheme_id);
                if (r.government_schemes?.id) freshSet.add(r.government_schemes.id);
                if (r.government_schemes?.scheme_code) {
                  freshSet.add(r.government_schemes.scheme_code);
                  freshSet.add(r.government_schemes.scheme_code.toLowerCase());
                }
              });
              userSavedSchemeIds = freshSet;
              try {
                localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...userSavedSchemeIds]));
              } catch (e) {}
              renderSchemes();
            }
          } else {
            userSavedSchemeIds = new Set();
            renderSchemes();
          }

          // Also fetch active schemes from DB if available
          const { data: dbSchemes, error: schErr } = await client
            .from('government_schemes')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

          if (!schErr && dbSchemes && dbSchemes.length > 0) {
            // Register all DB scheme codes to UUIDs dynamically
            dbSchemes.forEach(s => {
              if (s.scheme_code && s.id) {
                SCHEME_CODE_TO_UUID[s.scheme_code.toUpperCase()] = s.id;
              }
            });
            renderSchemes();
          }
        }
      }
    } catch (err) {
      console.warn("Hydrate schemes & bookmarks notice:", err);
    }
  }

  function renderSchemes() {
    const container = document.getElementById('schemes-container');
    if (!container) return;

    const isTamil = (window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === 'ta');
    const tCheck = window.i18n ? window.i18n.t('services_btn_check_eligibility') : 'Check Eligibility';
    const tSave = window.i18n ? window.i18n.t('services_btn_save_scheme') : 'Save Scheme';
    const tSaved = isTamil ? 'சேமிக்கப்பட்டது' : 'Saved';
    const tPortal = window.i18n ? window.i18n.t('services_btn_official_portal') : 'Official Portal';
    const tBenefits = window.i18n ? window.i18n.t('services_lbl_key_benefits') : 'Key Benefits';
    const tEligibility = window.i18n ? window.i18n.t('services_lbl_eligibility_criteria') : 'Eligibility Criteria';
    const tDocuments = window.i18n ? window.i18n.t('services_lbl_required_documents') : 'Required Documents';
    const tNoSchemes = window.i18n ? window.i18n.t('services_no_schemes_found') : 'No Government Schemes Found';
    const tNoSchemesDesc = window.i18n ? window.i18n.t('services_no_schemes_desc') : "Try searching for a different keyword or selecting 'All Schemes'.";

    const filtered = activeSchemesList.filter(sch => {
      const matchCat = currentCategory === 'all' || sch.category === currentCategory;
      const text = `${sch.name} ${sch.code} ${sch.dept} ${sch.benefits} ${sch.documents.join(' ')}`.toLowerCase();
      const matchSearch = !searchQuery || text.includes(searchQuery);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; background: var(--srv-bg-surface); border: 1px solid var(--srv-border); border-radius: 16px;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--srv-text-main); margin: 0 0 0.5rem 0;">${tNoSchemes}</h3>
          <p style="font-size: 0.85rem; color: var(--srv-text-muted); margin: 0;">${tNoSchemesDesc}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(sch => {
      const saved = isSchemeSaved(sch);
      const safeName = String(sch.name).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `
      <div class="scheme-card" data-scheme-id="${sch.id}" data-scheme-code="${sch.code}">
        <div class="scheme-card-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span class="scheme-badge">${sch.govtType}</span>
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--srv-text-muted);">${sch.code}</span>
          </div>

          <h3 class="scheme-title">${sch.name}</h3>
          <div class="scheme-dept">${sch.dept}</div>

          <div class="scheme-benefits">
            <strong style="display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--srv-primary); margin-bottom: 0.25rem;">${tBenefits}</strong>
            ${sch.benefits}
          </div>

          <div class="scheme-details-list">
            <div><strong>${tEligibility}:</strong> ${sch.ageLimit} | ${sch.incomeLimit}</div>
            <div style="margin-top: 0.35rem;"><strong>${tDocuments}:</strong> ${sch.documents.join(', ')}</div>
          </div>
        </div>

        <div class="scheme-actions">
          <div class="scheme-actions-row">
            <a href="scheme-checker.html?scheme=${sch.code || sch.id}" class="btn-srv btn-srv-primary">
              ${tCheck}
            </a>
            <button type="button" class="btn-srv btn-srv-outline ${saved ? 'is-saved' : ''}" data-scheme-id="${sch.id}" data-scheme-code="${sch.code}" onclick="toggleBookmarkScheme('${sch.id}', '${safeName}', this)" ${saved ? 'style="border-color: #10b981; color: #10b981; background: rgba(16, 185, 129, 0.1);"' : ''}>
              <i class="${saved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
              <span>${saved ? tSaved : tSave}</span>
            </button>
          </div>
          <a href="${sch.portal}" target="_blank" rel="noopener noreferrer" class="btn-srv btn-srv-outline btn-srv-portal">
            ${tPortal}
          </a>
        </div>
      </div>
    `;
    }).join('');
  }

  // Toggle Save / Unsave Scheme with Supabase Database Persistence
  window.toggleBookmarkScheme = async function (schemeId, schemeName, buttonElem) {
    const targetUuid = resolveSchemeUuid(schemeId);
    if (!targetUuid) {
      console.warn("Could not resolve scheme UUID for bookmark:", schemeId);
      if (window.showToast) window.showToast("Could not save scheme. Invalid scheme reference.", "error");
      return;
    }

    if (inFlightBookmarks.has(targetUuid)) return;
    inFlightBookmarks.add(targetUuid);

    const isTamil = (window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === 'ta');
    const tSave = window.i18n ? window.i18n.t('services_btn_save_scheme') : 'Save Scheme';
    const tSaved = isTamil ? 'சேமிக்கப்பட்டது' : 'Saved';

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
      currentUserId = userId;

      const isCurrentlySaved = userSavedSchemeIds.has(targetUuid) || (buttonElem && buttonElem.classList.contains('is-saved'));

      if (isCurrentlySaved) {
        // REMOVE / UNSAVE
        const { error: delError } = await client
          .from('saved_schemes')
          .delete()
          .eq('user_id', userId)
          .eq('scheme_id', targetUuid);

        if (!delError) {
          userSavedSchemeIds.delete(targetUuid);
          const found = activeSchemesList.find(s => s.id === targetUuid || resolveSchemeUuid(s.id) === targetUuid);
          if (found?.code) {
            userSavedSchemeIds.delete(found.code);
            userSavedSchemeIds.delete(found.code.toLowerCase());
          }
          try {
            localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...userSavedSchemeIds]));
          } catch (e) {}

          if (buttonElem) {
            buttonElem.classList.remove('is-saved');
            buttonElem.style.borderColor = '';
            buttonElem.style.color = '';
            buttonElem.style.background = '';
            buttonElem.innerHTML = `<i class="fa-regular fa-bookmark"></i> <span>${tSave}</span>`;
          }
          if (window.showToast) window.showToast("Scheme removed from your saved list.", "info");
        } else {
          console.warn("Error removing bookmark:", delError);
          if (window.showToast) window.showToast("Failed to remove bookmark. Please try again.", "error");
        }
      } else {
        // SAVE SCHEME
        const { error: insError } = await client
          .from('saved_schemes')
          .insert({ user_id: userId, scheme_id: targetUuid });

        if (!insError) {
          userSavedSchemeIds.add(targetUuid);
          const found = activeSchemesList.find(s => s.id === targetUuid || resolveSchemeUuid(s.id) === targetUuid);
          if (found?.code) {
            userSavedSchemeIds.add(found.code);
            userSavedSchemeIds.add(found.code.toLowerCase());
          }
          try {
            localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...userSavedSchemeIds]));
          } catch (e) {}

          if (buttonElem) {
            buttonElem.classList.add('is-saved');
            buttonElem.style.borderColor = '#10b981';
            buttonElem.style.color = '#10b981';
            buttonElem.style.background = 'rgba(16, 185, 129, 0.1)';
            buttonElem.innerHTML = `<i class="fa-solid fa-bookmark"></i> <span>${tSaved}</span>`;
          }
          if (window.showToast) window.showToast(`Saved ${schemeName} to your saved schemes.`, "success");
        } else if (insError.code === '23505') {
          // Already saved in database: guarantee UI matches database state
          userSavedSchemeIds.add(targetUuid);
          const found = activeSchemesList.find(s => s.id === targetUuid || resolveSchemeUuid(s.id) === targetUuid);
          if (found?.code) {
            userSavedSchemeIds.add(found.code);
            userSavedSchemeIds.add(found.code.toLowerCase());
          }
          try {
            localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...userSavedSchemeIds]));
          } catch (e) {}

          if (buttonElem) {
            buttonElem.classList.add('is-saved');
            buttonElem.style.borderColor = '#10b981';
            buttonElem.style.color = '#10b981';
            buttonElem.style.background = 'rgba(16, 185, 129, 0.1)';
            buttonElem.innerHTML = `<i class="fa-solid fa-bookmark"></i> <span>${tSaved}</span>`;
          }
          if (window.showToast) window.showToast(`${schemeName} is already saved.`, "info");
        } else {
          console.warn("Error saving scheme bookmark:", insError);
          if (window.showToast) window.showToast("Failed to save scheme. Please try again.", "error");
        }
      }
    } catch (err) {
      console.warn("Bookmark toggle exception:", err);
      if (window.showToast) window.showToast("Unable to update bookmark right now.", "error");
    } finally {
      inFlightBookmarks.delete(targetUuid);
    }
  };

  // Backward compatibility alias
  window.bookmarkScheme = function (schemeId, schemeName) {
    const btn = document.querySelector(`button[data-scheme-id="${schemeId}"]`) || 
                (typeof event !== 'undefined' && event?.target?.closest('button'));
    return window.toggleBookmarkScheme(schemeId, schemeName, btn);
  };

  // Floating AI Scheme Advisor Chatbot Logic
  function initFloatingChatbot() {
    const triggerBtn = document.getElementById('floating-scheme-chat-trigger');
    const chatWindow = document.getElementById('scheme-ai-chat-window');
    const closeBtn = document.getElementById('scheme-chat-close-btn');
    const sendBtn = document.getElementById('scheme-chat-send-btn');
    const chatInput = document.getElementById('scheme-chat-input');

    if (!triggerBtn || !chatWindow) return;

    triggerBtn.addEventListener('click', () => {
      chatWindow.classList.toggle('hidden');
      if (!chatWindow.classList.contains('hidden') && chatInput) {
        chatInput.focus();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
      });
    }

    if (sendBtn && chatInput) {
      sendBtn.addEventListener('click', () => handleSendUserMessage());
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSendUserMessage();
        }
      });
    }
  }

  window.sendQuickPrompt = function (promptText) {
    const chatInput = document.getElementById('scheme-chat-input');
    if (chatInput) {
      chatInput.value = promptText;
      handleSendUserMessage();
    }
  };

  async function handleSendUserMessage() {
    const chatInput = document.getElementById('scheme-chat-input');
    const messagesContainer = document.getElementById('scheme-chat-messages');

    if (!chatInput || !messagesContainer) return;
    const text = chatInput.value.trim();
    if (!text) return;

    // Render User Message (NO ICONS, NO EMOJIS)
    appendChatMessage('user', text);
    chatInput.value = '';

    // Add to conversation history
    conversationHistory.push({ sender: 'user', text: text });

    // Show Typing Indicator
    const typingElem = document.createElement('div');
    typingElem.className = 'chat-msg chat-msg-bot';
    typingElem.id = 'scheme-ai-typing';
    typingElem.textContent = 'Analyzing government scheme details...';
    messagesContainer.appendChild(typingElem);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      let replyText = '';

      if (window.API && typeof window.API.assistantChat === 'function') {
        const res = await window.API.assistantChat(conversationHistory);
        if (res && res.data && res.data.text) {
          replyText = res.data.text;
        } else if (res && res.text) {
          replyText = res.text;
        }
      }

      if (!replyText) {
        replyText = getFallbackSchemeAnswer(text);
      }

      // Clean emojis from AI response
      replyText = stripEmojis(replyText);

      // Remove typing indicator & render bot message
      const typing = document.getElementById('scheme-ai-typing');
      if (typing) typing.remove();

      appendChatMessage('bot', replyText);
      conversationHistory.push({ sender: 'bot', text: replyText });
    } catch (err) {
      console.warn('AI scheme chat error:', err);
      const typing = document.getElementById('scheme-ai-typing');
      if (typing) typing.remove();

      const fallbackText = getFallbackSchemeAnswer(text);
      appendChatMessage('bot', stripEmojis(fallbackText));
    }
  }

  function appendChatMessage(sender, text) {
    const container = document.getElementById('scheme-chat-messages');
    if (!container) return;

    const msgElem = document.createElement('div');
    msgElem.className = `chat-msg ${sender === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`;
    msgElem.textContent = text;
    container.appendChild(msgElem);
    container.scrollTop = container.scrollHeight;
  }

  function stripEmojis(text) {
    if (!text) return '';
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  }

  function getFallbackSchemeAnswer(query) {
    const q = query.toLowerCase();
    if (q.includes('magalir') || q.includes('kmut') || q.includes('women right')) {
      return "Kalaignar Magalir Urimai Thittam provides Rs 1,000 monthly financial rights assistance directly into bank accounts of female heads of households in Tamil Nadu. Required documents: Smart Family Ration Card, Aadhaar Card, and Bank Passbook. Official Portal: https://kmut.tn.gov.in/";
    } else if (q.includes('pudhumai') || q.includes('penn') || q.includes('girl student')) {
      return "Pudhumai Penn Scheme provides Rs 1,000 per month financial assistance for female students pursuing higher education (degree, diploma, ITI) who studied from Classes 6 to 12 in Tamil Nadu Government schools. Official Portal: https://penkalvi.tn.gov.in/";
    } else if (q.includes('cmchis') || q.includes('health') || q.includes('hospital')) {
      return "Chief Minister Comprehensive Health Insurance Scheme (CMCHIS) provides cashless hospital cover up to Rs 5,00,000 per family per year in empanelled government and private hospitals. Required documents: Ration Card and Income Certificate. Official Portal: https://cmchistn.com/";
    } else if (q.includes('kisan') || q.includes('farmer') || q.includes('agriculture')) {
      return "PM Kisan Samman Nidhi is a Central Government scheme providing Rs 6,000 per year direct income support in 3 equal installments of Rs 2,000 to landholding farmers across India. Official Portal: https://pmkisan.gov.in/";
    }
    return "I am your AI Scheme Advisor. You can ask me about Tamil Nadu State and Central Government welfare schemes, eligibility rules, required documents, or application steps.";
  }
})();
