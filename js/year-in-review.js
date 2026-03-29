// js/year-in-review.js
// Year-in-Review / "Wrapped" style annual listening summary

import { escapeHtml, getTrackArtists } from './utils.js';
import { navigate } from './router.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PERSONALITIES = [
    {
        id: 'night-owl',
        badge: 'Night Owl',
        icon: '\u{1F989}',
        desc: 'You thrive after midnight. The darker it gets, the louder you play.',
        test: (d) => d.nightRatio > 0.4,
    },
    {
        id: 'early-bird',
        badge: 'Early Bird',
        icon: '\u{1F426}',
        desc: 'Sunrise soundtrack on repeat. Music is your morning coffee.',
        test: (d) => d.morningRatio > 0.4,
    },
    {
        id: 'superfan',
        badge: 'Superfan',
        icon: '\u2B50',
        desc: (d) => `Your devotion to ${d.topArtist} is legendary.`,
        test: (d) => d.topArtistRatio > 0.3,
    },
    {
        id: 'explorer',
        badge: 'Explorer',
        icon: '\u{1F30D}',
        desc: 'Always hunting for the next sound. Your library is a map of the world.',
        test: (d) => d.uniqueArtists > 50,
    },
    {
        id: 'marathoner',
        badge: 'Marathoner',
        icon: '\u{1F3C3}',
        desc: (d) => `${d.totalHours}+ hours of non-stop listening. Your stamina is unreal.`,
        test: (d) => d.totalHours > 500,
    },
    {
        id: 'weekend-warrior',
        badge: 'Weekend Warrior',
        icon: '\u{1F94A}',
        desc: 'The workweek is quiet, but your weekends are a concert.',
        test: (d) => d.weekendRatio > 0.5,
    },
    {
        id: 'completionist',
        badge: 'Completionist',
        icon: '\u2705',
        desc: "You don't skip. You listen to every track start to finish.",
        test: (d) => d.avgPlaysPerTrack > 5,
    },
    {
        id: 'curator',
        badge: 'Curator',
        icon: '\u{1F3A8}',
        desc: 'Your taste is refined. Few artists make the cut, but those who do are gold.',
        test: (d) => d.uniqueArtists < 20 && d.totalPlays > 100,
    },
    {
        id: 'newcomer',
        badge: 'Getting Started',
        icon: '\u{1F331}',
        desc: 'Every journey starts with a single track. Keep listening!',
        test: () => false,
    },
];

export class YearInReview {
    constructor() {
        this._statsDb = null;
        this._mainDb = null;
        this._currentYear = new Date().getFullYear();
        this._selectedYear = this._currentYear;
        this._reviewData = null;
        this._container = null;
    }

    async _openMainDb() {
        if (this._mainDb) return this._mainDb;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('MonochromeDB', 10);
            req.onsuccess = () => {
                this._mainDb = req.result;
                resolve(this._mainDb);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async _openStatsDb() {
        if (this._statsDb) return this._statsDb;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('monochrome-stats', 2);
            req.onsuccess = () => {
                this._statsDb = req.result;
                resolve(this._statsDb);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async _getHistoryTracks(year) {
        try {
            const db = await this._openMainDb();
            return new Promise((resolve) => {
                const tx = db.transaction('history_tracks', 'readonly');
                const store = tx.objectStore('history_tracks');
                const index = store.index('timestamp');
                const req = index.getAll();
                req.onsuccess = () => {
                    const start = new Date(year, 0, 1).getTime();
                    const end = new Date(year + 1, 0, 1).getTime();
                    const filtered = (req.result || []).filter((t) => t.timestamp >= start && t.timestamp < end);
                    resolve(filtered);
                };
                req.onerror = () => resolve([]);
            });
        } catch {
            return [];
        }
    }

    async _getStatsPlays(year) {
        try {
            const db = await this._openStatsDb();
            return new Promise((resolve) => {
                const tx = db.transaction('plays', 'readonly');
                const store = tx.objectStore('plays');
                const req = store.getAll();
                req.onsuccess = () => {
                    const yearStr = String(year);
                    const filtered = (req.result || []).filter((p) => p.date && p.date.startsWith(yearStr));
                    resolve(filtered);
                };
                req.onerror = () => resolve([]);
            });
        } catch {
            return [];
        }
    }

    _getArtistName(track) {
        if (track.artists && track.artists.length > 0) {
            return track.artists.map((a) => a?.name || a).join(', ');
        }
        if (track.artist) {
            return typeof track.artist === 'string' ? track.artist : track.artist.name || 'Unknown Artist';
        }
        return track.artistName || 'Unknown Artist';
    }

    _getPrimaryArtistName(track) {
        if (track.artists && track.artists.length > 0) {
            return track.artists[0]?.name || 'Unknown Artist';
        }
        if (track.artist) {
            return typeof track.artist === 'string' ? track.artist : track.artist.name || 'Unknown Artist';
        }
        return track.artistName || 'Unknown Artist';
    }

    _getTrackTitle(track) {
        if (track.title) {
            return track.version ? `${track.title} (${track.version})` : track.title;
        }
        return 'Unknown Title';
    }

    _getGenre(track) {
        const tags = track.album?.mediaMetadata?.tags || track.mediaMetadata?.tags;
        if (Array.isArray(tags)) {
            const genreTags = tags.filter((t) => {
                const lower = t.toLowerCase();
                return ![
                    'dolby_atmos',
                    'hi_res_lossless',
                    'hires_lossless',
                    'lossless',
                    'high',
                    'low',
                    'master',
                    'mqa',
                    'hifi',
                    'hifi_plus',
                ].some((q) => lower === q || lower.replace(/_/g, '') === q.replace(/_/g, ''));
            });
            return genreTags;
        }
        return [];
    }

    _computePersonality(stats) {
        const hourCounts = stats.hourCounts;
        const total = stats.totalPlays;
        if (total === 0) return PERSONALITIES[PERSONALITIES.length - 1];

        const nightPlays =
            hourCounts.slice(22).reduce((a, b) => a + b, 0) + hourCounts.slice(0, 5).reduce((a, b) => a + b, 0);
        const morningPlays = hourCounts.slice(5, 12).reduce((a, b) => a + b, 0);
        const weekendPlays = (stats.dayCounts[0] || 0) + (stats.dayCounts[6] || 0);
        const weekdayPlays = total - weekendPlays;

        const topArtist = stats.topArtists[0]?.name || '';
        const topArtistRatio = stats.topArtists[0] ? stats.topArtists[0].count / total : 0;

        const data = {
            nightRatio: nightPlays / total,
            morningRatio: morningPlays / total,
            topArtist,
            topArtistRatio,
            uniqueArtists: stats.topArtists.length,
            totalHours: Math.round(stats.totalSeconds / 3600),
            weekendRatio: total > 0 ? weekendPlays / total : 0,
            avgPlaysPerTrack: stats.uniqueTracks > 0 ? total / stats.uniqueTracks : 0,
            totalPlays: total,
        };

        for (const p of PERSONALITIES) {
            if (p.id === 'newcomer') continue;
            if (p.test(data)) {
                return {
                    ...p,
                    desc: typeof p.desc === 'function' ? p.desc(data) : p.desc,
                };
            }
        }
        return PERSONALITIES.find((p) => p.id === 'explorer');
    }

    async generateReview(year = new Date().getFullYear()) {
        const [historyTracks, statsPlays] = await Promise.all([
            this._getHistoryTracks(year),
            this._getStatsPlays(year),
        ]);

        const artistCounts = {};
        const trackCounts = {};
        const genreCounts = {};
        const monthlySeconds = new Array(12).fill(0);
        const monthlyPlays = new Array(12).fill(0);
        const hourCounts = new Array(24).fill(0);
        const dayCounts = new Array(7).fill(0);

        let totalSeconds = 0;
        let totalPlays = 0;
        const seenTrackIds = new Set();
        let firstSong = null;

        for (const t of historyTracks) {
            const ts = t.timestamp;
            const date = new Date(ts);
            if (!firstSong || ts < firstSong.timestamp) {
                firstSong = { ...t, _date: date };
            }

            const artistName = this._getPrimaryArtistName(t);
            artistCounts[artistName] = (artistCounts[artistName] || 0) + 1;

            const trackKey = `${t.id || t.title}__${artistName}`;
            trackCounts[trackKey] = trackCounts[trackKey] || {
                title: this._getTrackTitle(t),
                artist: this._getArtistName(t),
                count: 0,
                id: t.id,
            };
            trackCounts[trackKey].count++;

            const genres = this._getGenre(t);
            for (const g of genres) {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            }

            const dur = t.duration || 0;
            totalSeconds += dur;
            totalPlays++;
            seenTrackIds.add(t.id);

            const month = date.getMonth();
            monthlySeconds[month] += dur;
            monthlyPlays[month]++;
            hourCounts[date.getHours()]++;
            dayCounts[date.getDay()]++;
        }

        for (const p of statsPlays) {
            const artistName = p.artistName || 'Unknown Artist';
            artistCounts[artistName] = (artistCounts[artistName] || 0) + 1;

            const trackKey = `${p.trackId}__${artistName}`;
            trackCounts[trackKey] = trackCounts[trackKey] || {
                title: p.title || 'Unknown Title',
                artist: artistName,
                count: 0,
                id: p.trackId,
            };
            trackCounts[trackKey].count++;

            const dur = p.duration || 0;
            totalSeconds += dur;
            totalPlays++;
            seenTrackIds.add(p.trackId);

            if (p.date) {
                const m = parseInt(p.date.split('-')[1], 10) - 1;
                if (m >= 0 && m < 12) {
                    monthlySeconds[m] += dur;
                    monthlyPlays[m]++;
                }
            }
            if (typeof p.hour === 'number') hourCounts[p.hour]++;
            if (typeof p.dayOfWeek === 'number') dayCounts[p.dayOfWeek]++;

            if (p.timestamp) {
                if (!firstSong || p.timestamp < firstSong.timestamp) {
                    firstSong = {
                        title: p.title,
                        artist: artistName,
                        timestamp: p.timestamp,
                        _date: new Date(p.timestamp),
                    };
                }
            }
        }

        const totalMinutes = Math.round(totalSeconds / 60);
        const uniqueTracks = seenTrackIds.size;

        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const topTracks = Object.values(trackCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ name, count }));

        let peakMonthIdx = 0;
        for (let i = 1; i < 12; i++) {
            if (monthlySeconds[i] > monthlySeconds[peakMonthIdx]) peakMonthIdx = i;
        }

        const stats = {
            totalPlays,
            totalSeconds,
            topArtists,
            uniqueTracks,
            hourCounts,
            dayCounts,
        };
        const personality = this._computePersonality(stats);

        this._reviewData = {
            year,
            totalMinutes,
            totalPlays,
            uniqueTracks,
            topArtists,
            topTracks,
            topGenres,
            monthlySeconds,
            monthlyPlays,
            hourCounts,
            dayCounts,
            personality,
            firstSong,
            peakMonth: {
                name: MONTH_NAMES[peakMonthIdx],
                index: peakMonthIdx,
                minutes: Math.round(monthlySeconds[peakMonthIdx] / 60),
            },
        };

        return this._reviewData;
    }

    _renderMonthChart(monthlySeconds) {
        const maxSeconds = Math.max(...monthlySeconds, 1);
        return monthlySeconds
            .map((sec, i) => {
                const pct = (sec / maxSeconds) * 100;
                const mins = Math.round(sec / 60);
                return `<div class="yr-month-col" title="${MONTH_NAMES[i]}: ${mins} min">
                    <div class="yr-month-bar" style="height:${Math.max(pct, 2)}%">
                        <span class="yr-month-value">${mins > 0 ? mins : ''}</span>
                    </div>
                    <span class="yr-month-label">${MONTH_NAMES[i]}</span>
                </div>`;
            })
            .join('');
    }

    _renderDayChart(dayCounts) {
        const max = Math.max(...dayCounts, 1);
        const shortDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        return dayCounts
            .map((c, i) => {
                const pct = (c / max) * 100;
                return `<div class="yr-day-col" title="${DAY_NAMES[i]}: ${c} plays">
                    <div class="yr-day-bar" style="height:${Math.max(pct, 2)}%"></div>
                    <span class="yr-day-label">${shortDays[i]}</span>
                </div>`;
            })
            .join('');
    }

    _renderHourChart(hourCounts) {
        const max = Math.max(...hourCounts, 1);
        return hourCounts
            .map((c, i) => {
                const pct = (c / max) * 100;
                return `<div class="yr-hour-bar" style="width:${Math.max(pct, 1)}%" title="${i}:00 - ${c} plays"></div>`;
            })
            .join('');
    }

    _buildShareText() {
        const d = this._reviewData;
        if (!d) return '';
        const lines = [
            `\u{1F3B5} Monochrome Wrapped ${d.year}`,
            '',
            `${d.totalMinutes.toLocaleString()} minutes listened`,
            `${d.totalPlays.toLocaleString()} plays across ${d.uniqueTracks} unique tracks`,
            '',
            `Top Artist: ${d.topArtists[0]?.name || 'N/A'}`,
            `Top Track: ${d.topTracks[0]?.title || 'N/A'} - ${d.topTracks[0]?.artist || ''}`,
            `Peak Month: ${d.peakMonth.name} (${d.peakMonth.minutes.toLocaleString()} min)`,
            '',
            `${d.personality.icon} ${d.personality.badge}: ${d.personality.desc}`,
        ];
        return lines.join('\n');
    }

    async _handleShare() {
        const text = this._buildShareText();
        const title = `Monochrome Wrapped ${this._reviewData.year}`;

        if (navigator.share) {
            try {
                await navigator.share({ title, text });
                return;
            } catch {
                // User cancelled or not supported, fall through to clipboard
            }
        }

        try {
            await navigator.clipboard.writeText(text);
            this._showToast('Summary copied to clipboard!');
        } catch {
            this._showToast('Could not copy to clipboard');
        }
    }

    _showToast(message) {
        const existing = document.querySelector('.yr-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'yr-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('yr-toast-visible'));
        setTimeout(() => {
            toast.classList.remove('yr-toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    async _handlePlayTrack(trackData) {
        if (!trackData?.id) return;
        window.dispatchEvent(new CustomEvent('play-track-by-id', { detail: { trackId: trackData.id } }));
    }

    async renderPage(container) {
        this._container = container;
        container.innerHTML =
            '<div class="yr-loading"><div class="yr-spinner"></div><p>Generating your Wrapped...</p></div>';

        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= currentYear - 5; y--) {
            years.push(y);
        }

        try {
            await this.generateReview(this._selectedYear);
        } catch (e) {
            console.error('[YearInReview] Failed to generate review:', e);
            container.innerHTML =
                '<div class="yr-empty"><p>Could not generate your Wrapped. Try again later.</p></div>';
            return;
        }

        const d = this._reviewData;
        if (!d || d.totalPlays === 0) {
            container.innerHTML = `
                <div class="yr-page">
                    <div class="yr-header">
                        <h1 class="yr-title">Monochrome Wrapped</h1>
                    </div>
                    <div class="yr-empty">
                        <div class="yr-empty-icon">\u{1F3B5}</div>
                        <h2>No listening data for ${this._selectedYear}</h2>
                        <p>Start listening to music and come back for your year-end summary!</p>
                        <button class="yr-btn yr-btn-primary" id="yr-go-listen">Browse Music</button>
                    </div>
                </div>`;
            container.querySelector('#yr-go-listen')?.addEventListener('click', () => navigate('/home'));
            return;
        }

        const firstSongDate = d.firstSong?._date;
        const firstSongDateStr = firstSongDate
            ? `${MONTH_NAMES[firstSongDate.getMonth()]} ${firstSongDate.getDate()}`
            : '';

        container.innerHTML = `
            <div class="yr-page">
                <div class="yr-header">
                    <div class="yr-header-bg"></div>
                    <div class="yr-header-content">
                        <h1 class="yr-title">Monochrome Wrapped</h1>
                        <p class="yr-subtitle">Your ${this._selectedYear} listening story</p>
                        <div class="yr-year-tabs">
                            ${years.map((y) => `<button class="yr-year-tab ${y === this._selectedYear ? 'yr-year-tab-active' : ''}" data-year="${y}">${y}</button>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="yr-cards">
                    <!-- Personality Card -->
                    <div class="yr-card yr-card-personality">
                        <div class="yr-card-glow"></div>
                        <span class="yr-card-label">Your Listening Personality</span>
                        <div class="yr-personality-icon">${d.personality.icon}</div>
                        <h2 class="yr-personality-badge">${escapeHtml(d.personality.badge)}</h2>
                        <p class="yr-personality-desc">${escapeHtml(d.personality.desc)}</p>
                    </div>

                    <!-- Overview Stats -->
                    <div class="yr-card yr-card-overview">
                        <span class="yr-card-label">By the Numbers</span>
                        <div class="yr-stats-grid">
                            <div class="yr-stat">
                                <span class="yr-stat-value">${d.totalMinutes.toLocaleString()}</span>
                                <span class="yr-stat-label">Minutes Listened</span>
                            </div>
                            <div class="yr-stat">
                                <span class="yr-stat-value">${d.totalPlays.toLocaleString()}</span>
                                <span class="yr-stat-label">Total Plays</span>
                            </div>
                            <div class="yr-stat">
                                <span class="yr-stat-value">${d.uniqueTracks.toLocaleString()}</span>
                                <span class="yr-stat-label">Unique Tracks</span>
                            </div>
                            <div class="yr-stat">
                                <span class="yr-stat-value">${d.topArtists.length > 0 ? d.topArtists.length : 0}</span>
                                <span class="yr-stat-label">Artists Played</span>
                            </div>
                        </div>
                    </div>

                    <!-- First Song -->
                    ${
                        d.firstSong
                            ? `
                    <div class="yr-card yr-card-first-song">
                        <span class="yr-card-label">First Track of ${this._selectedYear}</span>
                        <span class="yr-first-song-date">${escapeHtml(firstSongDateStr)}</span>
                        <div class="yr-first-song-info">
                            <span class="yr-first-song-title">${escapeHtml(d.firstSong.title || 'Unknown Title')}</span>
                            <span class="yr-first-song-artist">${escapeHtml(this._getArtistName(d.firstSong))}</span>
                        </div>
                    </div>`
                            : ''
                    }

                    <!-- Top Artists -->
                    <div class="yr-card yr-card-artists">
                        <span class="yr-card-label">Top 5 Artists</span>
                        <div class="yr-top-list">
                            ${d.topArtists
                                .map(
                                    (a, i) => `
                                <div class="yr-top-item" data-rank="${i + 1}">
                                    <span class="yr-top-rank">${i + 1}</span>
                                    <div class="yr-top-info">
                                        <span class="yr-top-name">${escapeHtml(a.name)}</span>
                                    </div>
                                    <span class="yr-top-count">${a.count} plays</span>
                                    <div class="yr-top-bar-bg"><div class="yr-top-bar" style="width:${d.topArtists[0].count > 0 ? (a.count / d.topArtists[0].count) * 100 : 0}%"></div></div>
                                </div>`
                                )
                                .join('')}
                        </div>
                    </div>

                    <!-- Top Tracks -->
                    <div class="yr-card yr-card-tracks">
                        <span class="yr-card-label">Top 10 Tracks</span>
                        <div class="yr-top-list yr-tracks-list">
                            ${d.topTracks
                                .map(
                                    (t, i) => `
                                <div class="yr-top-item yr-track-item" data-rank="${i + 1}" ${t.id ? `data-track-id="${escapeHtml(String(t.id))}"` : ''}>
                                    <span class="yr-top-rank">${i + 1}</span>
                                    <div class="yr-top-info">
                                        <span class="yr-top-name">${escapeHtml(t.title)}</span>
                                        <span class="yr-top-artist">${escapeHtml(t.artist)}</span>
                                    </div>
                                    <span class="yr-top-count">${t.count} plays</span>
                                </div>`
                                )
                                .join('')}
                        </div>
                    </div>

                    <!-- Top Genres -->
                    ${
                        d.topGenres.length > 0
                            ? `
                    <div class="yr-card yr-card-genres">
                        <span class="yr-card-label">Top Genres</span>
                        <div class="yr-genre-cloud">
                            ${d.topGenres
                                .map((g, i) => {
                                    const scale =
                                        1 + (d.topGenres[0].count > 0 ? (1 - g.count / d.topGenres[0].count) * 0.6 : 0);
                                    const opacity = 1 - i * 0.08;
                                    return `<span class="yr-genre-tag" style="font-size:${scale}em;opacity:${Math.max(opacity, 0.5)}">${escapeHtml(g.name)}</span>`;
                                })
                                .join('')}
                        </div>
                    </div>`
                            : ''
                    }

                    <!-- Monthly Listening -->
                    <div class="yr-card yr-card-monthly">
                        <span class="yr-card-label">Monthly Listening</span>
                        <div class="yr-month-chart">
                            ${this._renderMonthChart(d.monthlySeconds)}
                        </div>
                        <div class="yr-peak-badge">
                            Peak: <strong>${escapeHtml(d.peakMonth.name)}</strong> with ${d.peakMonth.minutes.toLocaleString()} minutes
                        </div>
                    </div>

                    <!-- Day of Week -->
                    <div class="yr-card yr-card-days">
                        <span class="yr-card-label">Listening by Day</span>
                        <div class="yr-day-chart">
                            ${this._renderDayChart(d.dayCounts)}
                        </div>
                    </div>

                    <!-- Hour Distribution -->
                    <div class="yr-card yr-card-hours">
                        <span class="yr-card-label">When You Listen</span>
                        <div class="yr-hour-chart">
                            ${this._renderHourChart(d.hourCounts)}
                        </div>
                        <div class="yr-hour-labels">
                            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
                        </div>
                    </div>
                </div>

                <div class="yr-footer">
                    <button class="yr-btn yr-btn-share" id="yr-share-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        Share Your Wrapped
                    </button>
                </div>
            </div>`;

        this._attachListeners(container);
    }

    _attachListeners(container) {
        container.querySelectorAll('.yr-year-tab').forEach((tab) => {
            tab.addEventListener('click', async () => {
                const year = parseInt(tab.dataset.year, 10);
                if (year === this._selectedYear) return;
                this._selectedYear = year;
                this._statsDb = null;
                this._mainDb = null;
                await this.renderPage(container);
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        container.querySelector('#yr-share-btn')?.addEventListener('click', () => this._handleShare());

        container.querySelectorAll('.yr-track-item[data-track-id]').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                const trackId = item.dataset.trackId;
                if (trackId) navigate(`/track/${trackId}`);
            });
        });

        container.querySelectorAll('.yr-card').forEach((card, i) => {
            card.style.animationDelay = `${i * 0.08}s`;
            card.classList.add('yr-card-animate');
        });
    }
}
