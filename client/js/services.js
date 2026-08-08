/**
 * CrowdCity AI v2.0 - Government Services Portal JavaScript
 * Manages scheme directory search, category filtering, scheme bookmarking, and dedicated Floating AI Scheme Advisor Chatbot.
 * STRICT POLICY: NO ICONS, NO EMOJIS, ZERO BUGS.
 */

(function () {
  'use strict';

  // Government Welfare Schemes Database
  const GOVERNMENT_SCHEMES = [
    {
      id: 'tn-kmut-001',
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
      id: 'tn-pudhumai-002',
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
      id: 'tn-nm-003',
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
      id: 'tn-cmchis-004',
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
      id: 'tn-mra-005',
      code: 'TN-MRA-005',
      name: 'Moovalur Ramamirtham Ammaiyar Marriage Assistance',
      dept: 'Social Welfare & Women Empowerment Dept, TN',
      category: 'social',
      govtType: 'Tamil Nadu State Govt',
      benefits: 'Financial assistance and 8 grams gold coin for brides completing 10th/12th/Degree education.',
      ageLimit: 'Bride minimum age 18 years',
      incomeLimit: 'Annual family income up to Rs 72,000',
      documents: ['Educational Marksheets (10th/12th/Degree)', 'Income Certificate', 'Community Certificate', 'Ration Card'],
      portal: 'https://www.tn.gov.in/scheme/data_view/44053'
    },
    {
      id: 'central-pmkisan-007',
      code: 'CENTRAL-PMKISAN-007',
      name: 'PM Kisan Samman Nidhi (PM-KISAN)',
      dept: 'Ministry of Agriculture & Farmers Welfare',
      category: 'agriculture',
      govtType: 'Central Govt',
      benefits: 'Rs 6,000 per year direct income support paid in 3 equal installments of Rs 2,000 to landholding farmers.',
      ageLimit: 'Adult landholding farmers',
      incomeLimit: 'Cultivable landholding in farmer name',
      documents: ['Land Patta / Ownership Record', 'Aadhaar Card', 'Aadhaar-linked Bank Account'],
      portal: 'https://pmkisan.gov.in/'
    },
    {
      id: 'central-pmjay-008',
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

  let currentCategory = 'all';
  let searchQuery = '';
  let conversationHistory = [];

  document.addEventListener('DOMContentLoaded', () => {
    initSchemeDirectory();
    initFloatingChatbot();
  });

  // Render Schemes Directory
  function initSchemeDirectory() {
    const container = document.getElementById('schemes-container');
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

    renderSchemes();
  }

  function renderSchemes() {
    const container = document.getElementById('schemes-container');
    if (!container) return;

    const filtered = GOVERNMENT_SCHEMES.filter(sch => {
      const matchCat = currentCategory === 'all' || sch.category === currentCategory;
      const text = `${sch.name} ${sch.code} ${sch.dept} ${sch.benefits} ${sch.documents.join(' ')}`.toLowerCase();
      const matchSearch = !searchQuery || text.includes(searchQuery);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; background: var(--srv-bg-surface); border: 1px solid var(--srv-border); border-radius: 16px;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--srv-text-main); margin: 0 0 0.5rem 0;">No Government Schemes Found</h3>
          <p style="font-size: 0.85rem; color: var(--srv-text-muted); margin: 0;">Try searching for a different keyword or selecting 'All Schemes'.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(sch => `
      <div class="scheme-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span class="scheme-badge">${sch.govtType}</span>
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--srv-text-muted);">${sch.code}</span>
          </div>

          <h3 class="scheme-title">${sch.name}</h3>
          <div class="scheme-dept">${sch.dept}</div>

          <div class="scheme-benefits">
            <strong style="display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--srv-primary); margin-bottom: 0.25rem;">Key Benefits</strong>
            ${sch.benefits}
          </div>

          <div class="scheme-details-list">
            <div><strong>Eligibility Criteria:</strong> ${sch.ageLimit} | ${sch.incomeLimit}</div>
            <div style="margin-top: 0.35rem;"><strong>Required Documents:</strong> ${sch.documents.join(', ')}</div>
          </div>
        </div>

        <div class="scheme-actions">
          <a href="scheme-checker.html?scheme=${sch.id}" class="btn-srv btn-srv-primary">
            Check Eligibility
          </a>
          <button type="button" class="btn-srv btn-srv-outline" onclick="bookmarkScheme('${sch.id}', '${sch.name}')">
            Save Scheme
          </button>
          <a href="${sch.portal}" target="_blank" rel="noopener noreferrer" class="btn-srv btn-srv-outline">
            Official Portal
          </a>
        </div>
      </div>
    `).join('');
  }

  // Save / Bookmark Scheme
  window.bookmarkScheme = function (schemeId, schemeName) {
    try {
      let saved = JSON.parse(localStorage.getItem('cc_saved_user_schemes') || '[]');
      if (!saved.includes(schemeId)) {
        saved.push(schemeId);
        localStorage.setItem('cc_saved_user_schemes', JSON.stringify(saved));
        if (typeof window.showToast === 'function') {
          window.showToast(`Saved ${schemeName} to your saved schemes.`, 'success');
        } else {
          alert(`Saved ${schemeName} to your saved schemes.`);
        }
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast(`${schemeName} is already saved.`, 'info');
        } else {
          alert(`${schemeName} is already saved.`);
        }
      }
    } catch (e) {
      console.warn('Bookmark error:', e);
    }
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
