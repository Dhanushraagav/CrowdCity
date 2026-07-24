/**
 * EmergencyContacts.js - Directory & Copy Utility for CrowdCity AI v3.0 Emergency Center
 */

window.EmergencyContacts = {
  directory: [
    {
      id: 'c1',
      service: 'National Emergency Number',
      number: '112',
      availability: '24/7 Universal',
      description: 'Single emergency number for Police, Fire, and Ambulance services across India.'
    },
    {
      id: 'c2',
      service: 'Medical Ambulance',
      number: '108',
      availability: '24/7 Free',
      description: 'Emergency medical response, free ambulance, and critical healthcare dispatch.'
    },
    {
      id: 'c3',
      service: 'Police Control Room',
      number: '100',
      availability: '24/7 Emergency',
      description: 'Immediate law enforcement response, crime reporting, and emergency safety.'
    },
    {
      id: 'c4',
      service: 'Fire & Rescue Services',
      number: '101',
      availability: '24/7 Emergency',
      description: 'Firefighting, chemical hazard response, building collapse, and rescue.'
    },
    {
      id: 'c5',
      service: 'Women Helpline',
      number: '1091',
      availability: '24/7 Toll-Free',
      description: 'Dedicated safety, harassment response, and emergency protection for women.'
    },
    {
      id: 'c6',
      service: 'Childline / Protection',
      number: '1098',
      availability: '24/7 Emergency',
      description: 'Emergency care, protection, and rescue for children in distress.'
    },
    {
      id: 'c7',
      service: 'State Disaster Management',
      number: '1070',
      availability: '24/7 Response',
      description: 'Cyclone, flood, earthquake, and major natural disaster emergency control.'
    },
    {
      id: 'c8',
      service: 'District Disaster Control',
      number: '1077',
      availability: '24/7 Control',
      description: 'Local district collectorate emergency response and disaster rescue team.'
    }
  ],

  /**
   * Render table rows dynamically into target tbody element
   */
  renderTable: function(containerId) {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;

    tbody.innerHTML = this.directory.map(item => `
      <tr>
        <td>
          <strong style="color: var(--text-dark); font-size: 0.95rem;">${item.service}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">${item.description}</div>
        </td>
        <td>
          <span class="phone-number-badge">${item.number}</span>
        </td>
        <td>
          <span class="availability-badge">
            <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${item.availability}
          </span>
        </td>
        <td>
          <a href="tel:${item.number}" class="btn-table-call">
            <i class="fa-solid fa-phone"></i> Call ${item.number}
          </a>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Copy contact number to clipboard with visual toast feedback
   */
  copyNumber: function(number, title) {
    window.EmergencyLocation.copyToClipboard(number).then(() => {
      this.showToast(`Copied ${title} number (${number}) to clipboard`);
    }).catch(() => {
      this.showToast(`Number: ${number}`);
    });
  },

  showToast: function(message) {
    const existing = document.querySelector('.emergency-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'emergency-toast';
    toast.innerHTML = `<i class="fa-solid fa-check-circle" style="color: #10b981;"></i> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};
