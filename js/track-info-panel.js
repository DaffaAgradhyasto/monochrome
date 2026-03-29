import { escapeHtml, formatTime, getTrackArtists } from './utils.js';

export class TrackInfoPanel {
    constructor(player, audioPlayer) {
        this._player = player;
        this._audioPlayer = audioPlayer;
        this._panel = null;
        this._isOpen = false;
        this._updateInterval = null;
        this._audioContext = null;
        this._analyser = null;
        this._sourceNode = null;
        this._connected = false;
        this._prevEnergy = 0;
        this._beatHistory = [];
        this._lastBeatTime = 0;
        this._estimatedBPM = null;
        this._rmsHistory = [];

        this._injectStyles();
    }

    _injectStyles() {
        if (document.getElementById('tip-styles')) return;

        const style = document.createElement('style');
        style.id = 'tip-styles';
        style.textContent = `
      .tip-overlay {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 380px;
        max-width: 90vw;
        background: #0a0a0a;
        color: #e0e0e0;
        z-index: 9999;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        border-left: 1px solid #222;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
      }

      .tip-overlay.tip-open {
        transform: translateX(0);
      }

      .tip-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 9998;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .tip-backdrop.tip-visible {
        opacity: 1;
        pointer-events: auto;
      }

      .tip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #1a1a1a;
        flex-shrink: 0;
      }

      .tip-header-title {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .tip-close-btn {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: color 0.15s, background 0.15s;
      }

      .tip-close-btn:hover {
        color: #fff;
        background: #222;
      }

      .tip-close-btn svg {
        width: 18px;
        height: 18px;
      }

      .tip-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        scrollbar-width: thin;
        scrollbar-color: #333 transparent;
      }

      .tip-body::-webkit-scrollbar {
        width: 6px;
      }

      .tip-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .tip-body::-webkit-scrollbar-thumb {
        background: #333;
        border-radius: 3px;
      }

      .tip-section {
        margin-bottom: 20px;
      }

      .tip-section-title {
        font-size: 10px;
        font-weight: 700;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-bottom: 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid #1a1a1a;
      }

      .tip-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 5px 0;
      }

      .tip-label {
        color: #888;
        font-size: 12px;
      }

      .tip-value {
        color: #e0e0e0;
        font-size: 12px;
        font-weight: 500;
        text-align: right;
        max-width: 60%;
        word-break: break-all;
      }

      .tip-value.tip-highlight {
        color: #fff;
      }

      .tip-value.tip-quality-hires {
        color: #a78bfa;
      }

      .tip-value.tip-quality-lossless {
        color: #34d399;
      }

      .tip-value.tip-quality-high {
        color: #60a5fa;
      }

      .tip-value.tip-quality-low {
        color: #9ca3af;
      }

      .tip-playback-bar {
        margin-top: 6px;
        margin-bottom: 2px;
      }

      .tip-progress-track {
        width: 100%;
        height: 4px;
        background: #222;
        border-radius: 2px;
        overflow: hidden;
      }

      .tip-progress-fill {
        height: 100%;
        background: #fff;
        border-radius: 2px;
        transition: width 0.5s linear;
      }

      .tip-playback-times {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 11px;
        color: #666;
      }

      .tip-no-track {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #555;
        font-size: 14px;
      }

      .tip-toggle-btn {
        background: none;
        border: 1px solid #333;
        color: #aaa;
        cursor: pointer;
        padding: 6px 8px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.15s, color 0.15s;
      }

      .tip-toggle-btn:hover {
        border-color: #666;
        color: #fff;
      }

      .tip-toggle-btn.tip-active {
        border-color: #a78bfa;
        color: #a78bfa;
      }

      .tip-toggle-btn svg {
        width: 18px;
        height: 18px;
      }

      .tip-buffer-bar {
        margin-top: 6px;
      }

      .tip-buffer-track {
        width: 100%;
        height: 4px;
        background: #222;
        border-radius: 2px;
        overflow: hidden;
      }

      .tip-buffer-fill {
        height: 100%;
        background: #4ade80;
        border-radius: 2px;
        transition: width 0.5s linear;
      }

      .tip-loudness-meter {
        margin-top: 6px;
      }

      .tip-loudness-track {
        width: 100%;
        height: 8px;
        background: #1a1a1a;
        border-radius: 4px;
        overflow: hidden;
        position: relative;
      }

      .tip-loudness-fill {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);
        border-radius: 4px;
        transition: width 0.1s linear;
      }
    `;
        document.head.appendChild(style);
    }

    _getQualityInfo(track) {
        if (!track) {
            return { label: 'Unknown', cssClass: '', bitrate: '-', sampleRate: '-', bitDepth: '-', codec: '-' };
        }

        const quality = track.audioQuality || '';
        const tags = track.mediaMetadata?.tags || [];

        let label = 'Unknown';
        let cssClass = '';
        let bitrate = '-';
        let sampleRate = '-';
        let bitDepth = '-';
        let codec = '-';

        switch (quality) {
            case 'HIRES_LOSSLESS':
                label = 'Hi-Res FLAC';
                cssClass = 'tip-quality-hires';
                bitrate = 'Up to 9216 kbps';
                sampleRate = 'Up to 192 kHz';
                bitDepth = '24-bit';
                codec = 'FLAC';
                break;
            case 'LOSSLESS':
                label = 'CD Quality FLAC';
                cssClass = 'tip-quality-lossless';
                bitrate = '1411 kbps';
                sampleRate = '44.1 kHz';
                bitDepth = '16-bit';
                codec = 'FLAC';
                break;
            case 'HIGH':
                label = 'AAC 320kbps';
                cssClass = 'tip-quality-high';
                bitrate = '320 kbps';
                sampleRate = '44.1 kHz';
                bitDepth = '-';
                codec = 'AAC';
                break;
            case 'LOW':
                label = 'AAC 96kbps';
                cssClass = 'tip-quality-low';
                bitrate = '96 kbps';
                sampleRate = '44.1 kHz';
                bitDepth = '-';
                codec = 'AAC';
                break;
            default:
                label = quality || 'Unknown';
                break;
        }

        if (tags.includes('MQA')) {
            label += ' (MQA)';
        }
        if (tags.includes('DOLBY_ATMOS')) {
            label += ' · Dolby Atmos';
            codec = 'Dolby AC-4 / E-AC-3 JOC';
        }
        if (tags.includes('SONY_360RA')) {
            label += ' · 360 Reality Audio';
            codec = 'MPEG-H 3D Audio';
        }

        return { label, cssClass, bitrate, sampleRate, bitDepth, codec };
    }

    _getTechnicalDetails() {
        const track = this._player?.currentTrack;
        if (!track) return null;

        const quality = this._getQualityInfo(track);
        const artists = getTrackArtists(track);

        return {
            title: track.title || 'Unknown Title',
            artists: artists,
            album: track.album?.title || 'Unknown Album',
            duration: track.duration || 0,
            trackNumber: track.trackNumber || '-',
            volumeNumber: track.volumeNumber || '-',
            quality: quality,
            isrc: track.isrc || '-',
            copyright: track.copyright || '-',
            albumCoverUrl: track.album?.coverUrl || '',
        };
    }

    _ensureAnalyser() {
        if (this._audioContext && this._analyser) return;

        try {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this._analyser = this._audioContext.createAnalyser();
            this._analyser.fftSize = 2048;
            this._analyser.smoothingTimeConstant = 0.8;
        } catch (_e) {
            this._analyser = null;
        }
    }

    _connectAnalyser() {
        if (this._connected || !this._audioPlayer || !this._analyser) return;

        try {
            this._sourceNode = this._audioContext.createMediaElementSource(this._audioPlayer);
            this._sourceNode.connect(this._analyser);
            this._analyser.connect(this._audioContext.destination);
            this._connected = true;
        } catch (_e) {
            this._connected = false;
        }
    }

    _calculateRMS() {
        if (!this._analyser) return 0;

        const bufferLength = this._analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this._analyser.getFloatTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }

        const rms = Math.sqrt(sum / bufferLength);
        return rms;
    }

    _estimateBPM() {
        if (!this._analyser) return null;

        const bufferLength = this._analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this._analyser.getFloatTimeDomainData(dataArray);

        let energy = 0;
        for (let i = 0; i < bufferLength; i++) {
            energy += dataArray[i] * dataArray[i];
        }
        energy = Math.sqrt(energy / bufferLength);

        const now = performance.now();
        const threshold = 0.02;
        const minInterval = 250;

        if (energy > threshold && energy > this._prevEnergy * 1.3 && now - this._lastBeatTime > minInterval) {
            const interval = now - this._lastBeatTime;
            this._lastBeatTime = now;

            if (interval > 250 && interval < 2000) {
                this._beatHistory.push(interval);
                if (this._beatHistory.length > 24) {
                    this._beatHistory.shift();
                }
            }
        }

        this._prevEnergy = energy * 0.9 + this._prevEnergy * 0.1;

        if (this._beatHistory.length >= 4) {
            const sorted = [...this._beatHistory].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const medianInterval = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

            const bpm = Math.round(60000 / medianInterval);
            if (bpm >= 40 && bpm <= 220) {
                this._estimatedBPM = bpm;
            }
        }

        return this._estimatedBPM;
    }

    _getBufferHealth() {
        const audio = this._audioPlayer;
        if (!audio || !audio.buffered || audio.buffered.length === 0) return 0;

        const duration = audio.duration;
        if (!duration || !isFinite(duration)) return 0;

        let buffered = 0;
        for (let i = 0; i < audio.buffered.length; i++) {
            buffered += audio.buffered.end(i) - audio.buffered.start(i);
        }

        return Math.min(100, Math.round((buffered / duration) * 100));
    }

    _formatQuality(quality) {
        return quality || '-';
    }

    _render() {
        const track = this._player?.currentTrack;

        if (!track) {
            return `
        <div class="tip-overlay" id="tip-panel">
          <div class="tip-header">
            <span class="tip-header-title">Track Info</span>
            <button class="tip-close-btn" id="tip-close-btn" aria-label="Close track info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="tip-body">
            <div class="tip-no-track">No track currently playing</div>
          </div>
        </div>
        <div class="tip-backdrop" id="tip-backdrop"></div>
      `;
        }

        const details = this._getTechnicalDetails();
        const audio = this._audioPlayer;
        const currentTime = audio?.currentTime || 0;
        const duration = details.duration;
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
        const bufferHealth = this._getBufferHealth();

        const rms = this._calculateRMS();
        const rmsPercent = Math.min(100, Math.round(rms * 500));
        const loudnessDb = rms > 0 ? (20 * Math.log10(rms)).toFixed(1) : '-∞';

        const bpm = this._estimateBPM();

        return `
      <div class="tip-overlay" id="tip-panel">
        <div class="tip-header">
          <span class="tip-header-title">Track Info</span>
          <button class="tip-close-btn" id="tip-close-btn" aria-label="Close track info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="tip-body">
          <div class="tip-section">
            <div class="tip-section-title">Basic Info</div>
            <div class="tip-row">
              <span class="tip-label">Title</span>
              <span class="tip-value tip-highlight">${escapeHtml(details.title)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Artist</span>
              <span class="tip-value">${escapeHtml(details.artists)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Album</span>
              <span class="tip-value">${escapeHtml(details.album)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Duration</span>
              <span class="tip-value">${formatTime(duration)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Track</span>
              <span class="tip-value">${details.volumeNumber !== '-' ? details.volumeNumber + '/' : ''}${details.trackNumber}</span>
            </div>
          </div>

          <div class="tip-section">
            <div class="tip-section-title">Technical Info</div>
            <div class="tip-row">
              <span class="tip-label">Quality</span>
              <span class="tip-value ${details.quality.cssClass}">${escapeHtml(details.quality.label)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Bitrate</span>
              <span class="tip-value">${escapeHtml(details.quality.bitrate)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Sample Rate</span>
              <span class="tip-value">${escapeHtml(details.quality.sampleRate)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Bit Depth</span>
              <span class="tip-value">${escapeHtml(details.quality.bitDepth)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Codec</span>
              <span class="tip-value">${escapeHtml(details.quality.codec)}</span>
            </div>
          </div>

          <div class="tip-section">
            <div class="tip-section-title">Identifiers</div>
            <div class="tip-row">
              <span class="tip-label">ISRC</span>
              <span class="tip-value">${escapeHtml(details.isrc)}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Copyright</span>
              <span class="tip-value">${escapeHtml(details.copyright)}</span>
            </div>
          </div>

          <div class="tip-section">
            <div class="tip-section-title">Audio Analysis</div>
            <div class="tip-row">
              <span class="tip-label">BPM (est.)</span>
              <span class="tip-value">${bpm !== null ? bpm : 'Analyzing...'}</span>
            </div>
            <div class="tip-row">
              <span class="tip-label">Loudness</span>
              <span class="tip-value">${loudnessDb} dB</span>
            </div>
            <div class="tip-loudness-meter">
              <div class="tip-loudness-track">
                <div class="tip-loudness-fill" id="tip-loudness-fill" style="width: ${rmsPercent}%"></div>
              </div>
            </div>
          </div>

          <div class="tip-section">
            <div class="tip-section-title">Playback Info</div>
            <div class="tip-row">
              <span class="tip-label">Position</span>
              <span class="tip-value tip-highlight" id="tip-position-value">${formatTime(currentTime)} / ${formatTime(duration)}</span>
            </div>
            <div class="tip-playback-bar">
              <div class="tip-progress-track">
                <div class="tip-progress-fill" id="tip-progress-fill" style="width: ${progressPercent.toFixed(2)}%"></div>
              </div>
              <div class="tip-playback-times">
                <span id="tip-current-time">${formatTime(currentTime)}</span>
                <span id="tip-remaining-time">-${formatTime(Math.max(0, duration - currentTime))}</span>
              </div>
            </div>
            <div class="tip-row" style="margin-top: 8px;">
              <span class="tip-label">Buffer Health</span>
              <span class="tip-value" id="tip-buffer-value">${bufferHealth}%</span>
            </div>
            <div class="tip-buffer-bar">
              <div class="tip-buffer-track">
                <div class="tip-buffer-fill" id="tip-buffer-fill" style="width: ${bufferHealth}%"></div>
              </div>
            </div>
            <div class="tip-row" style="margin-top: 8px;">
              <span class="tip-label">Codec In Use</span>
              <span class="tip-value" id="tip-active-codec">${escapeHtml(details.quality.codec)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="tip-backdrop" id="tip-backdrop"></div>
    `;
    }

    _updateLiveValues() {
        const audio = this._audioPlayer;
        if (!audio || !this._isOpen) return;

        const currentTime = audio.currentTime || 0;
        const duration = audio.duration || 0;
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

        const positionEl = document.getElementById('tip-position-value');
        const progressEl = document.getElementById('tip-progress-fill');
        const currentTimeEl = document.getElementById('tip-current-time');
        const remainingTimeEl = document.getElementById('tip-remaining-time');

        if (positionEl) positionEl.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        if (progressEl) progressEl.style.width = `${progressPercent.toFixed(2)}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime);
        if (remainingTimeEl) remainingTimeEl.textContent = `-${formatTime(Math.max(0, duration - currentTime))}`;

        const bufferHealth = this._getBufferHealth();
        const bufferValueEl = document.getElementById('tip-buffer-value');
        const bufferFillEl = document.getElementById('tip-buffer-fill');
        if (bufferValueEl) bufferValueEl.textContent = `${bufferHealth}%`;
        if (bufferFillEl) bufferFillEl.style.width = `${bufferHealth}%`;

        const rms = this._calculateRMS();
        const rmsPercent = Math.min(100, Math.round(rms * 500));
        const loudnessFillEl = document.getElementById('tip-loudness-fill');
        if (loudnessFillEl) loudnessFillEl.style.width = `${rmsPercent}%`;

        this._estimateBPM();
    }

    _startLiveUpdates() {
        this._stopLiveUpdates();
        this._updateInterval = setInterval(() => {
            this._updateLiveValues();
        }, 500);
    }

    _stopLiveUpdates() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
    }

    _bindEvents() {
        const closeBtn = document.getElementById('tip-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        const backdrop = document.getElementById('tip-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.close());
        }
    }

    open() {
        this._ensureAnalyser();
        this._connectAnalyser();

        if (this._audioContext && this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }

        let existingPanel = document.getElementById('tip-panel');
        let existingBackdrop = document.getElementById('tip-backdrop');

        if (existingPanel) existingPanel.remove();
        if (existingBackdrop) existingBackdrop.remove();

        const container = document.createElement('div');
        container.innerHTML = this._render();

        while (container.firstChild) {
            document.body.appendChild(container.firstChild);
        }

        this._panel = document.getElementById('tip-panel');
        const backdrop = document.getElementById('tip-backdrop');

        requestAnimationFrame(() => {
            if (this._panel) this._panel.classList.add('tip-open');
            if (backdrop) backdrop.classList.add('tip-visible');
        });

        this._bindEvents();
        this._startLiveUpdates();
        this._isOpen = true;

        const toggleBtn = document.querySelector('.tip-toggle-btn');
        if (toggleBtn) toggleBtn.classList.add('tip-active');
    }

    close() {
        const panel = document.getElementById('tip-panel');
        const backdrop = document.getElementById('tip-backdrop');

        if (panel) panel.classList.remove('tip-open');
        if (backdrop) backdrop.classList.remove('tip-visible');

        this._stopLiveUpdates();
        this._isOpen = false;

        const toggleBtn = document.querySelector('.tip-toggle-btn');
        if (toggleBtn) toggleBtn.classList.remove('tip-active');

        setTimeout(() => {
            if (panel) panel.remove();
            if (backdrop) backdrop.remove();
            this._panel = null;
        }, 300);
    }

    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    createToggleButton() {
        const btn = document.createElement('button');
        btn.className = 'tip-toggle-btn';
        btn.setAttribute('aria-label', 'Track info');
        btn.title = 'Track Info';
        btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
        btn.addEventListener('click', () => this.toggle());
        return btn;
    }

    refresh() {
        if (this._isOpen) {
            this._resetAnalysis();
            const container = document.createElement('div');
            container.innerHTML = this._render();

            const oldPanel = document.getElementById('tip-panel');
            const oldBackdrop = document.getElementById('tip-backdrop');

            if (oldPanel) oldPanel.remove();
            if (oldBackdrop) oldBackdrop.remove();

            while (container.firstChild) {
                document.body.appendChild(container.firstChild);
            }

            this._panel = document.getElementById('tip-panel');
            const backdrop = document.getElementById('tip-backdrop');

            requestAnimationFrame(() => {
                if (this._panel) this._panel.classList.add('tip-open');
                if (backdrop) backdrop.classList.add('tip-visible');
            });

            this._bindEvents();
        }
    }

    _resetAnalysis() {
        this._beatHistory = [];
        this._lastBeatTime = 0;
        this._prevEnergy = 0;
        this._estimatedBPM = null;
        this._rmsHistory = [];
    }

    destroy() {
        this._stopLiveUpdates();
        this.close();

        if (this._sourceNode) {
            try {
                this._sourceNode.disconnect();
            } catch (_e) {
                /* noop */
            }
            this._sourceNode = null;
        }

        if (this._analyser) {
            try {
                this._analyser.disconnect();
            } catch (_e) {
                /* noop */
            }
            this._analyser = null;
        }

        if (this._audioContext) {
            this._audioContext.close().catch(() => {});
            this._audioContext = null;
        }

        this._connected = false;
        this._panel = null;

        const styleEl = document.getElementById('tip-styles');
        if (styleEl) styleEl.remove();
    }
}
