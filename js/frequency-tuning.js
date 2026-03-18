// js/frequency-tuning.js
// Frequency Tuning Manager
// Allows real-time frequency shifting (432Hz, 528Hz, etc.)

import { frequencyTuningSettings } from './storage.js';

class FrequencyTuningManager {
    constructor() {
        this.audioContext = null;
        this.playbackRateNode = null;
        this.isEnabled = false;
        this.isInitialized = false;

        // Standard tuning frequencies
        this.tunings = {
            '440': { name: 'Standard (A4 = 440Hz)', rate: 1.0 },
            '432': { name: 'Verdi (A4 = 432Hz)', rate: 432 / 440 },
            '528': { name: 'Solfeggio (C5 = 528Hz)', rate: 528 / 523.25 }, // C5 standard = 523.25Hz
            '396': { name: 'Solfeggio Liberation (396Hz)', rate: 396 / 391.995 }, // G4 standard
            '417': { name: 'Solfeggio Change (417Hz)', rate: 417 / 415.305 }, // G#4 standard
            '639': { name: 'Solfeggio Connection (639Hz)', rate: 639 / 659.255 }, // E5 standard
            '741': { name: 'Solfeggio Awakening (741Hz)', rate: 741 / 739.989 }, // F#5 standard
            '852': { name: 'Solfeggio Intuition (852Hz)', rate: 852 / 830.609 }, // G#5 standard
        };

        this.currentTuning = frequencyTuningSettings.getTuning();

        // Load saved settings
        this._loadSettings();
    }

    /**
     * Initialize frequency tuning
     * Note: This doesn't use Web Audio API nodes because it modifies playback rate
     * which is a property of the audio element itself
     */
    init(audioContext) {
        if (this.isInitialized) return;
        if (!audioContext) return;

        this.audioContext = audioContext;
        this.isInitialized = true;
        console.log('[FrequencyTuning] Initialized');
    }

    /**
     * Check if frequency tuning is ready
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Enable/disable frequency tuning
     */
    toggle(enabled) {
        this.isEnabled = enabled;
        frequencyTuningSettings.setEnabled(enabled);
        return this.isEnabled;
    }

    /**
     * Check if frequency tuning is active
     */
    isActive() {
        return this.isInitialized && this.isEnabled;
    }

    /**
     * Set tuning frequency
     */
    setTuning(tuning) {
        if (!this.tunings[tuning]) {
            console.warn(`[FrequencyTuning] Unknown tuning: ${tuning}`);
            return false;
        }

        this.currentTuning = tuning;
        frequencyTuningSettings.setTuning(tuning);
        return true;
    }

    /**
     * Get current tuning
     */
    getTuning() {
        return this.currentTuning;
    }

    /**
     * Get playback rate for current tuning
     * This should be applied to the audio element's playbackRate property
     */
    getPlaybackRate() {
        if (!this.isEnabled) return 1.0;

        const tuning = this.tunings[this.currentTuning];
        return tuning ? tuning.rate : 1.0;
    }

    /**
     * Get available tunings
     */
    getTunings() {
        return { ...this.tunings };
    }

    /**
     * Apply frequency tuning to audio element
     * @param {HTMLAudioElement|HTMLVideoElement} audioElement - The audio/video element
     * @param {number} baseRate - Base playback rate (for speed control)
     */
    applyToElement(audioElement, baseRate = 1.0) {
        if (!audioElement) return;

        if (this.isEnabled) {
            const tuningRate = this.getPlaybackRate();
            audioElement.playbackRate = baseRate * tuningRate;
        } else {
            audioElement.playbackRate = baseRate;
        }
    }

    /**
     * Load settings from storage
     */
    _loadSettings() {
        this.isEnabled = frequencyTuningSettings.isEnabled();
        this.currentTuning = frequencyTuningSettings.getTuning();
    }

    /**
     * Reset to standard tuning
     */
    reset() {
        this.setTuning('440');
        this.toggle(false);
    }
}

// Export singleton instance
export const frequencyTuningManager = new FrequencyTuningManager();
