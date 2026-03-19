// js/listening-stats.js
// Tracks per-track and per-artist listening statistics for Smart Shuffle,
// Wrapped/Monthly Recap, Mood Detection, and AI DJ features.

const STATS_KEY = 'monochrome-listening-stats';
const PLAY_LOG_KEY = 'monochrome-play-log';
const MAX_LOG_ENTRIES = 5000;

/**
 * @typedef {Object} TrackStat
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} [genre]
 * @property {number} playCount
 * @property {number} totalListenMs  - total milliseconds actually listened
 * @property {number} lastPlayedAt   - unix ms timestamp
 * @property {number} firstPlayedAt
 */

/**
 * @typedef {Object} PlayLogEntry
 * @property {string} trackId
 * @property {string} title
 * @property {string} artist
 * @property {string} [genre]
 * @property {number} ts        - unix ms timestamp
 * @property {number} listenMs  - how long the session lasted
 */

export const listeningStats = {
    _cache: null,
    _logCache: null,

    // ---------- low-level helpers ----------
    _load() {
        if (this._cache) return this._cache;
        try {
            this._cache = JSON.parse(localStorage.getItem(STATS_KEY)) || {};
        } catch {
            this._cache = {};
        }
        return this._cache;
    },

    _save(data) {
        this._cache = data;
        try {
            localStorage.setItem(STATS_KEY, JSON.stringify(data));
        } catch {
            // quota exceeded – trim oldest entries
            const entries = Object.entries(data);
            entries.sort((a, b) => (a[1].lastPlayedAt || 0) - (b[1].lastPlayedAt || 0));
            const trimmed = Object.fromEntries(entries.slice(Math.floor(entries.length / 2)));
            this._cache = trimmed;
            try { localStorage.setItem(STATS_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
        }
    },

    _loadLog() {
        if (this._logCache) return this._logCache;
        try {
            this._logCache = JSON.parse(localStorage.getItem(PLAY_LOG_KEY)) || [];
        } catch {
            this._logCache = [];
        }
        return this._logCache;
    },

    _saveLog(log) {
        this._logCache = log;
        try {
            localStorage.setItem(PLAY_LOG_KEY, JSON.stringify(log));
        } catch {
            // trim
            const trimmed = log.slice(-Math.floor(MAX_LOG_ENTRIES / 2));
            this._logCache = trimmed;
            try { localStorage.setItem(PLAY_LOG_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
        }
    },

    // ---------- public API ----------

    /**
     * Record a play event. Called when a track has been listened to for ≥10s
     * or when it ends.
     * @param {Object} track
     * @param {number} listenMs - actual milliseconds listened this session
     */
    recordPlay(track, listenMs = 0) {
        if (!track?.id) return;

        const data = this._load();
        const key = String(track.id);
        const now = Date.now();

        if (!data[key]) {
            data[key] = {
                id: key,
                title: track.title || 'Unknown',
                artist: (track.artists?.[0]?.name || track.artist?.name || 'Unknown'),
                genre: track.genre || null,
                playCount: 0,
                totalListenMs: 0,
                lastPlayedAt: now,
                firstPlayedAt: now,
            };
        }

        const stat = data[key];
        stat.playCount += 1;
        stat.totalListenMs += Math.max(0, listenMs);
        stat.lastPlayedAt = now;
        // update metadata in case it changed
        stat.title = track.title || stat.title;
        stat.artist = track.artists?.[0]?.name || track.artist?.name || stat.artist;
        if (track.genre) stat.genre = track.genre;

        this._save(data);

        // append to play log
        const log = this._loadLog();
        log.push({ trackId: key, title: stat.title, artist: stat.artist, genre: stat.genre, ts: now, listenMs });
        if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
        this._saveLog(log);
    },

    /** Get stats for a single track */
    getTrackStat(trackId) {
        return this._load()[String(trackId)] || null;
    },

    /** Get all stats as array sorted by play count descending */
    getAllStats() {
        return Object.values(this._load()).sort((a, b) => b.playCount - a.playCount);
    },

    /** Top N tracks by play count */
    getTopTracks(n = 10) {
        return this.getAllStats().slice(0, n);
    },

    /**
     * Top N artists by total listen time
     * Returns [{artist, totalListenMs, playCount, tracks}]
     */
    getTopArtists(n = 10) {
        const map = {};
        for (const stat of Object.values(this._load())) {
            const a = stat.artist || 'Unknown';
            if (!map[a]) map[a] = { artist: a, totalListenMs: 0, playCount: 0, tracks: [] };
            map[a].totalListenMs += stat.totalListenMs;
            map[a].playCount += stat.playCount;
            map[a].tracks.push(stat);
        }
        return Object.values(map)
            .sort((a, b) => b.totalListenMs - a.totalListenMs)
            .slice(0, n);
    },

    /** Total listen time across all tracks in ms */
    getTotalListenMs() {
        return Object.values(this._load()).reduce((s, t) => s + t.totalListenMs, 0);
    },

    /** Genre breakdown — {genre: playCount} */
    getGenreBreakdown() {
        const map = {};
        for (const stat of Object.values(this._load())) {
            const g = stat.genre || 'Unknown';
            map[g] = (map[g] || 0) + stat.playCount;
        }
        return map;
    },

    /**
     * Get play log filtered by date range.
     * @param {number} fromMs
     * @param {number} toMs
     */
    getLogInRange(fromMs, toMs) {
        return this._loadLog().filter((e) => e.ts >= fromMs && e.ts <= toMs);
    },

    /** Stats filtered to the current calendar year */
    getYearStats(year = new Date().getFullYear()) {
        const from = new Date(year, 0, 1).getTime();
        const to = new Date(year + 1, 0, 1).getTime();
        return this._buildStatsFromLog(this.getLogInRange(from, to));
    },

    /** Stats filtered to a specific month (1-12) */
    getMonthStats(year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
        const from = new Date(year, month - 1, 1).getTime();
        const to = new Date(year, month, 1).getTime();
        return this._buildStatsFromLog(this.getLogInRange(from, to));
    },

    _buildStatsFromLog(entries) {
        const trackMap = {};
        const artistMap = {};
        let totalMs = 0;

        for (const e of entries) {
            // tracks
            if (!trackMap[e.trackId]) {
                trackMap[e.trackId] = { id: e.trackId, title: e.title, artist: e.artist, genre: e.genre, playCount: 0, totalListenMs: 0 };
            }
            trackMap[e.trackId].playCount++;
            trackMap[e.trackId].totalListenMs += e.listenMs;
            totalMs += e.listenMs;

            // artists
            const a = e.artist || 'Unknown';
            if (!artistMap[a]) artistMap[a] = { artist: a, playCount: 0, totalListenMs: 0 };
            artistMap[a].playCount++;
            artistMap[a].totalListenMs += e.listenMs;
        }

        const topTracks = Object.values(trackMap).sort((a, b) => b.playCount - a.playCount).slice(0, 10);
        const topArtists = Object.values(artistMap).sort((a, b) => b.totalListenMs - a.totalListenMs).slice(0, 10);

        const genreMap = {};
        for (const e of entries) {
            const g = e.genre || 'Unknown';
            genreMap[g] = (genreMap[g] || 0) + 1;
        }

        return { topTracks, topArtists, totalMs, totalPlays: entries.length, genreBreakdown: genreMap };
    },

    /**
     * Returns a weight (0–1) for Smart Shuffle. Higher = more likely to appear.
     * Tracks played recently or very frequently get lower weight (avoid repetition).
     */
    getShuffleWeight(trackId) {
        const stat = this.getTrackStat(trackId);
        if (!stat) return 1; // never played → highest priority

        const now = Date.now();
        const hoursAgo = (now - stat.lastPlayedAt) / 3_600_000;
        // cooldown: within 2 hours → weight 0, scales up to 1 over 24 hours
        const recencyWeight = Math.min(1, hoursAgo / 24);
        // frequency penalty: play count dampens weight slightly
        const freqPenalty = Math.min(0.5, stat.playCount / 200);

        return Math.max(0.05, recencyWeight - freqPenalty);
    },

    /** Clear all stats (used in settings) */
    clearAll() {
        this._cache = {};
        this._logCache = [];
        localStorage.removeItem(STATS_KEY);
        localStorage.removeItem(PLAY_LOG_KEY);
    },
};
