// js/activity-feed.js
import { db } from './db.js';
import { navigate } from './router.js';
import { escapeHtml, formatTime, getTrackArtists } from './utils.js';
import { showNotification } from './downloads.js';

export class ActivityFeed {
    constructor(player) {
        this._player = player;
        this._container = null;
        this._activeFilter = 'all';
        this._entries = [];
        this._boundClickHandler = this._handleClick.bind(this);
    }

    async _getRecentActivity(limit = 100) {
        try {
            const history = await db.getHistory(limit);
            if (!history || !Array.isArray(history)) return [];
            return history;
        } catch (err) {
            console.error('ActivityFeed: failed to fetch history', err);
            return [];
        }
    }

    _formatRelativeTime(timestamp) {
        if (!timestamp) return '';

        const now = Date.now();
        const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
        const diff = now - ts;

        if (diff < 0) return 'just now';

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
        if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) {
            const weeks = Math.floor(days / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        }
        if (days < 365) {
            const months = Math.floor(days / 30);
            return months === 1 ? '1 month ago' : `${months} months ago`;
        }
        const years = Math.floor(days / 365);
        return years === 1 ? '1 year ago' : `${years} years ago`;
    }

    _getDayLabel(timestamp) {
        if (!timestamp) return 'Unknown';

        const ts = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
        const now = new Date();

        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const entryStart = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());

        if (entryStart.getTime() === todayStart.getTime()) return 'Today';
        if (entryStart.getTime() === yesterdayStart.getTime()) return 'Yesterday';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[ts.getMonth()]} ${ts.getDate()}`;
    }

    _groupActivityByDay(entries) {
        const groups = {};
        for (const entry of entries) {
            const label = this._getDayLabel(entry.timestamp);
            if (!groups[label]) {
                groups[label] = [];
            }
            groups[label].push(entry);
        }
        return groups;
    }

    _filterEntries(entries) {
        if (this._activeFilter === 'all') return entries;
        return entries.filter((e) => {
            if (this._activeFilter === 'tracks') return e.type === 'track' || !e.type;
            if (this._activeFilter === 'albums') return e.type === 'album';
            if (this._activeFilter === 'podcasts') return e.type === 'podcast';
            return true;
        });
    }

    _getTypeLabel(type) {
        switch (type) {
            case 'album':
                return 'Album';
            case 'podcast':
                return 'Podcast';
            case 'track':
            default:
                return 'Track';
        }
    }

    _renderActivityItem(entry) {
        const title = escapeHtml(entry.title || 'Unknown');
        const artistName = escapeHtml(getTrackArtists(entry) || entry.artist?.name || 'Unknown Artist');
        const albumTitle = escapeHtml(entry.album?.title || '');
        const cover = entry.album?.cover || entry.cover || '';
        const duration = entry.duration ? formatTime(entry.duration) : '';
        const relTime = this._formatRelativeTime(entry.timestamp);
        const typeLabel = this._getTypeLabel(entry.type);
        const trackId = entry.id || '';
        const albumId = entry.album?.id || '';
        const artistId = entry.artists?.[0]?.id || entry.artist?.id || '';
        const artistRoute = entry.artists?.[0]?.name || entry.artist?.name || '';

        return `
      <div class="af-item" data-track-id="${escapeHtml(trackId)}" data-album-id="${escapeHtml(albumId)}" data-artist-route="${escapeHtml(artistRoute)}" data-artist-id="${escapeHtml(artistId)}">
        <div class="af-item-cover-wrap">
          ${
              cover
                  ? `<img class="af-item-cover" src="${escapeHtml(cover)}" alt="${albumTitle}" loading="lazy" />`
                  : `<div class="af-item-cover af-item-cover--placeholder"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`
          }
          <button class="af-item-play" aria-label="Play ${title}" data-action="play">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="af-item-info">
          <div class="af-item-title-row">
            <span class="af-item-title" data-action="track">${title}</span>
            ${duration ? `<span class="af-item-duration">${escapeHtml(duration)}</span>` : ''}
          </div>
          <div class="af-item-meta">
            <span class="af-item-type">${escapeHtml(typeLabel)}</span>
            <span class="af-item-sep">&middot;</span>
            ${artistName ? `<span class="af-item-artist" data-action="artist">${artistName}</span>` : ''}
            ${albumTitle ? `<span class="af-item-sep">&middot;</span><span class="af-item-album" data-action="album">${albumTitle}</span>` : ''}
          </div>
        </div>
        <div class="af-item-time">
          <time class="af-item-timestamp">${escapeHtml(relTime)}</time>
        </div>
      </div>
    `;
    }

    _renderFilters() {
        const filters = [
            { key: 'all', label: 'All' },
            { key: 'tracks', label: 'Tracks' },
            { key: 'albums', label: 'Albums' },
            { key: 'podcasts', label: 'Podcasts' },
        ];

        return `
      <div class="af-filters">
        ${filters
            .map(
                (f) => `
          <button class="af-filter-btn ${this._activeFilter === f.key ? 'af-filter-btn--active' : ''}" data-filter="${f.key}">
            ${f.label}
          </button>
        `
            )
            .join('')}
      </div>
    `;
    }

    _renderEmpty() {
        return `
      <div class="af-empty">
        <div class="af-empty-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <p class="af-empty-text">No activity yet</p>
        <p class="af-empty-sub">Start listening to see your history here.</p>
      </div>
    `;
    }

    async _handleClick(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        const itemEl = actionEl.closest('.af-item');
        if (!itemEl) return;

        e.preventDefault();
        e.stopPropagation();

        if (action === 'play') {
            await this._playFromItem(itemEl);
            return;
        }

        if (action === 'track') {
            const trackId = itemEl.dataset.trackId;
            if (trackId) {
                navigate(`/track/${encodeURIComponent(trackId)}`);
            }
            return;
        }

        if (action === 'artist') {
            const artistRoute = itemEl.dataset.artistRoute;
            if (artistRoute) {
                navigate(`/artist/${encodeURIComponent(artistRoute)}`);
            }
            return;
        }

        if (action === 'album') {
            const albumId = itemEl.dataset.albumId;
            if (albumId) {
                navigate(`/album/${encodeURIComponent(albumId)}`);
            }
        }
    }

    async _playFromItem(itemEl) {
        const trackId = itemEl.dataset.trackId;
        if (!trackId) return;

        const entry = this._entries.find((e) => (e.id || '') === trackId);
        if (!entry) return;

        const tracks = this._entries.map((e) => ({
            id: e.id,
            title: e.title,
            duration: e.duration,
            artist: e.artist,
            artists: e.artists,
            album: e.album,
            cover: e.album?.cover || e.cover,
            url: e.url || e.audio || e.src,
        }));

        const index = tracks.findIndex((t) => t.id === trackId);

        try {
            this._player.setQueue(tracks, index >= 0 ? index : 0);
            this._player.playTrackFromQueue(index >= 0 ? index : 0);
        } catch (err) {
            console.error('ActivityFeed: failed to play track', err);
            showNotification('Unable to play track', 'error');
        }
    }

    async renderPage(container) {
        this._container = container;
        container.innerHTML = `
      <div class="af-page">
        <div class="af-header">
          <h1 class="af-title">Activity</h1>
          <p class="af-subtitle">Your recent listening history</p>
        </div>
        <div class="af-controls">
          ${this._renderFilters()}
        </div>
        <div class="af-feed-wrap">
          <div class="af-loading">
            <div class="af-spinner"></div>
            <p>Loading activity&hellip;</p>
          </div>
        </div>
      </div>
      ${this._injectStyles()}
    `;

        container.addEventListener('click', this._boundClickHandler);

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.af-filter-btn');
            if (!btn) return;
            const filter = btn.dataset.filter;
            if (filter && filter !== this._activeFilter) {
                this._activeFilter = filter;
                this._renderFeed();
            }
        });

        this._entries = await this._getRecentActivity(100);
        this._renderFeed();
    }

    _renderFeed() {
        if (!this._container) return;

        const wrap = this._container.querySelector('.af-feed-wrap');
        if (!wrap) return;

        const filtered = this._filterEntries(this._entries);

        // Update filter button states
        const filterBtns = this._container.querySelectorAll('.af-filter-btn');
        filterBtns.forEach((btn) => {
            btn.classList.toggle('af-filter-btn--active', btn.dataset.filter === this._activeFilter);
        });

        if (filtered.length === 0) {
            wrap.innerHTML = this._renderEmpty();
            return;
        }

        const groups = this._groupActivityByDay(filtered);
        const orderedLabels = this._getOrderedLabels(Object.keys(groups));

        let html = '';
        for (const label of orderedLabels) {
            const items = groups[label];
            if (!items || items.length === 0) continue;
            html += `
        <div class="af-day-group">
          <h2 class="af-day-label">${escapeHtml(label)}</h2>
          <div class="af-day-items">
            ${items.map((entry) => this._renderActivityItem(entry)).join('')}
          </div>
        </div>
      `;
        }

        wrap.innerHTML = html;
    }

    _getOrderedLabels(labels) {
        const priority = ['Today', 'Yesterday'];
        const result = [];

        for (const p of priority) {
            if (labels.includes(p)) result.push(p);
        }

        const rest = labels.filter((l) => !priority.includes(l));
        rest.sort((a, b) => {
            const dateA = new Date(a + ' ' + new Date().getFullYear());
            const dateB = new Date(b + ' ' + new Date().getFullYear());
            return dateB - dateA;
        });

        return result.concat(rest);
    }

    destroy() {
        if (this._container) {
            this._container.removeEventListener('click', this._boundClickHandler);
            this._container.innerHTML = '';
        }
        this._container = null;
        this._entries = [];
    }

    _injectStyles() {
        return `
      <style>
        .af-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px 16px 80px;
        }

        .af-header {
          margin-bottom: 20px;
        }

        .af-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary, #fff);
          margin: 0 0 4px;
          letter-spacing: -0.5px;
        }

        .af-subtitle {
          font-size: 14px;
          color: var(--text-secondary, #999);
          margin: 0;
        }

        .af-controls {
          margin-bottom: 24px;
        }

        .af-filters {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 4px;
        }

        .af-filters::-webkit-scrollbar {
          display: none;
        }

        .af-filter-btn {
          padding: 8px 18px;
          border-radius: 20px;
          border: 1px solid var(--border-color, #333);
          background: transparent;
          color: var(--text-secondary, #999);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }

        .af-filter-btn:hover {
          background: var(--surface-hover, #222);
          color: var(--text-primary, #fff);
        }

        .af-filter-btn--active {
          background: var(--accent, #fff);
          color: var(--accent-contrast, #000);
          border-color: var(--accent, #fff);
          font-weight: 600;
        }

        .af-filter-btn--active:hover {
          opacity: 0.9;
          color: var(--accent-contrast, #000);
        }

        .af-feed-wrap {
          min-height: 200px;
        }

        .af-day-group {
          margin-bottom: 32px;
        }

        .af-day-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary, #999);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin: 0 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color, #222);
        }

        .af-day-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .af-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          transition: background 0.15s;
          cursor: default;
        }

        .af-item:hover {
          background: var(--surface-hover, #181818);
        }

        .af-item-cover-wrap {
          position: relative;
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 6px;
          overflow: hidden;
          background: var(--surface, #222);
        }

        .af-item-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .af-item-cover--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted, #555);
        }

        .af-item-play {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.55);
          border: none;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
          color: #fff;
          padding: 0;
          border-radius: 6px;
        }

        .af-item:hover .af-item-play {
          opacity: 1;
        }

        .af-item-play:hover {
          background: rgba(0, 0, 0, 0.7);
        }

        .af-item-play:active {
          transform: scale(0.95);
        }

        .af-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .af-item-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .af-item-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          transition: color 0.15s;
        }

        .af-item-title:hover {
          color: var(--accent, #fff);
          text-decoration: underline;
        }

        .af-item-duration {
          flex-shrink: 0;
          font-size: 12px;
          color: var(--text-muted, #666);
          font-variant-numeric: tabular-nums;
        }

        .af-item-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-secondary, #999);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .af-item-type {
          flex-shrink: 0;
          color: var(--text-muted, #666);
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .af-item-sep {
          color: var(--text-muted, #555);
          flex-shrink: 0;
        }

        .af-item-artist {
          cursor: pointer;
          transition: color 0.15s;
        }

        .af-item-artist:hover {
          color: var(--text-primary, #fff);
          text-decoration: underline;
        }

        .af-item-album {
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.15s;
        }

        .af-item-album:hover {
          color: var(--text-primary, #fff);
          text-decoration: underline;
        }

        .af-item-time {
          flex-shrink: 0;
          min-width: 80px;
          text-align: right;
        }

        .af-item-timestamp {
          font-size: 12px;
          color: var(--text-muted, #666);
          white-space: nowrap;
        }

        .af-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
          gap: 16px;
          color: var(--text-secondary, #999);
          font-size: 14px;
        }

        .af-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid var(--border-color, #333);
          border-top-color: var(--accent, #fff);
          border-radius: 50%;
          animation: af-spin 0.7s linear infinite;
        }

        @keyframes af-spin {
          to { transform: rotate(360deg); }
        }

        .af-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          text-align: center;
        }

        .af-empty-icon {
          color: var(--text-muted, #444);
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .af-empty-text {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-secondary, #999);
          margin: 0 0 6px;
        }

        .af-empty-sub {
          font-size: 13px;
          color: var(--text-muted, #666);
          margin: 0;
        }

        @media (max-width: 600px) {
          .af-page {
            padding: 16px 12px 80px;
          }

          .af-title {
            font-size: 22px;
          }

          .af-item {
            padding: 8px;
            gap: 10px;
          }

          .af-item-cover-wrap {
            width: 44px;
            height: 44px;
          }

          .af-item-time {
            display: none;
          }

          .af-item-meta {
            font-size: 11px;
          }
        }
      </style>
    `;
    }
}
