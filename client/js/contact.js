/**
 * contact.js - Controller for CrowdCity AI Citizen Contact Center
 * Handles form validation, category synchronization, FAQ toggles, and backend submissions.
 */

// Internal verified identity store for the currently authenticated user
let verifiedContactIdentity = {
  userId: null,
  name: '',
  email: ''
};

document.addEventListener('DOMContentLoaded', () => {
  // Enforce readonly locks on Name and Email inputs
  enforceReadonlyIdentityFields();

  // Pre-fill user profile info if logged in
  prefillUserInfo();

  // Re-sync once central auth initialization completes or auth state changes
  if (typeof window !== 'undefined' && window.authInitPromise && typeof window.authInitPromise.then === 'function') {
    window.authInitPromise.then(() => {
      prefillUserInfo();
      bindContactAuthStateListener();
    }).catch(() => {});
  } else {
    bindContactAuthStateListener();
  }

  // Sync Support Call button from centralized configuration
  initSupportCallButton();
});

function bindContactAuthStateListener() {
  if (typeof getOrInitSupabaseClient !== 'function') return;
  getOrInitSupabaseClient().then((client) => {
    if (client && client.auth && typeof client.auth.onAuthStateChange === 'function') {
      client.auth.onAuthStateChange(() => {
        prefillUserInfo();
      });
    }
  }).catch(() => {});
}

function enforceReadonlyIdentityFields() {
  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');

  [nameInput, emailInput].forEach((input, idx) => {
    if (!input) return;
    input.readOnly = true;
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('aria-readonly', 'true');

    const restoreVerifiedValue = (e) => {
      if (e && (e.type === 'paste' || e.type === 'cut' || e.type === 'drop')) {
        e.preventDefault();
      }
      const expectedValue = idx === 0 ? verifiedContactIdentity.name : verifiedContactIdentity.email;
      if (expectedValue && input.value !== expectedValue) {
        input.value = expectedValue;
      }
    };

    input.addEventListener('keydown', (e) => {
      // Allow Tab / navigation keys, block character modification
      if (e.key !== 'Tab' && e.key !== 'Escape' && !e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
    });
    input.addEventListener('paste', restoreVerifiedValue);
    input.addEventListener('cut', restoreVerifiedValue);
    input.addEventListener('drop', restoreVerifiedValue);
    input.addEventListener('input', restoreVerifiedValue);
    input.addEventListener('change', restoreVerifiedValue);
  });
}

function initSupportCallButton() {
  const config = (typeof window !== 'undefined' && window.CROWDCITY_CONFIG?.SUPPORT) 
    ? window.CROWDCITY_CONFIG.SUPPORT 
    : { 
        tel: 'tel:+919025132196', 
        actionText: 'Call CrowdCity Support',
        whatsappPhone: '+91 90251 32196',
        whatsappActionText: 'Chat with Support'
      };

  const supportBtn = document.getElementById('contact-call-support-btn');
  if (supportBtn) {
    supportBtn.href = config.tel || 'tel:+919025132196';
    if (config.actionText) {
      supportBtn.setAttribute('aria-label', config.actionText);
    }
  }

  const waBtn = document.getElementById('contact-whatsapp-support-btn');
  if (waBtn) {
    const contactEnquiryMsg = "Hello CrowdCity Support, I would like to get in touch with your support team regarding an enquiry. Please assist me with the appropriate information.";
    const waPhone = (config.whatsappPhone || '+91 90251 32196').replace(/[^0-9]/g, '');
    waBtn.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(contactEnquiryMsg)}`;
    if (config.whatsappActionText) {
      waBtn.setAttribute('aria-label', `WhatsApp: ${config.whatsappActionText}`);
    }
  }
}

/**
 * Resolves the authenticated user's verified Name and Email with strict cross-user cache isolation.
 */
function resolveAuthenticatedContactIdentity(explicitUser, storageObj) {
  const storage = storageObj || (typeof localStorage !== 'undefined' ? localStorage : null);
  const user = explicitUser !== undefined
    ? explicitUser
    : (typeof getCurrentUser === 'function' ? getCurrentUser() : null);

  const currentUserId = user ? (user.id || user.sub) : null;
  if (!user || !currentUserId) {
    return { userId: null, name: '', email: '' };
  }

  let fullName = '';
  let email = user.email || '';
  let cachedProfile = null;

  if (storage) {
    // 1. Prefer user-scoped profile key
    const scopedProfileStr = storage.getItem(`cc_user_profile_${currentUserId}`);
    if (scopedProfileStr) {
      try {
        const parsed = JSON.parse(scopedProfileStr);
        if (parsed && (parsed.id === currentUserId || parsed.sub === currentUserId)) {
          cachedProfile = parsed;
        }
      } catch (e) {}
    }

    // 2. Check generic profile key ONLY if ID matches currentUserId; purge immediately if mismatched
    if (!cachedProfile) {
      const genericProfileStr = storage.getItem('cc_user_profile');
      if (genericProfileStr) {
        try {
          const parsed = JSON.parse(genericProfileStr);
          if (parsed && (parsed.id === currentUserId || parsed.sub === currentUserId)) {
            cachedProfile = parsed;
          } else {
            storage.removeItem('cc_user_profile');
          }
        } catch (e) {
          storage.removeItem('cc_user_profile');
        }
      }
    }
  }

  if (cachedProfile && cachedProfile.full_name) {
    fullName = cachedProfile.full_name;
  } else if (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) {
    fullName = user.user_metadata.full_name || user.user_metadata.name;
  } else if (user.full_name) {
    fullName = user.full_name;
  }

  if (cachedProfile && cachedProfile.email) {
    email = cachedProfile.email;
  }

  if (!fullName && email) {
    fullName = email.split('@')[0];
  }

  return {
    userId: currentUserId,
    name: (fullName || '').trim(),
    email: (email || '').trim()
  };
}

/**
 * Pre-fills and locks the user's Name and Email strictly from the currently authenticated user.
 */
async function prefillUserInfo() {
  try {
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');

    if (nameInput) {
      nameInput.readOnly = true;
      nameInput.setAttribute('readonly', 'readonly');
    }
    if (emailInput) {
      emailInput.readOnly = true;
      emailInput.setAttribute('readonly', 'readonly');
    }

    let user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

    // Fallback to active Supabase client session if getCurrentUser() is not yet populated
    if ((!user || !user.id) && typeof getOrInitSupabaseClient === 'function') {
      try {
        const client = await getOrInitSupabaseClient();
        if (client && client.auth) {
          const { data } = await client.auth.getUser();
          if (data && data.user) {
            user = data.user;
          }
        }
      } catch (e) {}
    }

    const identity = resolveAuthenticatedContactIdentity(user);
    verifiedContactIdentity = identity;

    // Always overwrite DOM values with current user's verified identity (or clear if unauthenticated)
    if (nameInput) {
      nameInput.value = identity.name || '';
    }
    if (emailInput) {
      emailInput.value = identity.email || '';
    }
  } catch (e) {
    console.warn('Could not read user profile for prefill:', e);
  }
}

/**
 * Select inquiry category from cards, sync with form dropdown, and smoothly scroll to "Send a Message"
 */
function selectContactCategory(category, cardElement) {
  // Update card active classes
  const cards = document.querySelectorAll('.contact-card-option');
  cards.forEach(c => c.classList.remove('active'));
  if (cardElement) {
    cardElement.classList.add('active');
  }

  // Update dropdown
  const categorySelect = document.getElementById('contact-category');
  if (categorySelect) {
    categorySelect.value = category;
  }

  // Smoothly scroll to the "Send a Message" form section immediately on all screen sizes
  const sendMessageSection = document.getElementById('send-message-section') || document.querySelector('.contact-form-panel');
  if (sendMessageSection && typeof sendMessageSection.scrollIntoView === 'function') {
    sendMessageSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Synchronize dropdown selection with card highlights
 */
function syncCategoryCardSelection(selectedCategory) {
  const cards = document.querySelectorAll('.contact-card-option');
  cards.forEach(card => {
    if (card.getAttribute('data-category') === selectedCategory) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

/**
 * Handle attachment file selection
 */
function handleAttachmentChange(input) {
  const statusText = document.getElementById('upload-status-text');
  const nameDisplay = document.getElementById('file-name-display');

  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert((window.i18n && window.i18n.t('contact_err_filesize')) || 'File size exceeds 5MB limit. Please select a smaller file.');
      input.value = '';
      if (statusText) statusText.style.display = 'inline';
      if (nameDisplay) nameDisplay.style.display = 'none';
      return;
    }

    if (statusText) statusText.style.display = 'none';
    if (nameDisplay) {
      nameDisplay.textContent = file.name;
      nameDisplay.style.display = 'inline';
    }
  } else {
    if (statusText) statusText.style.display = 'inline';
    if (nameDisplay) nameDisplay.style.display = 'none';
  }
}

// Double-submission guard flag
let isSubmittingContactForm = false;

/**
 * Synchronously updates the Send Message button between idle ("Send Message") and submitting ("Sending...") states.
 * Protects against i18n MutationObserver overwriting the button label during active submission.
 */
function setContactSubmitLoadingState(isLoading) {
  const submitBtn = document.getElementById('contact-submit-btn');
  const btnText = document.getElementById('btn-text');
  const submitIcon = document.getElementById('contact-submit-icon') ||
    (submitBtn && typeof submitBtn.querySelector === 'function' ? submitBtn.querySelector('i') : null);
  const isTamil = typeof document !== 'undefined' && document.documentElement &&
    (document.documentElement.lang === 'ta' ||
     (typeof document.documentElement.getAttribute === 'function' && document.documentElement.getAttribute('data-lang') === 'ta'));

  if (submitBtn) {
    submitBtn.disabled = Boolean(isLoading);
    if (typeof submitBtn.setAttribute === 'function') {
      submitBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      if (isLoading) {
        submitBtn.setAttribute('aria-disabled', 'true');
      } else if (typeof submitBtn.removeAttribute === 'function') {
        submitBtn.removeAttribute('aria-disabled');
      }
    }
    if (submitBtn.classList) {
      if (isLoading && typeof submitBtn.classList.add === 'function') {
        submitBtn.classList.add('is-submitting');
      } else if (!isLoading && typeof submitBtn.classList.remove === 'function') {
        submitBtn.classList.remove('is-submitting');
      }
    }
  }

  if (submitIcon) {
    submitIcon.className = isLoading
      ? 'fa-solid fa-circle-notch fa-spin'
      : 'fa-solid fa-paper-plane';
  }

  if (btnText) {
    if (isLoading) {
      // Temporarily remove data-i18n / data-orig-en so i18n MutationObserver does not overwrite "Sending..."
      if (typeof btnText.getAttribute === 'function' && typeof btnText.setAttribute === 'function' && typeof btnText.removeAttribute === 'function') {
        const existingI18n = btnText.getAttribute('data-i18n');
        if (existingI18n) {
          btnText.setAttribute('data-saved-i18n', existingI18n);
          btnText.removeAttribute('data-i18n');
        }
        const existingOrigEn = btnText.getAttribute('data-orig-en');
        if (existingOrigEn) {
          btnText.setAttribute('data-saved-orig-en', existingOrigEn);
          btnText.removeAttribute('data-orig-en');
        }
      }
      btnText.textContent = isTamil ? 'அனுப்பப்படுகிறது...' : 'Sending...';
    } else {
      if (typeof btnText.getAttribute === 'function' && typeof btnText.setAttribute === 'function' && typeof btnText.removeAttribute === 'function') {
        const savedI18n = btnText.getAttribute('data-saved-i18n') || 'contact_send_btn';
        btnText.setAttribute('data-i18n', savedI18n);
        btnText.removeAttribute('data-saved-i18n');
        const savedOrigEn = btnText.getAttribute('data-saved-orig-en');
        if (savedOrigEn) {
          btnText.setAttribute('data-orig-en', savedOrigEn);
          btnText.removeAttribute('data-saved-orig-en');
        }
      }
      btnText.textContent = isTamil ? 'செய்தி அனுப்பு' : 'Send Message';
    }
  }
}

/**
 * Form submission handler with immediate loading feedback, duplicate protection, validation, and API integration
 */
async function handleContactFormSubmit(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const submitBtn = document.getElementById('contact-submit-btn');

  // Strict double-submission protection (prevents double-click, repeated Enter key, or concurrent requests)
  if (isSubmittingContactForm || (submitBtn && submitBtn.disabled)) {
    return;
  }

  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const categorySelect = document.getElementById('contact-category');
  const subjectInput = document.getElementById('contact-subject');
  const messageInput = document.getElementById('contact-message');
  const attachmentInput = document.getElementById('contact-attachment');
  const errorMsg = document.getElementById('contact-error-msg');
  const form = document.getElementById('contact-form');
  const successBanner = document.getElementById('contact-success-banner');

  if (errorMsg) errorMsg.style.display = 'none';

  // Synchronously resolve authenticated user's verified Name and Email (0ms — no await before loading UI)
  const syncIdentity = resolveAuthenticatedContactIdentity();
  if (syncIdentity && syncIdentity.userId) {
    verifiedContactIdentity = syncIdentity;
  }
  const name = (syncIdentity.name || verifiedContactIdentity.name || nameInput?.value || '').trim();
  const email = (syncIdentity.email || verifiedContactIdentity.email || emailInput?.value || '').trim();

  if (nameInput && name) nameInput.value = name;
  if (emailInput && email) emailInput.value = email;

  // Synchronous validation
  const category = (categorySelect?.value || '').trim();
  const subject = (subjectInput?.value || '').trim();
  const message = (messageInput?.value || '').trim();

  if (!name) {
    showContactError('Please enter your full name.');
    nameInput?.focus();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showContactError('Please enter a valid email address.');
    emailInput?.focus();
    return;
  }

  if (!category) {
    showContactError('Please select an inquiry category.');
    categorySelect?.focus();
    return;
  }

  if (!subject) {
    showContactError('Please enter a subject.');
    subjectInput?.focus();
    return;
  }

  if (!message) {
    showContactError('Please enter your message.');
    messageInput?.focus();
    return;
  }

  // IMMEDIATELY enter submitting state before any async FileReader or network request
  isSubmittingContactForm = true;
  setContactSubmitLoadingState(true);

  try {
    let attachmentUrl = null;
    let attachmentName = null;
    let attachmentType = null;

    // Convert file to base64 data URL if present
    if (attachmentInput && attachmentInput.files && attachmentInput.files[0]) {
      const file = attachmentInput.files[0];
      attachmentName = file.name;
      attachmentType = file.type;
      attachmentUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    const payload = {
      name,
      email,
      category,
      subject,
      message,
      attachmentUrl,
      attachmentName,
      attachmentType
    };

    const response = await fetch('/api/auth/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && (data.success || !data.error)) {
      // Show Success State
      if (form) form.style.display = 'none';
      if (successBanner) successBanner.style.display = 'flex';
    } else {
      // Keep user's entered form data visible and show sanitized error message
      if (form) form.style.display = 'flex';
      if (successBanner) successBanner.style.display = 'none';
      showContactError('Unable to send your message. Please try again.');
    }
  } catch (err) {
    console.error('Contact submission error:', err);
    // Do NOT silently fake success on network/server failure — keep form data intact and notify user
    if (form) form.style.display = 'flex';
    if (successBanner) successBanner.style.display = 'none';
    showContactError('Unable to send your message. Please try again.');
  } finally {
    isSubmittingContactForm = false;
    setContactSubmitLoadingState(false);
  }
}

/**
 * Display inline error message and toast notification if available
 */
function showContactError(msg) {
  const safeMsg = msg || 'Unable to send your message. Please try again.';
  const errorMsg = document.getElementById('contact-error-msg');
  if (errorMsg) {
    errorMsg.textContent = safeMsg;
    errorMsg.style.display = 'block';
  }
  if (typeof window !== 'undefined') {
    if (typeof window.showToast === 'function') {
      window.showToast(safeMsg, 'error');
    } else if (typeof window.showNotification === 'function') {
      window.showNotification(safeMsg, 'error');
    }
  }
}

/**
 * Reset form to send another message
 */
function resetContactFormState() {
  isSubmittingContactForm = false;
  setContactSubmitLoadingState(false);

  const form = document.getElementById('contact-form');
  const successBanner = document.getElementById('contact-success-banner');
  const nameDisplay = document.getElementById('file-name-display');
  const statusText = document.getElementById('upload-status-text');
  const errorMsg = document.getElementById('contact-error-msg');

  if (errorMsg) errorMsg.style.display = 'none';
  if (form) {
    form.reset();
    form.style.display = 'flex';
  }
  if (successBanner) {
    successBanner.style.display = 'none';
  }
  if (nameDisplay) nameDisplay.style.display = 'none';
  if (statusText) statusText.style.display = 'inline';

  const cards = document.querySelectorAll('.contact-card-option');
  cards.forEach(c => c.classList.remove('active'));

  prefillUserInfo();
}

/**
 * Accordion toggle for FAQ items
 */
function toggleFaqItem(headerEl) {
  const parentItem = headerEl.closest('.faq-item');
  if (parentItem) {
    parentItem.classList.toggle('open');
  }
}
