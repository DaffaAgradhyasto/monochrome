// js/ai-playlist.js
// AI Playlist Generator — takes a natural-language prompt, scores library
// tracks against it, and creates a user playlist from the best matches.

import { moodManager, MOODS } from './mood.js';
import { db } from './db.js';
import { listeningStats } from './listening-stats.js';

// Keyword → genre/mood hint mapping used for scoring
const PROMPT_KEYWORDS = {
    // Study / focus
    study: ['ambient', 'classical', 'lofi', 'lo-fi', 'instrumental', 'piano'],
    focus: ['ambient', 'classical', 'instrumental'],
    work:  ['ambient', 'instrumental', 'electronic'],
    concentrate: ['ambient', 'classical', 'instrumental'],

    // Energy
    workout: ['edm', 'hip-hop', 'metal', 'rock', 'electronic', 'trap'],
    gym:     ['edm', 'trap', 'hip-hop'],
    run:     ['edm', 'electronic', 'rock'],
    hype:    ['edm', 'hip-hop', 'trap', 'rock'],
    energy:  ['rock', 'edm', 'pop'],

    // Relaxation
    relax:   ['acoustic', 'jazz', 'r&b', 'soul', 'lo-fi'],
    chill:   ['lo-fi', 'acoustic', 'jazz'],
    sleep:   ['ambient', 'classical', 'new age'],
    calm:    ['ambient', 'classical', 'acoustic'],
    meditation: ['ambient', 'new age', 'classical'],

    // Party / social
    party:   ['pop', 'dance', 'edm', 'disco'],
    dance:   ['pop', 'edm', 'disco'],
    club:    ['edm', 'electronic', 'dance'],

    // Emotion
    sad:     ['blues', 'indie', 'folk', 'soul', 'alternative'],
    happy:   ['pop', 'indie', 'folk', 'reggae'],
    romantic:['r&b', 'soul', 'jazz', 'pop'],
    love:    ['r&b', 'soul', 'pop'],

    // Time of day
    morning: ['folk', 'acoustic', 'indie', 'pop'],
    night:   ['jazz', 'r&b', 'ambient', 'electronic'],
    evening: ['jazz', 'soul', 'r&b'],

    // Season / weather
    summer:  ['pop', 'reggae', 'latin', 'dance'],
    winter:  ['classical', 'acoustic', 'ambient'],
    rain:    ['acoustic', 'indie', 'jazz'],
};

/**
 * Score a single track against a parsed prompt.
 * @param {Object} track
 * @param {string[]} tokens - lowercase word tokens from user prompt
 * @param {string[]} hintGenres - genres inferred from keyword mapping
 * @returns {number}
 */
function scoreTrack(track, tokens, hintGenres) {
    const fields = [
        track.title || '',
        track.artist?.name || '',
        ...(track.artists?.map((a) => a.name) || []),
        track.album?.title || '',
        track.genre || '',
    ]
        .join(' ')
        .toLowerCase();

    let score = 0;

    // Direct word match in track metadata
    for (const token of tokens) {
        if (token.length < 3) continue;
        if (fields.includes(token)) score += 3;
    }

    // Genre hint match
    for (const g of hintGenres) {
        if (fields.includes(g)) score += 4;
    }

    // Listening history boost — frequently played tracks get a small boost
    const stat = listeningStats.getTrackStat(track.id);
    if (stat) {
        score += Math.min(2, stat.playCount / 10);
    }

    // Current mood boost
    score += moodManager.scoreTrack(track);

    return score;
}

/**
 * Parse a natural-language prompt into tokens and genre hints.
 */
function parsePrompt(prompt) {
    const lower = prompt.toLowerCase();
    const tokens = lower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    const hintGenres = new Set();
    for (const token of tokens) {
        const hints = PROMPT_KEYWORDS[token];
        if (hints) hints.forEach((g) => hintGenres.add(g));
    }

    // Also check mood names
    for (const [moodKey, moodData] of Object.entries(MOODS)) {
        if (lower.includes(moodKey)) {
            moodData.genres.forEach((g) => hintGenres.add(g));
            moodData.keywords.forEach((kw) => {
                const hints = PROMPT_KEYWORDS[kw];
                if (hints) hints.forEach((g) => hintGenres.add(g));
            });
        }
    }

    return { tokens, hintGenres: [...hintGenres] };
}

/**
 * Generate a playlist from the user's library that matches the given prompt.
 * @param {string} prompt
 * @param {Object[]} libraryTracks - all tracks available (from library / liked tracks)
 * @param {number} maxTracks
 * @returns {{ name: string, tracks: Object[] }}
 */
export function generateAIPlaylist(prompt, libraryTracks, maxTracks = 25) {
    if (!prompt || !libraryTracks?.length) return { name: 'AI Playlist', tracks: [] };

    const { tokens, hintGenres } = parsePrompt(prompt);

    // Score every track
    const scored = libraryTracks
        .map((t) => ({ track: t, score: scoreTrack(t, tokens, hintGenres) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

    // If nothing scored, fall back to top-played tracks
    const selected = scored.length > 0
        ? scored.slice(0, maxTracks).map((s) => s.track)
        : listeningStats.getTopTracks(maxTracks).map((stat) => {
            return libraryTracks.find((t) => String(t.id) === String(stat.id)) || null;
        }).filter(Boolean);

    // Derive a playlist name from the prompt (capitalize first letter)
    const name = prompt.length <= 40
        ? prompt.charAt(0).toUpperCase() + prompt.slice(1)
        : prompt.slice(0, 37) + '…';

    return { name: `AI: ${name}`, tracks: selected };
}

/**
 * Open the AI Playlist Generator modal.
 * @param {Object[]} libraryTracks
 * @param {Function} onPlaylistCreated - called with the new playlist object
 */
export function openAIPlaylistModal(libraryTracks, onPlaylistCreated) {
    // Remove existing modal
    document.getElementById('ai-playlist-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'ai-playlist-modal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;width:90%">
            <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                <h3 style="margin:0;display:flex;align-items:center;gap:.5rem">
                    <span>🤖</span> AI Playlist Generator
                </h3>
                <button id="ai-playlist-close" class="btn-icon" aria-label="Close" style="font-size:1.25rem">✕</button>
            </div>
            <p style="color:var(--muted-foreground);margin-bottom:1rem;font-size:.9rem">
                Describe what you want to listen to. e.g. <em>"buat belajar malam-malam"</em> or <em>"workout energy"</em>
            </p>
            <textarea
                id="ai-playlist-prompt"
                rows="3"
                style="width:100%;box-sizing:border-box;padding:.6rem;border-radius:6px;border:1px solid var(--border);background:var(--input);color:var(--foreground);font-size:.95rem;resize:vertical"
                placeholder="Type your playlist prompt…"
            ></textarea>
            <div style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem">
                <label style="font-size:.85rem;color:var(--muted-foreground)">Max tracks:</label>
                <input type="number" id="ai-playlist-count" value="25" min="5" max="100" style="width:60px;padding:.25rem .4rem;border-radius:4px;border:1px solid var(--border);background:var(--input);color:var(--foreground)" />
            </div>
            <div id="ai-playlist-status" style="margin-top:.75rem;font-size:.85rem;color:var(--muted-foreground);min-height:1.2em"></div>
            <div style="display:flex;gap:.5rem;margin-top:1rem;justify-content:flex-end">
                <button id="ai-playlist-cancel" class="btn-secondary">Cancel</button>
                <button id="ai-playlist-generate" class="btn-primary">✨ Generate</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#ai-playlist-close').addEventListener('click', close);
    modal.querySelector('#ai-playlist-cancel').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#ai-playlist-generate').addEventListener('click', async () => {
        const prompt = modal.querySelector('#ai-playlist-prompt').value.trim();
        if (!prompt) {
            modal.querySelector('#ai-playlist-status').textContent = 'Please enter a prompt first.';
            return;
        }

        const maxTracks = parseInt(modal.querySelector('#ai-playlist-count').value) || 25;
        const statusEl = modal.querySelector('#ai-playlist-status');
        const btn = modal.querySelector('#ai-playlist-generate');
        btn.disabled = true;
        btn.textContent = '⏳ Generating…';
        statusEl.textContent = 'Analyzing your library…';

        // Small delay for perceived AI feel
        await new Promise((r) => setTimeout(r, 600));

        try {
            const { name, tracks } = generateAIPlaylist(prompt, libraryTracks, maxTracks);

            if (!tracks.length) {
                statusEl.textContent = '⚠️ No matching tracks found. Try a different prompt or add more tracks to your library.';
                btn.disabled = false;
                btn.textContent = '✨ Generate';
                return;
            }

            statusEl.textContent = `✅ Found ${tracks.length} tracks — saving playlist…`;

            // Create user playlist via db
            const playlist = await db.createPlaylist(name, tracks);
            close();
            if (onPlaylistCreated) onPlaylistCreated(playlist);
        } catch (err) {
            console.error('[AI Playlist] Error:', err);
            statusEl.textContent = '❌ Failed to create playlist. Please try again.';
            btn.disabled = false;
            btn.textContent = '✨ Generate';
        }
    });

    // Focus prompt
    setTimeout(() => modal.querySelector('#ai-playlist-prompt')?.focus(), 50);
}
