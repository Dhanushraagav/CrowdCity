/**
 * CrowdCity AI - Emergency Maintenance Guard
 * Enforces global emergency maintenance mode across all portal pages.
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isBypassed = urlParams.get('bypass') === '1' || urlParams.get('admin') === '1' || window.location.pathname.includes('/admin') || window.location.pathname.includes('/authority');

  // If already on maintenance page or bypassed, skip overlay
  if (window.location.pathname.includes('/maintenance.html') || isBypassed) {
    return;
  }

  // Inject Emergency Maintenance Modal Overlay on Page Load
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.createElement('div');
    overlay.id = 'crowdcity-emergency-maintenance-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      box-sizing: border-box;
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="max-width: 540px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 2.25rem 1.75rem; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); box-sizing: border-box;">
        <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.35rem 0.85rem; border-radius: 999px; font-size: 0.76rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1.25rem;">
          <span style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; display: inline-block;"></span>
          <span>Emergency Maintenance Active</span>
        </div>

        <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.65rem; font-weight: 800; margin: 0 0 0.75rem 0; color: #ffffff;">
          CrowdCity Portal is Under Maintenance
        </h2>

        <p style="font-size: 0.9rem; color: #94a3b8; line-height: 1.6; margin: 0 0 1.75rem 0;">
          Our platform is currently undergoing scheduled emergency upgrades for security, AI engine enhancements, and database optimization.
        </p>

        <div style="background: rgba(13, 148, 136, 0.1); border: 1px dashed #0d9488; border-radius: 12px; padding: 1rem; margin-bottom: 1.75rem;">
          <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #0d9488; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Estimated Restoration</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: #ffffff;" id="overlay-timer">00h 45m 00s</div>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <a href="/maintenance.html" style="background: #0d9488; color: #ffffff; padding: 0.65rem 1.25rem; border-radius: 10px; font-size: 0.84rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem;">
            <i class="fa-solid fa-screwdriver-wrench"></i> View Maintenance Status
          </a>
          <a href="/emergency-services.html" style="background: transparent; color: #ffffff; border: 1px solid #334155; padding: 0.65rem 1.25rem; border-radius: 10px; font-size: 0.84rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem;">
            <i class="fa-solid fa-phone"></i> Emergency Help (100)
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Overlay Countdown Timer
    let targetTime = new Date().getTime() + (45 * 60 * 1000);
    setInterval(() => {
      const now = new Date().getTime();
      const distance = targetTime - now;
      const timerElem = document.getElementById('overlay-timer');
      if (!timerElem) return;

      if (distance <= 0) {
        timerElem.textContent = "Restoration In Progress...";
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const hStr = hours < 10 ? '0' + hours : hours;
      const mStr = minutes < 10 ? '0' + minutes : minutes;
      const sStr = seconds < 10 ? '0' + seconds : seconds;

      timerElem.textContent = `${hStr}h ${mStr}m ${sStr}s`;
    }, 1000);
  });
})();
