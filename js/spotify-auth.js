// js/spotify-auth.js
// Spotify OAuth PKCE Flow - No backend required
// Uses Authorization Code with PKCE for secure client-side auth

const SPOTIFY_CLIENT_ID = 'dea6cdc74cd342b3ada70ad8d668fd0b';
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/spotify-callback.html`;
const SPOTIFY_SCOPES = [
  'user-read-recently-played',
  'user-top-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'spotify_user_access_token',
  REFRESH_TOKEN: 'spotify_user_refresh_token',
  TOKEN_EXPIRY: 'spotify_user_token_expiry',
  CODE_VERIFIER: 'spotify_pkce_verifier',
  USER_PROFILE: 'spotify_user_profile',
};

async function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class SpotifyAuth {
  constructor() {
    this._accessToken = null;
    this._tokenExpiry = 0;
  }

  isConnected() {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiry = parseInt(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY) || '0');
    return !!token && Date.now() < expiry;
  }

  async getUserToken() {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiry = parseInt(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY) || '0');
    if (token && Date.now() < expiry) return token;
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (refreshToken) {
      try {
        return await this.refreshAccessToken(refreshToken);
      } catch (e) {
        console.warn('Spotify token refresh failed:', e);
        this.disconnect();
        return null;
      }
    }
    return null;
  }

  getUserProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async login() {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SPOTIFY_SCOPES,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  async handleCallback(code) {
    const verifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
    if (!verifier) throw new Error('No code verifier found');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Token exchange failed: ${err}`);
    }
    const data = await response.json();
    this._saveTokens(data);
    localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
    await this._fetchAndSaveProfile(data.access_token);
    return data.access_token;
  }

  async refreshAccessToken(refreshToken) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) throw new Error('Failed to refresh Spotify token');
    const data = await response.json();
    this._saveTokens(data);
    return data.access_token;
  }

  disconnect() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    this._accessToken = null;
    this._tokenExpiry = 0;
  }

  _saveTokens(data) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(Date.now() + data.expires_in * 1000));
    if (data.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
  }

  async _fetchAndSaveProfile(token) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify({
          id: profile.id,
          displayName: profile.display_name,
          avatar: profile.images?.[0]?.url || null,
          country: profile.country,
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch Spotify profile:', e);
    }
  }
}

export const spotifyAuth = new SpotifyAuth();
