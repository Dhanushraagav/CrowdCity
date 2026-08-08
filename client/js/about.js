/**
 * CrowdCity AI v2.0 - About Page Interactions & Animations
 * Manages scroll-driven timeline progress, interactive 3D card tilt effects, hero network canvas, and section reveals.
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

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    });

    const heroSection = document.querySelector('.about-hero');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      });
    }

    const numNodes = 32;
    const nodes = [];

    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2.2 + 1,
        alpha: Math.random() * 0.5 + 0.3
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw connecting network lines
      for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const lineAlpha = (1 - dist / 150) * 0.25;
            ctx.strokeStyle = `rgba(13, 148, 136, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update nodes with subtle mouse attraction
      nodes.forEach(node => {
        const mdx = mouseX - node.x;
        const mdy = mouseY - node.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 180) {
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
      threshold: 0.2
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, observerOptions);

    storyBlocks.forEach(block => observer.observe(block));

    // Update vertical timeline progress line smoothly on scroll
    window.addEventListener('scroll', () => {
      if (!progressLine) return;
      const track = document.querySelector('.team-story-section');
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalHeight = rect.height;

      let scrollProgress = (windowHeight / 2 - rect.top) / totalHeight;
      scrollProgress = Math.max(0, Math.min(1, scrollProgress));

      progressLine.style.height = `${scrollProgress * 100}%`;
    });
  }

  // Interactive Subtle 3D Card Tilt Effect
  function initCard3DTilt() {
    const cards = document.querySelectorAll('.purpose-card, .story-text-wrap');

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.015)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
      });
    });
  }
})();
