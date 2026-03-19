// js/wrapped.js
// Wrapped / Year-in-Review & Monthly Recap page

import { listeningStats } from './listening-stats.js';

/** Format milliseconds to "Xh Ym" */
function fmtMs(ms) {
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

/** Return top N entries from an object {key: count} */
function topN(obj, n = 5) {
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
}

/** Build an HTML card for a ranked track */
function trackCard(stat, rank) {
    return `
        <div class="wrapped-track-item" style="display:flex;align-items:center;gap:.75rem;padding:.6rem .5rem;border-radius:8px;background:var(--card);margin-bottom:.4rem">
            <span class="wrapped-rank" style="font-size:1.3rem;font-weight:700;min-width:2rem;text-align:center;color:var(--muted-foreground)">#${rank}</span>
            <div style="flex:1;overflow:hidden">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stat.title}</div>
                <div style="font-size:.8rem;color:var(--muted-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stat.artist}</div>
            </div>
            <span style="font-size:.8rem;color:var(--muted-foreground);white-space:nowrap">${stat.playCount} plays</span>
        </div>`;
}

/** Build an HTML card for a ranked artist */
function artistCard(stat, rank) {
    const time = fmtMs(stat.totalListenMs);
    return `
        <div class="wrapped-artist-item" style="display:flex;align-items:center;gap:.75rem;padding:.6rem .5rem;border-radius:8px;background:var(--card);margin-bottom:.4rem">
            <span style="font-size:1.3rem;font-weight:700;min-width:2rem;text-align:center;color:var(--muted-foreground)">#${rank}</span>
            <div style="flex:1;overflow:hidden">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stat.artist}</div>
                <div style="font-size:.8rem;color:var(--muted-foreground)">${stat.playCount} plays · ${time}</div>
            </div>
        </div>`;
}

/** Simple bar chart for genre breakdown */
function genreChart(breakdown) {
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    if (!total) return '<p style="color:var(--muted-foreground);font-size:.9rem">No genre data yet.</p>';

    const items = topN(breakdown, 8);
    return items.map(([genre, count]) => {
        const pct = Math.round((count / total) * 100);
        return `
            <div style="margin-bottom:.6rem">
                <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:2px">
                    <span>${genre}</span><span>${pct}%</span>
                </div>
                <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
                    <div style="background:var(--primary);height:100%;width:${pct}%;border-radius:4px;transition:width .5s ease"></div>
                </div>
            </div>`;
    }).join('');
}

/** Personality type based on top genre */
function getPersonalityType(genreBreakdown) {
    const top = topN(genreBreakdown, 1)[0];
    if (!top) return { type: 'Explorer 🌍', desc: "You're still discovering your taste." };

    const genre = top[0].toLowerCase();
    if (/classical|piano|orchestr/.test(genre)) return { type: 'The Connoisseur 🎻', desc: 'Refined taste, appreciates depth and complexity.' };
    if (/hip.hop|rap|trap/.test(genre)) return { type: 'The Trendsetter 🎤', desc: 'Always ahead of the curve, culture-driven.' };
    if (/edm|electronic|dance|techno|house/.test(genre)) return { type: 'The Night Owl 🦉', desc: 'Energetic and always ready to move.' };
    if (/rock|metal|punk|grunge/.test(genre)) return { type: 'The Rebel 🤘', desc: 'Passionate, intense, unapologetically loud.' };
    if (/jazz|soul|blues/.test(genre)) return { type: 'The Storyteller 📖', desc: 'Emotional, expressive, drawn to soulful sounds.' };
    if (/pop/.test(genre)) return { type: 'The Crowd Pleaser 🌟', desc: 'Loves catchy hooks and feel-good vibes.' };
    if (/r&b|rnb|funk/.test(genre)) return { type: 'The Smooth Operator 😎', desc: 'Effortlessly cool, groove is your middle name.' };
    if (/ambient|lo.fi|chill|meditation/.test(genre)) return { type: 'The Zen Master 🧘', desc: 'Calm, focused, always in the flow state.' };
    return { type: 'Explorer 🌍', desc: 'Eclectic and open-minded — you love it all.' };
}

/**
 * Render the Wrapped page into the given container element.
 * @param {HTMLElement} container
 * @param {'year'|'month'} mode
 * @param {number} year
 * @param {number} month (1-12, only used when mode==='month')
 */
export function renderWrappedPage(container, mode = 'year', year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    if (!container) return;

    const stats = mode === 'year'
        ? listeningStats.getYearStats(year)
        : listeningStats.getMonthStats(year, month);

    const totalTime = fmtMs(stats.totalMs);
    const { type: personality, desc: personalityDesc } = getPersonalityType(stats.genreBreakdown);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Year/month selector
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)
        .map((y) => `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`)
        .join('');

    const monthOptions = monthNames
        .map((m, i) => `<option value="${i + 1}"${i + 1 === month ? ' selected' : ''}>${m}</option>`)
        .join('');

    container.innerHTML = `
        <div class="wrapped-page" style="max-width:640px;margin:0 auto;padding:1.5rem 1rem">
            <!-- Header + controls -->
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem">
                <h2 style="margin:0;font-size:1.5rem">
                    ${mode === 'year' ? `🎁 ${year} Wrapped` : `📅 ${monthNames[month - 1]} ${year} Recap`}
                </h2>
                <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                    <button id="wrapped-mode-year" class="btn-${mode === 'year' ? 'primary' : 'secondary'}" style="font-size:.8rem;padding:.3rem .7rem">Year</button>
                    <button id="wrapped-mode-month" class="btn-${mode === 'month' ? 'primary' : 'secondary'}" style="font-size:.8rem;padding:.3rem .7rem">Month</button>
                    <select id="wrapped-year-select" style="padding:.3rem .5rem;border-radius:6px;border:1px solid var(--border);background:var(--input);color:var(--foreground);font-size:.8rem">${yearOptions}</select>
                    <select id="wrapped-month-select" style="padding:.3rem .5rem;border-radius:6px;border:1px solid var(--border);background:var(--input);color:var(--foreground);font-size:.8rem;${mode === 'year' ? 'display:none' : ''}">${monthOptions}</select>
                </div>
            </div>

            <!-- Summary cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1.5rem">
                <div style="background:var(--card);border-radius:12px;padding:1rem;text-align:center">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--primary)">${stats.totalPlays}</div>
                    <div style="font-size:.8rem;color:var(--muted-foreground)">Total Plays</div>
                </div>
                <div style="background:var(--card);border-radius:12px;padding:1rem;text-align:center">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--primary)">${totalTime}</div>
                    <div style="font-size:.8rem;color:var(--muted-foreground)">Time Listened</div>
                </div>
                <div style="background:var(--card);border-radius:12px;padding:1rem;text-align:center">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${stats.topArtists.length}</div>
                    <div style="font-size:.8rem;color:var(--muted-foreground)">Artists</div>
                </div>
                <div style="background:var(--card);border-radius:12px;padding:1rem;text-align:center">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${Object.keys(stats.genreBreakdown).length}</div>
                    <div style="font-size:.8rem;color:var(--muted-foreground)">Genres</div>
                </div>
            </div>

            <!-- Personality -->
            <div style="background:linear-gradient(135deg,var(--primary) 0%,var(--primary-foreground,#6366f1) 100%);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;color:#fff;text-align:center">
                <div style="font-size:1.4rem;font-weight:700;margin-bottom:.25rem">${personality}</div>
                <div style="font-size:.85rem;opacity:.9">${personalityDesc}</div>
            </div>

            ${stats.totalPlays === 0 ? `
                <div style="text-align:center;color:var(--muted-foreground);padding:2rem">
                    <p>No listening data yet for this period.</p>
                    <p style="font-size:.85rem">Start listening to build your stats!</p>
                </div>
            ` : `
            <!-- Top Tracks -->
            <section style="margin-bottom:1.5rem">
                <h3 style="margin:0 0 .75rem;font-size:1.1rem">🎵 Top Tracks</h3>
                ${stats.topTracks.length
                    ? stats.topTracks.map((t, i) => trackCard(t, i + 1)).join('')
                    : '<p style="color:var(--muted-foreground);font-size:.9rem">No track data yet.</p>'}
            </section>

            <!-- Top Artists -->
            <section style="margin-bottom:1.5rem">
                <h3 style="margin:0 0 .75rem;font-size:1.1rem">🎤 Top Artists</h3>
                ${stats.topArtists.length
                    ? stats.topArtists.map((a, i) => artistCard(a, i + 1)).join('')
                    : '<p style="color:var(--muted-foreground);font-size:.9rem">No artist data yet.</p>'}
            </section>

            <!-- Genre Breakdown -->
            <section style="margin-bottom:1.5rem">
                <h3 style="margin:0 0 .75rem;font-size:1.1rem">🎼 Genre Breakdown</h3>
                ${genreChart(stats.genreBreakdown)}
            </section>
            `}
        </div>
    `;

    // Wire up controls
    container.querySelector('#wrapped-mode-year')?.addEventListener('click', () => {
        renderWrappedPage(container, 'year', parseInt(container.querySelector('#wrapped-year-select').value), month);
    });
    container.querySelector('#wrapped-mode-month')?.addEventListener('click', () => {
        renderWrappedPage(container, 'month', parseInt(container.querySelector('#wrapped-year-select').value), parseInt(container.querySelector('#wrapped-month-select').value));
    });
    container.querySelector('#wrapped-year-select')?.addEventListener('change', (e) => {
        renderWrappedPage(container, mode, parseInt(e.target.value), month);
    });
    container.querySelector('#wrapped-month-select')?.addEventListener('change', (e) => {
        renderWrappedPage(container, mode, year, parseInt(e.target.value));
    });
}
