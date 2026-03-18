// js/smart-shuffle.js
// Smart Shuffle Manager
// AI-driven shuffle that learns from listening habits and creates intelligent track ordering

import { wrappedSettings } from './storage.js';

class SmartShuffleManager {
    constructor() {
        this.isEnabled = false;
        this.listeningHistory = [];
        this.trackScores = new Map();

        // Factors for intelligent shuffle
        this.factors = {
            recentlyPlayed: 0.3, // Avoid recently played tracks
            completionRate: 0.25, // Prefer tracks user listens to completion
            skipRate: 0.2, // Avoid frequently skipped tracks
            genreVariety: 0.15, // Mix up genres
            energyFlow: 0.1, // Consider energy/tempo transitions
        };

        this._loadListeningHistory();
    }

    /**
     * Load listening history from storage
     * @private
     */
    _loadListeningHistory() {
        this.listeningHistory = wrappedSettings.getListeningHistory();
    }

    /**
     * Enable/disable smart shuffle
     */
    toggle(enabled) {
        this.isEnabled = enabled;
        return this.isEnabled;
    }

    /**
     * Check if smart shuffle is active
     */
    isActive() {
        return this.isEnabled;
    }

    /**
     * Calculate track score based on listening habits
     * @param {Object} track - Track object
     * @returns {number} - Score (0-1, higher is better)
     * @private
     */
    _calculateTrackScore(track) {
        if (!track || !track.id) return 0.5;

        // Check if we have a cached score
        if (this.trackScores.has(track.id)) {
            return this.trackScores.get(track.id);
        }

        let score = 0.5; // Base score

        // Find track in listening history
        const trackHistory = this.listeningHistory.filter((entry) => entry.track.id === track.id);

        if (trackHistory.length === 0) {
            // New track - give it a higher score to encourage discovery
            score = 0.7;
        } else {
            // Recently played penalty
            const lastPlayed = trackHistory[trackHistory.length - 1];
            const hoursSinceLastPlay = (Date.now() - lastPlayed.timestamp) / (1000 * 60 * 60);

            if (hoursSinceLastPlay < 1) {
                score -= 0.3; // Strong penalty for very recent
            } else if (hoursSinceLastPlay < 24) {
                score -= 0.15; // Moderate penalty for same day
            } else if (hoursSinceLastPlay < 168) {
                score -= 0.05; // Small penalty for same week
            }

            // Completion rate bonus (tracks that were listened to completion)
            const completedPlays = trackHistory.filter((entry) => entry.completed).length;
            const completionRate = completedPlays / trackHistory.length;
            score += completionRate * 0.25;

            // Skip rate penalty
            const skippedPlays = trackHistory.filter((entry) => entry.skipped).length;
            const skipRate = skippedPlays / trackHistory.length;
            score -= skipRate * 0.2;
        }

        // Normalize score to 0-1 range
        score = Math.max(0, Math.min(1, score));

        // Cache the score
        this.trackScores.set(track.id, score);

        return score;
    }

    /**
     * Smart shuffle a queue of tracks
     * @param {Array} queue - Array of track objects
     * @param {Object} options - Shuffle options
     * @returns {Array} - Intelligently shuffled queue
     */
    shuffle(queue, options = {}) {
        if (!this.isEnabled || !queue || queue.length === 0) {
            // Fallback to random shuffle
            return this._randomShuffle(queue);
        }

        console.log('[SmartShuffle] Applying intelligent shuffle to', queue.length, 'tracks');

        // Calculate scores for all tracks
        const tracksWithScores = queue.map((track) => ({
            track,
            score: this._calculateTrackScore(track),
            genre: track.genre || 'unknown',
            energy: this._estimateEnergy(track),
        }));

        // Sort by score (descending)
        tracksWithScores.sort((a, b) => b.score - a.score);

        // Apply genre variety - don't put same genre consecutively
        const shuffled = this._applyGenreVariety(tracksWithScores);

        // Apply energy flow - create a smooth energy curve
        if (options.smoothEnergyFlow) {
            return this._applyEnergyFlow(shuffled);
        }

        return shuffled.map((item) => item.track);
    }

    /**
     * Apply genre variety to avoid consecutive similar genres
     * @param {Array} tracksWithScores - Tracks with scores
     * @returns {Array} - Reordered tracks
     * @private
     */
    _applyGenreVariety(tracksWithScores) {
        const result = [];
        const remaining = [...tracksWithScores];

        while (remaining.length > 0) {
            let nextTrack;

            if (result.length === 0) {
                // First track - pick highest score
                nextTrack = remaining.shift();
            } else {
                // Find track with different genre than last
                const lastGenre = result[result.length - 1].genre;
                const differentGenreIndex = remaining.findIndex((item) => item.genre !== lastGenre);

                if (differentGenreIndex !== -1 && differentGenreIndex < 5) {
                    // Pick different genre if within top 5
                    nextTrack = remaining.splice(differentGenreIndex, 1)[0];
                } else {
                    // Otherwise just pick next highest score
                    nextTrack = remaining.shift();
                }
            }

            result.push(nextTrack);
        }

        return result;
    }

    /**
     * Apply energy flow for smooth transitions
     * @param {Array} tracksWithScores - Tracks with scores
     * @returns {Array} - Reordered tracks
     * @private
     */
    _applyEnergyFlow(tracksWithScores) {
        // Create a wave pattern: medium -> high -> medium -> low -> repeat
        const result = [];
        const byEnergy = {
            low: tracksWithScores.filter((t) => t.energy < 0.4),
            medium: tracksWithScores.filter((t) => t.energy >= 0.4 && t.energy < 0.7),
            high: tracksWithScores.filter((t) => t.energy >= 0.7),
        };

        const pattern = ['medium', 'high', 'medium', 'low'];
        let patternIndex = 0;

        while (result.length < tracksWithScores.length) {
            const energyLevel = pattern[patternIndex % pattern.length];
            const pool = byEnergy[energyLevel];

            if (pool && pool.length > 0) {
                result.push(pool.shift());
            }

            patternIndex++;
        }

        return result;
    }

    /**
     * Estimate energy level of a track (0-1)
     * @param {Object} track - Track object
     * @returns {number} - Energy estimate
     * @private
     */
    _estimateEnergy(track) {
        // This is a simple heuristic - in a real implementation,
        // you would use audio analysis or API data
        if (track.energy !== undefined) return track.energy;

        // Estimate based on genre
        const highEnergyGenres = ['electronic', 'hip-hop', 'rock', 'metal', 'dance'];
        const lowEnergyGenres = ['classical', 'ambient', 'jazz', 'acoustic'];

        const genre = (track.genre || '').toLowerCase();

        if (highEnergyGenres.some((g) => genre.includes(g))) {
            return 0.8;
        } else if (lowEnergyGenres.some((g) => genre.includes(g))) {
            return 0.3;
        }

        return 0.5; // Default medium energy
    }

    /**
     * Random shuffle fallback
     * @param {Array} queue - Array of tracks
     * @returns {Array} - Randomly shuffled queue
     * @private
     */
    _randomShuffle(queue) {
        const result = [...queue];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Record a track play for learning
     * @param {Object} track - Track that was played
     * @param {Object} data - Play data (completed, skipped, duration, etc.)
     */
    recordPlay(track, data = {}) {
        const entry = {
            track: {
                id: track.id,
                title: track.title,
                artist: track.artist,
                genre: track.genre,
            },
            timestamp: Date.now(),
            completed: data.completed || false,
            skipped: data.skipped || false,
            duration: data.duration || 0,
        };

        wrappedSettings.addToHistory(entry.track, entry.timestamp);

        // Update listening history in memory
        this.listeningHistory.push(entry);

        // Clear cached score for this track
        this.trackScores.delete(track.id);
    }

    /**
     * Clear learning data
     */
    clearHistory() {
        this.listeningHistory = [];
        this.trackScores.clear();
    }
}

// Export singleton instance
export const smartShuffleManager = new SmartShuffleManager();
