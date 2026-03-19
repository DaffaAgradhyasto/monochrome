// js/playback-speed.js
// Variable playback speed control for music, podcasts, and audiobooks
// Supports speed presets, custom speeds, and pitch correction toggle

const STORAGE_KEY = 'monochrome-playback-speed-v1';

// Preset speed options
export const SPEED_PRESETS = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: 'Normal', value: 1.0 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '1.75x', value: 1.75 },
  { label: '2x', value: 2.0 },
  { label: '2.5x', value: 2.5 },
  { label: '3x', value: 3.0 },
];

// Speed range limits
const MIN_SPEED = 0.1;
const MAX_SPEED = 4.0;
const SPEED_STEP = 0.05;

let currentSpeed = 1.0;
let preservePitch = true;
let audioElement = null;
let speedChangeCallbacks = [];
let perTrackSpeeds = {};
let rememberPerTrack = false;

// Load settings
function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      currentSpeed = parsed.speed || 1.0;
      preservePitch = parsed.preservePitch !== false;
      perTrackSpeeds = parsed.perTrackSpeeds || {};
      rememberPerTrack = parsed.rememberPerTrack || false;
    }
  } catch (e) {
    console.warn('[PlaybackSpeed] Failed to load settings:', e);
  }
}

// Save settings
function saveSettings() {
  try {
    // Limit per-track cache
    const entries = Object.entries(perTrackSpeeds);
    if (entries.length > 200) {
      perTrackSpeeds = Object.fromEntries(entries.slice(-150));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      speed: currentSpeed,
      preservePitch,
      perTrackSpeeds,
      rememberPerTrack,
    }));
  } catch (e) {
    console.warn('[PlaybackSpeed] Failed to save settings:', e);
  }
}

// Notify listeners
function notifySpeedChange() {
  const info = {
    speed: currentSpeed,
    preservePitch,
    label: getSpeedLabel(currentSpeed),
  };
  speedChangeCallbacks.forEach(cb => {
    try { cb(info); } catch (e) { /* ignore */ }
  });
}

// Get human-readable speed label
function getSpeedLabel(speed) {
  if (speed === 1.0) return 'Normal';
  const preset = SPEED_PRESETS.find(p => Math.abs(p.value - speed) < 0.01);
  if (preset) return preset.label;
  return `${speed.toFixed(2)}x`;
}

// Initialize with an audio element
export function initPlaybackSpeed(element) {
  if (!element) {
    console.warn('[PlaybackSpeed] No audio element provided');
    return;
  }

  audioElement = element;
  loadSettings();

  // Apply saved speed
  applySpeed(currentSpeed);

  // Register keyboard shortcuts
  registerKeyboardShortcuts();

  console.log('[PlaybackSpeed] Initialized at', getSpeedLabel(currentSpeed));
}

// Apply speed to the audio element
function applySpeed(speed) {
  if (!audioElement) return;

  const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
  audioElement.playbackRate = clampedSpeed;

  // Pitch preservation (mozPreservesPitch for Firefox, preservesPitch for others)
  if ('preservesPitch' in audioElement) {
    audioElement.preservesPitch = preservePitch;
  }
  if ('mozPreservesPitch' in audioElement) {
    audioElement.mozPreservesPitch = preservePitch;
  }
  if ('webkitPreservesPitch' in audioElement) {
    audioElement.webkitPreservesPitch = preservePitch;
  }

  currentSpeed = clampedSpeed;
}

// Set playback speed
export function setSpeed(speed) {
  const clampedSpeed = Math.round(Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed)) * 100) / 100;
  applySpeed(clampedSpeed);
  saveSettings();
  notifySpeedChange();
  return clampedSpeed;
}

// Get current speed
export function getSpeed() {
  return currentSpeed;
}

// Increase speed by one step
export function increaseSpeed(step = SPEED_STEP) {
  return setSpeed(currentSpeed + step);
}

// Decrease speed by one step
export function decreaseSpeed(step = SPEED_STEP) {
  return setSpeed(currentSpeed - step);
}

// Reset to normal speed
export function resetSpeed() {
  return setSpeed(1.0);
}

// Cycle through preset speeds
export function cycleSpeed(direction = 1) {
  const currentIndex = SPEED_PRESETS.findIndex(
    p => Math.abs(p.value - currentSpeed) < 0.01
  );

  let nextIndex;
  if (currentIndex === -1) {
    // Current speed is not a preset, find the nearest
    const nearest = SPEED_PRESETS.reduce((prev, curr) =>
      Math.abs(curr.value - currentSpeed) < Math.abs(prev.value - currentSpeed) ? curr : prev
    );
    nextIndex = SPEED_PRESETS.indexOf(nearest) + direction;
  } else {
    nextIndex = currentIndex + direction;
  }

  // Wrap around
  if (nextIndex >= SPEED_PRESETS.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = SPEED_PRESETS.length - 1;

  return setSpeed(SPEED_PRESETS[nextIndex].value);
}

// Toggle pitch preservation
export function togglePreservePitch() {
  preservePitch = !preservePitch;
  applySpeed(currentSpeed);
  saveSettings();
  notifySpeedChange();
  return preservePitch;
}

// Set pitch preservation
export function setPreservePitch(value) {
  preservePitch = !!value;
  applySpeed(currentSpeed);
  saveSettings();
  notifySpeedChange();
}

// Get pitch preservation state
export function getPreservePitch() {
  return preservePitch;
}

// Set speed for a specific track (remembered)
export function setTrackSpeed(trackId, speed) {
  if (!trackId) return;
  perTrackSpeeds[trackId] = speed;
  setSpeed(speed);
}

// Apply remembered speed for a track
export function applyTrackSpeed(trackId) {
  if (!rememberPerTrack || !trackId) return currentSpeed;

  const savedSpeed = perTrackSpeeds[trackId];
  if (savedSpeed !== undefined) {
    return setSpeed(savedSpeed);
  }
  return currentSpeed;
}

// Toggle per-track speed memory
export function toggleRememberPerTrack() {
  rememberPerTrack = !rememberPerTrack;
  saveSettings();
  return rememberPerTrack;
}

// Register keyboard shortcuts for speed control
function registerKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

    // Shift + > (period) : increase speed
    if (e.shiftKey && e.key === '>') {
      e.preventDefault();
      increaseSpeed(0.25);
    }

    // Shift + < (comma) : decrease speed
    if (e.shiftKey && e.key === '<') {
      e.preventDefault();
      decreaseSpeed(0.25);
    }

    // Shift + 0 : reset speed
    if (e.shiftKey && e.key === ')') {
      e.preventDefault();
      resetSpeed();
    }

    // P key (without modifiers) : toggle pitch preservation
    // Note: only if not conflicting with other shortcuts
    if (e.key === 'P' && e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      togglePreservePitch();
    }
  });
}

// Register callback for speed changes
export function onSpeedChange(callback) {
  if (typeof callback === 'function') {
    speedChangeCallbacks.push(callback);
  }
  return () => {
    speedChangeCallbacks = speedChangeCallbacks.filter(cb => cb !== callback);
  };
}

// Get speed info for display
export function getSpeedInfo() {
  return {
    speed: currentSpeed,
    label: getSpeedLabel(currentSpeed),
    preservePitch,
    rememberPerTrack,
    isNormal: Math.abs(currentSpeed - 1.0) < 0.01,
    presets: SPEED_PRESETS,
    min: MIN_SPEED,
    max: MAX_SPEED,
    step: SPEED_STEP,
  };
}

// Create a speed control UI widget (returns HTML element)
export function createSpeedControlWidget() {
  const container = document.createElement('div');
  container.className = 'speed-control-widget';
  container.innerHTML = `
    <div class="speed-control-inner">
      <button class="speed-btn speed-decrease" aria-label="Decrease speed" title="Decrease speed (Shift+<)">-</button>
      <button class="speed-label-btn" aria-label="Current speed" title="Click to reset (Shift+0)">${getSpeedLabel(currentSpeed)}</button>
      <button class="speed-btn speed-increase" aria-label="Increase speed" title="Increase speed (Shift+>)">+</button>
    </div>
    <div class="speed-presets-row">
      ${SPEED_PRESETS.filter(p => [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].includes(p.value))
        .map(p => `<button class="speed-preset-btn ${Math.abs(p.value - currentSpeed) < 0.01 ? 'active' : ''}" data-speed="${p.value}">${p.label}</button>`)
        .join('')}
    </div>
  `;

  // Event listeners
  container.querySelector('.speed-decrease').addEventListener('click', () => decreaseSpeed(0.25));
  container.querySelector('.speed-increase').addEventListener('click', () => increaseSpeed(0.25));
  container.querySelector('.speed-label-btn').addEventListener('click', () => resetSpeed());
  container.querySelectorAll('.speed-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => setSpeed(parseFloat(btn.dataset.speed)));
  });

  // Update on speed change
  onSpeedChange((info) => {
    const labelBtn = container.querySelector('.speed-label-btn');
    if (labelBtn) labelBtn.textContent = info.label;

    container.querySelectorAll('.speed-preset-btn').forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - info.speed) < 0.01);
    });
  });

  return container;
}

// Export for settings/UI integration
export const playbackSpeedSettings = {
  get speed() { return currentSpeed; },
  set speed(val) { setSpeed(val); },
  get preservePitch() { return preservePitch; },
  set preservePitch(val) { setPreservePitch(val); },
  get info() { return getSpeedInfo(); },
  get rememberPerTrack() { return rememberPerTrack; },
  set rememberPerTrack(val) {
    rememberPerTrack = !!val;
    saveSettings();
  },
  presets: SPEED_PRESETS,
  init: initPlaybackSpeed,
  increase: increaseSpeed,
  decrease: decreaseSpeed,
  reset: resetSpeed,
  cycle: cycleSpeed,
  togglePitch: togglePreservePitch,
  createWidget: createSpeedControlWidget,
  onChange: onSpeedChange,
};
