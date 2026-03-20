import { getRecentActivity } from './activity-log.js';

function toDateKey(date) {
    return new Date(date).toISOString().slice(0, 10);
}

function downloadText(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export class AdminAnalytics {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.activity = [];
    }

    async init() {
        this.activity = await getRecentActivity(500);
        this.render();
    }

    computeMetrics() {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        const streams = this.activity.filter((item) => item.action === 'play_track');

        const byDay = new Map();
        streams.forEach((item) => {
            const key = toDateKey(item.$createdAt || item.created_at);
            byDay.set(key, (byDay.get(key) || 0) + 1);
        });

        const weeklyStreams = streams.filter(
            (item) => now - new Date(item.$createdAt || item.created_at).getTime() <= 7 * dayMs
        ).length;

        const monthlyStreams = streams.filter(
            (item) => now - new Date(item.$createdAt || item.created_at).getTime() <= 30 * dayMs
        ).length;

        const topTracks = new Map();
        const topArtists = new Map();

        streams.forEach((item) => {
            const details = item.detailsObject || {};
            const track = details.track || details.trackTitle || 'Unknown Track';
            const artist = details.artist || details.artistName || 'Unknown Artist';
            topTracks.set(track, (topTracks.get(track) || 0) + 1);
            topArtists.set(artist, (topArtists.get(artist) || 0) + 1);
        });

        const userGrowth = new Map();
        this.activity
            .filter((item) => item.action === 'login')
            .forEach((item) => {
                const key = toDateKey(item.$createdAt || item.created_at);
                const userId = item.user_id || 'anonymous';
                if (!userGrowth.has(key)) userGrowth.set(key, new Set());
                userGrowth.get(key).add(userId);
            });

        return {
            streamsPerDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
            streamsPerWeek: weeklyStreams,
            streamsPerMonth: monthlyStreams,
            topTracks: [...topTracks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
            topArtists: [...topArtists.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
            userGrowth: [...userGrowth.entries()].map(([day, users]) => [day, users.size]),
        };
    }

    drawChart(canvas, points) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = '#151515';
        ctx.fillRect(0, 0, width, height);

        const values = points.map(([, value]) => value);
        const max = Math.max(1, ...values);
        const barWidth = Math.max(10, width / Math.max(1, points.length));

        points.forEach(([, value], index) => {
            const h = (value / max) * (height - 30);
            const x = index * barWidth + 4;
            const y = height - h - 8;

            ctx.fillStyle = '#ff4444';
            ctx.fillRect(x, y, barWidth - 8, h);
        });
    }

    exportCsv(metrics) {
        const rows = [['metric', 'key', 'value']];

        metrics.streamsPerDay.forEach(([day, value]) => rows.push(['streams_per_day', day, value]));
        metrics.topTracks.forEach(([name, value]) => rows.push(['top_track', name, value]));
        metrics.topArtists.forEach(([name, value]) => rows.push(['top_artist', name, value]));
        metrics.userGrowth.forEach(([day, value]) => rows.push(['user_growth', day, value]));

        const csv = rows.map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(',')).join('\n');
        downloadText('admin-analytics.csv', csv);
    }

    renderList(title, items) {
        return `
            <div class="admin-card">
                <h3>${title}</h3>
                <ul class="admin-simple-list">
                    ${items.map(([name, count]) => `<li><span>${name}</span><strong>${count}</strong></li>`).join('')}
                </ul>
            </div>
        `;
    }

    render() {
        const metrics = this.computeMetrics();

        this.rootEl.innerHTML = `
            <div class="admin-grid two">
                <div class="admin-card">
                    <h3>Streams</h3>
                    <p>Week: <strong>${metrics.streamsPerWeek}</strong></p>
                    <p>Month: <strong>${metrics.streamsPerMonth}</strong></p>
                    <canvas id="admin-streams-chart" width="800" height="240"></canvas>
                    <button id="admin-export-analytics" class="btn-secondary">Export CSV</button>
                </div>
                ${this.renderList('Top Tracks', metrics.topTracks)}
                ${this.renderList('Top Artists', metrics.topArtists)}
                ${this.renderList('User Growth', metrics.userGrowth)}
            </div>
        `;

        this.drawChart(this.rootEl.querySelector('#admin-streams-chart'), metrics.streamsPerDay);
        this.rootEl.querySelector('#admin-export-analytics')?.addEventListener('click', () => this.exportCsv(metrics));
    }
}
