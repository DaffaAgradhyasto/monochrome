// mood-playlist.js
// Mood-Based Playlist Generator - create playlists based on mood/energy tags

const MoodPlaylist = (() => {
  const MOODS = [
    { id: 'happy', label: 'Happy', emoji: '😊', color: '#f1c40f', keywords: ['happy', 'joy', 'fun', 'bright', 'upbeat', 'cheerful', 'dance', 'pop'] },
    { id: 'sad', label: 'Sad', emoji: '😢', color: '#3498db', keywords: ['sad', 'melancholy', 'blue', 'longing', 'heartbreak', 'slow', 'ballad'] },
    { id: 'energetic', label: 'Energetic', emoji: '⚡', color: '#e74c3c', keywords: ['energy', 'rock', 'metal', 'fast', 'hype', 'intense', 'workout', 'power'] },
    { id: 'chill', label: 'Chill', emoji: '🌊', color: '#1abc9c', keywords: ['chill', 'relax', 'calm', 'ambient', 'lo-fi', 'lofi', 'peaceful', 'soft'] },
    { id: 'focus', label: 'Focus', emoji: '🎯', color: '#9b59b6', keywords: ['focus', 'study', 'concentration', 'instrumental', 'classical', 'minimal'] },
    { id: 'romantic', label: 'Romantic', emoji: '❤️', color: '#e91e63', keywords: ['love', 'romantic', 'sweet', 'tender', 'soul', 'r&b', 'smooth'] },
  ];

  let uiContainer = null;
  let currentMoodFilter = null;

  function init() {
    injectUI();
  }

  function injectUI() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'mood-playlist-panel';
    uiContainer.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      background: rgba(18,18,18,0.97);
      color: #fff;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 16px 18px;
      z-index: 9990;
      font-family: inherit;
      min-width: 260px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      display: none;
    `;

    const moodButtons = MOODS.map(m => `
      <button class="mood-btn" data-mood="${m.id}" style="
        background: rgba(255,255,255,0.06);
        border: 1px solid ${m.color}44;
        color: #fff;
        border-radius: 20px;
        padding: 6px 14px;
        margin: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s;
      ">
        ${m.emoji} ${m.label}
      </button>
    `).join('');

    uiContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-weight:700;font-size:15px;">Mood Playlist</span>
        <button id="mood-panel-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:18px;">×</button>
      </div>
      <p style="font-size:12px;color:#aaa;margin:0 0 10px;">Select a mood to filter your music library:</p>
      <div style="display:flex;flex-wrap:wrap;margin-bottom:12px;">${moodButtons}</div>
      <div id="mood-active-label" style="font-size:12px;color:#aaa;margin-bottom:8px;min-height:18px;"></div>
      <div id="mood-track-list" style="max-height:220px;overflow-y:auto;font-size:13px;"></div>
      <button id="mood-clear-btn" style="display:none;margin-top:10px;background:#444;color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;">Clear Filter</button>
    `;

    document.body.appendChild(uiContainer);

    document.getElementById('mood-panel-close').addEventListener('click', () => {
      uiContainer.style.display = 'none';
    });

    uiContainer.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const moodId = btn.dataset.mood;
        setMoodFilter(moodId);
      });
    });

    document.getElementById('mood-clear-btn').addEventListener('click', clearMoodFilter);

    addToggleButton();
  }

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'mood-toggle-btn';
    btn.title = 'Mood Playlist';
    btn.textContent = '🎭';
    btn.style.cssText = `
      position: fixed;
      bottom: 175px;
      right: 22px;
      background: rgba(30,30,30,0.95);
      border: 1px solid #444;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      font-size: 18px;
      cursor: pointer;
      z-index: 9989;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener('click', () => {
      uiContainer.style.display = uiContainer.style.display === 'none' ? 'block' : 'none';
    });
    document.body.appendChild(btn);
  }

  function setMoodFilter(moodId) {
    currentMoodFilter = moodId;
    const mood = MOODS.find(m => m.id === moodId);
    if (!mood) return;

    document.getElementById('mood-active-label').textContent = `Showing: ${mood.emoji} ${mood.label} tracks`;
    document.getElementById('mood-clear-btn').style.display = 'inline-block';

    const tracks = getAllTracks();
    const filtered = tracks.filter(t => matchesMood(t, mood));
    renderTrackList(filtered, mood.color);

    document.querySelectorAll('.mood-btn').forEach(b => {
      b.style.background = b.dataset.mood === moodId
        ? `rgba(255,255,255,0.18)`
        : 'rgba(255,255,255,0.06)';
    });
  }

  function clearMoodFilter() {
    currentMoodFilter = null;
    document.getElementById('mood-active-label').textContent = '';
    document.getElementById('mood-track-list').innerHTML = '';
    document.getElementById('mood-clear-btn').style.display = 'none';
    document.querySelectorAll('.mood-btn').forEach(b => {
      b.style.background = 'rgba(255,255,255,0.06)';
    });
  }

  function getAllTracks() {
    const items = [];
    document.querySelectorAll('[data-track], .track-item, .song-item, li[data-index]').forEach(el => {
      const title = el.querySelector('.title, .track-title, [data-title]')?.textContent?.trim()
        || el.getAttribute('data-title') || el.textContent?.trim()?.slice(0, 60);
      if (title) items.push({ el, title: title.toLowerCase() });
    });
    return items;
  }

  function matchesMood(track, mood) {
    return mood.keywords.some(kw => track.title.includes(kw));
  }

  function renderTrackList(tracks, color) {
    const container = document.getElementById('mood-track-list');
    if (!tracks.length) {
      container.innerHTML = '<div style="color:#666;padding:8px 0;">No matching tracks found in current view.</div>';
      return;
    }
    container.innerHTML = tracks.slice(0, 30).map(t => `
      <div style="padding:6px 0;border-bottom:1px solid #222;color:${color};cursor:pointer;" title="Click to play">
        ♪ ${t.title.slice(0, 50)}
      </div>
    `).join('');
    container.querySelectorAll('div').forEach((div, i) => {
      div.addEventListener('click', () => {
        if (tracks[i]?.el) tracks[i].el.click();
      });
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => MoodPlaylist.init());
export default MoodPlaylist;
