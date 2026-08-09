/**
 * CrowdCity AI v2.0 - About Page Interactions & Animations
 * Manages scroll-driven timeline progress, GPU-accelerated 3D card tilt, hero network canvas, and section reveals.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initHeroCanvas();
    initScrollAnimations();
    initCard3DTilt();
  });

  // Hero Section Ultra-Sleek Glowing Ambient Glass Orbs & Soft Aurora Glow Canvas Animation
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    let isMobile = window.innerWidth < 768;

    let mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2
    };

    let time = 0;

    // Responsive Ambient Floating Light Orbs
    const orbs = [
      { color: '20, 184, 166', baseRadius: 180, phaseX: 0, phaseY: 0, speedX: 0.006, speedY: 0.005, orbitX: 0.28, orbitY: 0.25 },
      { color: '56, 189, 248', baseRadius: 220, phaseX: Math.PI * 0.5, phaseY: Math.PI * 0.7, speedX: 0.004, speedY: 0.007, orbitX: 0.32, orbitY: 0.22 },
      { color: '16, 185, 129', baseRadius: 160, phaseX: Math.PI * 1.2, phaseY: Math.PI * 0.3, speedX: 0.007, speedY: 0.004, orbitX: 0.25, orbitY: 0.30 },
      { color: '14, 148, 136', baseRadius: 240, phaseX: Math.PI * 1.8, phaseY: Math.PI * 1.4, speedX: 0.003, speedY: 0.006, orbitX: 0.30, orbitY: 0.28 }
    ];

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      isMobile = window.innerWidth < 768;
    });

    const heroSection = document.querySelector('.about-hero');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        mouse.targetX = e.clientX - rect.left;
        mouse.targetY = e.clientY - rect.top;
      });
    }

    function animate() {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse position damping
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const isLight = document.documentElement.classList.contains('light-theme');
      const maxAlpha = isLight ? 0.28 : 0.42;

      // Render Floating Glowing Ambient Glass Orbs
      orbs.forEach(orb => {
        const radiusScale = isMobile ? 0.65 : 1.0;
        const radius = orb.baseRadius * radiusScale * (1 + Math.sin(time * 0.008 + orb.phaseX) * 0.08);

        const cx = width * 0.5 + Math.cos(time * orb.speedX + orb.phaseX) * (width * orb.orbitX);
        const cy = height * 0.5 + Math.sin(time * orb.speedY + orb.phaseY) * (height * orb.orbitY);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.8);
        grad.addColorStop(0, `rgba(${orb.color}, ${maxAlpha})`);
        grad.addColorStop(0.45, `rgba(${orb.color}, ${maxAlpha * 0.45})`);
        grad.addColorStop(1, `rgba(${orb.color}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Interactive Soft Mouse Spotlight Halo
      const mouseGradRadius = isMobile ? 120 : 220;
      const mouseGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouseGradRadius);
      mouseGrad.addColorStop(0, `rgba(56, 189, 248, ${maxAlpha * 0.35})`);
      mouseGrad.addColorStop(0.5, `rgba(20, 184, 166, ${maxAlpha * 0.15})`);
      mouseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = mouseGrad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouseGradRadius, 0, Math.PI * 2);
      ctx.fill();

      requestAnimationFrame(animate);
    }

    animate();
  }

  // Scroll Animations & Timeline Progress Indicator
  function initScrollAnimations() {
    const storyBlocks = document.querySelectorAll('.story-block');
    const progressLine = document.getElementById('timeline-progress');

    if (!storyBlocks.length) return;

    // IntersectionObserver for team blocks
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -15% 0px',
      threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, observerOptions);

    storyBlocks.forEach(block => observer.observe(block));

    // Update top progress accent bar and vertical timeline progress line smoothly on scroll (throttled with rAF)
    const topBar = document.getElementById('scroll-progress-top');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Top scroll bar calculation
          if (topBar) {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            topBar.style.width = `${scrollPercent}%`;
          }

          // Vertical timeline track calculation
          if (progressLine) {
            const track = document.querySelector('.team-story-section');
            if (track) {
              const rect = track.getBoundingClientRect();
              const windowHeight = window.innerHeight;
              const totalHeight = rect.height;

              let scrollProgress = (windowHeight / 2 - rect.top) / totalHeight;
              scrollProgress = Math.max(0, Math.min(1, scrollProgress));
              progressLine.style.height = `${scrollProgress * 100}%`;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // Lag-Free GPU-Accelerated 3D Card Tilt Effect (Desktop & Laptop Pointer Only)
  function initCard3DTilt() {
    if (window.matchMedia('(hover: none) or (pointer: coarse)').matches) return;

    const cards = document.querySelectorAll('.help-card, .purpose-card, .story-text-wrap');

    cards.forEach(card => {
      let rAF = null;

      card.addEventListener('mousemove', (e) => {
        if (rAF) cancelAnimationFrame(rAF);

        rAF = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const rotateX = ((y - centerY) / centerY) * -4.5;
          const rotateY = ((x - centerX) / centerX) * 4.5;

          card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -5px, 0)`;
        });
      });

      card.addEventListener('mouseleave', () => {
        if (rAF) cancelAnimationFrame(rAF);
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';
      });
    });
  }
})();
