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
      throw new Error(`Spotify API error: ${response.statusText}`);
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
    const data = await this.fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
    return {
      items: data.tracks.items.map(t => this.prepareTrack(t)),
      total: data.tracks.total,
    };
  }

  async getRecommendations(trackIds, limit = 20) {
    const data = await this.fetchSpotify(`/recommendations?seed_tracks=${trackIds.join(',')}&limit=${limit}`);
    return data.tracks.map(t => this.prepareTrack(t));
  }

  async getArtistTopTracks(artistId) {
    const data = await this.fetchSpotify(`/artists/${artistId}/top-tracks?market=ID`);
    return data.tracks.map(t => this.prepareTrack(t));
  }

  async getUserPlaylists() {
    // Note: Needs user auth for private playlists, using public for now
    const data = await this.fetchSpotify('/browse/featured-playlists?country=ID');
    return data.playlists.items;
  }

  // Algorithm-based "Spotify Original" features
  async getPersonalizedMixes() {
    const history = await db.getHistory();
    const topTracks = history.slice(0, 5).map(t => t.id);
    
    if (topTracks.length === 0) {
      return this.getTrending();
    }

    return this.getRecommendations(topTracks);
  }

  async getTrending() {
    const data = await this.fetchSpotify('/browse/new-releases?limit=10');
    return data.albums.items;
  }
}
