// js/ai-dj.js
// AI DJ Manager
// Virtual DJ that introduces tracks with synthetic voice and explains selections

class AIDJManager {
    constructor() {
        this.isEnabled = false;
        this.voice = null;
        this.availableVoices = [];
        this.djPersonality = 'friendly'; // 'friendly', 'professional', 'energetic', 'calm'
        this.introductionFrequency = 'every-3rd'; // 'every', 'every-3rd', 'first-only'
        this.trackCount = 0;

        // DJ personalities with different speaking styles
        this.personalities = {
            friendly: {
                name: 'Friendly',
                description: 'Warm and conversational',
                templates: [
                    "Hey there! Up next, we've got {title} by {artist}. This one's a real vibe.",
                    "Alright, coming up is {title} from {artist}. I think you're gonna love this.",
                    "Next on the playlist, it's {title} by {artist}. Great choice!",
                ],
            },
            professional: {
                name: 'Professional',
                description: 'Polished radio DJ style',
                templates: [
                    "Now playing: {title} by {artist}.",
                    "You're listening to {title}, performed by {artist}.",
                    "Next up, we have {title} from {artist}.",
                ],
            },
            energetic: {
                name: 'Energetic',
                description: 'Hype and enthusiastic',
                templates: [
                    "Let's gooo! Here comes {title} by the amazing {artist}!",
                    "Oh yeah! Time for {title} by {artist}! This is gonna be fire!",
                    "Pump it up! It's {title} from {artist}! Let's get it!",
                ],
            },
            calm: {
                name: 'Calm',
                description: 'Soothing and relaxed',
                templates: [
                    "Take a moment to enjoy {title} by {artist}.",
                    "Here's a beautiful track: {title} from {artist}.",
                    "Relax and listen to {title} by {artist}.",
                ],
            },
        };

        // Initialize speech synthesis
        this._initSpeech();
    }

    /**
     * Initialize speech synthesis
     * @private
     */
    _initSpeech() {
        if (!window.speechSynthesis) {
            console.warn('[AIDJ] Speech synthesis not supported in this browser');
            return;
        }

        // Load available voices
        const loadVoices = () => {
            this.availableVoices = window.speechSynthesis.getVoices();
            console.log(`[AIDJ] Loaded ${this.availableVoices.length} voices`);

            // Select a default voice (prefer English)
            if (!this.voice && this.availableVoices.length > 0) {
                this.voice =
                    this.availableVoices.find((v) => v.lang.startsWith('en')) || this.availableVoices[0];
                console.log(`[AIDJ] Selected default voice: ${this.voice.name}`);
            }
        };

        // Chrome loads voices asynchronously
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }

        loadVoices();
    }

    /**
     * Enable/disable AI DJ
     */
    toggle(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            // Stop any ongoing speech
            this.stop();
        }
        return this.isEnabled;
    }

    /**
     * Check if AI DJ is active
     */
    isActive() {
        return this.isEnabled;
    }

    /**
     * Introduce a track
     * @param {Object} track - Track object
     * @param {Object} options - Introduction options
     */
    introduceTrack(track, options = {}) {
        if (!this.isEnabled) return;
        if (!window.speechSynthesis) return;

        // Check if we should introduce this track based on frequency setting
        this.trackCount++;

        if (this.introductionFrequency === 'first-only' && this.trackCount > 1) {
            return;
        }

        if (this.introductionFrequency === 'every-3rd' && this.trackCount % 3 !== 0) {
            return;
        }

        // Generate introduction text
        const text = this._generateIntroduction(track, options);

        // Speak the introduction
        this.speak(text);
    }

    /**
     * Generate introduction text for a track
     * @param {Object} track - Track object
     * @param {Object} options - Options
     * @returns {string} - Introduction text
     * @private
     */
    _generateIntroduction(track, options = {}) {
        const personality = this.personalities[this.djPersonality];
        const templates = personality.templates;

        // Select a random template
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Extract track info
        const title = track.title || 'Unknown Track';
        const artist = track.artist?.name || track.artist || 'Unknown Artist';
        const album = track.album?.title || track.album || '';

        // Replace placeholders
        let text = template
            .replace('{title}', title)
            .replace('{artist}', artist)
            .replace('{album}', album);

        // Add reason if provided
        if (options.reason) {
            text += ` ${options.reason}`;
        } else if (options.mood) {
            text += ` Perfect for your ${options.mood} mood.`;
        }

        return text;
    }

    /**
     * Speak text using speech synthesis
     * @param {string} text - Text to speak
     */
    speak(text) {
        if (!window.speechSynthesis) return;

        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Configure voice
        if (this.voice) {
            utterance.voice = this.voice;
        }

        // Configure speech parameters
        utterance.rate = 1.0; // Speed
        utterance.pitch = 1.0; // Pitch
        utterance.volume = 0.8; // Volume (0-1)

        // Adjust parameters based on personality
        if (this.djPersonality === 'energetic') {
            utterance.rate = 1.1;
            utterance.pitch = 1.1;
        } else if (this.djPersonality === 'calm') {
            utterance.rate = 0.9;
            utterance.pitch = 0.9;
        }

        // Speak
        window.speechSynthesis.speak(utterance);

        console.log('[AIDJ] Speaking:', text);
    }

    /**
     * Stop any ongoing speech
     */
    stop() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    /**
     * Set DJ personality
     * @param {string} personality - Personality key
     */
    setPersonality(personality) {
        if (this.personalities[personality]) {
            this.djPersonality = personality;
            console.log(`[AIDJ] Personality set to "${personality}"`);
            return true;
        }
        return false;
    }

    /**
     * Get current personality
     * @returns {string} - Current personality key
     */
    getPersonality() {
        return this.djPersonality;
    }

    /**
     * Get all available personalities
     * @returns {Object} - All personalities
     */
    getPersonalities() {
        return { ...this.personalities };
    }

    /**
     * Set voice
     * @param {SpeechSynthesisVoice} voice - Voice object
     */
    setVoice(voice) {
        this.voice = voice;
    }

    /**
     * Get available voices
     * @returns {Array} - Available voices
     */
    getAvailableVoices() {
        return [...this.availableVoices];
    }

    /**
     * Set introduction frequency
     * @param {string} frequency - Frequency setting
     */
    setIntroductionFrequency(frequency) {
        if (['every', 'every-3rd', 'first-only'].includes(frequency)) {
            this.introductionFrequency = frequency;
            return true;
        }
        return false;
    }

    /**
     * Get introduction frequency
     * @returns {string} - Current frequency setting
     */
    getIntroductionFrequency() {
        return this.introductionFrequency;
    }

    /**
     * Make a custom announcement
     * @param {string} text - Custom announcement text
     */
    announce(text) {
        if (this.isEnabled) {
            this.speak(text);
        }
    }

    /**
     * Reset track count
     */
    resetTrackCount() {
        this.trackCount = 0;
    }
}

// Export singleton instance
export const aiDJManager = new AIDJManager();
