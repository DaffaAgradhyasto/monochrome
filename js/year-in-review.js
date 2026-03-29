// js/year-in-review.js
// Year in Review / Listening Wrapped feature with animated card slides

export class YearInReview {
    constructor() {
        this._dbName = 'monochrome-stats';
        this._storeName = 'plays';
        this._db = null;
        this._currentSlide = 0;
        this._autoAdvanceTimer = null;
        this._stats = null;
        this._slideCount = 6;
    }

    async _init() {
        try {
            this._db = await this._openDB();
        } catch (e) {
            console.warn('[YearInReview] DB init failed:', e);
        }
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this._dbName, 2);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('plays')) {
                    const store = db.createObjectStore('plays', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('trackId', 'trackId', { unique: false });
                    store.createIndex('artistName', 'artistName', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('hour', 'hour', { unique: false });
                }
                if (!db.objectStoreNames.contains('streaks')) {
                    db.createObjectStore('streaks', { keyPath: 'date' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async _getYearPlays() {
        if (!this._db) await this._init();
        if (!this._db) return [];

        const now = new Date();
        const year = now.getFullYear();
        const startOfYear = new Date(year, 0, 1).getTime();
        const endOfYear = new Date(year + 1, 0, 1).getTime();

        return new Promise((resolve) => {
            try {
                const tx = this._db.transaction(this._storeName, 'readonly');
                const store = tx.objectStore(this._storeName);
                const index = store.index('timestamp');
                const range = IDBKeyRange.bound(startOfYear, endOfYear, false, true);
                const results = [];

                const cursor = index.openCursor(range);
                cursor.onsuccess = (e) => {
                    const c = e.target.result;
                    if (c) {
                        results.push(c.value);
                        c.continue();
                    } else {
                        resolve(results);
                    }
                };
                cursor.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    }

    async _getStats() {
        if (this._stats) return this._stats;

        const plays = await this._getYearPlays();
        const now = new Date();
        const year = now.getFullYear();

        if (plays.length === 0) {
            this._stats = this._emptyStats(year);
            return this._stats;
        }

        const trackCounts = {};
        const artistCounts = {};
        const hourCounts = new Array(24).fill(0);
        const dayOfWeekCounts = new Array(7).fill(0);
        const monthCounts = new Array(12).fill(0);
        const dateSet = new Set();
        let totalListenDuration = 0;
        const uniqueTrackIds = new Set();
        const uniqueArtistSet = new Set();

        for (const p of plays) {
            const trackKey = p.trackTitle || p.title || 'Unknown';
            const artistKey = p.artistName || 'Unknown';

            trackCounts[trackKey] = trackCounts[trackKey] || { title: trackKey, artist: artistKey, count: 0 };
            trackCounts[trackKey].count++;
            artistCounts[artistKey] = (artistCounts[artistKey] || 0) + 1;

            hourCounts[p.hour] = (hourCounts[p.hour] || 0) + 1;
            totalListenDuration += p.listenDuration || p.duration || 0;

            if (p.trackId) uniqueTrackIds.add(p.trackId);
            uniqueArtistSet.add(artistKey);

            if (p.date) {
                dateSet.add(p.date);
                const d = new Date(p.date + 'T00:00:00');
                if (!isNaN(d.getTime())) {
                    dayOfWeekCounts[d.getDay()]++;
                    monthCounts[d.getMonth()]++;
                }
            }
        }

        const topTracks = Object.values(trackCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const maxMonthCount = Math.max(...monthCounts, 1);
        const mostActiveMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));
        const mostActiveMonth = monthNames[mostActiveMonthIdx];

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const maxDayCount = Math.max(...dayOfWeekCounts, 1);
        const mostActiveDayIdx = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
        const mostActiveDay = dayNames[mostActiveDayIdx];

        const streak = this._calculateStreak(dateSet);

        const timePeriods = {
            'Late Night (12am-5am)': hourCounts.slice(0, 5).reduce((a, b) => a + b, 0),
            'Morning (5am-12pm)': hourCounts.slice(5, 12).reduce((a, b) => a + b, 0),
            'Afternoon (12pm-6pm)': hourCounts.slice(12, 18).reduce((a, b) => a + b, 0),
            'Evening (6pm-12am)': hourCounts.slice(18, 24).reduce((a, b) => a + b, 0),
        };
        const mostActivePeriod = Object.entries(timePeriods).sort((a, b) => b[1] - a[1])[0][0];

        const personality = this._getPersonality(
            hourCounts,
            topArtists,
            plays.length,
            uniqueTrackIds.size,
            uniqueArtistSet.size
        );

        this._stats = {
            year,
            totalPlays: plays.length,
            totalListenDuration,
            totalHours: Math.floor(totalListenDuration / 3600),
            totalMinutes: Math.floor((totalListenDuration % 3600) / 60),
            uniqueTracks: uniqueTrackIds.size || new Set(plays.map((p) => p.trackTitle || p.title)).size,
            uniqueArtists: uniqueArtistSet.size,
            topTracks,
            topArtists,
            hourCounts,
            dayOfWeekCounts,
            monthCounts,
            monthNames,
            maxMonthCount,
            mostActiveMonth,
            mostActiveDay,
            mostActivePeriod,
            dayNames,
            maxDayCount,
            streak,
            personality,
        };

        return this._stats;
    }

    _calculateStreak(dateSet) {
        if (dateSet.size === 0) return 0;
        const sortedDates = Array.from(dateSet).sort();
        let maxStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
            const curr = new Date(sortedDates[i] + 'T00:00:00');
            const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else if (diffDays > 1) {
                currentStreak = 1;
            }
        }

        return maxStreak;
    }

    _getPersonality(hourCounts, topArtists, totalPlays, uniqueTracks, uniqueArtists) {
        const nightPlays =
            hourCounts.slice(22).reduce((a, b) => a + b, 0) + hourCounts.slice(0, 5).reduce((a, b) => a + b, 0);
        const morningPlays = hourCounts.slice(5, 12).reduce((a, b) => a + b, 0);
        const afternoonPlays = hourCounts.slice(12, 18).reduce((a, b) => a + b, 0);
        const eveningPlays = hourCounts.slice(18, 22).reduce((a, b) => a + b, 0);

        if (totalPlays === 0) {
            return {
                badge: 'Newcomer',
                icon: '\u{1F331}',
                desc: 'Start your listening journey this year!',
                color: '#4a9eff',
            };
        }

        if (topArtists.length > 0 && topArtists[0].count > totalPlays * 0.25) {
            return {
                badge: 'Superfan',
                icon: '\u2B50',
                desc: `You couldn't get enough of ${topArtists[0].name}!`,
                color: '#ffd700',
            };
        }

        if (nightPlays / totalPlays > 0.35) {
            return {
                badge: 'Night Owl',
                icon: '\u{1F989}',
                desc: 'The night is your soundtrack sanctuary',
                color: '#7b68ee',
            };
        }

        if (morningPlays / totalPlays > 0.35) {
            return { badge: 'Early Bird', icon: '\u{1F426}', desc: 'You start every day with music', color: '#ff6b6b' };
        }

        if (uniqueArtists > 50 && uniqueTracks > 100) {
            return {
                badge: 'Explorer',
                icon: '\u{1F30D}',
                desc: 'You discovered a world of music this year',
                color: '#00d4ff',
            };
        }

        if (afternoonPlays > eveningPlays && afternoonPlays > morningPlays) {
            return {
                badge: 'Afternoon Groover',
                icon: '\u{1F3B6}',
                desc: 'Your afternoons are filled with great tunes',
                color: '#ff9f43',
            };
        }

        if (eveningPlays > nightPlays && eveningPlays > morningPlays) {
            return {
                badge: 'Evening Melophile',
                icon: '\u{1F3B5}',
                desc: 'Sunsets and songs go hand in hand',
                color: '#e056fd',
            };
        }

        return { badge: 'Music Lover', icon: '\u{1F49A}', desc: 'Music is your constant companion', color: '#26de81' };
    }

    _emptyStats(year) {
        return {
            year: year || new Date().getFullYear(),
            totalPlays: 0,
            totalListenDuration: 0,
            totalHours: 0,
            totalMinutes: 0,
            uniqueTracks: 0,
            uniqueArtists: 0,
            topTracks: [],
            topArtists: [],
            hourCounts: new Array(24).fill(0),
            dayOfWeekCounts: new Array(7).fill(0),
            monthCounts: new Array(12).fill(0),
            monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            maxMonthCount: 1,
            mostActiveMonth: 'N/A',
            mostActiveDay: 'N/A',
            mostActivePeriod: 'N/A',
            dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            maxDayCount: 1,
            streak: 0,
            personality: {
                badge: 'Newcomer',
                icon: '\u{1F331}',
                desc: 'Start your listening journey!',
                color: '#4a9eff',
            },
        };
    }

    async render(container) {
        if (!container) return;

        const stats = await this._getStats();

        container.innerHTML = this._getStyles() + this._getHTML(stats);
        this._bindEvents(container);
        this._goToSlide(0);
    }

    _getStyles() {
        return `
      <style>
        .yir-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #fff;
          user-select: none;
        }

        .yir-slides-container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .yir-slide {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          box-sizing: border-box;
          opacity: 0;
          transform: translateX(60px);
          transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          overflow-y: auto;
        }

        .yir-slide.active {
          opacity: 1;
          transform: translateX(0);
          pointer-events: auto;
        }

        .yir-slide.exit-left {
          opacity: 0;
          transform: translateX(-60px);
        }

        .yir-slide-0 { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); }
        .yir-slide-1 { background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); }
        .yir-slide-2 { background: linear-gradient(135deg, #0d1117, #161b22, #1a1a2e); }
        .yir-slide-3 { background: linear-gradient(135deg, #1b1b2f, #162447, #1f4068); }
        .yir-slide-4 { background: linear-gradient(135deg, #0a0a23, #1a1a40, #2d2d6e); }
        .yir-slide-5 { background: linear-gradient(135deg, #121225, #1e1e3f, #2a2a5a); }

        .yir-label {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 12px;
        }

        .yir-year {
          font-size: 28px;
          font-weight: 300;
          color: rgba(255,255,255,0.7);
          margin-bottom: 4px;
        }

        .yir-big-number {
          font-size: clamp(60px, 15vw, 120px);
          font-weight: 800;
          background: linear-gradient(135deg, #00d4ff, #7b68ee, #ff6b9d);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
          text-align: center;
        }

        .yir-big-label {
          font-size: 20px;
          color: rgba(255,255,255,0.6);
          margin-top: 8px;
          text-align: center;
        }

        .yir-hero-sub {
          display: flex;
          gap: 32px;
          margin-top: 40px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .yir-hero-stat {
          text-align: center;
        }

        .yir-hero-stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #00d4ff;
        }

        .yir-hero-stat-label {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          margin-top: 4px;
        }

        .yir-section-title {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 28px;
          text-align: center;
          color: rgba(255,255,255,0.9);
        }

        .yir-track-list {
          width: 100%;
          max-width: 560px;
        }

        .yir-track-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 20px;
          margin-bottom: 10px;
          background: rgba(255,255,255,0.06);
          border-radius: 16px;
          backdrop-filter: blur(10px);
          animation: yirFadeSlideUp 0.5s ease both;
        }

        .yir-track-item:nth-child(1) { animation-delay: 0.1s; }
        .yir-track-item:nth-child(2) { animation-delay: 0.2s; }
        .yir-track-item:nth-child(3) { animation-delay: 0.3s; }
        .yir-track-item:nth-child(4) { animation-delay: 0.4s; }
        .yir-track-item:nth-child(5) { animation-delay: 0.5s; }

        @keyframes yirFadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .yir-track-rank {
          font-size: 24px;
          font-weight: 800;
          color: #00d4ff;
          min-width: 36px;
          text-align: center;
        }

        .yir-track-info {
          flex: 1;
          min-width: 0;
        }

        .yir-track-title {
          font-size: 16px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .yir-track-artist {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .yir-track-count {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          white-space: nowrap;
        }

        .yir-badge-card {
          background: rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 48px 40px;
          text-align: center;
          max-width: 420px;
          width: 100%;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08);
          animation: yirPulse 2s ease-in-out infinite alternate;
        }

        @keyframes yirPulse {
          from { box-shadow: 0 0 30px rgba(0, 212, 255, 0.1); }
          to { box-shadow: 0 0 60px rgba(0, 212, 255, 0.25); }
        }

        .yir-badge-icon {
          font-size: 72px;
          margin-bottom: 16px;
          display: block;
        }

        .yir-badge-name {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 12px;
          background: linear-gradient(135deg, var(--badge-color, #00d4ff), #fff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .yir-badge-desc {
          font-size: 16px;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
        }

        .yir-bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 240px;
          width: 100%;
          max-width: 600px;
          padding: 0 12px;
        }

        .yir-bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }

        .yir-bar {
          width: 100%;
          min-height: 4px;
          border-radius: 6px 6px 0 0;
          background: linear-gradient(180deg, #00d4ff, #7b68ee);
          transition: height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .yir-bar:hover {
          filter: brightness(1.3);
        }

        .yir-bar-label {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-top: 8px;
          text-align: center;
        }

        .yir-bar-value {
          position: absolute;
          top: -22px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .yir-bar:hover .yir-bar-value {
          opacity: 1;
        }

        .yir-fun-facts {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          width: 100%;
          max-width: 500px;
        }

        .yir-fact-card {
          background: rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          backdrop-filter: blur(10px);
          animation: yirFadeSlideUp 0.5s ease both;
        }

        .yir-fact-card:nth-child(1) { animation-delay: 0.1s; }
        .yir-fact-card:nth-child(2) { animation-delay: 0.2s; }
        .yir-fact-card:nth-child(3) { animation-delay: 0.3s; }

        .yir-fact-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .yir-fact-value {
          font-size: 24px;
          font-weight: 700;
          color: #00d4ff;
        }

        .yir-fact-label {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          margin-top: 4px;
        }

        .yir-nav-dots {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          z-index: 10;
        }

        .yir-nav-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          padding: 0;
        }

        .yir-nav-dot.active {
          background: #00d4ff;
          width: 28px;
          border-radius: 5px;
        }

        .yir-nav-dot:hover {
          background: rgba(255,255,255,0.5);
        }

        .yir-nav-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          z-index: 10;
          transition: background 0.2s;
        }

        .yir-nav-arrow:hover {
          background: rgba(255,255,255,0.15);
        }

        .yir-nav-prev { left: 16px; }
        .yir-nav-next { right: 16px; }

        .yir-progress-bar {
          position: absolute;
          top: 0; left: 0;
          height: 3px;
          background: linear-gradient(90deg, #00d4ff, #7b68ee);
          z-index: 10;
          transition: width 0.3s linear;
        }

        .yir-empty-state {
          text-align: center;
          color: rgba(255,255,255,0.5);
        }

        .yir-empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          display: block;
        }

        .yir-empty-title {
          font-size: 24px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          margin-bottom: 8px;
        }

        .yir-empty-desc {
          font-size: 14px;
          max-width: 300px;
          margin: 0 auto;
          line-height: 1.6;
        }

        @media (max-width: 600px) {
          .yir-slide { padding: 24px 16px; }
          .yir-big-number { font-size: 56px; }
          .yir-hero-sub { gap: 20px; }
          .yir-hero-stat-value { font-size: 24px; }
          .yir-badge-card { padding: 32px 24px; }
          .yir-badge-icon { font-size: 56px; }
          .yir-badge-name { font-size: 26px; }
          .yir-bar-chart { height: 180px; }
          .yir-track-item { padding: 12px 14px; }
          .yir-nav-arrow { display: none; }
        }
      </style>
    `;
    }

    _getHTML(stats) {
        const monthBars = stats.monthCounts
            .map((count, i) => {
                const pct = stats.maxMonthCount > 0 ? (count / stats.maxMonthCount) * 100 : 0;
                return `
        <div class="yir-bar-col">
          <div class="yir-bar" style="height: ${Math.max(pct, 2)}%">
            <span class="yir-bar-value">${count}</span>
          </div>
          <span class="yir-bar-label">${stats.monthNames[i]}</span>
        </div>
      `;
            })
            .join('');

        const topTracksHTML =
            stats.topTracks.length > 0
                ? stats.topTracks
                      .map(
                          (t, i) => `
      <div class="yir-track-item">
        <span class="yir-track-rank">${i + 1}</span>
        <div class="yir-track-info">
          <div class="yir-track-title">${this._escapeHTML(t.title)}</div>
          <div class="yir-track-artist">${this._escapeHTML(t.artist)}</div>
        </div>
        <span class="yir-track-count">${t.count} plays</span>
      </div>
    `
                      )
                      .join('')
                : '<div class="yir-empty-state"><span class="yir-empty-icon">\u{1F3B5}</span><div class="yir-empty-title">No tracks yet</div><div class="yir-empty-desc">Start listening to see your top tracks here</div></div>';

        const topArtistsHTML =
            stats.topArtists.length > 0
                ? stats.topArtists
                      .map(
                          (a, i) => `
      <div class="yir-track-item">
        <span class="yir-track-rank">${i + 1}</span>
        <div class="yir-track-info">
          <div class="yir-track-title">${this._escapeHTML(a.name)}</div>
        </div>
        <span class="yir-track-count">${a.count} plays</span>
      </div>
    `
                      )
                      .join('')
                : '<div class="yir-empty-state"><span class="yir-empty-icon">\u{1F3B4}</span><div class="yir-empty-title">No artists yet</div><div class="yir-empty-desc">Your artist stats will appear as you listen</div></div>';

        return `
      <div class="yir-wrapper" id="yir-wrapper">
        <div class="yir-progress-bar" id="yir-progress"></div>

        <div class="yir-slides-container" id="yir-slides">

          <div class="yir-slide yir-slide-0" data-slide="0">
            <span class="yir-label">Your Year in Review</span>
            <div class="yir-year">${stats.year}</div>
            <div class="yir-big-number">${stats.totalHours > 0 ? stats.totalHours : '< 1'}</div>
            <div class="yir-big-label">hours of music</div>
            <div class="yir-hero-sub">
              <div class="yir-hero-stat">
                <div class="yir-hero-stat-value">${stats.totalPlays}</div>
                <div class="yir-hero-stat-label">Tracks Played</div>
              </div>
              <div class="yir-hero-stat">
                <div class="yir-hero-stat-value">${stats.uniqueTracks}</div>
                <div class="yir-hero-stat-label">Unique Tracks</div>
              </div>
              <div class="yir-hero-stat">
                <div class="yir-hero-stat-value">${stats.uniqueArtists}</div>
                <div class="yir-hero-stat-label">Artists</div>
              </div>
            </div>
          </div>

          <div class="yir-slide yir-slide-1" data-slide="1">
            <div class="yir-section-title">Your Top 5 Tracks</div>
            <div class="yir-track-list">${topTracksHTML}</div>
          </div>

          <div class="yir-slide yir-slide-2" data-slide="2">
            <div class="yir-section-title">Your Top 5 Artists</div>
            <div class="yir-track-list">${topArtistsHTML}</div>
          </div>

          <div class="yir-slide yir-slide-3" data-slide="3">
            <span class="yir-label">Your Listening Personality</span>
            <div class="yir-badge-card" style="--badge-color: ${stats.personality.color}">
              <span class="yir-badge-icon">${stats.personality.icon}</span>
              <div class="yir-badge-name">${stats.personality.badge}</div>
              <div class="yir-badge-desc">${stats.personality.desc}</div>
            </div>
          </div>

          <div class="yir-slide yir-slide-4" data-slide="4">
            <div class="yir-section-title">Monthly Listening</div>
            <div class="yir-bar-chart">${monthBars}</div>
          </div>

          <div class="yir-slide yir-slide-5" data-slide="5">
            <div class="yir-section-title">Fun Facts</div>
            <div class="yir-fun-facts">
              <div class="yir-fact-card">
                <div class="yir-fact-icon">\u{1F550}</div>
                <div class="yir-fact-value">${stats.mostActivePeriod}</div>
                <div class="yir-fact-label">Your favorite time to listen</div>
              </div>
              <div class="yir-fact-card">
                <div class="yir-fact-icon">\u{1F4C5}</div>
                <div class="yir-fact-value">${stats.mostActiveDay}</div>
                <div class="yir-fact-label">Your most active listening day</div>
              </div>
              <div class="yir-fact-card">
                <div class="yir-fact-icon">\u{1F525}</div>
                <div class="yir-fact-value">${stats.streak} day${stats.streak !== 1 ? 's' : ''}</div>
                <div class="yir-fact-label">Longest listening streak</div>
              </div>
            </div>
          </div>

        </div>

        <button class="yir-nav-arrow yir-nav-prev" id="yir-prev">\u276E</button>
        <button class="yir-nav-arrow yir-nav-next" id="yir-next">\u276F</button>

        <div class="yir-nav-dots" id="yir-dots">
          ${Array.from(
              { length: this._slideCount },
              (_, i) => `
            <button class="yir-nav-dot${i === 0 ? ' active' : ''}" data-slide="${i}"></button>
          `
          ).join('')}
        </div>
      </div>
    `;
    }

    _bindEvents(container) {
        const dots = container.querySelectorAll('.yir-nav-dot');
        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const idx = parseInt(dot.dataset.slide, 10);
                this._goToSlide(idx);
                this._resetAutoAdvance();
            });
        });

        const prevBtn = container.querySelector('#yir-prev');
        const nextBtn = container.querySelector('#yir-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this._prevSlide();
                this._resetAutoAdvance();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this._nextSlide();
                this._resetAutoAdvance();
            });
        }

        const wrapper = container.querySelector('#yir-wrapper');
        if (wrapper) {
            let touchStartX = 0;
            let touchEndX = 0;

            wrapper.addEventListener(
                'touchstart',
                (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                },
                { passive: true }
            );

            wrapper.addEventListener(
                'touchend',
                (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    const diff = touchStartX - touchEndX;
                    if (Math.abs(diff) > 50) {
                        if (diff > 0) this._nextSlide();
                        else this._prevSlide();
                        this._resetAutoAdvance();
                    }
                },
                { passive: true }
            );

            wrapper.addEventListener('mouseenter', () => this._pauseAutoAdvance());
            wrapper.addEventListener('mouseleave', () => this._startAutoAdvance());
        }

        this._startAutoAdvance();
    }

    _goToSlide(index) {
        if (index < 0 || index >= this._slideCount) return;

        const slides = document.querySelectorAll('.yir-slide');
        const dots = document.querySelectorAll('.yir-nav-dot');
        const progress = document.getElementById('yir-progress');

        slides.forEach((slide, i) => {
            slide.classList.remove('active', 'exit-left');
            if (i < index) slide.classList.add('exit-left');
        });

        if (slides[index]) {
            slides[index].classList.add('active');
        }

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        if (progress) {
            const pct = this._slideCount > 1 ? ((index + 1) / this._slideCount) * 100 : 100;
            progress.style.width = pct + '%';
        }

        this._currentSlide = index;
    }

    _nextSlide() {
        const next = (this._currentSlide + 1) % this._slideCount;
        this._goToSlide(next);
    }

    _prevSlide() {
        const prev = (this._currentSlide - 1 + this._slideCount) % this._slideCount;
        this._goToSlide(prev);
    }

    _startAutoAdvance() {
        this._pauseAutoAdvance();
        this._autoAdvanceTimer = setInterval(() => {
            this._nextSlide();
        }, 5000);
    }

    _pauseAutoAdvance() {
        if (this._autoAdvanceTimer) {
            clearInterval(this._autoAdvanceTimer);
            this._autoAdvanceTimer = null;
        }
    }

    _resetAutoAdvance() {
        this._startAutoAdvance();
    }

    _escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        this._pauseAutoAdvance();
        this._currentSlide = 0;
        this._stats = null;
    }
}
