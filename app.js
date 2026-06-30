// Register GSAP ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

// Configuration Constants
const TOTAL_FRAMES = 210;
const images = [];
const frameProgressObj = { frame: 0 };

// DOM Elements
const canvas = document.getElementById('aditya-canvas');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const progressBar = document.getElementById('loader-progress');
const progressText = document.getElementById('loader-percentage');
const scrubSlider = document.getElementById('scrub-slider');
const playBtn = document.getElementById('btn-play');
const speedButtons = document.querySelectorAll('.speed-btn');

// HUD indicators
const hudDistance = document.getElementById('hud-distance');
const hudFrame = document.getElementById('hud-frame');
const hudScroll = document.getElementById('hud-scroll');
const hudSystemState = document.getElementById('hud-system-state');
const hudWind = document.getElementById('hud-wind');

// Interactive states
let isAutoplay = false;
let autoplayInterval = null;
let currentSpeed = 1.0;

// Helper to format frame numbers (e.g. 1 -> "001")
const padZero = (num) => num.toString().padStart(3, '0');

// Generate image path
const getImagePath = (index) => `./ezgif-frame-${padZero(index)}.jpg`;

// ==========================================================================
// PRE-LOADING IMAGES
// ==========================================================================
let loadedCount = 0;

function preloadImages() {
  return new Promise((resolve) => {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getImagePath(i);
      img.onload = () => {
        loadedCount++;
        updateLoaderProgress();
        if (loadedCount === TOTAL_FRAMES) {
          onPreloadComplete(resolve);
        }
      };
      img.onerror = () => {
        // Fallback for errors to keep progress moving
        console.warn(`Failed to load frame ${i}, skipping...`);
        loadedCount++;
        updateLoaderProgress();
        if (loadedCount === TOTAL_FRAMES) {
          onPreloadComplete(resolve);
        }
      };
      images.push(img);
    }
  });
}

function updateLoaderProgress() {
  const percent = Math.min(Math.round((loadedCount / TOTAL_FRAMES) * 100), 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
}

function onPreloadComplete(resolve) {
  setTimeout(() => {
    loader.classList.add('loaded');
    resolve();
  }, 500); // Small delay for visual polish
}

// ==========================================================================
// CANVAS RENDER LOGIC
// ==========================================================================
function resizeCanvas() {
  // Set canvas bounds to match the inner viewport dimensions
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Re-draw current frame
  const currentFrameIndex = Math.round(frameProgressObj.frame);
  renderFrame(currentFrameIndex);
}

function renderFrame(index) {
  const img = images[index];
  if (!img) return;

  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;

  if (!imgWidth || !imgHeight) {
    // If the image failed to load or has 0 dimensions, search for the closest valid frame to render
    let closestImg = null;
    let minDiff = Infinity;
    for (let i = 0; i < images.length; i++) {
      if (images[i] && images[i].naturalWidth && images[i].naturalHeight) {
        const diff = Math.abs(i - index);
        if (diff < minDiff) {
          minDiff = diff;
          closestImg = images[i];
        }
      }
    }
    if (closestImg) {
      drawImg(closestImg);
    }
    return;
  }

  drawImg(img);
}

function drawImg(img) {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;

  const imgRatio = imgWidth / imgHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth, drawHeight, drawX, drawY;

  if (canvasRatio > imgRatio) {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imgRatio;
    drawHeight = canvasHeight;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// ==========================================================================
// GSAP SCROLL ANIMATION BINDINGS
// ==========================================================================
let scrollTriggerInstance = null;

function initScrollAnimation() {
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if (hasGSAP) {
    scrollTriggerInstance = ScrollTrigger.create({
      trigger: "#scroll-wrapper",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
      onUpdate: (self) => {
        const targetFrame = self.progress * (TOTAL_FRAMES - 1);
        gsap.to(frameProgressObj, {
          frame: targetFrame,
          duration: 0.15,
          ease: "power1.out",
          onUpdate: () => {
            const index = Math.round(frameProgressObj.frame);
            renderFrame(index);
            updateHUD(index, self.progress);
          }
        });
      }
    });

    const sections = document.querySelectorAll('.scroll-section');
    sections.forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: "top 75%",
        end: "bottom 25%",
        onEnter: () => section.querySelector('.section-content').classList.add('active'),
        onLeave: () => section.querySelector('.section-content').classList.remove('active'),
        onEnterBack: () => section.querySelector('.section-content').classList.add('active'),
        onLeaveBack: () => section.querySelector('.section-content').classList.remove('active')
      });
    });
  } else {
    console.warn("GSAP / ScrollTrigger not loaded. Falling back to native scroll listener.");
    
    // Native Scroll Listener Fallback
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      
      const targetFrame = progress * (TOTAL_FRAMES - 1);
      const index = Math.round(targetFrame);
      
      frameProgressObj.frame = index;
      renderFrame(index);
      updateHUD(index, progress);
      
      // Native Section Fade-In
      const sections = document.querySelectorAll('.scroll-section');
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const content = section.querySelector('.section-content');
        if (rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Run once initially
  }

  // Activate first section content on load
  setTimeout(() => {
    const firstSec = document.querySelector('#sec-hero .section-content');
    if (firstSec) firstSec.classList.add('active');
  }, 800);
}

// Update HUD & UI Slider based on current frame and scroll progress
function updateHUD(frameIndex, scrollProgress) {
  // Format variables
  const frameNumStr = padZero(frameIndex + 1);
  const scrollPercentVal = Math.round(scrollProgress * 100);
  
  // 1. Slider update (without triggering slider's input listener loop)
  scrubSlider.value = frameIndex + 1;
  
  // 2. HUD texts update
  hudFrame.textContent = `${frameNumStr} / ${padZero(TOTAL_FRAMES)}`;
  hudScroll.textContent = `${scrollPercentVal}%`;
  
  // 3. Dynamic distance tracker telemetry effect (1.5 million km total)
  const currentDistance = Math.round(scrollProgress * 1500000);
  hudDistance.textContent = `${currentDistance.toLocaleString()} KM`;
}

function updateTelemetryDisplay(state) {
  if (!state) return;

  if (hudWind) {
    hudWind.textContent = `${state.solarWindSpeed} km/s`;
  }

  if (hudSystemState) {
    hudSystemState.textContent = state.systemState || 'NOMINAL';
    hudSystemState.classList.remove('text-green', 'text-gold', 'text-danger');

    if (state.alertActive) {
      hudSystemState.classList.add('text-danger');
    } else if (state.systemState === 'NOMINAL') {
      hudSystemState.classList.add('text-green');
    } else {
      hudSystemState.classList.add('text-gold');
    }
  }
}

function initTelemetryStream() {
  if (!window.EventSource) return;

  const telemetrySource = new EventSource('/api/telemetry/stream');
  telemetrySource.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data);
      updateTelemetryDisplay(state);
    } catch (err) {
      console.warn('Unable to parse telemetry stream:', err);
    }
  };

  telemetrySource.onerror = () => {
    console.warn('Telemetry stream connection lost.');
    telemetrySource.close();
  };
}

// ==========================================================================
// DOCK CONTROLS (AUTOPLAY, SPEED, SCRUBBING)
// ==========================================================================

// Autoplay
function toggleAutoplay() {
  isAutoplay = !isAutoplay;
  if (isAutoplay) {
    playBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    `;
    startAutoplayLoop();
  } else {
    playBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `;
    stopAutoplayLoop();
  }
}

function startAutoplayLoop() {
  if (autoplayInterval) clearInterval(autoplayInterval);
  
  autoplayInterval = setInterval(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    let nextScroll = window.scrollY + (currentSpeed * 3);
    
    // Loop back to start if bottom is reached
    if (nextScroll >= scrollHeight) {
      nextScroll = 0;
    }
    
    window.scrollTo(0, nextScroll);
  }, 16); // ~60fps updates
}

function stopAutoplayLoop() {
  if (autoplayInterval) {
    clearInterval(autoplayInterval);
    autoplayInterval = null;
  }
}

// Manual Scrubbing slider
scrubSlider.addEventListener('input', (e) => {
  if (isAutoplay) toggleAutoplay(); // pause autoplay on user drag
  
  const targetFrameVal = parseInt(e.target.value);
  const ratio = (targetFrameVal - 1) / (TOTAL_FRAMES - 1);
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  
  // Instantly scroll window to corresponding ratio
  window.scrollTo(0, ratio * scrollHeight);
});

// Speed settings selector
speedButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    speedButtons.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentSpeed = parseFloat(e.target.dataset.speed);
    
    // Refresh autoplay interval if active
    if (isAutoplay) {
      startAutoplayLoop();
    }
  });
});

// Interactive Replay / Scroll helper
function restartJourney() {
  if (isAutoplay) toggleAutoplay();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// Stop autoplay if user manually scrolls/interacts with wheel or keys
window.addEventListener('wheel', () => {
  if (isAutoplay) toggleAutoplay();
});
window.addEventListener('touchmove', () => {
  if (isAutoplay) toggleAutoplay();
});

// Play/Pause button trigger
playBtn.addEventListener('click', toggleAutoplay);


// ==========================================================================
// SCIENTIFIC PAYLOADS TABS INTERACTION
// ==========================================================================
const payloadTabs = document.querySelectorAll('.payload-tab');
const payloadDetails = document.querySelectorAll('.payload-detail');

payloadTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    // Deactivate current active tab
    payloadTabs.forEach(t => t.classList.remove('active'));
    payloadDetails.forEach(d => d.classList.remove('active'));
    
    // Activate clicked tab
    const payloadId = e.target.dataset.payload;
    e.target.classList.add('active');
    
    const targetDetail = document.getElementById(`payload-${payloadId}`);
    if (targetDetail) targetDetail.classList.add('active');
  });
});


// ==========================================================================
// APP INITIALIZATION
// ==========================================================================
async function init() {
  // 1. Preload all frame images
  await preloadImages();
  
  // 2. Setup canvas drawing & initial frame
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // 3. Setup scroll triggers and animations
  initScrollAnimation();

  // 4. Initialize live telemetry stream
  initTelemetryStream();
}

// Run app init
window.addEventListener('DOMContentLoaded', init);
