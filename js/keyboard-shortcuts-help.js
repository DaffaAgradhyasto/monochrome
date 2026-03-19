// js/keyboard-shortcuts-help.js
// Comprehensive keyboard shortcuts help overlay
// Press '?' to toggle the shortcuts help panel

const SHORTCUT_CATEGORIES = [
  {
    title: 'Playback',
    icon: '▶',
    shortcuts: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['→'], description: 'Seek forward 5s' },
      { keys: ['←'], description: 'Seek backward 5s' },
      { keys: ['Shift', '→'], description: 'Next track' },
      { keys: ['Shift', '←'], description: 'Previous track' },
      { keys: ['R'], description: 'Toggle repeat mode' },
      { keys: ['S'], description: 'Toggle shuffle' },
      { keys: ['M'], description: 'Mute / Unmute' },
      { keys: ['↑'], description: 'Volume up' },
      { keys: ['↓'], description: 'Volume down' },
    ]
  },
  {
    title: 'Navigation',
    icon: '🧭',
    shortcuts: [
      { keys: ['H'], description: 'Go to Home' },
      { keys: ['L'], description: 'Go to Library' },
      { keys: ['Q'], description: 'Toggle queue panel' },
      { keys: ['/', 'Ctrl+K'], description: 'Open search / Command palette' },
      { keys: ['Esc'], description: 'Close modal / panel' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ]
  },
  {
    title: 'Features',
    icon: '✨',
    shortcuts: [
      { keys: ['F'], description: 'Toggle Focus Mode (Zen)' },
      { keys: ['E'], description: 'Toggle Equalizer' },
      { keys: ['V'], description: 'Toggle Visualizer' },
      { keys: ['D'], description: 'Download current track' },
      { keys: ['Ctrl', 'Shift', 'L'], description: 'Toggle Lyrics' },
    ]
  },
  {
    title: 'General',
    icon: '⚙',
    shortcuts: [
      { keys: ['?'], description: 'Show this help' },
      { keys: ['Ctrl', 'Shift', 'F'], description: 'Toggle fullscreen' },
      { keys: ['T'], description: 'Toggle theme (dark/light)' },
      { keys: ['1-9'], description: 'Seek to 10%-90% of track' },
    ]
  }
];

let overlayEl = null;
let isVisible = false;

function createOverlayHTML() {
  const categoriesHTML = SHORTCUT_CATEGORIES.map(cat => {
    const shortcutsHTML = cat.shortcuts.map(s => {
      const keysHTML = s.keys.map(k =>
        `<kbd class="kbd-shortcut-key">${k}</kbd>`
      ).join('<span class="kbd-separator">+</span>');
      return `
        <div class="shortcut-row">
          <span class="shortcut-desc">${s.description}</span>
          <span class="shortcut-keys">${keysHTML}</span>
        </div>`;
    }).join('');

    return `
      <div class="shortcut-category">
        <h3 class="shortcut-category-title">
          <span class="shortcut-category-icon">${cat.icon}</span>
          ${cat.title}
        </h3>
        ${shortcutsHTML}
      </div>`;
  }).join('');

  return `
    <div class="shortcuts-overlay-backdrop" id="shortcuts-overlay">
      <div class="shortcuts-overlay-content">
        <div class="shortcuts-overlay-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="shortcuts-close-btn" aria-label="Close shortcuts help">&times;</button>
        </div>
        <div class="shortcuts-grid">
          ${categoriesHTML}
        </div>
        <div class="shortcuts-footer">
          <span>Press <kbd class="kbd-shortcut-key">?</kbd> or <kbd class="kbd-shortcut-key">Esc</kbd> to close</span>
        </div>
      </div>
    </div>`;
}

function injectStyles() {
  if (document.getElementById('keyboard-shortcuts-styles')) return;
  const style = document.createElement('style');
  style.id = 'keyboard-shortcuts-styles';
  style.textContent = `
    .shortcuts-overlay-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s ease, visibility 0.25s ease;
    }
    .shortcuts-overlay-backdrop.visible {
      opacity: 1;
      visibility: visible;
    }
    .shortcuts-overlay-content {
      background: var(--settings-bg, #1a1a2e);
      border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      border-radius: 16px;
      padding: 24px 28px;
      max-width: 750px;
      width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      transform: translateY(20px) scale(0.95);
      transition: transform 0.25s ease;
    }
    .shortcuts-overlay-backdrop.visible .shortcuts-overlay-content {
      transform: translateY(0) scale(1);
    }
    .shortcuts-overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1));
    }
    .shortcuts-overlay-header h2 {
      margin: 0;
      font-size: 1.4rem;
      color: var(--text-color, #fff);
      font-weight: 600;
    }
    .shortcuts-close-btn {
      background: none;
      border: none;
      color: var(--text-color, #aaa);
      font-size: 1.8rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      transition: background 0.15s;
      line-height: 1;
    }
    .shortcuts-close-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    .shortcuts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .shortcut-category {
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      padding: 16px;
    }
    .shortcut-category-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--accent-color, #7c5cfc);
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .shortcut-category-icon {
      font-size: 1.1rem;
    }
    .shortcut-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .shortcut-row:last-child {
      border-bottom: none;
    }
    .shortcut-desc {
      color: var(--text-color, #ccc);
      font-size: 0.85rem;
    }
    .shortcut-keys {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .kbd-shortcut-key {
      display: inline-block;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      color: var(--text-color, #ddd);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      min-width: 24px;
      text-align: center;
      white-space: nowrap;
    }
    .kbd-separator {
      color: var(--text-color, #666);
      font-size: 0.7rem;
      margin: 0 1px;
    }
    .shortcuts-footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));
      text-align: center;
      color: var(--text-color, #888);
      font-size: 0.8rem;
    }
    .shortcuts-footer kbd {
      margin: 0 2px;
    }
    @media (max-width: 600px) {
      .shortcuts-grid {
        grid-template-columns: 1fr;
      }
      .shortcuts-overlay-content {
        padding: 16px;
        max-height: 90vh;
      }
    }
  `;
  document.head.appendChild(style);
}

function createOverlay() {
  if (overlayEl) return overlayEl;
  injectStyles();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = createOverlayHTML();
  overlayEl = wrapper.firstElementChild;
  document.body.appendChild(overlayEl);

  overlayEl.querySelector('.shortcuts-close-btn')
    .addEventListener('click', hideShortcutsHelp);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) hideShortcutsHelp();
  });

  return overlayEl;
}

export function showShortcutsHelp() {
  const overlay = createOverlay();
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
  isVisible = true;
}

export function hideShortcutsHelp() {
  if (!overlayEl) return;
  overlayEl.classList.remove('visible');
  isVisible = false;
}

export function toggleShortcutsHelp() {
  if (isVisible) {
    hideShortcutsHelp();
  } else {
    showShortcutsHelp();
  }
}

export function isShortcutsHelpVisible() {
  return isVisible;
}

// Register the '?' key listener
export function initKeyboardShortcutsHelp() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input/textarea
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggleShortcutsHelp();
    }

    if (e.key === 'Escape' && isVisible) {
      e.preventDefault();
      hideShortcutsHelp();
    }
  });
}

// Auto-initialize
initKeyboardShortcutsHelp();
