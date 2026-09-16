// Authority Case Details Inspection Console Module
function bootAuthorityDetails() {
  if (window.ComplaintService && typeof window.ComplaintService.init === 'function') {
    window.ComplaintService.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAuthorityDetails);
} else {
  bootAuthorityDetails();
}
