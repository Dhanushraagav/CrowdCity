// CrowdCity AI v2.0 - AI Government Assistant JavaScript
// Manages ChatGPT-style chat session, Groq backend calls, message history, suggested questions, and smart action cards.

(function() {
  'use strict';

  let currentConversation = [];
  let isThinking = false;

  // Recognized Schemes Dictionary for Smart Actions
  const knownSchemesMap = [
    { keywords: ['kmut', 'kalaignar', 'magalir urimai', 'magalir'], id: 'tn-kmut', name: 'Kalaignar Magalir Urimai Thittam', portal: 'https://kmut.tn.gov.in/' },
    { keywords: ['pudhumai penn', 'pudhumai', 'higher education assurance'], id: 'tn-pudhumai', name: 'Pudhumai Penn Scheme', portal: 'https://penkalvi.tn.gov.in/' },
    { keywords: ['naan mudhalvan', 'mudhalvan', 'skill development'], id: 'tn-naanmudhalvan', name: 'Naan Mudhalvan Scheme', portal: 'https://www.naanmudhalvan.tn.gov.in/' },
    { keywords: ['cmchis', 'health insurance', 'cm health'], id: 'tn-cmchis', name: 'CMCHIS Health Insurance', portal: 'https://cmchistn.com/' },
    { keywords: ['pm kisan', 'pmkisan', 'samman nidhi'], id: 'central-pmkisan', name: 'PM Kisan Samman Nidhi', portal: 'https://pmkisan.gov.in/' },
    { keywords: ['ayushman', 'pmjay', 'pm-jay'], id: 'central-pmjay', name: 'Ayushman Bharat PM-JAY', portal: 'https://pmjay.gov.in/' }
  ];

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function detectSmartSchemes(text) {
    const lower = text.toLowerCase();
    const matches = [];

    knownSchemesMap.forEach(s => {
      if (s.keywords.some(k => lower.includes(k))) {
        if (!matches.some(m => m.id === s.id)) {
          matches.push(s);
        }
      }
    });

    return matches;
  }

  function detectOfficeQuery(text) {
    const lower = text.toLowerCase();
    const officeKeywords = ['office', 'nearest', 'where to apply', 'e-sevai', 'esevai', 'collectorate', 'taluk', 'vao', 'location', 'address'];
    return officeKeywords.some(k => lower.includes(k));
  }

  function renderMessages() {
    const container = document.getElementById('chat-messages-container');
    const welcomeScreen = document.getElementById('assistant-welcome-screen');

    if (!container) return;

    if (currentConversation.length === 0) {
      if (welcomeScreen) welcomeScreen.style.display = 'block';
      container.innerHTML = '';
      return;
    }

    if (welcomeScreen) welcomeScreen.style.display = 'none';

    container.innerHTML = currentConversation.map((msg, idx) => {
      const isUser = msg.sender === 'user';
      const detectedSchemes = !isUser ? detectSmartSchemes(msg.text) : [];
      const showOfficeCard = !isUser && detectOfficeQuery(msg.text);

      return `
        <div class="chat-row ${isUser ? 'user-row' : 'assistant-row'}">
          ${!isUser ? `<div class="chat-avatar"><i class="fa-solid fa-landmark"></i></div>` : ''}
          <div class="chat-bubble">
            <div style="white-space: pre-line;">${escapeHtml(msg.text)}</div>

            ${showOfficeCard ? `
              <div class="embedded-smart-card" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05);">
                <div class="embedded-smart-title" style="color: #10b981;">
                  <i class="fa-solid fa-building-flag"></i> Government Office Locator Available
                </div>
                <div style="font-size: 0.82rem; color: var(--text-main); margin-bottom: 0.5rem;">
                  Find nearby E-Sevai Centers, Taluk Offices, VAO offices, and Collectorates in your district.
                </div>
                <div class="embedded-smart-actions">
                  <a href="office-locator.html" class="smart-action-btn btn-primary-smart" style="background: #10b981; border-color: #10b981;">
                    <i class="fa-solid fa-location-dot"></i> Open Office Locator
                  </a>
                </div>
              </div>
            ` : ''}

            ${detectedSchemes.length > 0 ? `
              <div class="embedded-smart-card">
                <div class="embedded-smart-title">
                  <i class="fa-solid fa-bolt" style="color: var(--primary);"></i> Smart Actions Available
                </div>
                ${detectedSchemes.map(sch => `
                  <div style="margin-bottom: 0.5rem; font-size: 0.82rem; font-weight: 700; color: var(--text-main);">
                    ${sch.name}
                  </div>
                  <div class="embedded-smart-actions">
                    <a href="scheme-details.html?id=${sch.id}" class="smart-action-btn btn-primary-smart">
                      <i class="fa-solid fa-circle-info"></i> View Details
                    </a>
                    <button type="button" class="smart-action-btn btn-save-smart" data-id="${sch.id}">
                      <i class="fa-regular fa-bookmark"></i> Save Scheme
                    </button>
                    <a href="${sch.portal}" target="_blank" rel="noopener noreferrer" class="smart-action-btn">
                      <i class="fa-solid fa-arrow-up-right-from-square"></i> Official Portal
                    </a>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
              ${!isUser ? `
                <button type="button" class="btn-copy-msg" data-idx="${idx}" title="Copy Response" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.75rem;">
                  <i class="fa-regular fa-copy"></i> Copy
                </button>
              ` : '<div></div>'}
              <div class="chat-timestamp">${msg.timestamp || formatTime()}</div>
            </div>
          </div>
          ${isUser ? `<div class="chat-avatar"><i class="fa-solid fa-user"></i></div>` : ''}
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Attach copy & save listeners
    container.querySelectorAll('.btn-copy-msg').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgIdx = parseInt(btn.dataset.idx);
        const textToCopy = currentConversation[msgIdx]?.text;
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy);
          if (window.showToast) window.showToast("Response copied to clipboard!", "success");
        }
      });
    });

    container.querySelectorAll('.btn-save-smart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const schemeId = btn.dataset.id;
        await saveBookmarkFromChat(schemeId, btn);
      });
    });
  }

  const ASSISTANT_SCHEME_CODE_TO_UUID = {
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

  const ASSISTANT_LEGACY_SLUG_TO_UUID = {
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

  function resolveAssistantSchemeUuid(identifier) {
    if (!identifier) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) return identifier;
    const upper = String(identifier).toUpperCase();
    if (ASSISTANT_SCHEME_CODE_TO_UUID[upper]) return ASSISTANT_SCHEME_CODE_TO_UUID[upper];
    const lower = String(identifier).toLowerCase();
    if (ASSISTANT_LEGACY_SLUG_TO_UUID[lower]) return ASSISTANT_LEGACY_SLUG_TO_UUID[lower];
    return null;
  }

  async function saveBookmarkFromChat(schemeId, buttonElem) {
    const targetUuid = resolveAssistantSchemeUuid(schemeId);
    if (!targetUuid) return;

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

          const { error } = await client.from('saved_schemes').insert({ user_id: userId, scheme_id: targetUuid });
          if (!error || error.code === '23505') {
            if (window.showToast) window.showToast("Scheme saved to your bookmarks!", "success");
            buttonElem.style.borderColor = '#10b981';
            buttonElem.style.color = '#10b981';
            buttonElem.innerHTML = `<i class="fa-solid fa-bookmark"></i> Saved`;
            try {
              let arr = [];
              const cached = localStorage.getItem(`cc_saved_schemes_${userId}`);
              if (cached) arr = JSON.parse(cached);
              arr.push(targetUuid);
              localStorage.setItem(`cc_saved_schemes_${userId}`, JSON.stringify([...new Set(arr)]));
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function sendMessage(userText) {
    if (!userText || !userText.trim() || isThinking) return;

    const query = userText.trim();
    const timeStr = formatTime();

    // Append User Message
    currentConversation.push({ sender: 'user', text: query, timestamp: timeStr });
    renderMessages();

    // Show Typing Indicator
    isThinking = true;
    const container = document.getElementById('chat-messages-container');
    const typingRow = document.createElement('div');
    typingRow.className = 'chat-row assistant-row typing-indicator-row';
    typingRow.innerHTML = `
      <div class="chat-avatar"><i class="fa-solid fa-landmark"></i></div>
      <div class="chat-bubble" style="font-style: italic; color: var(--text-muted);">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Government Assistant is researching scheme database...
      </div>
    `;
    container.appendChild(typingRow);
    container.scrollTop = container.scrollHeight;

    try {
      const response = await fetch('/api/ai/assistant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentConversation,
          userProfile: JSON.parse(sessionStorage.getItem('cc_scheme_checker_profile') || '{}')
        })
      });

      const data = await response.json();
      typingRow.remove();

      if (data.success && data.text) {
        currentConversation.push({ sender: 'assistant', text: data.text, timestamp: formatTime() });
      } else {
        currentConversation.push({
          sender: 'assistant',
          text: `Welcome! You can ask questions about Kalaignar Magalir Urimai Thittam, Pudhumai Penn, Naan Mudhalvan, CMCHIS Health Insurance, or PM-KISAN. I can help explain eligibility criteria and document requirements!`,
          timestamp: formatTime()
        });
      }
    } catch (err) {
      typingRow.remove();
      currentConversation.push({
        sender: 'assistant',
        text: `Kalaignar Magalir Urimai Thittam provides ₹1,000 monthly financial rights assistance for female heads of families in Tamil Nadu.\n\nEligibility:\n- Age: 21 to 60 years\n- Annual income: up to ₹2,50,000\n- Required Docs: Ration Card, Aadhaar Card, Bank Passbook.`,
        timestamp: formatTime()
      });
    } finally {
      isThinking = false;
      renderMessages();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('chat-input-text');
    const sendBtn = document.getElementById('btn-send-message');
    const newChatBtn = document.getElementById('btn-new-chat-sidebar');
    const clearChatBtn = document.getElementById('btn-clear-chat-header');

    if (sendBtn && inputField) {
      sendBtn.addEventListener('click', () => {
        sendMessage(inputField.value);
        inputField.value = '';
      });

      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(inputField.value);
          inputField.value = '';
        }
      });
    }

    // Suggested Questions Cards
    document.querySelectorAll('.suggested-card').forEach(card => {
      card.addEventListener('click', () => {
        const question = card.dataset.question;
        if (question) sendMessage(question);
      });
    });

    // New Chat Button
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        currentConversation = [];
        renderMessages();
      });
    }

    // Clear Chat Button
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        currentConversation = [];
        renderMessages();
      });
    }

    renderMessages();
  });

})();
