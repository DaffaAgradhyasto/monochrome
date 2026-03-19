// recently-played.js
// Recently Played History - track and display recently played songs with play count

const RecentlyPlayed = (() => {
  const STORAGE_KEY = 'monochrome_recently_played';
  const MAX_HISTORY = 50;
  let history = [];
  let uiContainer = null;
  let lastTrack = null;

  function init() {
    loadHistory();
    injectUI();
    startTracking();
  }

  function loadHistory() {
    try {
      history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { history = []; }
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  function getCurrentTrackInfo() {
    const titleEl = document.querySelector('.track-title, .song-title, [data-track-title], h1.title, .now-playing-title');
    const artistEl = document.querySelector('.artist, .track-artist, [data-artist], .now-playing-artist');
    const audio = document.querySelector('audio');
    return {
      title: titleEl?.textContent?.trim() || document.title || 'Unknown',
      artist: artistEl?.textContent?.trim() || '',
      src: audio?.src || '',
      timestamp: Date.now()
    };
  }

  function recordTrack(info) {
    const existing = history.findIndex(h => h.src === info.src || (h.title === info.title && h.artist === info.artist));
    if (existing !== -1) {
      const entry = history.splice(existing, 1)[0];
      entry.playCount = (entry.playCount || 1) + 1;
      entry.lastPlayed = Date.now();
      history.unshift(entry);
    } else {
      history.unshift({ ...info, playCount: 1, lastPlayed: Date.now() });
    }
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    saveHistory();
    if (uiContainer && uiContainer.style.display !== 'none') renderHistory();
  }

  function startTracking() {
    setInterval(() => {
      const audio = document.querySelector('audio');
      if (!audio || audio.paused) return;
      const info = getCurrentTrackInfo();
      if (info.title !== lastTrack) {
        lastTrack = info.title;
        recordTrack(info);
      }
    }, 3000);
  }

  function injectUI() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'recently-played-panel';
    uiContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 20px;
      background: rgba(18,18,18,0.97);
      color: #fff;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 14px 18px;
      z-index: 9993;
      font-family: inherit;
      min-width: 270px;
      max-width: 340px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      display: none;
    `;
    uiContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-weight:700;font-size:14px;">Recently Played</span>
        <button id="rp-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:18px;">×</button>
      </div>
      <div id="rp-list" style="max-height:300px;overflow-y:auto;font-size:13px;"></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <span id="rp-count" style="font-size:11px;color:#666;"></span>
        <button id="rp-clear" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:11px;">Clear History</button>
      </div>
    `;
    document.body.appendChild(uiContainer);

    document.getElementById('rp-close').addEventListener('click', () => {
      uiContainer.style.display = 'none';
    });
    document.getElementById('rp-clear').addEventListener('click', () => {
      history = [];
      saveHistory();
      renderHistory();
    });

    addToggleButton();
  }

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'rp-toggle-btn';
    btn.title = 'Recently Played';
    btn.textContent = '🕐';
    btn.style.cssText = `
      position: fixed;
      bottom: 310px;
      right: 22px;
      background: rgba(30,30,30,0.95);
      border: 1px solid #444;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 18px;
      cursor: pointer;
      z-index: 9992;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener('click', () => {
      const visible = uiContainer.style.display !== 'none';
      uiContainer.style.display = visible ? 'none' : 'block';
      if (!visible) renderHistory();
    });
    document.body.appendChild(btn);
  }

  function renderHistory() {
    const list = document.getElementById('rp-list');
    const countEl = document.getElementById('rp-count');
    if (!list) return;
    if (!history.length) {
      list.innerHTML = '<div style="color:#666;padding:6px 0;">No recently played tracks.</div>';
      if (countEl) countEl.textContent = '';
      return;
    }
    if (countEl) countEl.textContent = `${history.length} track${history.length > 1 ? 's' : ''}`;
    list.innerHTML = history.slice(0, 30).map((h, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1a1a1a;">
        <span style="font-size:18px;min-width:24px;text-align:center;color:#555;">${i + 1}</span>
        <div style="flex:1;overflow:hidden;">
          <div style="color:#fff;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.title}</div>
          ${h.artist ? `<div style="color:#888;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.artist}</div>` : ''}
        </div>
        <span style="font-size:11px;color:#1db954;min-width:28px;text-align:right;">${h.playCount > 1 ? '×' + h.playCount : ''}</span>
      </div>
    `).join('');
  }

  return { init, getHistory: () => history };
})();

document.addEventListener('DOMContentLoaded', () => RecentlyPlayed.init());
export default RecentlyPlayed;
