//js/focus-mode.js
// Focus Mode (Zen Mode) - Hides UI clutter to focus on the music
// Toggle with 'F' key or via the command palette

let isFocusMode = false;
let previousSidebarState = null;

const FOCUS_MODE_CLASS = 'focus-mode-active';

// CSS to inject for focus mode
const focusModeStyles = `
  .focus-mode-active .side-panel {
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.4s ease, opacity 0.3s ease;
  }

  .focus-mode-active .search-container {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .focus-mode-active .nav-arrows {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .focus-mode-active .content-area {
    margin-left: 0 !important;
    transition: margin-left 0.4s ease;
  }

  .focus-mode-active .now-playing-bar {
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
  }

  .focus-mode-active .main-content {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 90px);
  }

  .focus-mode-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.92);
    backdrop-filter: blur(30px);
    z-index: 999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
  }

  .focus-mode-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .focus-mode-overlay .focus-album-art {
    width: min(400px, 70vw);
    height: min(400px, 70vw);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    object-fit: cover;
    margin-bottom: 2rem;
    animation: focusPulse 4s ease-in-out infinite alternate;
  }

  .focus-mode-overlay .focus-track-info {
    text-align: center;
    color: #fff;
  }

  .focus-mode-overlay .focus-track-title {
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }

  .focus-mode-overlay .focus-track-artist {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 400;
  }

  .focus-mode-overlay .focus-exit-hint {
    position: absolute;
    bottom: 20px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.8rem;
  }

  @keyframes focusPulse {
    from { transform: scale(1); }
    to { transform: scale(1.02); }
  }
`;

/**
 * Initialize focus mode - inject styles and create overlay
 */
export function initFocusMode() {
  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.id = 'focus-mode-styles';
  styleEl.textContent = focusModeStyles;
  document.head.appendChild(styleEl);

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'focus-mode-overlay';
  overlay.className = 'focus-mode-overlay';
  overlay.innerHTML = `
    <img class="focus-album-art" src="" alt="Album Art" />
    <div class="focus-track-info">
      <div class="focus-track-title"></div>
      <div class="focus-track-artist"></div>
    </div>
    <div class="focus-exit-hint">Press F or Escape to exit focus mode</div>
  `;
  document.body.appendChild(overlay);

  // Click overlay to exit
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('focus-exit-hint')) {
      toggleFocusMode();
    }
  });
}

/**
 * Toggle focus mode on/off
 */
export function toggleFocusMode() {
  isFocusMode = !isFocusMode;

  if (isFocusMode) {
    enterFocusMode();
  } else {
    exitFocusMode();
  }

  return isFocusMode;
}

/**
 * Enter focus mode
 */
function enterFocusMode() {
  document.body.classList.add(FOCUS_MODE_CLASS);

  const overlay = document.getElementById('focus-mode-overlay');
  if (overlay) {
    updateFocusOverlay();
    // Slight delay for smooth transition
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }
}

/**
 * Exit focus mode
 */
function exitFocusMode() {
  document.body.classList.remove(FOCUS_MODE_CLASS);

  const overlay = document.getElementById('focus-mode-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

/**
 * Update the focus mode overlay with current track info
 */
export function updateFocusOverlay() {
  if (!isFocusMode) return;

  const overlay = document.getElementById('focus-mode-overlay');
  if (!overlay) return;

  // Get current track info from the now-playing bar
  const albumArt = document.querySelector('.now-playing-bar img, .player-cover-art img');
  const titleEl = document.querySelector('.now-playing-bar .track-title, .player-track-title');
  const artistEl = document.querySelector('.now-playing-bar .track-artist, .player-track-artist');

  const focusArt = overlay.querySelector('.focus-album-art');
  const focusTitle = overlay.querySelector('.focus-track-title');
  const focusArtist = overlay.querySelector('.focus-track-artist');

  if (focusArt && albumArt) {
    focusArt.src = albumArt.src || '';
  }
  if (focusTitle) {
    focusTitle.textContent = titleEl?.textContent || 'No track playing';
  }
  if (focusArtist) {
    focusArtist.textContent = artistEl?.textContent || '';
  }
}

/**
 * Check if focus mode is currently active
 */
export function isFocusModeActive() {
  return isFocusMode;
}

/**
 * Get the focus mode state for saving in settings
 */
export function getFocusModeState() {
  return { active: isFocusMode };
}
