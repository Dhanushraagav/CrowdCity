// Authority Assigned Cases Module
document.addEventListener('DOMContentLoaded', () => {
  if (window.ComplaintService && typeof window.ComplaintService.init === 'function') {
    window.ComplaintService.init();
  }
});
