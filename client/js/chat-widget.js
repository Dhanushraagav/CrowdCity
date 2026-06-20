// CrowdCity AI Assistant Chat Widget Injector

(function() {
  // Styles configuration
  const cssStyles = `
    /* Floating Chat Bubble Button */
    #cc-chat-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
    }

    #cc-chat-trigger:hover {
      transform: scale(1.05);
      border-color: var(--primary);
      background: var(--bg-surface-hover);
    }

    #cc-chat-trigger.active {
      transform: rotate(90deg) scale(0.95);
    }

    #cc-chat-trigger i {
      transition: transform 0.2s ease;
    }

    /* Pulse Animation */
    #cc-chat-trigger.pulse {
      animation: cc-trigger-pulse 2s infinite;
    }

    @keyframes cc-trigger-pulse {
      0% {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(79, 70, 229, 0.45);
      }
      70% {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 12px rgba(79, 70, 229, 0);
      }
      100% {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(79, 70, 229, 0);
      }
    }

    /* Notification Badge */
    #cc-chat-trigger-badge {
      position: absolute;
      top: -1px;
      right: -1px;
      width: 10px;
      height: 10px;
      background-color: #ef4444;
      border-radius: 50%;
      border: 2px solid var(--bg-surface);
      display: none;
    }

    /* Backdrop Blur Overlay */
    #cc-chat-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9997; /* Just below #cc-chat-window */
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #cc-chat-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    /* Chat Window Container Card */
    #cc-chat-window {
      position: fixed;
      bottom: 88px;
      right: 24px;
      width: 420px;
      height: 600px;
      max-height: calc(100vh - 120px);
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 9998;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #cc-chat-window.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }

    /* Drag Handle Bar for Mobile */
    .cc-chat-drag-handle {
      display: none;
    }

    /* Header Panel */
    .cc-chat-header {
      background: var(--bg-surface);
      color: var(--text-main);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
    }

    .cc-chat-title-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .cc-chat-title-info h3 {
      font-family: var(--font-heading);
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0;
      color: var(--text-main);
    }

    .cc-chat-status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .cc-chat-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #10b981;
      display: inline-block;
      animation: cc-pulse 2s infinite;
    }

    @keyframes cc-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
      }
      70% {
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    .cc-chat-close-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 1rem;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease, transform 0.15s ease;
    }

    .cc-chat-close-btn:hover {
      color: var(--text-main);
      transform: scale(1.1);
    }

    /* Message List Area */
    .cc-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background-color: var(--bg-app);
      scroll-behavior: smooth;
    }

    .cc-msg {
      max-width: 85%;
      padding: 0.85rem 1.15rem;
      font-size: 0.875rem;
      line-height: 1.5;
      word-wrap: break-word;
      animation: cc-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes cc-slide-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .cc-msg p {
      margin-bottom: 0.625rem;
    }
    
    .cc-msg p:last-child {
      margin-bottom: 0;
    }

    .cc-msg ul, .cc-msg ol {
      margin-left: 1.25rem;
      margin-bottom: 0.625rem;
    }
    
    .cc-msg li {
      margin-bottom: 0.25rem;
    }

    .cc-msg-user {
      align-self: flex-end;
      background-color: var(--btn-secondary-bg);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      border-radius: 12px 12px 2px 12px;
    }

    .cc-msg-bot {
      align-self: flex-start;
      background-color: var(--bg-surface);
      color: var(--text-main);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--primary);
      border-radius: 2px 12px 12px 12px;
    }

    /* Typing Bouncing indicator */
    .cc-typing-indicator {
      align-self: flex-start;
      display: flex;
      gap: 5px;
      padding: 0.85rem 1.15rem;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--primary);
      border-radius: 2px 12px 12px 12px;
      width: max-content;
      margin-bottom: 0.25rem;
      animation: cc-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .cc-typing-indicator span {
      width: 5px;
      height: 5px;
      background-color: var(--text-muted);
      border-radius: 50%;
      animation: cc-bounce 1.4s infinite ease-in-out both;
    }

    .cc-typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
    .cc-typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes cc-bounce {
      0%, 80%, 100% { transform: scale(0.3); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Footer Input panel */
    .cc-chat-footer {
      padding: 1rem 1.25rem;
      background-color: var(--bg-surface);
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .cc-chat-input-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background-color: var(--bg-app);
      padding: 4px 6px 4px 10px;
      transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .cc-chat-input-container:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }

    .cc-chat-input {
      flex: 1;
      height: 32px;
      border: none;
      background: transparent;
      color: var(--text-main);
      font-size: 0.875rem;
      outline: none;
      font-family: var(--font-body);
    }

    .cc-chat-input::placeholder {
      color: var(--text-muted);
      opacity: 0.8;
    }

    .cc-chat-send-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: var(--radius-sm);
      background: var(--primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background-color 0.25s ease, opacity 0.25s ease;
    }

    .cc-chat-send-btn:hover {
      background-color: var(--primary-hover);
    }
    
    .cc-chat-send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .cc-chat-footnote {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: center;
      opacity: 0.7;
    }

    /* Mobile Adaptability */
    @media (max-width: 768px) {
      #cc-chat-window {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        height: 70vh;
        max-height: 70vh;
        border-radius: 24px 24px 0 0;
        border-left: none;
        border-right: none;
        border-bottom: none;
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.15);
        transform: translateY(100%);
        opacity: 1; /* Slide-only transition */
        transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }

      #cc-chat-window.open {
        transform: translateY(0);
      }

      /* Hide floating trigger button when open to prevent blocking input container */
      #cc-chat-trigger.open {
        opacity: 0;
        pointer-events: none;
        transform: scale(0.8);
      }

      /* Drag Handle Bar at top of sheet */
      .cc-chat-drag-handle {
        display: block;
        width: 36px;
        height: 4px;
        background-color: var(--border-color);
        border-radius: 2px;
        margin: 8px auto 4px auto;
        flex-shrink: 0;
        cursor: grab;
        touch-action: none;
      }
      .cc-chat-drag-handle:active {
        cursor: grabbing;
      }

      /* Reduce empty space & make messages occupy more area */
      .cc-chat-messages {
        padding: 0.75rem 1rem;
        gap: 0.75rem;
      }

      .cc-msg {
        max-width: 90%;
        padding: 0.75rem 1rem;
        font-size: 0.85rem;
      }

      .cc-chat-footer {
        padding: 0.75rem 1rem;
        gap: 0.375rem;
      }

      .cc-chat-input-container {
        padding: 4px 6px 4px 8px;
      }

      .cc-chat-input {
        height: 28px;
        font-size: 0.85rem;
      }

      .cc-chat-send-btn {
        width: 28px;
        height: 28px;
        font-size: 0.8rem;
      }
    }
  `;

  // Conversation history in memory
  let chatHistory = [];

  // Initialize widget UI on DOM load
  function initChatbotWidget() {
    // 1. Inject Styles
    const styleEl = document.createElement('style');
    styleEl.innerHTML = cssStyles;
    document.head.appendChild(styleEl);

    // 1.5 Create Backdrop Overlay
    const backdropEl = document.createElement('div');
    backdropEl.id = 'cc-chat-backdrop';
    backdropEl.addEventListener('click', toggleChatWindow);
    document.body.appendChild(backdropEl);

    // 2. Create Trigger Button
    const triggerBtn = document.createElement('div');
    triggerBtn.id = 'cc-chat-trigger';
    triggerBtn.ariaLabel = 'Open AI Assistant';
    triggerBtn.innerHTML = '<i class="fa-regular fa-comment-dots"></i>';

    // Create Badge
    const badge = document.createElement('span');
    badge.id = 'cc-chat-trigger-badge';
    triggerBtn.appendChild(badge);

    // Initial check for badge/pulse
    const openedOnce = localStorage.getItem('cc_chatbot_opened_once');
    if (!openedOnce) {
      badge.style.display = 'block';
      triggerBtn.classList.add('pulse');
    } else {
      badge.style.display = 'none';
    }

    triggerBtn.addEventListener('click', toggleChatWindow);
    document.body.appendChild(triggerBtn);

    // 3. Create Chat Drawer
    const chatWindow = document.createElement('div');
    chatWindow.id = 'cc-chat-window';
    chatWindow.innerHTML = `
      <div class="cc-chat-drag-handle"></div>
      <div class="cc-chat-header">
        <div class="cc-chat-title-info">
          <h3>Civic Assistant</h3>
          <div class="cc-chat-status">
            <span class="cc-chat-status-dot"></span>
            <span>Civic AI &bull; Active</span>
          </div>
        </div>
        <button class="cc-chat-close-btn" onclick="toggleChatWindow()" aria-label="Close Chat"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="cc-chat-messages" id="cc-chat-msg-box">
        <div class="cc-msg cc-msg-bot">
          Hi! I am the CrowdCity AI Assistant. Ask me how to report issues, how points/badges work, what a status means, or safety suggestions!
        </div>
      </div>
      <div class="cc-chat-footer">
        <form class="cc-chat-form" id="cc-chat-input-form" onsubmit="handleSend(event)">
          <div class="cc-chat-input-container">
            <input type="text" class="cc-chat-input" id="cc-chat-input-box" placeholder="Ask the civic assistant..." autocomplete="off" required>
            <button type="submit" class="cc-chat-send-btn" id="cc-chat-submit-btn"><i class="fa-solid fa-arrow-up"></i></button>
          </div>
        </form>
        <div class="cc-chat-footnote">CrowdCity AI Civic Assistant &bull; Powered by Groq AI</div>
      </div>
    `;
    document.body.appendChild(chatWindow);

    // 4. Bind Drag/Swipe down to close touch listeners for mobile
    const dragHandle = chatWindow.querySelector('.cc-chat-drag-handle');
    const chatHeader = chatWindow.querySelector('.cc-chat-header');
    const msgBox = chatWindow.querySelector('#cc-chat-msg-box');

    let touchStartY = 0;
    let touchCurrentY = 0;
    let isDragging = false;

    function onTouchStart(e) {
      if (window.innerWidth > 768) return;
      touchStartY = e.touches[0].clientY;
      touchCurrentY = touchStartY;
      isDragging = true;
      chatWindow.style.transition = 'none';
    }

    function onTouchMove(e) {
      if (!isDragging) return;
      touchCurrentY = e.touches[0].clientY;
      const deltaY = touchCurrentY - touchStartY;
      if (deltaY > 0) {
        chatWindow.style.transform = `translateY(${deltaY}px)`;
        if (e.cancelable) e.preventDefault();
      } else {
        // Cancel dragging if swiping up
        isDragging = false;
        chatWindow.style.transition = '';
        chatWindow.style.transform = '';
      }
    }

    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = touchCurrentY - touchStartY;
      if (deltaY > 120) {
        // Reset inline styles and close
        chatWindow.style.transition = '';
        chatWindow.style.transform = '';
        toggleChatWindow();
      } else {
        // Animate back to open state
        chatWindow.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        chatWindow.style.transform = 'translateY(0)';
      }
    }

    dragHandle.addEventListener('touchstart', onTouchStart, { passive: true });
    dragHandle.addEventListener('touchmove', onTouchMove, { passive: false });
    dragHandle.addEventListener('touchend', onTouchEnd);

    chatHeader.addEventListener('touchstart', onTouchStart, { passive: true });
    chatHeader.addEventListener('touchmove', onTouchMove, { passive: false });
    chatHeader.addEventListener('touchend', onTouchEnd);

    // Messages container swipe down (only when scrolled to top)
    msgBox.addEventListener('touchstart', (e) => {
      if (window.innerWidth > 768) return;
      if (msgBox.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isDragging = true;
        chatWindow.style.transition = 'none';
      }
    }, { passive: true });

    msgBox.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      touchCurrentY = e.touches[0].clientY;
      const deltaY = touchCurrentY - touchStartY;
      if (deltaY > 0) {
        chatWindow.style.transform = `translateY(${deltaY}px)`;
        if (e.cancelable) e.preventDefault();
      } else {
        isDragging = false;
        chatWindow.style.transition = '';
        chatWindow.style.transform = '';
      }
    }, { passive: false });

    msgBox.addEventListener('touchend', onTouchEnd);

    // 5. Visual Viewport / Software Keyboard handling for mobile
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (window.innerWidth > 768) return;
        const chatWin = document.getElementById('cc-chat-window');
        if (!chatWin || !chatWin.classList.contains('open')) return;

        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        if (keyboardHeight > 50) {
          chatWin.style.bottom = `${keyboardHeight}px`;
          chatWin.style.height = `${window.visualViewport.height * 0.7}px`;
        } else {
          chatWin.style.bottom = '0px';
          chatWin.style.height = '70vh';
        }
      });
    }
  }

  // Toggle drawer open/close state
  function toggleChatWindow() {
    const chatWin = document.getElementById('cc-chat-window');
    const trigger = document.getElementById('cc-chat-trigger');
    const backdrop = document.getElementById('cc-chat-backdrop');
    if (!chatWin || !trigger) return;

    chatWin.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open');
    trigger.classList.toggle('open');

    if (chatWin.classList.contains('open')) {
      trigger.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
      // Auto-focus input box with slight timeout to let slide-up animate smoothly
      const input = document.getElementById('cc-chat-input-box');
      if (input) {
        setTimeout(() => input.focus(), 150);
      }

      // Mark opened once
      localStorage.setItem('cc_chatbot_opened_once', 'true');
      const badge = document.getElementById('cc-chat-trigger-badge');
      if (badge) badge.style.display = 'none';

      trigger.classList.remove('pulse');
    } else {
      trigger.innerHTML = '<i class="fa-regular fa-comment-dots"></i>';
      // Reset inline styles for drag and keyboard layout when closed
      chatWin.style.bottom = '';
      chatWin.style.height = '';
      chatWin.style.transform = '';
      // Unfocus input to dismiss keyboard
      const input = document.getElementById('cc-chat-input-box');
      if (input) input.blur();
    }
  }
  // Expose toggle globally for inline header onclick support
  window.toggleChatWindow = toggleChatWindow;

  // Window resize to clear mobile layout overrides when changing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      const chatWin = document.getElementById('cc-chat-window');
      const trigger = document.getElementById('cc-chat-trigger');
      const backdrop = document.getElementById('cc-chat-backdrop');
      if (chatWin) {
        chatWin.style.bottom = '';
        chatWin.style.height = '';
        chatWin.style.transform = '';
      }
      if (trigger) {
        trigger.classList.remove('open');
      }
      if (backdrop) {
        backdrop.classList.remove('open');
      }
    }
  });

  // Process sending user message
  async function handleSend(e) {
    if (e) e.preventDefault();

    const input = document.getElementById('cc-chat-input-box');
    const msgBox = document.getElementById('cc-chat-msg-box');
    const submitBtn = document.getElementById('cc-chat-submit-btn');

    if (!input || !input.value.trim()) return;

    const userText = input.value.trim();
    input.value = '';

    // Append user message to display
    appendMessage('user', userText);

    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser) {
      appendMessage('bot', 'Please **Sign In** to chat with the CrowdCity AI Assistant.');
      return;
    }

    // Append to memory history
    chatHistory.push({ role: 'user', content: userText });

    // Show typing loader
    const loaderId = showTypingIndicator();
    submitBtn.disabled = true;

    try {
      const { data, error } = await window.API.chatWithAi(chatHistory);

      // Remove typing loader
      hideTypingIndicator(loaderId);
      submitBtn.disabled = false;

      if (error) {
        console.error('Chat completions error:', error);
        appendMessage('bot', 'Sorry, I encountered an issue connecting to the AI helper. Please try again.');
        // Remove last item to prevent corrupting context
        chatHistory.pop();
        return;
      }

      if (data && data.message) {
        const botReply = data.message.content;
        appendMessage('bot', botReply);
        // Append bot reply to context history
        chatHistory.push({ role: 'assistant', content: botReply });
      }
    } catch (err) {
      console.error('Chat submission exception:', err);
      hideTypingIndicator(loaderId);
      submitBtn.disabled = false;
      appendMessage('bot', 'An unexpected network error occurred.');
    }
  }
  window.handleSend = handleSend;

  /**
   * Helper to format markdown bolding and bullet list lists in response text
   */
  function formatMarkdown(text) {
    // 1. Double line breaks to paragraphs
    let html = text
      .split('\n\n')
      .map(para => `<p>${para.trim()}</p>`)
      .join('');

    // 2. Bold text **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 3. Bullet points lists (lines starting with * or -)
    html = html.replace(/<p>([\s\S]*?)<\/p>/g, function(match, inner) {
      if (inner.includes('\n* ') || inner.includes('\n- ')) {
        const listItems = inner.split(/\n[\*\-]\s+/)
          .map((item, idx) => idx === 0 ? `<p>${item}</p><ul>` : `<li>${item}</li>`)
          .join('');
        return listItems + '</ul>';
      }
      return match;
    });

    return html;
  }

  /**
   * Append message bubble dynamically
   */
  function appendMessage(role, text) {
    const msgBox = document.getElementById('cc-chat-msg-box');
    if (!msgBox) return;

    const msg = document.createElement('div');
    msg.className = `cc-msg cc-msg-${role}`;
    msg.innerHTML = role === 'bot' ? formatMarkdown(text) : text;
    msgBox.appendChild(msg);

    // Scroll to bottom
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  /**
   * Render Typing bouncing circles indicator
   */
  function showTypingIndicator() {
    const msgBox = document.getElementById('cc-chat-msg-box');
    if (!msgBox) return null;

    const id = `cc-typing-${Date.now()}`;
    const loader = document.createElement('div');
    loader.id = id;
    loader.className = 'cc-typing-indicator';
    loader.innerHTML = '<span></span><span></span><span></span>';
    msgBox.appendChild(loader);

    msgBox.scrollTop = msgBox.scrollHeight;
    return id;
  }

  /**
   * Remove Typing bouncing indicator
   */
  function hideTypingIndicator(id) {
    if (!id) return;
    const loader = document.getElementById(id);
    if (loader) loader.remove();
  }

  // Bootstrap when document has loaded fully
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbotWidget);
  } else {
    initChatbotWidget();
  }

})();
