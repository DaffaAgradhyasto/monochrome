// js/mood-detection.js
// Mood Detection Manager
// Detects user mood based on time, context, or manual input and recommends music

class MoodDetectionManager {
    constructor() {
        this.currentMood = null;
        this.detectionMode = 'auto'; // 'auto', 'manual', 'contextual'

        // Mood definitions with music characteristics
        this.moods = {
            energized: {
                name: 'Energized',
                description: 'Upbeat and ready to conquer the world',
                characteristics: {
                    minTempo: 120,
                    minEnergy: 0.7,
                    minValence: 0.6,
                },
                genres: ['pop', 'electronic', 'hip-hop', 'rock'],
                keywords: ['upbeat', 'energetic', 'pump up', 'hype'],
                icon: '⚡',
                color: '#ff6b6b',
            },
            relaxed: {
                name: 'Relaxed',
                description: 'Calm and peaceful',
                characteristics: {
                    maxTempo: 100,
                    maxEnergy: 0.5,
                    minAcousticness: 0.4,
                },
                genres: ['ambient', 'classical', 'jazz', 'acoustic'],
                keywords: ['chill', 'calm', 'peaceful', 'zen'],
                icon: '😌',
                color: '#51cf66',
            },
            focused: {
                name: 'Focused',
                description: 'In the zone and productive',
                characteristics: {
                    maxTempo: 120,
                    minInstrumentalness: 0.5,
                    maxEnergy: 0.6,
                },
                genres: ['classical', 'ambient', 'lo-fi', 'instrumental'],
                keywords: ['focus', 'concentration', 'study', 'work'],
                icon: '🎯',
                color: '#339af0',
            },
            happy: {
                name: 'Happy',
                description: 'Feeling great and positive',
                characteristics: {
                    minValence: 0.7,
                    minEnergy: 0.5,
                },
                genres: ['pop', 'indie', 'funk', 'soul'],
                keywords: ['happy', 'cheerful', 'joyful', 'positive'],
                icon: '😊',
                color: '#ffd43b',
            },
            melancholic: {
                name: 'Melancholic',
                description: 'Reflective and emotional',
                characteristics: {
                    maxValence: 0.4,
                    maxEnergy: 0.4,
                    minAcousticness: 0.5,
                },
                genres: ['indie', 'alternative', 'folk', 'classical'],
                keywords: ['sad', 'melancholy', 'emotional', 'reflective'],
                icon: '😔',
                color: '#748ffc',
            },
            romantic: {
                name: 'Romantic',
                description: 'In love and sentimental',
                characteristics: {
                    minValence: 0.5,
                    maxTempo: 110,
                },
                genres: ['r&b', 'soul', 'jazz', 'pop'],
                keywords: ['love', 'romantic', 'intimate', 'sensual'],
                icon: '❤️',
                color: '#ff6b9d',
            },
            motivated: {
                name: 'Motivated',
                description: 'Ready to achieve goals',
                characteristics: {
                    minEnergy: 0.7,
                    minTempo: 110,
                    minValence: 0.6,
                },
                genres: ['hip-hop', 'rock', 'electronic', 'pop'],
                keywords: ['motivational', 'inspirational', 'empowering'],
                icon: '💪',
                color: '#ff922b',
            },
            sleepy: {
                name: 'Sleepy',
                description: 'Winding down for rest',
                characteristics: {
                    maxTempo: 80,
                    maxEnergy: 0.3,
                    minAcousticness: 0.6,
                },
                genres: ['ambient', 'classical', 'acoustic', 'lo-fi'],
                keywords: ['sleep', 'bedtime', 'lullaby', 'night'],
                icon: '😴',
                color: '#845ef7',
            },
            adventurous: {
                name: 'Adventurous',
                description: 'Ready for new experiences',
                characteristics: {
                    minEnergy: 0.6,
                    minValence: 0.5,
                },
                genres: ['indie', 'alternative', 'world', 'electronic'],
                keywords: ['adventure', 'discovery', 'exploration', 'travel'],
                icon: '🌍',
                color: '#20c997',
            },
            nostalgic: {
                name: 'Nostalgic',
                description: 'Remembering the good times',
                characteristics: {
                    maxEnergy: 0.6,
                },
                genres: ['classic', 'retro', 'pop', 'rock'],
                keywords: ['throwback', 'memories', 'nostalgic', 'vintage'],
                icon: '📼',
                color: '#fab005',
            },
        };

        // Time-based mood mapping
        this.timeBasedMoods = {
            morning: ['energized', 'motivated', 'happy'], // 6 AM - 11 AM
            afternoon: ['focused', 'motivated', 'energized'], // 12 PM - 5 PM
            evening: ['relaxed', 'happy', 'romantic'], // 6 PM - 9 PM
            night: ['relaxed', 'melancholic', 'sleepy'], // 10 PM - 5 AM
        };
    }

    /**
     * Detect mood automatically based on time of day
     * @returns {string} - Detected mood key
     */
    detectMoodByTime() {
        const hour = new Date().getHours();

        let timeOfDay;
        if (hour >= 6 && hour < 12) {
            timeOfDay = 'morning';
        } else if (hour >= 12 && hour < 18) {
            timeOfDay = 'afternoon';
        } else if (hour >= 18 && hour < 22) {
            timeOfDay = 'evening';
        } else {
            timeOfDay = 'night';
        }

        // Get possible moods for this time
        const possibleMoods = this.timeBasedMoods[timeOfDay];

        // Pick a random mood from the possibilities
        const moodKey = possibleMoods[Math.floor(Math.random() * possibleMoods.length)];

        console.log(`[MoodDetection] Detected mood "${moodKey}" for ${timeOfDay} (${hour}:00)`);

        return moodKey;
    }

    /**
     * Detect mood based on weather (requires weather API)
     * @param {Object} weather - Weather data
     * @returns {string} - Detected mood key
     */
    detectMoodByWeather(weather) {
        if (!weather) return null;

        const condition = weather.condition?.toLowerCase() || '';
        const temp = weather.temperature || 20;

        if (condition.includes('rain') || condition.includes('storm')) {
            return 'melancholic';
        } else if (condition.includes('cloud') || condition.includes('overcast')) {
            return 'relaxed';
        } else if (condition.includes('sun') || condition.includes('clear')) {
            if (temp > 25) {
                return 'energized';
            } else {
                return 'happy';
            }
        } else if (condition.includes('snow')) {
            return 'nostalgic';
        }

        return null;
    }

    /**
     * Detect mood based on user activity
     * @param {string} activity - User activity ('working', 'exercising', 'relaxing', etc.)
     * @returns {string} - Detected mood key
     */
    detectMoodByActivity(activity) {
        const activityMoodMap = {
            working: 'focused',
            studying: 'focused',
            exercising: 'energized',
            running: 'motivated',
            relaxing: 'relaxed',
            sleeping: 'sleepy',
            'winding-down': 'sleepy',
            party: 'energized',
            dating: 'romantic',
            commuting: 'focused',
            cooking: 'happy',
            'hanging-out': 'happy',
        };

        return activityMoodMap[activity] || null;
    }

    /**
     * Get current mood
     * @returns {Object|null} - Current mood object
     */
    getCurrentMood() {
        if (!this.currentMood) {
            // Auto-detect if not set
            const moodKey = this.detectMoodByTime();
            this.setMood(moodKey);
        }

        return this.currentMood ? this.moods[this.currentMood] : null;
    }

    /**
     * Set mood manually
     * @param {string} moodKey - Mood key
     */
    setMood(moodKey) {
        if (!this.moods[moodKey]) {
            console.warn(`[MoodDetection] Unknown mood: ${moodKey}`);
            return false;
        }

        this.currentMood = moodKey;
        console.log(`[MoodDetection] Mood set to "${moodKey}"`);

        // Dispatch event for UI update
        window.dispatchEvent(
            new CustomEvent('mood-changed', {
                detail: { mood: this.moods[moodKey], moodKey },
            })
        );

        return true;
    }

    /**
     * Get all available moods
     * @returns {Object} - All moods
     */
    getAllMoods() {
        return { ...this.moods };
    }

    /**
     * Get music recommendations for current mood
     * @returns {Object} - Recommendation filters and queries
     */
    getRecommendations() {
        const mood = this.getCurrentMood();
        if (!mood) return null;

        return {
            name: mood.name,
            description: mood.description,
            characteristics: mood.characteristics,
            genres: mood.genres,
            keywords: mood.keywords,
            searchQueries: this._buildSearchQueries(mood),
        };
    }

    /**
     * Build search queries for a mood
     * @param {Object} mood - Mood object
     * @returns {Array<string>} - Search queries
     * @private
     */
    _buildSearchQueries(mood) {
        const queries = [];

        // Add genre-based queries
        mood.genres.forEach((genre) => {
            queries.push(genre);
        });

        // Add keyword-based queries
        mood.keywords.slice(0, 2).forEach((keyword) => {
            queries.push(keyword);
        });

        return queries;
    }

    /**
     * Check if a track matches current mood
     * @param {Object} track - Track object
     * @returns {boolean} - True if track matches mood
     */
    matchesMood(track) {
        const mood = this.getCurrentMood();
        if (!mood) return true; // No mood set, accept all

        const characteristics = mood.characteristics;

        // Check tempo
        if (characteristics.minTempo && track.tempo < characteristics.minTempo) {
            return false;
        }
        if (characteristics.maxTempo && track.tempo > characteristics.maxTempo) {
            return false;
        }

        // Check energy
        if (characteristics.minEnergy && track.energy < characteristics.minEnergy) {
            return false;
        }
        if (characteristics.maxEnergy && track.energy > characteristics.maxEnergy) {
            return false;
        }

        // Check valence (positivity)
        if (characteristics.minValence && track.valence < characteristics.minValence) {
            return false;
        }
        if (characteristics.maxValence && track.valence > characteristics.maxValence) {
            return false;
        }

        // Check genre
        const trackGenre = (track.genre || '').toLowerCase();
        if (mood.genres.length > 0 && !mood.genres.some((g) => trackGenre.includes(g))) {
            return false;
        }

        return true;
    }

    /**
     * Reset mood (clear current mood)
     */
    reset() {
        this.currentMood = null;
    }

    /**
     * Set detection mode
     * @param {string} mode - Detection mode ('auto', 'manual', 'contextual')
     */
    setDetectionMode(mode) {
        if (['auto', 'manual', 'contextual'].includes(mode)) {
            this.detectionMode = mode;
        }
    }
}

// Export singleton instance
export const moodDetectionManager = new MoodDetectionManager();
