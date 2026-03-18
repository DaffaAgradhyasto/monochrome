// js/ai-playlist-generator.js
// AI Playlist Generator
// Generates playlists based on natural language prompts

class AIPlaylistGenerator {
    constructor() {
        this.isGenerating = false;
        this.generatedPlaylists = [];

        // Keyword mapping for genres, moods, activities
        this.genreKeywords = {
            'pop': ['pop', 'mainstream', 'chart', 'billboard'],
            'rock': ['rock', 'metal', 'punk', 'grunge', 'alternative'],
            'electronic': ['electronic', 'edm', 'techno', 'house', 'trance', 'dubstep'],
            'hip-hop': ['hip-hop', 'rap', 'trap', 'hiphop'],
            'r&b': ['r&b', 'rnb', 'soul', 'neo-soul'],
            'jazz': ['jazz', 'blues', 'swing', 'bebop'],
            'classical': ['classical', 'orchestral', 'symphony', 'baroque', 'romantic'],
            'country': ['country', 'folk', 'americana', 'bluegrass'],
            'latin': ['latin', 'reggaeton', 'salsa', 'bachata', 'merengue'],
            'indie': ['indie', 'independent', 'underground'],
            'ambient': ['ambient', 'chill', 'downtempo', 'lo-fi', 'lofi'],
        };

        this.moodKeywords = {
            'energetic': ['energetic', 'upbeat', 'hype', 'pump up', 'workout', 'gym', 'party', 'dance'],
            'calm': ['calm', 'peaceful', 'relaxing', 'chill', 'zen', 'meditation', 'yoga'],
            'sad': ['sad', 'melancholy', 'depressing', 'crying', 'heartbreak', 'emotional'],
            'happy': ['happy', 'cheerful', 'joyful', 'positive', 'bright', 'sunshine'],
            'romantic': ['romantic', 'love', 'date night', 'intimate', 'sensual'],
            'focus': ['study', 'concentration', 'focus', 'work', 'productivity'],
            'sleep': ['sleep', 'bedtime', 'night', 'insomnia', 'lullaby'],
            'motivational': ['motivational', 'inspirational', 'empowering', 'confident'],
        };

        this.activityKeywords = {
            'workout': ['workout', 'gym', 'exercise', 'running', 'training', 'fitness'],
            'study': ['study', 'studying', 'homework', 'reading', 'learning'],
            'party': ['party', 'pregame', 'club', 'dance', 'celebration'],
            'driving': ['driving', 'road trip', 'commute', 'travel'],
            'cooking': ['cooking', 'kitchen', 'dinner party', 'baking'],
            'work': ['work', 'office', 'productivity', 'background'],
            'morning': ['morning', 'wake up', 'breakfast', 'sunrise'],
            'night': ['night', 'evening', 'late night', 'midnight'],
        };

        this.timeKeywords = {
            'morning': ['morning', 'am', 'breakfast', 'sunrise'],
            'afternoon': ['afternoon', 'day', 'daytime', 'lunch'],
            'evening': ['evening', 'night', 'pm', 'dinner'],
            'late-night': ['late night', 'midnight', 'nighttime', 'nocturnal'],
        };

        this.eraKeywords = {
            '2020s': ['recent', 'new', 'latest', 'modern', '2020', '2021', '2022', '2023', '2024', '2025', '2026'],
            '2010s': ['2010s', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019'],
            '2000s': ['2000s', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009'],
            '90s': ['90s', '1990s', 'nineties', 'throwback'],
            '80s': ['80s', '1980s', 'eighties', 'retro', 'vintage'],
            '70s': ['70s', '1970s', 'seventies', 'disco'],
            'classic': ['classic', 'old', 'timeless', 'legendary'],
        };
    }

    /**
     * Parse natural language prompt and extract intent
     * @param {string} prompt - User's natural language prompt
     * @returns {Object} - Parsed intent with genres, moods, activities, etc.
     */
    parsePrompt(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        const intent = {
            genres: [],
            moods: [],
            activities: [],
            timeOfDay: null,
            era: null,
            keywords: [],
        };

        // Extract genres
        for (const [genre, keywords] of Object.entries(this.genreKeywords)) {
            if (keywords.some((kw) => lowerPrompt.includes(kw))) {
                intent.genres.push(genre);
            }
        }

        // Extract moods
        for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
            if (keywords.some((kw) => lowerPrompt.includes(kw))) {
                intent.moods.push(mood);
            }
        }

        // Extract activities
        for (const [activity, keywords] of Object.entries(this.activityKeywords)) {
            if (keywords.some((kw) => lowerPrompt.includes(kw))) {
                intent.activities.push(activity);
            }
        }

        // Extract time of day
        for (const [time, keywords] of Object.entries(this.timeKeywords)) {
            if (keywords.some((kw) => lowerPrompt.includes(kw))) {
                intent.timeOfDay = time;
                break;
            }
        }

        // Extract era
        for (const [era, keywords] of Object.entries(this.eraKeywords)) {
            if (keywords.some((kw) => lowerPrompt.includes(kw))) {
                intent.era = era;
                break;
            }
        }

        // Extract additional keywords (split by space and filter)
        const words = lowerPrompt.split(/\s+/);
        intent.keywords = words.filter((word) => word.length > 3);

        return intent;
    }

    /**
     * Generate a playlist name based on the intent
     * @param {Object} intent - Parsed intent
     * @param {string} originalPrompt - Original user prompt
     * @returns {string} - Generated playlist name
     */
    generatePlaylistName(intent, originalPrompt) {
        // Use original prompt if it's short and descriptive
        if (originalPrompt.length < 50 && originalPrompt.length > 5) {
            return originalPrompt.charAt(0).toUpperCase() + originalPrompt.slice(1);
        }

        // Otherwise, construct a name from intent
        const parts = [];

        if (intent.timeOfDay) {
            parts.push(intent.timeOfDay.charAt(0).toUpperCase() + intent.timeOfDay.slice(1));
        }

        if (intent.moods.length > 0) {
            parts.push(intent.moods[0].charAt(0).toUpperCase() + intent.moods[0].slice(1));
        }

        if (intent.activities.length > 0) {
            parts.push(intent.activities[0].charAt(0).toUpperCase() + intent.activities[0].slice(1));
        }

        if (intent.genres.length > 0) {
            parts.push(intent.genres[0].toUpperCase());
        }

        if (parts.length === 0) {
            return 'AI Generated Mix';
        }

        return parts.join(' ') + ' Mix';
    }

    /**
     * Generate search filters based on intent
     * @param {Object} intent - Parsed intent
     * @returns {Object} - Search filters for music API
     */
    generateFilters(intent) {
        const filters = {};

        // Genre filters
        if (intent.genres.length > 0) {
            filters.genres = intent.genres;
        }

        // Mood-based energy level
        if (intent.moods.includes('energetic')) {
            filters.minEnergy = 0.7;
        } else if (intent.moods.includes('calm') || intent.moods.includes('sleep')) {
            filters.maxEnergy = 0.4;
            filters.minAcousticness = 0.5;
        }

        if (intent.moods.includes('happy')) {
            filters.minValence = 0.6;
        } else if (intent.moods.includes('sad')) {
            filters.maxValence = 0.4;
        }

        // Activity-based tempo
        if (intent.activities.includes('workout')) {
            filters.minTempo = 120;
            filters.minEnergy = 0.7;
        } else if (intent.activities.includes('study') || intent.activities.includes('work')) {
            filters.maxTempo = 100;
            filters.minInstrumentalness = 0.5;
        }

        // Era-based year range
        if (intent.era) {
            const eraRanges = {
                '2020s': [2020, 2026],
                '2010s': [2010, 2019],
                '2000s': [2000, 2009],
                '90s': [1990, 1999],
                '80s': [1980, 1989],
                '70s': [1970, 1979],
                'classic': [1950, 1979],
            };

            if (eraRanges[intent.era]) {
                filters.yearRange = eraRanges[intent.era];
            }
        }

        return filters;
    }

    /**
     * Generate a playlist based on natural language prompt
     * @param {string} prompt - User's natural language prompt
     * @param {Object} api - Music API instance
     * @param {number} trackCount - Number of tracks to generate (default 30)
     * @returns {Promise<Object>} - Generated playlist with tracks
     */
    async generatePlaylist(prompt, api, trackCount = 30) {
        if (this.isGenerating) {
            throw new Error('Already generating a playlist');
        }

        this.isGenerating = true;

        try {
            // Parse the prompt
            const intent = this.parsePrompt(prompt);
            console.log('[AIPlaylistGenerator] Parsed intent:', intent);

            // Generate playlist name
            const playlistName = this.generatePlaylistName(intent, prompt);

            // Generate filters
            const filters = this.generateFilters(intent);

            // Build search queries based on intent
            const searchQueries = this._buildSearchQueries(intent);

            // Fetch tracks from API
            const tracks = await this._fetchTracks(api, searchQueries, filters, trackCount);

            if (tracks.length === 0) {
                throw new Error('No tracks found matching your criteria');
            }

            // Create playlist object
            const playlist = {
                id: `ai-generated-${Date.now()}`,
                name: playlistName,
                description: `AI-generated playlist based on: "${prompt}"`,
                tracks,
                intent,
                filters,
                createdAt: Date.now(),
            };

            this.generatedPlaylists.push(playlist);

            console.log(`[AIPlaylistGenerator] Generated playlist "${playlistName}" with ${tracks.length} tracks`);

            return playlist;
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Build search queries based on intent
     * @param {Object} intent - Parsed intent
     * @returns {Array<string>} - Array of search queries
     * @private
     */
    _buildSearchQueries(intent) {
        const queries = [];

        // Genre-based queries
        if (intent.genres.length > 0) {
            intent.genres.forEach((genre) => {
                queries.push(genre);
            });
        }

        // Mood-based queries
        if (intent.moods.length > 0) {
            intent.moods.forEach((mood) => {
                queries.push(mood);
            });
        }

        // Activity-based queries
        if (intent.activities.length > 0) {
            intent.activities.forEach((activity) => {
                queries.push(activity);
            });
        }

        // Fallback: use keywords
        if (queries.length === 0 && intent.keywords.length > 0) {
            queries.push(...intent.keywords.slice(0, 3));
        }

        // Final fallback
        if (queries.length === 0) {
            queries.push('popular');
        }

        return queries;
    }

    /**
     * Fetch tracks from API based on queries and filters
     * @param {Object} api - Music API instance
     * @param {Array<string>} queries - Search queries
     * @param {Object} filters - Filters to apply
     * @param {number} trackCount - Number of tracks to fetch
     * @returns {Promise<Array>} - Array of tracks
     * @private
     */
    async _fetchTracks(api, queries, filters, trackCount) {
        const allTracks = [];
        const tracksPerQuery = Math.ceil(trackCount / queries.length);

        for (const query of queries) {
            try {
                // Search for tracks using the query
                const searchResults = await api.search(query, 'tracks', tracksPerQuery);

                if (searchResults && searchResults.tracks && searchResults.tracks.length > 0) {
                    // Filter tracks based on filters
                    let filteredTracks = searchResults.tracks;

                    // Apply year range filter
                    if (filters.yearRange) {
                        filteredTracks = filteredTracks.filter((track) => {
                            const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : null;
                            return year && year >= filters.yearRange[0] && year <= filters.yearRange[1];
                        });
                    }

                    allTracks.push(...filteredTracks);
                }
            } catch (error) {
                console.warn(`[AIPlaylistGenerator] Failed to search for "${query}":`, error);
            }
        }

        // Remove duplicates based on track ID
        const uniqueTracks = [];
        const seenIds = new Set();

        for (const track of allTracks) {
            if (!seenIds.has(track.id)) {
                seenIds.add(track.id);
                uniqueTracks.push(track);
            }
        }

        // Shuffle and limit to requested count
        const shuffled = this._shuffle(uniqueTracks);
        return shuffled.slice(0, trackCount);
    }

    /**
     * Shuffle array
     * @param {Array} array - Array to shuffle
     * @returns {Array} - Shuffled array
     * @private
     */
    _shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Get generated playlists
     * @returns {Array} - Array of generated playlists
     */
    getGeneratedPlaylists() {
        return [...this.generatedPlaylists];
    }

    /**
     * Clear generated playlists
     */
    clearGeneratedPlaylists() {
        this.generatedPlaylists = [];
    }
}

// Export singleton instance
export const aiPlaylistGenerator = new AIPlaylistGenerator();
