// sleep-timer-advanced.js
// Advanced Sleep Timer - auto-pause music after set time or end of track/album

const SleepTimerAdvanced = (() => {
  let timerId = null;
  let endOfTrackMode = false;
  let endOfAlbumMode = false;
  let fadeOutDuration = 30; // seconds
  let remainingSeconds = 0;
  let countdownInterval = null;
  let uiContainer = null;

  function init() {
    injectUI();
    listenForTrackEnd();
  }

  function injectUI() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'sleep-timer-advanced';
    uiContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: rgba(20,20,20,0.97);
      color: #fff;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 14px 18px;
      z-index: 9999;
      font-family: inherit;
      min-width: 240px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      display: none;
    `;
    uiContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-weight:700;font-size:14px;">Sleep Timer</span>
        <button id="sleep-timer-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:18px;">×</button>
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:12px;color:#aaa;">After (minutes):</label>
        <input id="sleep-minutes-input" type="number" min="1" max="180" value="30" style="width:60px;margin-left:8px;background:#222;color:#fff;border:1px solid #444;border-radius:6px;padding:3px 6px;font-size:13px;" />
        <button id="sleep-start-timer" style="margin-left:8px;background:#1db954;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">Start</button>
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#aaa;cursor:pointer;">
          <input id="sleep-end-track" type="checkbox" />
          Stop after current track
        </label>
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#aaa;cursor:pointer;">
          <input id="sleep-end-album" type="checkbox" />
          Stop after current album
        </label>
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:12px;color:#aaa;">Fade out (seconds):</label>
        <input id="sleep-fade-input" type="number" min="0" max="60" value="30" style="width:50px;margin-left:8px;background:#222;color:#fff;border:1px solid #444;border-radius:6px;padding:3px 6px;font-size:13px;" />
      </div>
      <div id="sleep-countdown" style="font-size:13px;color:#1db954;min-height:20px;margin-top:4px;"></div>
      <button id="sleep-cancel-btn" style="display:none;margin-top:8px;background:#c0392b;color:#fff;border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;">Cancel Timer</button>
    `;
    document.body.appendChild(uiContainer);

    document.getElementById('sleep-timer-close').addEventListener('click', () => {
      uiContainer.style.display = 'none';
    });
    document.getElementById('sleep-start-timer').addEventListener('click', startTimer);
    document.getElementById('sleep-cancel-btn').addEventListener('click', cancelTimer);
    document.getElementById('sleep-end-track').addEventListener('change', e => {
      endOfTrackMode = e.target.checked;
      if (endOfTrackMode) document.getElementById('sleep-end-album').checked = false, endOfAlbumMode = false;
    });
    document.getElementById('sleep-end-album').addEventListener('change', e => {
      endOfAlbumMode = e.target.checked;
      if (endOfAlbumMode) document.getElementById('sleep-end-track').checked = false, endOfTrackMode = false;
    });

    addToggleButton();
  }

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'sleep-timer-toggle-btn';
    btn.title = 'Sleep Timer';
    btn.textContent = '😴';
    btn.style.cssText = `
      position: fixed;
      bottom: 130px;
      right: 22px;
      background: rgba(30,30,30,0.95);
      border: 1px solid #444;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 18px;
      cursor: pointer;
      z-index: 9998;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener('click', () => {
      uiContainer.style.display = uiContainer.style.display === 'none' ? 'block' : 'none';
    });
    document.body.appendChild(btn);
  }

  function startTimer() {
    cancelTimer();
    fadeOutDuration = parseInt(document.getElementById('sleep-fade-input').value) || 30;
    if (endOfTrackMode || endOfAlbumMode) {
      document.getElementById('sleep-countdown').textContent = endOfTrackMode ? 'Stopping after current track...' : 'Stopping after current album...';
      document.getElementById('sleep-cancel-btn').style.display = 'inline-block';
      return;
    }
    const minutes = parseInt(document.getElementById('sleep-minutes-input').value) || 30;
    remainingSeconds = minutes * 60;
    document.getElementById('sleep-cancel-btn').style.display = 'inline-block';
    countdownInterval = setInterval(() => {
      remainingSeconds--;
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      document.getElementById('sleep-countdown').textContent = `Pausing in: ${m}:${s.toString().padStart(2,'0')}`;
      if (remainingSeconds <= fadeOutDuration && fadeOutDuration > 0) {
        applyFadeOut(remainingSeconds / fadeOutDuration);
      }
      if (remainingSeconds <= 0) {
        pausePlayback();
        cancelTimer();
        document.getElementById('sleep-countdown').textContent = 'Playback paused by sleep timer.';
      }
    }, 1000);
  }

  function cancelTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = null;
    endOfTrackMode = false;
    endOfAlbumMode = false;
    restoreVolume();
    document.getElementById('sleep-countdown').textContent = '';
    document.getElementById('sleep-cancel-btn').style.display = 'none';
    document.getElementById('sleep-end-track').checked = false;
    document.getElementById('sleep-end-album').checked = false;
  }

  function listenForTrackEnd() {
    document.addEventListener('trackended', () => {
      if (endOfTrackMode) {
        pausePlayback();
        cancelTimer();
        document.getElementById('sleep-countdown').textContent = 'Playback paused after track.';
      }
    });
    document.addEventListener('albumended', () => {
      if (endOfAlbumMode) {
        pausePlayback();
        cancelTimer();
        document.getElementById('sleep-countdown').textContent = 'Playback paused after album.';
      }
    });
  }

  function pausePlayback() {
    const audio = document.querySelector('audio');
    if (audio) audio.pause();
    const playBtn = document.querySelector('[data-action="play"], .play-btn, button[aria-label*="Pause"]');
    if (playBtn) playBtn.click();
  }

  function applyFadeOut(ratio) {
    const audio = document.querySelector('audio');
    if (audio) audio.volume = Math.max(0, ratio);
  }

  function restoreVolume() {
    const audio = document.querySelector('audio');
    if (audio) audio.volume = 1;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => SleepTimerAdvanced.init());
export default SleepTimerAdvanced;
