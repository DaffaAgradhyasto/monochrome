// track-bookmarks.js
// Track Bookmarks - save timestamp bookmarks within tracks for quick navigation

const TrackBookmarks = (() => {
  const STORAGE_KEY = 'monochrome_track_bookmarks';
  let bookmarks = {};
  let uiContainer = null;
  let currentTrack = null;

  function init() {
    loadBookmarks();
    injectUI();
    watchTrack();
  }

  function loadBookmarks() {
    try {
      bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { bookmarks = {}; }
  }

  function saveBookmarks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }

  function getAudio() {
    return document.querySelector('audio');
  }

  function getCurrentTrackId() {
    const audio = getAudio();
    if (!audio) return null;
    return audio.src || document.title || 'unknown';
  }

  function injectUI() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'track-bookmarks-panel';
    uiContainer.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: rgba(18,18,18,0.97);
      color: #fff;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 14px 18px;
      z-index: 9992;
      font-family: inherit;
      min-width: 260px;
      max-width: 320px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      display: none;
    `;
    uiContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-weight:700;font-size:14px;">Track Bookmarks</span>
        <button id="tbm-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:18px;">×</button>
      </div>
      <div style="margin-bottom:8px;display:flex;gap:6px;">
        <button id="tbm-add" style="background:#1db954;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;flex:1;">
          + Bookmark Current Position
        </button>
      </div>
      <div style="margin-bottom:6px;">
        <input id="tbm-label" type="text" placeholder="Optional label..." style="width:100%;box-sizing:border-box;background:#222;color:#fff;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:12px;" />
      </div>
      <div id="tbm-list" style="max-height:240px;overflow-y:auto;font-size:13px;"></div>
      <button id="tbm-clear" style="margin-top:8px;background:#555;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Clear All</button>
    `;
    document.body.appendChild(uiContainer);

    document.getElementById('tbm-close').addEventListener('click', () => {
      uiContainer.style.display = 'none';
    });
    document.getElementById('tbm-add').addEventListener('click', addBookmark);
    document.getElementById('tbm-clear').addEventListener('click', clearBookmarks);

    addToggleButton();
  }

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'tbm-toggle-btn';
    btn.title = 'Track Bookmarks';
    btn.textContent = '🔖';
    btn.style.cssText = `
      position: fixed;
      bottom: 265px;
      right: 22px;
      background: rgba(30,30,30,0.95);
      border: 1px solid #444;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 18px;
      cursor: pointer;
      z-index: 9991;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener('click', () => {
      uiContainer.style.display = uiContainer.style.display === 'none' ? 'block' : 'none';
      renderBookmarks();
    });
    document.body.appendChild(btn);
  }

  function addBookmark() {
    const audio = getAudio();
    if (!audio) return;
    const trackId = getCurrentTrackId();
    const time = audio.currentTime;
    const label = document.getElementById('tbm-label').value.trim() || formatTime(time);
    if (!bookmarks[trackId]) bookmarks[trackId] = [];
    bookmarks[trackId].push({ time, label, created: Date.now() });
    bookmarks[trackId].sort((a, b) => a.time - b.time);
    saveBookmarks();
    document.getElementById('tbm-label').value = '';
    renderBookmarks();
  }

  function clearBookmarks() {
    const trackId = getCurrentTrackId();
    if (trackId && bookmarks[trackId]) {
      delete bookmarks[trackId];
      saveBookmarks();
      renderBookmarks();
    }
  }

  function renderBookmarks() {
    const trackId = getCurrentTrackId();
    const list = document.getElementById('tbm-list');
    if (!list) return;
    const bms = (trackId && bookmarks[trackId]) || [];
    if (!bms.length) {
      list.innerHTML = '<div style="color:#666;padding:6px 0;">No bookmarks for this track.</div>';
      return;
    }
    list.innerHTML = bms.map((bm, i) => `
      <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #222;">
        <button class="tbm-goto" data-idx="${i}" style="background:#333;border:none;color:#1db954;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px;min-width:46px;">${formatTime(bm.time)}</button>
        <span style="flex:1;font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bm.label}</span>
        <button class="tbm-delete" data-idx="${i}" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:14px;padding:0 4px;">×</button>
      </div>
    `).join('');

    list.querySelectorAll('.tbm-goto').forEach(btn => {
      btn.addEventListener('click', () => {
        const audio = getAudio();
        if (audio) audio.currentTime = bms[parseInt(btn.dataset.idx)].time;
      });
    });

    list.querySelectorAll('.tbm-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        bms.splice(parseInt(btn.dataset.idx), 1);
        bookmarks[trackId] = bms;
        saveBookmarks();
        renderBookmarks();
      });
    });
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  function watchTrack() {
    setInterval(() => {
      const id = getCurrentTrackId();
      if (id !== currentTrack) {
        currentTrack = id;
        if (uiContainer.style.display !== 'none') renderBookmarks();
      }
    }, 2000);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => TrackBookmarks.init());
export default TrackBookmarks;
