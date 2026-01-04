// ClipMe Landing Page - JavaScript

document.addEventListener('DOMContentLoaded', () => {
  initInteractivePreview();
  initScrollAnimations();
  initSmoothScroll();
  initDecryptedText();
  initSpotlightCards();
  initHeaderScroll();
  initCouponCopy();
  initFAQ();
  initScrollSpy();
  initDownloadLinks();
  initPricingScroll();
});

// ========== Pricing Initial Scroll ==========
function initPricingScroll() {
  // Only for mobile
  if (window.innerWidth > 768) return;

  const grid = document.querySelector('.pricing-grid');
  const proCard = document.querySelector('.pricing-plan-pro');
  
  if (!grid || !proCard) return;

  // Wait a tick for layout
  setTimeout(() => {
    // Check if grid is scrollable
    if (grid.scrollWidth <= grid.clientWidth) return;

    // Calculate position to center/show Pro card
    // We want Pro card to be the first fully visible main element
    const paddingLeft = 24; // The padding on the grid
    const targetScroll = proCard.offsetLeft - grid.offsetLeft - paddingLeft;
    
    grid.scrollTo({
      left: targetScroll,
      behavior: 'auto'
    });
  }, 100);
}

// ========== GitHub Download Links ==========
function initDownloadLinks() {
  const btnMacSilicon = document.getElementById('download-mac-silicon');
  const btnMacIntel = document.getElementById('download-mac-intel');
  const btnWindows = document.getElementById('download-windows');

  // If buttons aren't there, skip
  if (!btnMacSilicon && !btnMacIntel && !btnWindows) return;

  fetch('https://api.github.com/repos/emrecv/clipme/releases/latest')
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      const assets = data.assets;
      if (!assets) return;

      // Find assets
      // Mac Silicon: looks for .dmg and 'aarch64'
      const macSilicon = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('aarch64'));
      
      // Mac Intel: looks for .dmg and NOT 'aarch64' (assuming x64 or universal is the other one)
      // updating logic to be safe: if there is another dmg that is NOT the silicon one, use it.
      const macIntel = assets.find(a => a.name.endsWith('.dmg') && !a.name.includes('aarch64'));

      // Windows: looks for .exe or .msi
      const windows = assets.find(a => a.name.endsWith('.exe') || a.name.endsWith('.msi'));

      if (btnMacSilicon && macSilicon) {
        btnMacSilicon.href = macSilicon.browser_download_url;
      }

      if (btnMacIntel && macIntel) {
        btnMacIntel.href = macIntel.browser_download_url;
      }

      if (btnWindows && windows) {
        btnWindows.href = windows.browser_download_url;
      }
      
      // Update Version Badge
      const versionBadge = document.getElementById('version-badge-text');
      if (versionBadge && data.tag_name) {
          // Remove 'v' from tag name if present for cleaner display "Version 1.0.1"
          const version = data.tag_name.replace(/^v/, '');
          versionBadge.textContent = `Version ${version} is here`;
      }
    })
    .catch(error => {
      console.warn('Failed to fetch latest releases:', error);
      // Fallback is already the releases page, so we don't need to do anything
    });
}

// ========== React Bits: Decrypted Text Effect ==========
function initDecryptedText() {
  const element = document.getElementById('heroTitle');
  if (!element) return;

  // Config
  const originalText = element.textContent;
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
  const speed = 50;
  const iterations = 15; // How many scrambles per letter

  // Split text into spans for granular control if needed,
  // but for simple effect we can just replace textContent

  // We only want to animate the "Clip. Convert. Done." part or the whole thing?
  // The HTML is: Clip. Convert. <span class="text-gradient">Done.</span>
  // Animating children is trickier. Let's just animate the "Done." part?
  // Or let's create a custom attribute data-value on elements we want to decrypt.

  // Let's target the .text-gradient span specifically for maximum impact
  const targetSpan = element.querySelector('.text-gradient');
  if (!targetSpan) return;

  const finalText = targetSpan.textContent;
  let iteration = 0;

  const interval = setInterval(() => {
    targetSpan.textContent = finalText
      .split('')
      .map((letter, index) => {
        if (index < iteration) {
          return finalText[index];
        }
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');

    if (iteration >= finalText.length) {
      clearInterval(interval);
    }

    iteration += 1 / 3; // Slow down the reveal
  }, 30);
}

// ========== React Bits: Spotlight Card Effect ==========
function initSpotlightCards() {
  const cards = document.querySelectorAll('.spotlight-card');

  document.addEventListener('mousemove', (e) => {
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

// ========== Header Scroll State ==========
function initHeaderScroll() {
  const header = document.querySelector('.matte-header');
  if (!header) return;

  const toggle = () => {
    const isScrolled = window.scrollY > 20;
    header.classList.toggle('is-scrolled', isScrolled);
  };

  toggle();
  window.addEventListener('scroll', toggle, { passive: true });
}

// ========== Interactive Mini Preview ==========
function initInteractivePreview() {
  const range = document.getElementById('demoRange');
  const handleLeft = document.getElementById('handleLeft');
  const handleRight = document.getElementById('handleRight');
  const track = document.querySelector('.demo-slider-track');

  // --- Draggable Handlers ---
  if (handleLeft && handleRight && track) {
    let isDragging = null; // 'left' or 'right'

    const updateRange = () => {
      const leftPos = parseFloat(handleLeft.style.left) || 20;
      const rightPos = parseFloat(handleRight.style.left) || 80;
      range.style.left = leftPos + '%';
      range.style.width = rightPos - leftPos + '%';
    };

    const onMove = (e) => {
      if (!isDragging) return;

      const rect = track.getBoundingClientRect();
      // Calculate percentage from 0 to 100
      let x = ((e.clientX - rect.left) / rect.width) * 100;

      // Constrain 0-100
      if (x < 0) x = 0;
      if (x > 100) x = 100;

      // Apply logic based on handle
      if (isDragging === 'left') {
        const rightPos = parseFloat(handleRight.style.left) || 80;
        // Don't cross right handle (min gap 5%)
        if (x > rightPos - 5) x = rightPos - 5;
        handleLeft.style.left = x + '%';
      } else {
        const leftPos = parseFloat(handleLeft.style.left) || 20;
        // Don't cross left handle (min gap 5%)
        if (x < leftPos + 5) x = leftPos + 5;
        handleRight.style.left = x + '%';
      }

      updateRange();
    };

    const onUp = () => {
      isDragging = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };

    const initDrag = (handle, type) => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text selection
        isDragging = type;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'ew-resize';
      });
    };

    // Initialize positions
    handleLeft.style.left = '20%';
    handleRight.style.left = '80%';
    updateRange();

    initDrag(handleLeft, 'left');
    initDrag(handleRight, 'right');
  }

  // --- Clickable Buttons & Toggles ---
  // Make play button toggle
  const playIcon = document.querySelector('.play-icon');
  if (playIcon) {
    playIcon.addEventListener('click', () => {
      playIcon.textContent = playIcon.textContent === '▶' ? '⏸' : '▶';
      playIcon.classList.toggle('active'); // Add a class for CSS scale effect
    });
  }

  // Make regular buttons "clicky"
  document
    .querySelectorAll('.demo-icon-btn, .demo-primary-btn')
    .forEach((btn) => {
      btn.addEventListener('click', function () {
        // Simple visual feedback
        this.style.transform = 'scale(0.95)';
        setTimeout(() => (this.style.transform = ''), 150);
      });
    });

  // Make dropdowns toggle active state
  document.querySelectorAll('.demo-select').forEach((select) => {
    select.addEventListener('click', function () {
      this.classList.toggle('active'); // CSS will handle appearance

      // Dummy logic to rotate chevron
      const svg = this.querySelector('svg');
      if (svg) {
        svg.style.transform = this.classList.contains('active')
          ? 'rotate(180deg)'
          : 'rotate(0deg)';
        svg.style.transition = 'transform 0.2s';
      }
    });

    // Ensure pointer cursor
    select.style.cursor = 'pointer';
  });
}

// ========== Scroll Animations ==========
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-visible'); // Use class instead of inline style for cleaner separation
          entry.target.style.animationPlayState = 'running';
        }
      });
    },
    { threshold: 0.1 }
  );

  // Select elements to animate
  document
    .querySelectorAll('.animate-in')
    .forEach((el) => observer.observe(el));
}

// ========== Smooth Anchor Scroll ==========
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });
}

// ========== Coupon Copy Functionality ==========
function initCouponCopy() {
  const couponBox = document.getElementById('couponCodeBox');
  if (!couponBox) return;

  couponBox.addEventListener('click', () => {
    const code = 'EARLYBIRD';
    navigator.clipboard.writeText(code).then(() => {
      // Show Feedback
      couponBox.classList.add('copied');

      // Hide after 2 seconds
      setTimeout(() => {
        couponBox.classList.remove('copied');
      }, 2000);
    });
  });
}

// ========== FAQ Accordion ==========
function initFAQ() {
  const items = document.querySelectorAll('.faq-item');

  items.forEach((item) => {
    const question = item.querySelector('.faq-question');
    
    question.addEventListener('click', () => {
      // Close other items (optional: accordion behavior)
      items.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
        }
      });

      // Toggle current
      item.classList.toggle('active');
    });
  });
}

// ========== Text Scroll Spy ==========
function initScrollSpy() {
  const sections = document.querySelectorAll('section, header');
  const navLinks = document.querySelectorAll('.nav-item');

  if (navLinks.length === 0) return;

  const onScroll = () => {
    let current = '';

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      // Offset for header height
      if (window.scrollY >= sectionTop - 150) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href.includes(current) && current !== '') {
        link.classList.add('active');
        
        // Auto-scroll nav to show active item
        const nav = document.querySelector('.header-nav');
        if (nav && link.offsetParent) {
          const navRect = nav.getBoundingClientRect();
          const linkRect = link.getBoundingClientRect();
          
          // Check if link is outside visible area of nav
          if (linkRect.left < navRect.left || linkRect.right > navRect.right) {
            link.scrollIntoView({ 
              behavior: 'smooth', 
              inline: 'center', 
              block: 'nearest' 
            });
          }
        }
      } else if (current === '' && href === '#') {
         // Default to top if nothing active
         // link.classList.add('active'); 
      }
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}
