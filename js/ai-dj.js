// js/ai-dj.js
// AI DJ — shows an introductory toast notification when a new track starts,
// as if a virtual DJ is introducing the song.

const AI_DJ_KEY = 'monochrome-ai-dj-enabled';

// Templates for DJ introductions
const INTRO_TEMPLATES = [
    (t, a) => `🎙️ Next up: "${t}" by ${a} — sit back and enjoy!`,
    (t, a) => `🎧 Dropping into "${t}" by ${a}. This one hits different.`,
    (t, a) => `📻 Your DJ here! Now playing "${t}" from ${a}.`,
    (t, a) => `🎵 Handpicked for you: "${t}" by ${a}.`,
    (t, a) => `✨ Curated pick: "${t}" by ${a} — you're going to love this.`,
    (t, a) => `🎤 Kicking things off with "${t}" by ${a}. Enjoy the vibe!`,
    (t, a) => `🔊 Queue locked in — "${t}" by ${a} is up next!`,
    (t, a) => `🎼 Selected just for this moment: "${t}" by ${a}.`,
    (t, a) => `💫 Here's a gem: "${t}" by ${a}. Let it play.`,
    (t, a) => `🎶 On the decks now: "${t}" by ${a}. Turn it up!`,
];

const MOOD_INTROS = {
    focus:   (t, a) => `🎯 Perfect focus track: "${t}" by ${a}. Stay in the zone.`,
    chill:   (t, a) => `😌 Chilling with "${t}" by ${a}. Relax and unwind.`,
    hype:    (t, a) => `🔥 HYPE TRACK INCOMING — "${t}" by ${a}. Let's go!`,
    party:   (t, a) => `🎉 Party starter: "${t}" by ${a}. Hit the dance floor!`,
    sad:     (t, a) => `💙 Feeling the emotion with "${t}" by ${a}. You're not alone.`,
    romantic:(t, a) => `❤️ Setting the mood with "${t}" by ${a}. This one's for you.`,
    morning: (t, a) => `🌅 Good morning! Waking up with "${t}" by ${a}.`,
    sleep:   (t, a) => `🌙 Drifting off to "${t}" by ${a}. Sweet dreams.`,
};

let _lastTrackId = null;

export const aiDJ = {
    isEnabled() {
        try {
            return localStorage.getItem(AI_DJ_KEY) === 'true';
        } catch {
            return false;
        }
    },

    setEnabled(val) {
        try {
            localStorage.setItem(AI_DJ_KEY, val ? 'true' : 'false');
        } catch { /* ignore */ }
    },

    /**
     * Announce the current track if AI DJ is enabled.
     * @param {Object} track
     * @param {string|null} moodKey
     */
    announce(track, moodKey = null) {
        if (!this.isEnabled()) return;
        if (!track) return;
        // Debounce: don't announce same track twice in a row
        if (track.id === _lastTrackId) return;
        _lastTrackId = track.id;

        const title = track.title || 'Unknown';
        const artist = track.artists?.[0]?.name || track.artist?.name || 'Unknown Artist';

        let message;
        if (moodKey && MOOD_INTROS[moodKey]) {
            message = MOOD_INTROS[moodKey](title, artist);
        } else {
            const template = INTRO_TEMPLATES[Math.floor(Math.random() * INTRO_TEMPLATES.length)];
            message = template(title, artist);
        }

        this._showToast(message);
    },

    _showToast(message) {
        // Remove any existing AI DJ toast
        document.querySelector('.ai-dj-toast')?.remove();

        const toast = document.createElement('div');
        toast.className = 'ai-dj-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger show animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('visible'));
        });

        // Auto-hide after 4 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    },
};

/**
 * Initialize AI DJ — hooks into player track change events.
 * @param {Object} player - Player instance
 */
export function initAIDJ(player) {
    // Listen for track start events fired from the player audio element
    const announceCurrentTrack = () => {
        if (player.currentTrack) {
            const { moodManager } = window._moodManagerRef || {};
            const mood = moodManager?.getMood?.() || null;
            aiDJ.announce(player.currentTrack, mood);
        }
    };

    // Intercept: whenever a new track is set, announce it
    // We listen to the 'play' event on audio element which fires on each new track
    const audioEl = player.audio;
    let _prevSrc = null;
    audioEl?.addEventListener('play', () => {
        if (audioEl.src !== _prevSrc) {
            _prevSrc = audioEl.src;
            // Small delay so currentTrack is set
            setTimeout(announceCurrentTrack, 200);
        }
    });

    // Also listen for video
    const videoEl = player.video;
    let _prevVideoSrc = null;
    videoEl?.addEventListener('play', () => {
        if (videoEl.src !== _prevVideoSrc) {
            _prevVideoSrc = videoEl.src;
            setTimeout(announceCurrentTrack, 200);
        }
    });
}
