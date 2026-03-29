// js/audio-fingerprint.js

import { showNotification } from './downloads.js';
import { escapeHtml } from './utils.js';
import { navigate } from './router.js';

const AUDD_API_URL = 'https://api.audd.io/';
const AUDD_TOKEN_KEY = 'audd-api-token';
const MAX_RECORDING_MS = 10000;

export class AudioFingerprint {
    constructor(player, musicAPI) {
        this._player = player;
        this._musicAPI = musicAPI;
        this._isListening = false;
        this._stream = null;
        this._mediaRecorder = null;
        this._chunks = [];
        this._recordingTimeout = null;
        this._container = null;
        this._fab = null;

        this._injectStyles();
    }

    async startListening() {
        if (this._isListening) return;

        const token = localStorage.getItem(AUDD_TOKEN_KEY);
        if (!token) {
            this._renderSettings();
            return;
        }

        try {
            this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            showNotification('Microphone access denied. Please allow microphone access to identify songs.', 'error');
            return;
        }

        this._isListening = true;
        this._chunks = [];

        this._mediaRecorder = new MediaRecorder(this._stream, {
            mimeType: this._getSupportedMimeType(),
        });

        this._mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this._chunks.push(e.data);
            }
        };

        this._mediaRecorder.onstop = async () => {
            const mimeType = this._mediaRecorder.mimeType || 'audio/webm';
            const blob = new Blob(this._chunks, { type: mimeType });
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = null;
            this._mediaRecorder = null;

            if (blob.size > 0) {
                await this._identifyAudio(blob);
            } else {
                this._isListening = false;
                this._updateUI('idle');
                showNotification('No audio captured. Please try again.', 'error');
            }
        };

        this._mediaRecorder.start(250);

        this._updateUI('listening');

        this._recordingTimeout = setTimeout(() => {
            if (this._isListening) {
                this.stopListening();
            }
        }, MAX_RECORDING_MS);
    }

    stopListening() {
        if (!this._isListening) return;

        if (this._recordingTimeout) {
            clearTimeout(this._recordingTimeout);
            this._recordingTimeout = null;
        }

        this._isListening = false;

        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
            this._mediaRecorder.stop();
        }

        if (this._stream) {
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = null;
        }

        this._updateUI('identifying');
    }

    async _identifyAudio(audioBlob) {
        this._updateUI('identifying');

        const token = localStorage.getItem(AUDD_TOKEN_KEY);

        const formData = new FormData();
        formData.append('api_token', token);
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('return', 'apple_music,spotify');

        try {
            const response = await fetch(AUDD_API_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`AudD API returned ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.result) {
                const trackInfo = {
                    title: data.result.title || '',
                    artist: data.result.artist || '',
                    album: data.result.album || '',
                    artwork:
                        data.result.song_art ||
                        data.result.spotify?.album?.images?.[0]?.url ||
                        data.result.apple_music?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') ||
                        '',
                    releaseDate: data.result.release_date || '',
                    isrc: data.result.isrc || '',
                    auddResult: data.result,
                };

                const tidalResult = await this._searchOnTidal(trackInfo);

                if (tidalResult) {
                    this._updateUI('found', { ...trackInfo, tidal: tidalResult });
                    showNotification(`Found: ${trackInfo.title} by ${trackInfo.artist}`, 'success');
                } else {
                    this._updateUI('not-tidal', trackInfo);
                    showNotification(`Match found but not available on TIDAL.`, 'info');
                }
            } else {
                this._updateUI('not-found');
                showNotification('No match found. Try again with less background noise.', 'info');
            }
        } catch (err) {
            console.error('Audio identification failed:', err);
            this._updateUI('error');
            showNotification('Failed to identify audio. Check your API token and try again.', 'error');
        }
    }

    async _searchOnTidal(trackInfo) {
        try {
            const query = `${trackInfo.title} ${trackInfo.artist}`;
            const results = await this._musicAPI.searchTracks(query);

            if (results && results.length > 0) {
                const normalizedTitle = trackInfo.title.toLowerCase().trim();
                const normalizedArtist = trackInfo.artist.toLowerCase().trim();

                let best = results.find((r) => {
                    const rTitle = (r.title || r.name || '').toLowerCase().trim();
                    const rArtist = (r.artist || r.artistName || '').toLowerCase().trim();
                    return rTitle === normalizedTitle && rArtist.includes(normalizedArtist);
                });

                if (!best) {
                    best = results.find((r) => {
                        const rTitle = (r.title || r.name || '').toLowerCase().trim();
                        return rTitle === normalizedTitle;
                    });
                }

                if (!best) {
                    best = results[0];
                }

                return best;
            }

            return null;
        } catch (err) {
            console.error('TIDAL search failed:', err);
            return null;
        }
    }

    _getSupportedMimeType() {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return '';
    }

    _updateUI(state, data) {
        if (!this._container) return;

        const content = this._container.querySelector('.afp-content');
        if (!content) return;

        switch (state) {
            case 'idle':
                content.innerHTML = this._renderIdle();
                break;

            case 'listening':
                content.innerHTML = this._renderListening();
                break;

            case 'identifying':
                content.innerHTML = this._renderIdentifying();
                break;

            case 'found':
                content.innerHTML = this._renderFound(data);
                this._bindFoundEvents(data);
                break;

            case 'not-found':
                content.innerHTML = this._renderNotFound();
                break;

            case 'not-tidal':
                content.innerHTML = this._renderNotTidal(data);
                break;

            case 'error':
                content.innerHTML = this._renderError();
                break;

            case 'settings':
                content.innerHTML = this._renderSettingsContent();
                this._bindSettingsEvents();
                break;

            default:
                content.innerHTML = this._renderIdle();
        }
    }

    _renderIdle() {
        return `
      <div class="afp-idle">
        <div class="afp-idle-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <h2 class="afp-title">What's this song?</h2>
        <p class="afp-desc">Tap the button below to identify the song playing near you.</p>
        <button class="afp-btn afp-btn-primary afp-listen-btn">Start Listening</button>
        <button class="afp-btn afp-btn-ghost afp-settings-btn">API Settings</button>
      </div>
    `;
    }

    _renderListening() {
        return `
      <div class="afp-listening">
        <div class="afp-pulse-ring">
          <div class="afp-pulse-core">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
        </div>
        <h2 class="afp-title">Listening...</h2>
        <p class="afp-desc">Play the song near your device. Recording will stop automatically after 10 seconds.</p>
        <button class="afp-btn afp-btn-secondary afp-stop-btn">Stop</button>
      </div>
    `;
    }

    _renderIdentifying() {
        return `
      <div class="afp-identifying">
        <div class="afp-spinner"></div>
        <h2 class="afp-title">Identifying...</h2>
        <p class="afp-desc">Searching for a match in our database.</p>
      </div>
    `;
    }

    _renderFound(data) {
        const artSrc = data.artwork || '';
        const title = escapeHtml(data.title);
        const artist = escapeHtml(data.artist);
        const album = escapeHtml(data.album || '');
        const tidalTrackId = data.tidal?.id || data.tidal?.trackId || '';

        return `
      <div class="afp-found">
        <div class="afp-result-card">
          ${artSrc ? `<img class="afp-artwork" src="${escapeHtml(artSrc)}" alt="Album art" />` : '<div class="afp-artwork afp-artwork-placeholder"></div>'}
          <div class="afp-result-info">
            <h2 class="afp-track-title">${title}</h2>
            <p class="afp-track-artist">${artist}</p>
            ${album ? `<p class="afp-track-album">${album}</p>` : ''}
            ${tidalTrackId ? `<p class="afp-tidal-badge">Available on TIDAL</p>` : ''}
          </div>
        </div>
        <div class="afp-actions">
          ${tidalTrackId ? `<button class="afp-btn afp-btn-primary afp-play-btn" data-track-id="${escapeHtml(String(tidalTrackId))}">Play on Monochrome</button>` : ''}
          <button class="afp-btn afp-btn-secondary afp-listen-again-btn">Listen Again</button>
        </div>
      </div>
    `;
    }

    _renderNotFound() {
        return `
      <div class="afp-not-found">
        <div class="afp-not-found-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <h2 class="afp-title">No match found</h2>
        <p class="afp-desc">We couldn't identify the song. Try again with less background noise or a clearer audio source.</p>
        <button class="afp-btn afp-btn-primary afp-listen-again-btn">Try Again</button>
      </div>
    `;
    }

    _renderNotTidal(data) {
        const artSrc = data.artwork || '';
        const title = escapeHtml(data.title);
        const artist = escapeHtml(data.artist);

        return `
      <div class="afp-not-tidal">
        ${artSrc ? `<img class="afp-artwork afp-artwork-small" src="${escapeHtml(artSrc)}" alt="Album art" />` : ''}
        <h2 class="afp-title">${title}</h2>
        <p class="afp-track-artist">${artist}</p>
        <p class="afp-desc">This track was identified but is not available on TIDAL.</p>
        <button class="afp-btn afp-btn-primary afp-listen-again-btn">Listen Again</button>
      </div>
    `;
    }

    _renderError() {
        return `
      <div class="afp-error">
        <div class="afp-error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h2 class="afp-title">Something went wrong</h2>
        <p class="afp-desc">Could not identify the audio. Please check your API token and try again.</p>
        <button class="afp-btn afp-btn-primary afp-listen-again-btn">Try Again</button>
        <button class="afp-btn afp-btn-ghost afp-settings-btn">API Settings</button>
      </div>
    `;
    }

    _renderSettingsContent() {
        const currentToken = localStorage.getItem(AUDD_TOKEN_KEY) || '';
        return `
      <div class="afp-settings">
        <h2 class="afp-title">API Settings</h2>
        <p class="afp-desc">Enter your AudD API token to enable song identification. Get a free token at <a href="https://audd.io/" target="_blank" rel="noopener noreferrer">audd.io</a>.</p>
        <div class="afp-settings-field">
          <label class="afp-label" for="afp-token-input">AudD API Token</label>
          <input id="afp-token-input" class="afp-input" type="text" placeholder="Paste your API token here" value="${escapeHtml(currentToken)}" autocomplete="off" />
        </div>
        <div class="afp-actions">
          <button class="afp-btn afp-btn-primary afp-save-token-btn">Save Token</button>
          <button class="afp-btn afp-btn-ghost afp-back-btn">Back</button>
        </div>
      </div>
    `;
    }

    _bindFoundEvents(data) {
        if (!this._container) return;

        const playBtn = this._container.querySelector('.afp-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const trackId = playBtn.dataset.trackId;
                if (trackId) {
                    this._player.playTrack(trackId);
                    navigate(`/track/${trackId}`);
                }
            });
        }

        const listenAgainBtn = this._container.querySelector('.afp-listen-again-btn');
        if (listenAgainBtn) {
            listenAgainBtn.addEventListener('click', () => {
                this._updateUI('idle');
            });
        }
    }

    _bindSettingsEvents() {
        if (!this._container) return;

        const saveBtn = this._container.querySelector('.afp-save-token-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const input = this._container.querySelector('#afp-token-input');
                if (input) {
                    const token = input.value.trim();
                    if (token) {
                        localStorage.setItem(AUDD_TOKEN_KEY, token);
                        showNotification('API token saved.', 'success');
                        this._updateUI('idle');
                    } else {
                        localStorage.removeItem(AUDD_TOKEN_KEY);
                        showNotification('API token cleared.', 'info');
                    }
                }
            });
        }

        const backBtn = this._container.querySelector('.afp-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this._updateUI('idle');
            });
        }
    }

    _bindIdleEvents() {
        if (!this._container) return;

        const listenBtn = this._container.querySelector('.afp-listen-btn');
        if (listenBtn) {
            listenBtn.addEventListener('click', () => {
                this.startListening();
            });
        }

        const settingsBtn = this._container.querySelector('.afp-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this._updateUI('settings');
            });
        }
    }

    renderUI(container) {
        this._container = container;
        this._container.classList.add('afp-container');

        this._container.innerHTML = `<div class="afp-content"></div>`;

        this._updateUI('idle');

        this._container.addEventListener('click', (e) => {
            const target = e.target;

            if (target.closest('.afp-listen-btn')) {
                this.startListening();
            } else if (target.closest('.afp-stop-btn')) {
                this.stopListening();
            } else if (target.closest('.afp-listen-again-btn')) {
                this._updateUI('idle');
            } else if (target.closest('.afp-settings-btn')) {
                this._updateUI('settings');
            } else if (target.closest('.afp-back-btn')) {
                this._updateUI('idle');
            } else if (target.closest('.afp-save-token-btn')) {
                this._bindSettingsEvents();
            } else if (target.closest('.afp-play-btn')) {
                const btn = target.closest('.afp-play-btn');
                const trackId = btn.dataset.trackId;
                if (trackId) {
                    this._player.playTrack(trackId);
                    navigate(`/track/${trackId}`);
                }
            }
        });

        return this._container;
    }

    renderButton() {
        return this.createFAB();
    }

    createFAB() {
        if (this._fab) return this._fab;

        const btn = document.createElement('button');
        btn.className = 'afp-fab';
        btn.setAttribute('aria-label', 'Identify song');
        btn.setAttribute('title', "What's this song?");
        btn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    `;

        btn.addEventListener('click', () => {
            if (!document.querySelector('.afp-container')) {
                const overlay = document.createElement('div');
                overlay.className = 'afp-overlay';
                overlay.innerHTML = `
          <div class="afp-panel">
            <button class="afp-panel-close" aria-label="Close">&times;</button>
            <div class="afp-panel-body"></div>
          </div>
        `;
                document.body.appendChild(overlay);

                const panelBody = overlay.querySelector('.afp-panel-body');
                this.renderUI(panelBody);

                const closeBtn = overlay.querySelector('.afp-panel-close');
                closeBtn.addEventListener('click', () => {
                    if (this._isListening) this.stopListening();
                    overlay.remove();
                });

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        if (this._isListening) this.stopListening();
                        overlay.remove();
                    }
                });
            }
        });

        this._fab = btn;
        return btn;
    }

    destroy() {
        if (this._isListening) this.stopListening();
        if (this._fab && this._fab.parentNode) {
            this._fab.parentNode.removeChild(this._fab);
        }
        this._fab = null;
        this._container = null;
    }

    _injectStyles() {
        if (document.getElementById('afp-styles')) return;

        const style = document.createElement('style');
        style.id = 'afp-styles';
        style.textContent = `
      .afp-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #e91e63;
        color: #fff;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(233, 30, 99, 0.4);
        z-index: 1000;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .afp-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(233, 30, 99, 0.5);
      }
      .afp-fab:active {
        transform: scale(0.95);
      }

      .afp-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }
      .afp-panel {
        background: #1a1a2e;
        border-radius: 16px;
        width: 90%;
        max-width: 420px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        color: #e0e0e0;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      }
      .afp-panel-close {
        position: absolute;
        top: 12px;
        right: 16px;
        background: none;
        border: none;
        color: #888;
        font-size: 28px;
        cursor: pointer;
        line-height: 1;
        z-index: 1;
      }
      .afp-panel-close:hover {
        color: #fff;
      }
      .afp-panel-body {
        padding: 32px 24px;
      }

      .afp-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
      }
      .afp-content {
        text-align: center;
      }

      .afp-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 16px 0 8px;
        color: #fff;
      }
      .afp-desc {
        font-size: 0.9rem;
        color: #999;
        margin: 0 0 24px;
        line-height: 1.5;
      }
      .afp-desc a {
        color: #e91e63;
        text-decoration: none;
      }
      .afp-desc a:hover {
        text-decoration: underline;
      }

      .afp-idle-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(233, 30, 99, 0.15);
        color: #e91e63;
      }

      .afp-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: background 0.2s ease, transform 0.1s ease;
        min-width: 120px;
      }
      .afp-btn:active {
        transform: scale(0.97);
      }
      .afp-btn-primary {
        background: #e91e63;
        color: #fff;
      }
      .afp-btn-primary:hover {
        background: #c2185b;
      }
      .afp-btn-secondary {
        background: #333;
        color: #fff;
      }
      .afp-btn-secondary:hover {
        background: #444;
      }
      .afp-btn-ghost {
        background: transparent;
        color: #999;
        border: 1px solid #444;
      }
      .afp-btn-ghost:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
      }
      .afp-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
      }

      .afp-pulse-ring {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 100px;
        height: 100px;
        margin: 0 auto;
      }
      .afp-pulse-ring::before,
      .afp-pulse-ring::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid #e91e63;
        animation: afp-pulse 1.5s ease-out infinite;
      }
      .afp-pulse-ring::after {
        animation-delay: 0.5s;
      }
      .afp-pulse-core {
        position: relative;
        z-index: 1;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(233, 30, 99, 0.2);
        color: #e91e63;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      @keyframes afp-pulse {
        0% {
          transform: scale(0.6);
          opacity: 1;
        }
        100% {
          transform: scale(1.6);
          opacity: 0;
        }
      }

      .afp-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid #333;
        border-top-color: #e91e63;
        border-radius: 50%;
        margin: 0 auto 16px;
        animation: afp-spin 0.8s linear infinite;
      }
      @keyframes afp-spin {
        to { transform: rotate(360deg); }
      }

      .afp-result-card {
        display: flex;
        gap: 16px;
        align-items: center;
        text-align: left;
        margin-bottom: 24px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 12px;
      }
      .afp-artwork {
        width: 100px;
        height: 100px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
      }
      .afp-artwork-small {
        width: 80px;
        height: 80px;
        border-radius: 8px;
        object-fit: cover;
        margin: 0 auto 12px;
      }
      .afp-artwork-placeholder {
        background: #333;
      }
      .afp-result-info {
        flex: 1;
        min-width: 0;
      }
      .afp-track-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #fff;
        margin: 0 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .afp-track-artist {
        font-size: 0.95rem;
        color: #ccc;
        margin: 0 0 4px;
      }
      .afp-track-album {
        font-size: 0.85rem;
        color: #888;
        margin: 0 0 8px;
      }
      .afp-tidal-badge {
        display: inline-block;
        font-size: 0.75rem;
        color: #00bcd4;
        background: rgba(0, 188, 212, 0.1);
        padding: 2px 8px;
        border-radius: 4px;
        margin: 0;
      }

      .afp-settings-field {
        margin-bottom: 20px;
        text-align: left;
      }
      .afp-label {
        display: block;
        font-size: 0.85rem;
        color: #999;
        margin-bottom: 6px;
      }
      .afp-input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #444;
        background: #111;
        color: #fff;
        font-size: 0.9rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s ease;
      }
      .afp-input:focus {
        border-color: #e91e63;
      }
      .afp-input::placeholder {
        color: #555;
      }

      .afp-not-found-icon,
      .afp-error-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        color: #666;
        margin-bottom: 8px;
      }
      .afp-error-icon {
        color: #f44336;
        background: rgba(244, 67, 54, 0.1);
      }
    `;

        document.head.appendChild(style);
    }
}
