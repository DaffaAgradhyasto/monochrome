// js/collab-playlist.js
// Collaborative Playlist Editing - real-time multi-user playlist editing
// Uses BroadcastChannel for same-device tab sync + localStorage events for cross-tab fallback

import { db } from './db.js';
import { escapeHtml } from './utils.js';
import { showNotification } from './downloads.js';

const EDITOR_COLORS = [
    '#e74c3c',
    '#e67e22',
    '#f1c40f',
    '#2ecc71',
    '#1abc9c',
    '#3498db',
    '#9b59b6',
    '#e84393',
    '#00cec9',
    '#6c5ce7',
    '#fd79a8',
    '#00b894',
    '#fab1a0',
    '#74b9ff',
    '#a29bfe',
];

const MAX_EDIT_LOG_ENTRIES = 100;

export class CollabPlaylist {
    constructor(player) {
        this._player = player;
        this._playlistId = null;
        this._channel = null;
        this._editors = [];
        this._editLog = [];
        this._username = 'User-' + Math.random().toString(36).substr(2, 4);
        this._color = this._generateColor();
        this._container = null;
        this._isActive = false;
        this._dragSrcIndex = null;
        this._storageListener = null;
        this._heartbeatInterval = null;
        this._lastConflictState = null;
        this._version = 0;
    }

    _generateColor() {
        return EDITOR_COLORS[Math.floor(Math.random() * EDITOR_COLORS.length)];
    }

    _generateEditorId() {
        return Math.random().toString(36).substring(2, 10);
    }

    async enableCollab(playlistId) {
        this._playlistId = playlistId;
        this._isActive = true;

        const state = await db.getSetting('collab-' + playlistId);
        if (state) {
            this._editLog = state.editLog || [];
            this._version = state.version || 0;
        }

        await db.saveSetting('collab-' + playlistId, {
            enabled: true,
            enabledAt: Date.now(),
            editLog: this._editLog,
            version: this._version,
        });

        this._openChannel(playlistId);
        this._setupStorageListener();

        this._channel.postMessage({
            type: 'join',
            user: this._username,
            color: this._color,
            data: { editorId: this._username },
            timestamp: Date.now(),
        });

        this._startHeartbeat();

        console.log('[CollabPlaylist] Enabled collab for playlist:', playlistId);
    }

    async disableCollab() {
        if (!this._isActive) return;

        this._channel?.postMessage({
            type: 'leave',
            user: this._username,
            color: this._color,
            data: {},
            timestamp: Date.now(),
        });

        this._stopHeartbeat();
        this._removeStorageListener();
        this._channel?.close();
        this._channel = null;

        if (this._playlistId) {
            const state = await db.getSetting('collab-' + this._playlistId);
            if (state) {
                await db.saveSetting('collab-' + this._playlistId, {
                    ...state,
                    enabled: false,
                });
            }
        }

        this._isActive = false;
        this._editors = [];
        this._playlistId = null;
        console.log('[CollabPlaylist] Disabled collab');
    }

    _openChannel(playlistId) {
        if (this._channel) {
            this._channel.close();
        }
        this._channel = new BroadcastChannel(`monochrome-collab-playlist-${playlistId}`);
        this._channel.onmessage = (e) => this._handleRemoteChange(e.data);
    }

    _setupStorageListener() {
        this._storageListener = (event) => {
            if (!event.key || !event.key.startsWith('monochrome-collab-playlist-')) return;
            if (event.newValue) {
                try {
                    const msg = JSON.parse(event.newValue);
                    if (msg.user !== this._username) {
                        this._handleRemoteChange({ data: msg });
                    }
                } catch {
                    // ignore parse errors
                }
            }
        };
        window.addEventListener('storage', this._storageListener);
    }

    _removeStorageListener() {
        if (this._storageListener) {
            window.removeEventListener('storage', this._storageListener);
            this._storageListener = null;
        }
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatInterval = setInterval(() => {
            if (!this._channel || !this._isActive) return;
            this._channel.postMessage({
                type: 'heartbeat',
                user: this._username,
                color: this._color,
                data: {},
                timestamp: Date.now(),
            });
        }, 5000);
    }

    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    }

    _broadcastChange(action, data) {
        if (!this._channel || !this._isActive) return;

        const msg = {
            type: 'edit',
            user: this._username,
            color: this._color,
            data: { action, ...data },
            timestamp: Date.now(),
        };

        this._channel.postMessage(msg);

        try {
            localStorage.setItem('monochrome-collab-playlist-' + this._playlistId, JSON.stringify(msg));
        } catch {
            // localStorage may be full or unavailable
        }
    }

    _handleRemoteChange(event) {
        if (!event || !event.data) return;
        const msg = event.data;
        if (msg.user === this._username && msg.type !== 'join') return;

        switch (msg.type) {
            case 'edit':
                this._onRemoteEdit(msg);
                break;
            case 'join':
                this._onRemoteJoin(msg);
                break;
            case 'leave':
                this._onRemoteLeave(msg);
                break;
            case 'heartbeat':
                this._updateEditorHeartbeat(msg);
                break;
            case 'cursor':
                this._updateEditorCursor(msg);
                break;
        }
    }

    _onRemoteJoin(msg) {
        const existing = this._editors.find((e) => e.user === msg.user);
        if (existing) {
            existing.lastSeen = msg.timestamp;
            existing.color = msg.color;
        } else {
            this._editors.push({
                user: msg.user,
                color: msg.color,
                lastSeen: msg.timestamp,
                cursorIndex: -1,
            });
            showNotification(`${msg.user} joined the editing session`);
        }

        if (msg.type === 'join') {
            this._channel?.postMessage({
                type: 'heartbeat',
                user: this._username,
                color: this._color,
                data: {},
                timestamp: Date.now(),
            });
        }

        this._renderEditorsList();
        this._pruneEditors();
    }

    _onRemoteLeave(msg) {
        this._editors = this._editors.filter((e) => e.user !== msg.user);
        showNotification(`${msg.user} left the editing session`);
        this._renderEditorsList();
    }

    _updateEditorHeartbeat(msg) {
        const existing = this._editors.find((e) => e.user === msg.user);
        if (existing) {
            existing.lastSeen = msg.timestamp;
            existing.color = msg.color;
        } else {
            this._editors.push({
                user: msg.user,
                color: msg.color,
                lastSeen: msg.timestamp,
                cursorIndex: -1,
            });
        }
        this._renderEditorsList();
        this._pruneEditors();
    }

    _updateEditorCursor(msg) {
        const existing = this._editors.find((e) => e.user === msg.user);
        if (existing && msg.data) {
            existing.cursorIndex = msg.data.index ?? -1;
        }
    }

    _pruneEditors() {
        const staleThreshold = Date.now() - 15000;
        const before = this._editors.length;
        this._editors = this._editors.filter((e) => e.lastSeen > staleThreshold);
        if (this._editors.length !== before) {
            this._renderEditorsList();
        }
    }

    async _onRemoteEdit(msg) {
        const { action } = msg.data;

        const logEntry = {
            user: msg.user,
            color: msg.color,
            action,
            data: msg.data,
            timestamp: msg.timestamp,
        };
        this._editLog.unshift(logEntry);
        if (this._editLog.length > MAX_EDIT_LOG_ENTRIES) {
            this._editLog = this._editLog.slice(0, MAX_EDIT_LOG_ENTRIES);
        }

        switch (action) {
            case 'add': {
                const track = msg.data.track;
                if (track) {
                    try {
                        await db.addTrackToPlaylist(this._playlistId, track);
                        showNotification(`${msg.user} added "${track.title || 'a track'}"`);
                        this._refreshPlaylistView();
                    } catch {
                        // Track may already exist
                    }
                }
                break;
            }
            case 'remove': {
                const trackId = msg.data.trackId;
                if (trackId != null) {
                    try {
                        await db.removeTrackFromPlaylist(this._playlistId, trackId);
                        showNotification(`${msg.user} removed a track`);
                        this._refreshPlaylistView();
                    } catch {
                        // ignore
                    }
                }
                break;
            }
            case 'reorder': {
                const { fromIndex, toIndex } = msg.data;
                if (fromIndex != null && toIndex != null) {
                    const playlist = await db.getPlaylist(this._playlistId);
                    if (playlist?.tracks) {
                        const tracks = [...playlist.tracks];
                        const [moved] = tracks.splice(fromIndex, 1);
                        if (moved) {
                            tracks.splice(toIndex, 0, moved);
                            await db.updatePlaylistTracks(this._playlistId, tracks);
                            showNotification(`${msg.user} reordered tracks`);
                            this._refreshPlaylistView();
                        }
                    }
                }
                break;
            }
            case 'conflict':
                this._handleConflict(msg);
                break;
        }

        this._renderEditLog();
        this._saveCollabState();
    }

    _handleConflict(msg) {
        this._lastConflictState = msg.data;
        showNotification(`Conflict detected: ${msg.user} edited the same track`);
        this._renderConflictUI();
    }

    async _saveCollabState() {
        if (!this._playlistId) return;
        const state = await db.getSetting('collab-' + this._playlistId);
        await db.saveSetting('collab-' + this._playlistId, {
            ...state,
            editLog: this._editLog,
            version: this._version,
        });
    }

    async addTrack(track) {
        if (!this._isActive || !this._playlistId) return;

        this._version++;
        this._broadcastChange('add', { track, version: this._version });

        const logEntry = {
            user: this._username,
            color: this._color,
            action: 'add',
            data: { action: 'add', track, version: this._version },
            timestamp: Date.now(),
        };
        this._editLog.unshift(logEntry);
        if (this._editLog.length > MAX_EDIT_LOG_ENTRIES) {
            this._editLog = this._editLog.slice(0, MAX_EDIT_LOG_ENTRIES);
        }
        this._renderEditLog();
        this._saveCollabState();
    }

    async removeTrack(trackId) {
        if (!this._isActive || !this._playlistId) return;

        this._version++;
        this._broadcastChange('remove', { trackId, version: this._version });

        const logEntry = {
            user: this._username,
            color: this._color,
            action: 'remove',
            data: { action: 'remove', trackId, version: this._version },
            timestamp: Date.now(),
        };
        this._editLog.unshift(logEntry);
        if (this._editLog.length > MAX_EDIT_LOG_ENTRIES) {
            this._editLog = this._editLog.slice(0, MAX_EDIT_LOG_ENTRIES);
        }
        this._renderEditLog();
        this._saveCollabState();
    }

    async reorderTrack(fromIndex, toIndex) {
        if (!this._isActive || !this._playlistId) return;

        this._version++;
        this._broadcastChange('reorder', { fromIndex, toIndex, version: this._version });

        const logEntry = {
            user: this._username,
            color: this._color,
            action: 'reorder',
            data: { action: 'reorder', fromIndex, toIndex, version: this._version },
            timestamp: Date.now(),
        };
        this._editLog.unshift(logEntry);
        if (this._editLog.length > MAX_EDIT_LOG_ENTRIES) {
            this._editLog = this._editLog.slice(0, MAX_EDIT_LOG_ENTRIES);
        }
        this._renderEditLog();
        this._saveCollabState();
    }

    async renderCollabUI(container, playlistId) {
        this._container = container;
        this._playlistId = playlistId;

        const state = await db.getSetting('collab-' + playlistId);
        const collabEnabled = state?.enabled === true;

        if (collabEnabled && !this._isActive) {
            await this.enableCollab(playlistId);
        }

        const playlist = await db.getPlaylist(playlistId);
        const tracks = playlist?.tracks || [];

        const shareUrl = `${window.location.origin}/userplaylist/${playlistId}?collab=true`;

        container.innerHTML = `
      <div class="cp-container">
        <div class="cp-header">
          <div class="cp-title-row">
            <h2 class="cp-title">Collaborative Editing</h2>
            <label class="cp-toggle-label">
              <input type="checkbox" class="cp-toggle" ${this._isActive ? 'checked' : ''} />
              <span class="cp-toggle-slider"></span>
              <span class="cp-toggle-text">${this._isActive ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          <div class="cp-share-section" style="${this._isActive ? '' : 'display:none'}">
            <label class="cp-share-label">Share Edit Link</label>
            <div class="cp-share-row">
              <input type="text" class="cp-share-input" value="${escapeHtml(shareUrl)}" readonly />
              <button class="cp-share-btn" title="Copy link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            </div>
          </div>
        </div>

        <div class="cp-body" style="${this._isActive ? '' : 'display:none'}">
          <div class="cp-editors-section">
            <h3 class="cp-section-title">Active Editors</h3>
            <div class="cp-editors-list">
              <div class="cp-editor-item" style="border-color: ${this._color}">
                <span class="cp-editor-avatar" style="background: ${this._color}">${this._username.charAt(0).toUpperCase()}</span>
                <span class="cp-editor-name">${escapeHtml(this._username)} (you)</span>
                <span class="cp-editor-status">Active</span>
              </div>
            </div>
          </div>

          <div class="cp-log-section">
            <h3 class="cp-section-title">Edit Log</h3>
            <div class="cp-edit-log">
              <div class="cp-edit-log-empty">No edits yet. Start editing to see activity here.</div>
            </div>
          </div>

          <div class="cp-tracks-section">
            <h3 class="cp-section-title">Playlist Tracks</h3>
            <div class="cp-tracks-list">
              ${tracks.length === 0 ? '<div class="cp-tracks-empty">No tracks in this playlist</div>' : ''}
            </div>
          </div>

          <div class="cp-conflict-section" style="display:none">
            <div class="cp-conflict-banner">
              <span class="cp-conflict-icon">&#9888;</span>
              <span class="cp-conflict-message">Conflict detected</span>
              <button class="cp-conflict-resolve-btn">Resolve</button>
              <button class="cp-conflict-dismiss-btn">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    `;

        if (this._isActive) {
            this._renderTracksList(tracks);
            this._renderEditLog();
            this._renderEditorsList();
        }

        this._attachEvents(container);
    }

    _attachEvents(container) {
        container.querySelector('.cp-toggle')?.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await this.enableCollab(this._playlistId);
                container.querySelector('.cp-share-section').style.display = '';
                container.querySelector('.cp-body').style.display = '';
                container.querySelector('.cp-toggle-text').textContent = 'Enabled';
                this._refreshPlaylistView();
            } else {
                await this.disableCollab();
                container.querySelector('.cp-share-section').style.display = 'none';
                container.querySelector('.cp-body').style.display = 'none';
                container.querySelector('.cp-toggle-text').textContent = 'Disabled';
            }
        });

        container.querySelector('.cp-share-btn')?.addEventListener('click', () => {
            const input = container.querySelector('.cp-share-input');
            if (input) {
                navigator.clipboard.writeText(input.value).then(() => {
                    const btn = container.querySelector('.cp-share-btn');
                    if (btn) {
                        btn.textContent = 'Copied!';
                        setTimeout(() => {
                            if (btn) {
                                btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
                            }
                        }, 2000);
                    }
                });
            }
        });

        container.querySelector('.cp-conflict-resolve-btn')?.addEventListener('click', () => {
            this._resolveConflict();
        });

        container.querySelector('.cp-conflict-dismiss-btn')?.addEventListener('click', () => {
            const section = container.querySelector('.cp-conflict-section');
            if (section) section.style.display = 'none';
            this._lastConflictState = null;
        });
    }

    _renderTracksList(tracks) {
        const list = this._container?.querySelector('.cp-tracks-list');
        if (!list) return;

        if (tracks.length === 0) {
            list.innerHTML = '<div class="cp-tracks-empty">No tracks in this playlist</div>';
            return;
        }

        list.innerHTML = tracks
            .map((track, i) => {
                const title = track.title || 'Unknown Title';
                const artistName = track.artist?.name || track.artists?.[0]?.name || 'Unknown Artist';
                const editor = this._editors.find((e) => e.cursorIndex === i);

                return `
        <div class="cp-track-item" draggable="true" data-index="${i}">
          <span class="cp-track-handle">&#9776;</span>
          <span class="cp-track-number">${i + 1}</span>
          <div class="cp-track-info">
            <span class="cp-track-title">${escapeHtml(title)}</span>
            <span class="cp-track-artist">${escapeHtml(artistName)}</span>
          </div>
          ${editor ? `<span class="cp-track-cursor" style="background: ${editor.color}" title="${escapeHtml(editor.user)} is here">${editor.user.charAt(0)}</span>` : ''}
          <button class="cp-track-remove" data-track-id="${escapeHtml(String(track.id))}" title="Remove track">&#10005;</button>
        </div>
      `;
            })
            .join('');

        list.querySelectorAll('.cp-track-remove').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const trackId = btn.dataset.trackId;
                if (!trackId) return;
                try {
                    await db.removeTrackFromPlaylist(this._playlistId, trackId);
                    this.removeTrack(trackId);
                    this._refreshPlaylistView();
                } catch (err) {
                    console.error('[CollabPlaylist] Failed to remove track:', err);
                }
            });
        });

        list.querySelectorAll('.cp-track-item[draggable="true"]').forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                this._dragSrcIndex = parseInt(item.dataset.index, 10);
                item.classList.add('cp-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.index);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('cp-dragging');
                list.querySelectorAll('.cp-track-item').forEach((el) => {
                    el.classList.remove('cp-drag-over');
                });
                this._dragSrcIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('cp-drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('cp-drag-over');
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('cp-drag-over');

                const fromIndex = this._dragSrcIndex;
                const toIndex = parseInt(item.dataset.index, 10);

                if (fromIndex === null || fromIndex === toIndex) return;

                const playlist = await db.getPlaylist(this._playlistId);
                if (!playlist?.tracks) return;

                const tracks = [...playlist.tracks];
                const [moved] = tracks.splice(fromIndex, 1);
                if (moved) {
                    tracks.splice(toIndex, 0, moved);
                    await db.updatePlaylistTracks(this._playlistId, tracks);
                    this.reorderTrack(fromIndex, toIndex);
                    this._refreshPlaylistView();
                }
            });
        });
    }

    _renderEditorsList() {
        const list = this._container?.querySelector('.cp-editors-list');
        if (!list) return;

        const html = `
      <div class="cp-editor-item" style="border-color: ${this._color}">
        <span class="cp-editor-avatar" style="background: ${this._color}">${this._username.charAt(0).toUpperCase()}</span>
        <span class="cp-editor-name">${escapeHtml(this._username)} (you)</span>
        <span class="cp-editor-status">Active</span>
      </div>
      ${this._editors
          .map(
              (editor) => `
        <div class="cp-editor-item" style="border-color: ${editor.color}">
          <span class="cp-editor-avatar" style="background: ${editor.color}">${editor.user.charAt(0).toUpperCase()}</span>
          <span class="cp-editor-name">${escapeHtml(editor.user)}</span>
          <span class="cp-editor-status">Active</span>
        </div>
      `
          )
          .join('')}
    `;

        list.innerHTML = html;
    }

    _renderEditLog() {
        const log = this._container?.querySelector('.cp-edit-log');
        if (!log) return;

        if (this._editLog.length === 0) {
            log.innerHTML = '<div class="cp-edit-log-empty">No edits yet. Start editing to see activity here.</div>';
            return;
        }

        log.innerHTML = this._editLog
            .map((entry) => {
                const time = new Date(entry.timestamp).toLocaleTimeString();
                let description = '';
                switch (entry.action) {
                    case 'add':
                        description = `added "${escapeHtml(entry.data.track?.title || 'a track')}"`;
                        break;
                    case 'remove':
                        description = `removed a track`;
                        break;
                    case 'reorder':
                        description = `moved track from position ${(entry.data.fromIndex ?? 0) + 1} to ${(entry.data.toIndex ?? 0) + 1}`;
                        break;
                    default:
                        description = entry.action;
                }

                return `
        <div class="cp-log-entry">
          <span class="cp-log-dot" style="background: ${entry.color}"></span>
          <span class="cp-log-user" style="color: ${entry.color}">${escapeHtml(entry.user)}</span>
          <span class="cp-log-action">${description}</span>
          <span class="cp-log-time">${time}</span>
        </div>
      `;
            })
            .join('');
    }

    _renderConflictUI() {
        const section = this._container?.querySelector('.cp-conflict-section');
        if (!section) return;

        section.style.display = '';

        const message = this._container?.querySelector('.cp-conflict-message');
        if (message && this._lastConflictState) {
            message.textContent = `Conflict: another user edited the playlist at the same time. Version mismatch detected.`;
        }
    }

    async _resolveConflict() {
        if (!this._playlistId) return;

        const playlist = await db.getPlaylist(this._playlistId);
        if (playlist?.tracks) {
            this._version++;
            this._broadcastChange('conflict', {
                resolved: true,
                tracks: playlist.tracks,
                version: this._version,
            });
        }

        const section = this._container?.querySelector('.cp-conflict-section');
        if (section) section.style.display = 'none';
        this._lastConflictState = null;

        showNotification('Conflict resolved. Playlist synchronized.');
        this._refreshPlaylistView();
        this._saveCollabState();
    }

    async _refreshPlaylistView() {
        if (!this._container || !this._playlistId) return;

        const playlist = await db.getPlaylist(this._playlistId);
        const tracks = playlist?.tracks || [];
        this._renderTracksList(tracks);

        window.dispatchEvent(
            new CustomEvent('collab-playlist-updated', {
                detail: { playlistId: this._playlistId, tracks },
            })
        );
    }

    sendCursorUpdate(index) {
        if (!this._channel || !this._isActive) return;
        this._channel.postMessage({
            type: 'cursor',
            user: this._username,
            color: this._color,
            data: { index },
            timestamp: Date.now(),
        });
    }

    destroy() {
        this.disableCollab();
        if (this._container) {
            this._container.innerHTML = '';
        }
        this._container = null;
        this._editLog = [];
        this._editors = [];
        this._lastConflictState = null;
    }
}
