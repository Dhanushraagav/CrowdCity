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

  // Hero Section Interactive Network Node Canvas Animation
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;

    let nodes = [];
    let isMobile = window.innerWidth < 768;

    function buildNodes() {
      isMobile = window.innerWidth < 768;
      const numNodes = isMobile ? 12 : 42;
      nodes = [];
      for (let i = 0; i < numNodes; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.6),
          vy: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.6),
          radius: isMobile ? (Math.random() * 1.8 + 1.2) : (Math.random() * 3.2 + 1.8),
          alpha: isMobile ? (Math.random() * 0.3 + 0.25) : (Math.random() * 0.4 + 0.45)
        });
      }
    }

    buildNodes();

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      if ((window.innerWidth < 768) !== isMobile) {
        buildNodes();
      }
    });

    const heroSection = document.querySelector('.about-hero');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      const maxDist = isMobile ? 110 : 165;
      const alphaMult = isMobile ? 0.18 : 0.42;

      // Draw connecting network lines with screen-appropriate density
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * alphaMult;
            ctx.strokeStyle = `rgba(13, 148, 136, ${lineAlpha})`;
            ctx.lineWidth = isMobile ? 0.9 : 1.25;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update glowing nodes with active mouse attraction
      nodes.forEach(node => {
        const mdx = mouseX - node.x;
        const mdy = mouseY - node.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < (isMobile ? 120 : 220)) {
          node.x += (mdx / mdist) * 0.25;
          node.y += (mdy / mdist) * 0.25;
        }

        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        ctx.fillStyle = `rgba(13, 148, 136, ${node.alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
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

    // Update vertical timeline progress line smoothly on scroll (throttled with rAF)
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
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

  // Lag-Free GPU-Accelerated 3D Card Tilt Effect
  function initCard3DTilt() {
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
