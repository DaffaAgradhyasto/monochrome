import { APICache } from './cache.js';
import { db } from './db.js';

const SPOTIFY_CLIENT_ID = 'dea6cdc74cd342b3ada70ad8d668fd0b';
const SPOTIFY_CLIENT_SECRET = '4a253883a7f1478b9e99d98963acf89b';

export class SpotifyAPI {
  constructor(settings) {
    this.settings = settings;
    this.cache = new APICache({
      maxSize: 500,
      ttl: 1000 * 60 * 60, // 1 hour
    });
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

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

  async fetchSpotify(endpoint, options = {}) {
    const token = await this.getAccessToken();
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

  prepareTrack(track) {
    return {
      id: track.id,
      title: track.name,
      artist: {
        id: track.artists[0].id,
        name: track.artists[0].name,
      },
      artists: track.artists.map(a => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        title: track.album.name,
        cover: track.album.images[0]?.url,
        releaseDate: track.album.release_date,
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
      items: data.tracks.items.map(t => this.prepareTrack(t)),
      total: data.tracks.total,
    };
    await this.cache.set('search', cacheKey, result);
    return result;
  }

  // Resolve Tidal track metadata to Spotify track IDs by searching Spotify
  async resolveSpotifyIds(tidalTracks) {
    const spotifyIds = [];
    for (const track of tidalTracks.slice(0, 5)) {
      try {
        const title = track.title || track.name || '';
        const artist = track.artist?.name || (track.artists?.[0]?.name) || '';
        if (!title && !artist) continue;
        const query = `${title} ${artist}`.trim();
        const result = await this.searchTracks(query, 1);
        if (result.items && result.items.length > 0) {
          spotifyIds.push(result.items[0].id);
        }
      } catch (e) {
        console.warn('Failed to resolve Spotify ID for track:', e);
      }
    }
    return spotifyIds;
  }

  async getRecommendations(spotifyTrackIds, limit = 20) {
    if (!spotifyTrackIds || spotifyTrackIds.length === 0) return [];
    // Spotify allows max 5 seed tracks
    const seeds = spotifyTrackIds.slice(0, 5);
    const data = await this.fetchSpotify(`/recommendations?seed_tracks=${seeds.join(',')}&limit=${limit}&market=ID`);
    return data.tracks.map(t => this.prepareTrack(t));
  }

  async getArtistTopTracks(artistId) {
    const data = await this.fetchSpotify(`/artists/${artistId}/top-tracks?market=ID`);
    return data.tracks.map(t => this.prepareTrack(t));
  }

  async getUserPlaylists() {
    const data = await this.fetchSpotify('/browse/featured-playlists?country=ID');
    return data.playlists.items;
  }

  async getTrending(limit = 20) {
    // Use new-releases and then get tracks from those albums via search
    // Since client credentials can't access user-specific endpoints,
    // we fall back to fetching top tracks of a trending playlist
    const cacheKey = `trending_${limit}`;
    const cached = await this.cache.get('trending', cacheKey);
    if (cached) return cached;
    try {
      const data = await this.fetchSpotify('/browse/featured-playlists?country=ID&limit=1');
      const playlist = data.playlists?.items?.[0];
      if (playlist) {
        const tracksData = await this.fetchSpotify(`/playlists/${playlist.id}/tracks?limit=${limit}&market=ID`);
        const tracks = (tracksData.items || [])
          .filter(i => i.track && i.track.id)
          .map(i => this.prepareTrack(i.track));
        await this.cache.set('trending', cacheKey, tracks);
        return tracks;
      }
    } catch (e) {
      console.warn('Failed to get trending from featured playlists:', e);
    }
    // Final fallback: search for popular tracks
    const result = await this.searchTracks('year:2024-2025', limit);
    return result.items || [];
  }

  // Algorithm-based personalized features
  // Uses history from db to find matching Spotify tracks and generate recommendations
  async getPersonalizedMixes() {
    const cacheKey = 'personalized_mixes';
    const cached = await this.cache.get('mixes', cacheKey);
    if (cached) return cached;

    let result = [];
    try {
      const history = await db.getHistory();
      const recentTracks = history.slice(0, 10);

      if (recentTracks.length === 0) {
        // No history: return trending tracks
        result = await this.getTrending(20);
      } else {
        // Resolve Tidal track IDs -> Spotify IDs via title+artist search
        const spotifyIds = await this.resolveSpotifyIds(recentTracks);

        if (spotifyIds.length > 0) {
          result = await this.getRecommendations(spotifyIds, 20);
        } else {
          // Could not resolve any Spotify IDs, fall back to trending
          result = await this.getTrending(20);
        }
      }
    } catch (e) {
      console.warn('Spotify getPersonalizedMixes error:', e);
      result = [];
    }

    if (result.length > 0) {
      await this.cache.set('mixes', cacheKey, result);
    }
    return result;
  }
}
