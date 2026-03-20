// audio-crossfade-engine.js
// Audio Crossfade Engine - smooth transitions between tracks

const AudioCrossfadeEngine = (() => {
  let crossfadeDuration = 5; // seconds
  let enabled = false;
  let isCrossfading = false;
  let nextAudio = null;
  let uiContainer = null;

  function init() {
    injectUI();
    hookIntoPlayer();
  }

  function injectUI() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'crossfade-panel';
    uiContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 20px;
      background: rgba(18,18,18,0.97);
      color: #fff;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 14px 18px;
      z-index: 9991;
      font-family: inherit;
      min-width: 230px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      display: none;
    `;
    uiContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-weight:700;font-size:14px;">Crossfade</span>
        <button id="crossfade-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:18px;">×</button>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;">
        <input id="crossfade-toggle" type="checkbox" ${enabled ? 'checked' : ''} />
        <span style="font-size:13px;">Enable Crossfade</span>
      </label>
      <div style="margin-bottom:8px;">
        <label style="font-size:12px;color:#aaa;">Duration: <span id="crossfade-duration-label">${crossfadeDuration}s</span></label>
        <input id="crossfade-slider" type="range" min="1" max="12" value="${crossfadeDuration}" style="width:100%;margin-top:4px;accent-color:#1db954;" />
      </div>
      <div id="crossfade-status" style="font-size:12px;color:#aaa;min-height:16px;"></div>
    `;
    document.body.appendChild(uiContainer);

    document.getElementById('crossfade-close').addEventListener('click', () => {
      uiContainer.style.display = 'none';
    });
    document.getElementById('crossfade-toggle').addEventListener('change', e => {
      enabled = e.target.checked;
      document.getElementById('crossfade-status').textContent = enabled ? 'Crossfade enabled' : 'Crossfade disabled';
    });
    document.getElementById('crossfade-slider').addEventListener('input', e => {
      crossfadeDuration = parseInt(e.target.value);
      document.getElementById('crossfade-duration-label').textContent = crossfadeDuration + 's';
    });

    addToggleButton();
  }

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'crossfade-toggle-btn';
    btn.title = 'Crossfade';
    btn.textContent = '🔀';
    btn.style.cssText = `
      position: fixed;
      bottom: 220px;
      right: 22px;
      background: rgba(30,30,30,0.95);
      border: 1px solid #444;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 18px;
      cursor: pointer;
      z-index: 9990;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener('click', () => {
      uiContainer.style.display = uiContainer.style.display === 'none' ? 'block' : 'none';
    });
    document.body.appendChild(btn);
  }

  function hookIntoPlayer() {
    // Listen for media end events on any audio element
    document.addEventListener('ended', e => {
      if (!enabled || isCrossfading) return;
      if (e.target && e.target.tagName === 'AUDIO') {
        startCrossfade(e.target);
      }
    }, true);

    // Monitor audio elements for pre-crossfade trigger
    const checkInterval = setInterval(() => {
      if (!enabled) return;
      const audio = document.querySelector('audio');
      if (!audio || audio.paused || !audio.duration) return;
      const remaining = audio.duration - audio.currentTime;
      if (remaining <= crossfadeDuration && remaining > 0 && !isCrossfading) {
        triggerPreCrossfade(audio, remaining / crossfadeDuration);
      }
    }, 500);
  }

  function triggerPreCrossfade(audio, ratio) {
    if (!enabled || isCrossfading) return;
    isCrossfading = true;
    const targetVol = ratio;
    audio.volume = Math.max(0, Math.min(1, targetVol));
    document.getElementById('crossfade-status').textContent = 'Crossfading...';
    setTimeout(() => { isCrossfading = false; }, (crossfadeDuration + 1) * 1000);
  }

  function startCrossfade(outAudio) {
    outAudio.volume = 0;
    const nextBtn = document.querySelector('[data-action="next"], .next-btn, button[aria-label*="Next"]');
    if (nextBtn) {
      nextBtn.click();
      fadeIn();
    }
    isCrossfading = false;
    document.getElementById('crossfade-status').textContent = 'Crossfade complete';
  }

  function fadeIn() {
    const audio = document.querySelector('audio');
    if (!audio) return;
    audio.volume = 0;
    const steps = 20;
    const stepTime = (crossfadeDuration * 1000) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.min(1, step / steps);
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }

  return { init, setDuration: d => { crossfadeDuration = d; } };
})();

document.addEventListener('DOMContentLoaded', () => AudioCrossfadeEngine.init());
export default AudioCrossfadeEngine;
