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

  // Hero Section Ultra-Luxury Fluid Silk Aurora & Quantum Stardust Canvas Animation
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    let isMobile = window.innerWidth < 768;
    let time = 0;

    let mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2
    };

    // Responsive Floating Stardust Micro-Particles
    let particles = [];
    function initParticles() {
      isMobile = window.innerWidth < 768;
      const count = isMobile ? 16 : 42;
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * (isMobile ? 1.8 : 3.2) + 0.8,
          baseAlpha: Math.random() * 0.4 + 0.25,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -Math.random() * 0.4 - 0.15,
          color: i % 3 === 0 ? 'rgba(20, 184, 166,' : (i % 3 === 1 ? 'rgba(56, 189, 248,' : 'rgba(16, 185, 129,')
        });
      }
    }

    initParticles();

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      if ((window.innerWidth < 768) !== isMobile) {
        initParticles();
      }
    });

    const heroSection = document.querySelector('.about-hero');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        mouse.targetX = e.clientX - rect.left;
        mouse.targetY = e.clientY - rect.top;
      });
    }

    // 3 Layered Fluid Aurora Wave Ribbons
    const waves = [
      { amplitude: 38, frequency: 0.007, speed: 0.012, color: 'rgba(20, 184, 166, ', offset: 0 },
      { amplitude: 48, frequency: 0.005, speed: 0.008, color: 'rgba(56, 189, 248, ', offset: Math.PI * 0.6 },
      { amplitude: 30, frequency: 0.010, speed: 0.014, color: 'rgba(16, 185, 129, ', offset: Math.PI * 1.3 }
    ];

    function drawAuroraWave(wave, alphaMult) {
      ctx.beginPath();
      const step = isMobile ? 10 : 5;
      ctx.moveTo(0, height);

      for (let x = 0; x <= width + step; x += step) {
        const yBase = height * 0.52;
        const sin1 = Math.sin(x * wave.frequency + time * wave.speed + wave.offset);
        const sin2 = Math.cos(x * wave.frequency * 0.65 - time * wave.speed * 0.75);
        const distToMouse = Math.abs(x - mouse.x);
        const mouseRipple = Math.exp(-distToMouse / 220) * (mouse.y - yBase) * 0.12;

        const y = yBase + (sin1 + sin2 * 0.5) * wave.amplitude + mouseRipple;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      // Fluid Gradient Fill
      const grad = ctx.createLinearGradient(0, height * 0.25, 0, height);
      grad.addColorStop(0, wave.color + (0.32 * alphaMult) + ')');
      grad.addColorStop(0.65, wave.color + (0.10 * alphaMult) + ')');
      grad.addColorStop(1, 'rgba(9, 13, 22, 0)');

      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing Top Edge Line
      ctx.lineWidth = isMobile ? 1.2 : 1.8;
      ctx.strokeStyle = wave.color + (0.55 * alphaMult) + ')';
      ctx.stroke();
    }

    function animate() {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Mouse position easing
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      const isLight = document.documentElement.classList.contains('light-theme');
      const alphaMult = isLight ? 0.7 : 1.0;

      // 1. Render Fluid Aurora Waves
      waves.forEach(w => drawAuroraWave(w, alphaMult));

      // 2. Render Floating Quantum Stardust Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let alpha = p.baseAlpha;
        if (dist < 160) {
          alpha = Math.min(0.95, p.baseAlpha + (1 - dist / 160) * 0.55);
        }

        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2.8);
        radGrad.addColorStop(0, p.color + (alpha * alphaMult) + ')');
        radGrad.addColorStop(1, p.color + '0)');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.8, 0, Math.PI * 2);
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
