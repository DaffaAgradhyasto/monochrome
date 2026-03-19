// js/audio-normalizer.js
// Audio loudness normalization using Web Audio API
// Provides consistent volume levels across different tracks

const STORAGE_KEY = 'monochrome-audio-normalizer-v1';
const TARGET_LUFS = -14; // Standard streaming loudness target (Spotify/YouTube)
const ANALYSIS_DURATION = 10; // Analyze first 10 seconds for loudness

// Normalization modes
export const NORM_MODES = {
  OFF: 'off',
  TRACK: 'track',       // Per-track normalization
  ALBUM: 'album',       // Album-level normalization (preserves dynamics within album)
  DYNAMIC: 'dynamic',   // Real-time dynamic normalization
};

let currentMode = NORM_MODES.OFF;
let gainNode = null;
let analyserNode = null;
let audioContext = null;
let loudnessCache = {};
let isInitialized = false;
let currentGain = 1.0;
let dynamicProcessor = null;

// Load persisted settings
function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      currentMode = parsed.mode || NORM_MODES.OFF;
      loudnessCache = parsed.cache || {};
      return parsed;
    }
  } catch (e) {
    console.warn('[AudioNormalizer] Failed to load settings:', e);
  }
  return { mode: NORM_MODES.OFF, cache: {} };
}

// Save settings
function saveSettings() {
  try {
    // Limit cache size to 500 entries
    const entries = Object.entries(loudnessCache);
    if (entries.length > 500) {
      loudnessCache = Object.fromEntries(entries.slice(-400));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: currentMode,
      cache: loudnessCache,
    }));
  } catch (e) {
    console.warn('[AudioNormalizer] Failed to save settings:', e);
  }
}

// Initialize the normalizer with the audio context
export function initNormalizer(ctx, sourceNode) {
  if (isInitialized && audioContext === ctx) return gainNode;

  audioContext = ctx;

  // Create gain node for volume adjustment
  gainNode = ctx.createGain();
  gainNode.gain.value = 1.0;

  // Create analyser for loudness measurement
  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.8;

  // Connect: source -> analyser -> gain -> destination
  if (sourceNode) {
    sourceNode.connect(analyserNode);
    analyserNode.connect(gainNode);
  }

  loadSettings();
  isInitialized = true;

  console.log('[AudioNormalizer] Initialized with mode:', currentMode);
  return gainNode;
}

// Measure RMS loudness of current audio
function measureRMS() {
  if (!analyserNode) return -Infinity;

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  analyserNode.getFloatTimeDomainData(dataArray);

  let sumSquares = 0;
  for (let i = 0; i < bufferLength; i++) {
    sumSquares += dataArray[i] * dataArray[i];
  }

  const rms = Math.sqrt(sumSquares / bufferLength);
  // Convert to dB (approximate LUFS)
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

// Calculate gain adjustment to reach target loudness
function calculateGainAdjustment(measuredLUFS) {
  if (measuredLUFS === -Infinity || isNaN(measuredLUFS)) return 1.0;

  const difference = TARGET_LUFS - measuredLUFS;
  // Convert dB difference to linear gain
  let gain = Math.pow(10, difference / 20);

  // Clamp gain to prevent extreme amplification or attenuation
  gain = Math.max(0.1, Math.min(gain, 4.0));

  return gain;
}

// Analyze a track and cache its loudness
export async function analyzeTrack(trackId, audioBuffer) {
  if (!trackId) return null;

  // Check cache first
  if (loudnessCache[trackId]) {
    return loudnessCache[trackId];
  }

  try {
    // Analyze the audio buffer for loudness
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const samplesToAnalyze = Math.min(
      channelData.length,
      sampleRate * ANALYSIS_DURATION
    );

    let sumSquares = 0;
    for (let i = 0; i < samplesToAnalyze; i++) {
      sumSquares += channelData[i] * channelData[i];
    }

    const rms = Math.sqrt(sumSquares / samplesToAnalyze);
    const lufs = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

    const result = {
      lufs,
      gain: calculateGainAdjustment(lufs),
      analyzedAt: Date.now(),
    };

    loudnessCache[trackId] = result;
    saveSettings();

    return result;
  } catch (e) {
    console.warn('[AudioNormalizer] Analysis failed:', e);
    return null;
  }
}

// Apply normalization for a track
export function applyNormalization(trackId, albumId) {
  if (currentMode === NORM_MODES.OFF || !gainNode) {
    if (gainNode) gainNode.gain.value = 1.0;
    currentGain = 1.0;
    return;
  }

  let targetGain = 1.0;

  if (currentMode === NORM_MODES.TRACK) {
    const cached = loudnessCache[trackId];
    if (cached) {
      targetGain = cached.gain;
    }
  } else if (currentMode === NORM_MODES.ALBUM && albumId) {
    // Find average loudness for the album
    const albumTracks = Object.entries(loudnessCache)
      .filter(([key]) => key.startsWith(albumId + ':'));
    if (albumTracks.length > 0) {
      const avgGain = albumTracks.reduce((sum, [, val]) => sum + val.gain, 0)
        / albumTracks.length;
      targetGain = avgGain;
    }
  }

  // Smooth transition to new gain value
  const now = audioContext?.currentTime || 0;
  gainNode.gain.setTargetAtTime(targetGain, now, 0.1);
  currentGain = targetGain;
}

// Start dynamic normalization (real-time adjustment)
export function startDynamicNormalization() {
  if (dynamicProcessor) return;
  if (!analyserNode || !gainNode) return;

  let frameCount = 0;
  const UPDATE_INTERVAL = 30; // Update every 30 frames (~0.5s at 60fps)

  function processFrame() {
    frameCount++;
    if (frameCount % UPDATE_INTERVAL === 0) {
      const currentLUFS = measureRMS();
      if (currentLUFS > -60) { // Only adjust if there's meaningful audio
        const targetGain = calculateGainAdjustment(currentLUFS);
        // Slow smoothing for dynamic mode
        const smoothedGain = currentGain + (targetGain - currentGain) * 0.05;
        const clampedGain = Math.max(0.3, Math.min(smoothedGain, 3.0));
        gainNode.gain.setTargetAtTime(clampedGain, audioContext.currentTime, 0.3);
        currentGain = clampedGain;
      }
    }
    dynamicProcessor = requestAnimationFrame(processFrame);
  }

  dynamicProcessor = requestAnimationFrame(processFrame);
}

// Stop dynamic normalization
export function stopDynamicNormalization() {
  if (dynamicProcessor) {
    cancelAnimationFrame(dynamicProcessor);
    dynamicProcessor = null;
  }
}

// Set normalization mode
export function setNormalizationMode(mode) {
  if (!Object.values(NORM_MODES).includes(mode)) {
    console.warn('[AudioNormalizer] Invalid mode:', mode);
    return;
  }

  const prevMode = currentMode;
  currentMode = mode;

  // Stop dynamic processing if switching away from dynamic mode
  if (prevMode === NORM_MODES.DYNAMIC && mode !== NORM_MODES.DYNAMIC) {
    stopDynamicNormalization();
  }

  // Start dynamic processing if switching to dynamic mode
  if (mode === NORM_MODES.DYNAMIC) {
    startDynamicNormalization();
  }

  // Reset gain if turned off
  if (mode === NORM_MODES.OFF && gainNode) {
    gainNode.gain.setTargetAtTime(1.0, audioContext?.currentTime || 0, 0.1);
    currentGain = 1.0;
  }

  saveSettings();
  console.log('[AudioNormalizer] Mode set to:', mode);
}

// Get current mode
export function getNormalizationMode() {
  return currentMode;
}

// Get current gain value
export function getCurrentGain() {
  return currentGain;
}

// Get loudness info for a track
export function getTrackLoudness(trackId) {
  return loudnessCache[trackId] || null;
}

// Clear loudness cache
export function clearLoudnessCache() {
  loudnessCache = {};
  saveSettings();
}

// Get normalizer stats
export function getNormalizerStats() {
  const cacheEntries = Object.entries(loudnessCache);
  return {
    mode: currentMode,
    currentGain: Math.round(currentGain * 100) / 100,
    currentGainDb: Math.round(20 * Math.log10(currentGain) * 10) / 10,
    targetLufs: TARGET_LUFS,
    cachedTracks: cacheEntries.length,
    avgLoudness: cacheEntries.length > 0
      ? Math.round(
          cacheEntries.reduce((sum, [, v]) => sum + (v.lufs || 0), 0)
          / cacheEntries.length * 10
        ) / 10
      : null,
  };
}

// Export for settings UI integration
export const audioNormalizerSettings = {
  get mode() { return currentMode; },
  set mode(val) { setNormalizationMode(val); },
  get stats() { return getNormalizerStats(); },
  modes: NORM_MODES,
  init: initNormalizer,
  analyze: analyzeTrack,
  apply: applyNormalization,
  clearCache: clearLoudnessCache,
};
