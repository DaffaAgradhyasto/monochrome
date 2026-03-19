// js/mood.js
// Mood Detection — stores a selected mood and maps it to genre/keyword hints
// used by AI Playlist Generator and home page recommendations.

const MOOD_KEY = 'monochrome-mood';

export const MOODS = {
    focus:   { label: '🎯 Focus',  keywords: ['study', 'ambient', 'lofi', 'instrumental', 'classical', 'piano', 'concentration', 'work'], genres: ['classical', 'ambient', 'lo-fi', 'instrumental'] },
    chill:   { label: '😌 Chill',  keywords: ['chill', 'relax', 'calm', 'acoustic', 'lofi', 'mellow', 'easy', 'smooth'], genres: ['lo-fi', 'acoustic', 'soul', 'r&b', 'jazz'] },
    hype:    { label: '🔥 Hype',   keywords: ['hype', 'energy', 'pump', 'edm', 'electronic', 'trap', 'bass', 'workout', 'gym'], genres: ['edm', 'electronic', 'hip-hop', 'trap', 'dubstep', 'metal'] },
    party:   { label: '🎉 Party',  keywords: ['party', 'dance', 'disco', 'club', 'pop', 'fun', 'upbeat', 'summer', 'festival'], genres: ['pop', 'dance', 'electronic', 'disco'] },
    sad:     { label: '💙 Sad',    keywords: ['sad', 'melancholy', 'heartbreak', 'blues', 'slow', 'emotional', 'rain', 'lonely'], genres: ['blues', 'indie', 'alternative', 'soul', 'folk'] },
    romantic:{ label: '❤️ Romantic', keywords: ['love', 'romantic', 'sweet', 'soul', 'r&b', 'ballad', 'soft', 'night'], genres: ['r&b', 'soul', 'pop', 'jazz'] },
    morning: { label: '🌅 Morning', keywords: ['morning', 'fresh', 'uplifting', 'happy', 'bright', 'new day', 'sunrise'], genres: ['pop', 'folk', 'indie', 'acoustic'] },
    sleep:   { label: '🌙 Sleep',  keywords: ['sleep', 'lullaby', 'ambient', 'quiet', 'soft', 'gentle', 'night'], genres: ['ambient', 'classical', 'new age'] },
};

export const moodManager = {
    getMood() {
        try {
            return localStorage.getItem(MOOD_KEY) || null;
        } catch {
            return null;
        }
    },

    setMood(moodKey) {
        try {
            if (moodKey && MOODS[moodKey]) {
                localStorage.setItem(MOOD_KEY, moodKey);
            } else {
                localStorage.removeItem(MOOD_KEY);
            }
        } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('mood-changed', { detail: { mood: moodKey } }));
    },

    clearMood() {
        this.setMood(null);
    },

    getCurrentMoodData() {
        const key = this.getMood();
        return key ? { key, ...MOODS[key] } : null;
    },

    /**
     * Score a track against the current mood (0 = no match, higher = better match).
     * @param {Object} track
     * @returns {number}
     */
    scoreTrack(track) {
        const mood = this.getCurrentMoodData();
        if (!mood) return 0;

        const text = [
            track.title || '',
            track.artist?.name || '',
            ...(track.artists?.map((a) => a.name) || []),
            track.album?.title || '',
            track.genre || '',
        ]
            .join(' ')
            .toLowerCase();

        let score = 0;
        for (const kw of mood.keywords) {
            if (text.includes(kw)) score += 2;
        }
        for (const g of mood.genres) {
            if (text.includes(g)) score += 3;
        }
        return score;
    },
};

/**
 * Render mood selector chips into a container element.
 * @param {HTMLElement} container
 */
export function renderMoodSelector(container) {
    if (!container) return;
    const current = moodManager.getMood();

    container.innerHTML = '';
    const clearChip = document.createElement('button');
    clearChip.className = `mood-chip${!current ? ' active' : ''}`;
    clearChip.textContent = '🎵 All';
    clearChip.title = 'No mood filter';
    clearChip.dataset.mood = '';
    container.appendChild(clearChip);

    for (const [key, data] of Object.entries(MOODS)) {
        const chip = document.createElement('button');
        chip.className = `mood-chip${current === key ? ' active' : ''}`;
        chip.textContent = data.label;
        chip.title = `Filter by ${data.label} mood`;
        chip.dataset.mood = key;
        container.appendChild(chip);
    }

    container.addEventListener('click', (e) => {
        const chip = e.target.closest('.mood-chip');
        if (!chip) return;
        const mood = chip.dataset.mood;
        moodManager.setMood(mood || null);
        container.querySelectorAll('.mood-chip').forEach((c) => {
            c.classList.toggle('active', c.dataset.mood === mood);
        });
    });
}
