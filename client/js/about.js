/**
 * CrowdCity AI v2.0 - About Page Interactions & Animations
 * Manages scroll-driven timeline progress, GPU-accelerated 3D card tilt, hero ambient canvas, and section reveals.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initHeroCanvas();
    initScrollAnimations();
    initCard3DTilt();
  });

  // Premium Subtle Ambient Light Wave & Stardust Canvas Engine (Cross-Device 60FPS)
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

    // 1. Soft Ambient Silk Light Orbs
    const orbs = [
      { color: '20, 184, 166', baseRadius: 220, phaseX: 0, phaseY: 0, speedX: 0.004, speedY: 0.003, orbitX: 0.30, orbitY: 0.22 },
      { color: '56, 189, 248', baseRadius: 260, phaseX: Math.PI * 0.6, phaseY: Math.PI * 0.8, speedX: 0.003, speedY: 0.005, orbitX: 0.35, orbitY: 0.25 },
      { color: '16, 185, 129', baseRadius: 200, phaseX: Math.PI * 1.4, phaseY: Math.PI * 0.4, speedX: 0.005, speedY: 0.003, orbitX: 0.25, orbitY: 0.28 }
    ];

    // 2. Subtle Micro-Stardust Particles
    const particleCount = isMobile ? 18 : 36;
    const particles = [];

    function createParticles() {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.4 + 0.6,
          alpha: Math.random() * 0.4 + 0.1,
          speedY: -(Math.random() * 0.25 + 0.08),
          speedX: (Math.random() - 0.5) * 0.15,
          pulseSpeed: Math.random() * 0.02 + 0.01,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
    createParticles();

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      isMobile = window.innerWidth < 768;
      createParticles();
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

      // Mouse damping interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const isLight = document.documentElement.classList.contains('light-theme');
      const maxOrbAlpha = isLight ? 0.22 : 0.35;

      // Draw Floating Ambient Light Orbs
      orbs.forEach(orb => {
        const radiusScale = isMobile ? 0.6 : 1.0;
        const radius = orb.baseRadius * radiusScale * (1 + Math.sin(time * 0.005 + orb.phaseX) * 0.06);

        const cx = width * 0.5 + Math.cos(time * orb.speedX + orb.phaseX) * (width * orb.orbitX);
        const cy = height * 0.5 + Math.sin(time * orb.speedY + orb.phaseY) * (height * orb.orbitY);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.8);
        grad.addColorStop(0, `rgba(${orb.color}, ${maxOrbAlpha})`);
        grad.addColorStop(0.5, `rgba(${orb.color}, ${maxOrbAlpha * 0.4})`);
        grad.addColorStop(1, `rgba(${orb.color}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Interactive Ambient Mouse Spotlight Halo
      const mouseGradRadius = isMobile ? 130 : 230;
      const mouseGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouseGradRadius);
      mouseGrad.addColorStop(0, `rgba(56, 189, 248, ${maxOrbAlpha * 0.28})`);
      mouseGrad.addColorStop(0.5, `rgba(20, 184, 166, ${maxOrbAlpha * 0.12})`);
      mouseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = mouseGrad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouseGradRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw Delicate Micro-Stardust Particles
      particles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;

        // Wrap particles gracefully around canvas edges
        if (p.y < -10) p.y = height + 10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const pAlpha = (p.alpha * (0.6 + Math.sin(time * p.pulseSpeed + p.phase) * 0.4)) * (isLight ? 0.5 : 1.0);
        const particleColor = isLight ? `rgba(15, 23, 42, ${pAlpha * 0.4})` : `rgba(255, 255, 255, ${pAlpha})`;

        ctx.fillStyle = particleColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

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
