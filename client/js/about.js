/**
 * CrowdCity AI v2.0 - About Page Interactions & Animations
 * Manages scroll-driven timeline progress, hero network canvas, and section reveals.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initHeroCanvas();
    initScrollAnimations();
  });

  // Hero Section Subtle Network Node Canvas Animation
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    });

    const numNodes = 25;
    const nodes = [];

    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw connecting network lines
      ctx.strokeStyle = 'rgba(13, 148, 136, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update nodes
      ctx.fillStyle = 'rgba(13, 148, 136, 0.4)';
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

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

    // Update vertical timeline progress line on scroll
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
})();
