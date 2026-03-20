import { APICache } from './cache.js';
import { db } from './db.js';
import { spotifyAuth } from './spotify-auth.js';

const SPOTIFY_CLIENT_ID = 'dea6cdc74cd342b3ada70ad8d668fd0b';
const SPOTIFY_CLIENT_SECRET = '4a253883a7f1478b9e99d98963acf89b';

export class SpotifyAPI {
  constructor(settings) {
    this.settings = settings;
    this.cache = new APICache({
      maxSize: 500,
      ttl: 1000 * 60 * 60,
    });
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  // Client credentials token (for public data)
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET),
      },
      body: 'grant_type=client_credentials',
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    return this.accessToken;
  }

  // Get best available token: user token preferred, fall back to client credentials
  async getBestToken() {
    const userToken = await spotifyAuth.getUserToken();
    if (userToken) return { token: userToken, isUser: true };
    const clientToken = await this.getAccessToken();
    return { token: clientToken, isUser: false };
  }

  async fetchSpotify(endpoint, options = {}) {
    const { token } = await this.getBestToken();
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Fetch with explicit user token (requires OAuth login)
  async fetchSpotifyUser(endpoint, options = {}) {
    const userToken = await spotifyAuth.getUserToken();
    if (!userToken) throw new Error('Spotify user not logged in');
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${userToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Spotify User API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  prepareTrack(track) {
    if (!track || !track.id) return null;
    return {
      id: track.id,
      title: track.name,
      artist: {
        id: track.artists?.[0]?.id,
        name: track.artists?.[0]?.name,
      },
      artists: (track.artists || []).map(a => ({ id: a.id, name: a.name })),
      album: {
        id: track.album?.id,
        title: track.album?.name,
        cover: track.album?.images?.[0]?.url,
        releaseDate: track.album?.release_date,
      },
      duration: track.duration_ms / 1000,
      popularity: track.popularity,
      explicit: track.explicit,
      type: 'track',
      source: 'spotify',
    };
  }

  async searchTracks(query, limit = 20) {
    const cacheKey = `search_${query}_${limit}`;
    const cached = await this.cache.get('search', cacheKey);
    if (cached) return cached;
    const data = await this.fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
    const result = {
      items: data.tracks.items.map(t => this.prepareTrack(t)).filter(Boolean),
      total: data.tracks.total,
    };
    await this.cache.set('search', cacheKey, result);
    return result;
  }

  // Resolve Tidal track metadata to Spotify track IDs
  async resolveSpotifyIds(tidalTracks) {
    const spotifyIds = [];
    for (const track of tidalTracks.slice(0, 5)) {
      try {
        const title = track.title || track.name || '';
        const artist = track.artist?.name || track.artists?.[0]?.name || '';
        if (!title && !artist) continue;
        const query = `${title} ${artist}`.trim();
        const result = await this.searchTracks(query, 1);
        if (result.items?.length > 0) {
          spotifyIds.push(result.items[0].id);
        }
      } catch (e) {
        console.warn('Failed to resolve Spotify ID:', e);
      }
    }
    return spotifyIds;
  }

  async getRecommendations(spotifyTrackIds, limit = 20) {
    if (!spotifyTrackIds?.length) return [];
    const seeds = spotifyTrackIds.slice(0, 5);
    const data = await this.fetchSpotify(`/recommendations?seed_tracks=${seeds.join(',')}&limit=${limit}&market=ID`);
    return data.tracks.map(t => this.prepareTrack(t)).filter(Boolean);
  }

  // Get user's recently played tracks (requires user OAuth)
  async getRecentlyPlayed(limit = 20) {
    const cacheKey = `recently_played_${limit}`;
    const cached = await this.cache.get('user', cacheKey);
    if (cached) return cached;
    const data = await this.fetchSpotifyUser(`/me/player/recently-played?limit=${limit}`);
    const tracks = (data.items || [])
      .map(item => this.prepareTrack(item.track))
      .filter(Boolean);
    await this.cache.set('user', cacheKey, tracks);
    return tracks;
  }

  // Get user's top tracks (requires user OAuth)
  async getTopTracks(limit = 20, timeRange = 'medium_term') {
    const cacheKey = `top_tracks_${limit}_${timeRange}`;
    const cached = await this.cache.get('user', cacheKey);
    if (cached) return cached;
    const data = await this.fetchSpotifyUser(`/me/top/tracks?limit=${limit}&time_range=${timeRange}`);
    const tracks = (data.items || []).map(t => this.prepareTrack(t)).filter(Boolean);
    await this.cache.set('user', cacheKey, tracks);
    return tracks;
  }

  // Get user's saved tracks from library (requires user OAuth)
  async getSavedTracks(limit = 20) {
    const cacheKey = `saved_tracks_${limit}`;
    const cached = await this.cache.get('user', cacheKey);
    if (cached) return cached;
    const data = await this.fetchSpotifyUser(`/me/tracks?limit=${limit}&market=ID`);
    const tracks = (data.items || [])
      .map(item => this.prepareTrack(item.track))
      .filter(Boolean);
    await this.cache.set('user', cacheKey, tracks);
    return tracks;
  }

  async getArtistTopTracks(artistId) {
    const data = await this.fetchSpotify(`/artists/${artistId}/top-tracks?market=ID`);
    return data.tracks.map(t => this.prepareTrack(t)).filter(Boolean);
  }

  async getTrending(limit = 20) {
    const cacheKey = `trending_${limit}`;
    const cached = await this.cache.get('trending', cacheKey);
    if (cached) return cached;
    try {
      const data = await this.fetchSpotify('/browse/featured-playlists?country=ID&limit=1');
      const playlist = data.playlists?.items?.[0];
      if (playlist) {
        const tracksData = await this.fetchSpotify(`/playlists/${playlist.id}/tracks?limit=${limit}&market=ID`);
        const tracks = (tracksData.items || [])
          .filter(i => i.track?.id)
          .map(i => this.prepareTrack(i.track))
          .filter(Boolean);
        await this.cache.set('trending', cacheKey, tracks);
        return tracks;
      }
    } catch (e) {
      console.warn('Spotify featured playlist failed:', e);
    }
    const result = await this.searchTracks('year:2024-2025', limit);
    return result.items || [];
  }

  // Main: get personalized mixes using real Spotify user data if logged in
  async getPersonalizedMixes() {
    const cacheKey = 'personalized_mixes_v2';
    const cached = await this.cache.get('mixes', cacheKey);
    if (cached) return cached;

    let result = [];
    try {
      const isUserLoggedIn = spotifyAuth.isConnected();

      if (isUserLoggedIn) {
        // Use real Spotify user data: recently played + top tracks
        let seedTracks = [];
        try {
          const recentlyPlayed = await this.getRecentlyPlayed(10);
          const topTracks = await this.getTopTracks(10);
          // Merge and deduplicate by track ID
          const seen = new Set();
          for (const t of [...recentlyPlayed, ...topTracks]) {
            if (t?.id && !seen.has(t.id)) {
              seen.add(t.id);
              seedTracks.push(t);
            }
          }
        } catch (e) {
          console.warn('Failed to get user tracks from Spotify:', e);
        }

        if (seedTracks.length > 0) {
          const seedIds = seedTracks.slice(0, 5).map(t => t.id);
          result = await this.getRecommendations(seedIds, 20);
        } else {
          result = await this.getTrending(20);
        }
      } else {
        // Fallback: use Monochrome history to resolve Spotify IDs
        const history = await db.getHistory();
        const recentTracks = history.slice(0, 10);
        if (recentTracks.length > 0) {
          const spotifyIds = await this.resolveSpotifyIds(recentTracks);
          if (spotifyIds.length > 0) {
            result = await this.getRecommendations(spotifyIds, 20);
          } else {
            result = await this.getTrending(20);
          }
        } else {
          result = await this.getTrending(20);
        }
      }
    } catch (e) {
      console.warn('Spotify getPersonalizedMixes error:', e);
      result = [];
    }

    if (result.length > 0) {
      // Short TTL for user data so it stays fresh
      await this.cache.set('mixes', cacheKey, result);
    }
    return result;
  }

  // Check if Spotify OAuth user is connected
  isUserConnected() {
    return spotifyAuth.isConnected();
  }

  // Get Spotify user profile
  getUserProfile() {
    return spotifyAuth.getUserProfile();
  }
}
