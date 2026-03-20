// playlist-analyzer.js
// Playlist Analyzer - analyze current playlist for stats, duplicates, and insights

const PlaylistAnalyzer = (() => {
  let uiContainer = null;

  function init() {
    injectUI();
  }

  function injectUI() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'playlist-analyzer-panel';
    uiContainer.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(16,16,16,0.98);
      color: #fff;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 18px 22px;
      z-index: 9994;
      font-family: inherit;
      min-width: 320px;
      max-width: 480px;
      width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7);
      display: none;
    `;
    uiContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <span style="font-weight:700;font-size:16px;">Playlist Analyzer</span>
        <button id="pa-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:20px;">×</button>
      </div>
      <button id="pa-analyze" style="background:#1db954;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:13px;font-weight:600;width:100%;margin-bottom:12px;">
        Analyze Current Playlist
      </button>
      <div id="pa-results"></div>
    `;
    document.body.appendChild(uiContainer);

    document.getElementById('pa-close').addEventListener('click', () => {
      uiContainer.style.display = 'none';
    });
    document.getElementById('pa-analyze').addEventListener('click', runAnalysis);

    addToggleButton();
  }

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'pa-toggle-btn';
    btn.title = 'Playlist Analyzer';
    btn.textContent = '📊';
    btn.style.cssText = `
      position: fixed;
      bottom: 355px;
      right: 22px;
      background: rgba(30,30,30,0.95);
      border: 1px solid #444;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 18px;
      cursor: pointer;
      z-index: 9993;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener('click', () => {
      uiContainer.style.display = uiContainer.style.display === 'none' ? 'block' : 'none';
    });
    document.body.appendChild(btn);
  }

  function getPlaylistTracks() {
    const tracks = [];
    const selectors = [
      '[data-track]', '.track-item', '.song-item', '.playlist-track',
      'li[data-index]', '.queue-item', '[role="row"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      const titleEl = el.querySelector('.title, .track-title, [data-title], .name') || el;
      const artistEl = el.querySelector('.artist, .track-artist, [data-artist]');
      const durationEl = el.querySelector('.duration, .time, [data-duration]');
      const title = titleEl?.textContent?.trim()?.slice(0, 80);
      const artist = artistEl?.textContent?.trim() || '';
      const duration = parseDuration(durationEl?.textContent?.trim() || '');
      if (title && title.length > 1) tracks.push({ title, artist, duration });
    });
    return tracks;
  }

  function parseDuration(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function formatDuration(seconds) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  function findDuplicates(tracks) {
    const seen = {};
    const dupes = [];
    tracks.forEach((t, i) => {
      const key = (t.title + '|' + t.artist).toLowerCase();
      if (seen[key] !== undefined) {
        dupes.push({ track: t, index: i, firstIndex: seen[key] });
      } else {
        seen[key] = i;
      }
    });
    return dupes;
  }

  function getTopArtists(tracks) {
    const counts = {};
    tracks.forEach(t => {
      if (t.artist) counts[t.artist] = (counts[t.artist] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  function runAnalysis() {
    const resultsEl = document.getElementById('pa-results');
    resultsEl.innerHTML = '<div style="color:#888;padding:8px 0;">Analyzing...</div>';

    setTimeout(() => {
      const tracks = getPlaylistTracks();
      if (!tracks.length) {
        resultsEl.innerHTML = '<div style="color:#888;padding:8px 0;">No tracks found in current view. Try opening a playlist first.</div>';
        return;
      }

      const totalDuration = tracks.reduce((s, t) => s + t.duration, 0);
      const dupes = findDuplicates(tracks);
      const topArtists = getTopArtists(tracks);
      const withArtist = tracks.filter(t => t.artist).length;

      let html = `
        <div style="background:#1a1a1a;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="font-weight:600;font-size:13px;color:#1db954;margin-bottom:8px;">📋 Overview</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div style="font-size:12px;color:#aaa;">Total Tracks <br><span style="font-size:18px;color:#fff;font-weight:700;">${tracks.length}</span></div>
            <div style="font-size:12px;color:#aaa;">Total Duration <br><span style="font-size:18px;color:#fff;font-weight:700;">${formatDuration(totalDuration)}</span></div>
            <div style="font-size:12px;color:#aaa;">Unique Artists <br><span style="font-size:16px;color:#fff;font-weight:700;">${new Set(tracks.map(t => t.artist).filter(Boolean)).size}</span></div>
            <div style="font-size:12px;color:#aaa;">Duplicates <br><span style="font-size:16px;color:${dupes.length > 0 ? '#e74c3c' : '#2ecc71'};font-weight:700;">${dupes.length}</span></div>
          </div>
        </div>
      `;

      if (topArtists.length) {
        html += `
          <div style="background:#1a1a1a;border-radius:10px;padding:12px;margin-bottom:10px;">
            <div style="font-weight:600;font-size:13px;color:#1db954;margin-bottom:8px;">🎤 Top Artists</div>
            ${topArtists.map(([artist, count]) => `
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
                <span style="color:#ddd;">${artist}</span>
                <span style="color:#1db954;">${count} track${count > 1 ? 's' : ''}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (dupes.length > 0) {
        html += `
          <div style="background:#1a1a1a;border-radius:10px;padding:12px;margin-bottom:10px;">
            <div style="font-weight:600;font-size:13px;color:#e74c3c;margin-bottom:8px;">⚠️ Duplicates Found</div>
            ${dupes.slice(0, 5).map(d => `
              <div style="font-size:12px;color:#f39c12;padding:3px 0;border-bottom:1px solid #222;">
                ${d.track.title} ${d.track.artist ? `- ${d.track.artist}` : ''}
                <span style="color:#888;"> (track #${d.firstIndex + 1} & #${d.index + 1})</span>
              </div>
            `).join('')}
            ${dupes.length > 5 ? `<div style="color:#888;font-size:11px;margin-top:4px;">...and ${dupes.length - 5} more</div>` : ''}
          </div>
        `;
      }

      if (totalDuration > 0) {
        const avgDuration = Math.round(totalDuration / tracks.filter(t => t.duration).length);
        html += `
          <div style="background:#1a1a1a;border-radius:10px;padding:12px;">
            <div style="font-weight:600;font-size:13px;color:#1db954;margin-bottom:8px;">⏱️ Duration Stats</div>
            <div style="font-size:12px;color:#aaa;">Average track length: <span style="color:#fff;">${formatDuration(avgDuration)}</span></div>
          </div>
        `;
      }

      resultsEl.innerHTML = html;
    }, 200);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PlaylistAnalyzer.init());
export default PlaylistAnalyzer;
