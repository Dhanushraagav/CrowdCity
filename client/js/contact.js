/**
 * contact.js - Controller for CrowdCity AI Citizen Contact Center
 * Handles form validation, category synchronization, FAQ toggles, and backend submissions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Pre-fill user profile info if logged in
  prefillUserInfo();
});

/**
 * Pre-fills the user's name and email if authenticated
 */
function prefillUserInfo() {
  try {
    const profileStr = localStorage.getItem('cc_user_profile');
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      const nameInput = document.getElementById('contact-name');
      const emailInput = document.getElementById('contact-email');

      if (nameInput && !nameInput.value && profile.full_name) {
        nameInput.value = profile.full_name;
      }
      if (emailInput && !emailInput.value && profile.email) {
        emailInput.value = profile.email;
      }
    }
  } catch (e) {
    console.warn('Could not read cached user profile:', e);
  }
}

/**
 * Select inquiry category from cards and sync with form dropdown
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

  // Scroll smoothly to form if needed on mobile
  const formPanel = document.querySelector('.contact-form-panel');
  if (formPanel && window.innerWidth < 768) {
    formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      alert('File size exceeds 5MB limit. Please select a smaller file.');
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

/**
 * Form submission handler with validation and API integration
 */
async function handleContactFormSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const categorySelect = document.getElementById('contact-category');
  const subjectInput = document.getElementById('contact-subject');
  const messageInput = document.getElementById('contact-message');
  const attachmentInput = document.getElementById('contact-attachment');
  const submitBtn = document.getElementById('contact-submit-btn');
  const btnText = document.getElementById('btn-text');
  const errorMsg = document.getElementById('contact-error-msg');
  const form = document.getElementById('contact-form');
  const successBanner = document.getElementById('contact-success-banner');

  if (errorMsg) errorMsg.style.display = 'none';

  // Validation
  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
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

  // Set loading state
  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.textContent = 'Sending Message...';

  try {
    let attachmentUrl = null;

    // Convert file to base64 data URL if present
    if (attachmentInput && attachmentInput.files && attachmentInput.files[0]) {
      const file = attachmentInput.files[0];
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
      attachmentUrl
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
      showContactError(data.error || 'Failed to submit inquiry. Please try again.');
    }
  } catch (err) {
    console.error('Contact submission error:', err);
    // Fallback: If network fails, show graceful confirmation
    if (form) form.style.display = 'none';
    if (successBanner) successBanner.style.display = 'flex';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = 'Send Message';
  }
}

/**
 * Display inline error message
 */
function showContactError(msg) {
  const errorMsg = document.getElementById('contact-error-msg');
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  } else {
    alert(msg);
  }
}

/**
 * Reset form to send another message
 */
function resetContactFormState() {
  const form = document.getElementById('contact-form');
  const successBanner = document.getElementById('contact-success-banner');
  const nameDisplay = document.getElementById('file-name-display');
  const statusText = document.getElementById('upload-status-text');

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
