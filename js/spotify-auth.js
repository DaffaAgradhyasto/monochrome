// js/spotify-auth.js
// Spotify OAuth 2.0 PKCE Authentication for Monochrome Music Player
// This module handles login, token management, and refresh flows.

const SPOTIFY_CLIENT_ID = 'dea6cdc74cd342b3ada70ad8d668fd0b';
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/callback`;
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'spotify_access_token',
  REFRESH_TOKEN: 'spotify_refresh_token',
  TOKEN_EXPIRY: 'spotify_token_expiry',
  CODE_VERIFIER: 'spotify_code_verifier',
  USER_PROFILE: 'spotify_user_profile',
};

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class SpotifyAuth {
  constructor() {
    this._refreshTimer = null;
  }

  getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  isLoggedIn() {
    const token = this.getAccessToken();
    const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (!token || !expiry) return false;
    return Date.now() < parseInt(expiry, 10);
  }

  getUserProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async login() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64UrlEncode(hashed);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: SPOTIFY_SCOPES,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('Spotify auth error:', error);
      throw new Error(`Spotify authorization failed: ${error}`);
    }

    if (!code) {
      return false;
    }

    const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('Code verifier not found. Please try logging in again.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
    }

    const data = await response.json();
    this._storeTokens(data);
    localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);

    await this._fetchAndStoreProfile();
    this._scheduleRefresh(data.expires_in);

    return true;
  }

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available. Please log in again.');
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        this.logout();
        throw new Error('Token refresh failed. Please log in again.');
      }

      const data = await response.json();
      this._storeTokens(data);
      this._scheduleRefresh(data.expires_in);

      return data.access_token;
    } catch (error) {
      console.error('Failed to refresh Spotify token:', error);
      throw error;
    }
  }

  async getValidToken() {
    if (this.isLoggedIn()) {
      return this.getAccessToken();
    }

    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      return this.refreshAccessToken();
    }

    return null;
  }

  logout() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    window.dispatchEvent(new CustomEvent('spotify-logout'));
  }

  _storeTokens(data) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    const expiryTime = Date.now() + data.expires_in * 1000;
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    window.dispatchEvent(new CustomEvent('spotify-token-updated'));
  }

  _scheduleRefresh(expiresIn) {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    const refreshMs = (expiresIn - 120) * 1000;
    if (refreshMs > 0) {
      this._refreshTimer = setTimeout(() => this.refreshAccessToken().catch(console.error), refreshMs);
    }
  }

  async _fetchAndStoreProfile() {
    try {
      const token = this.getAccessToken();
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const profile = await response.json();
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
        window.dispatchEvent(new CustomEvent('spotify-profile-loaded', { detail: profile }));
      }
    } catch (error) {
      console.warn('Failed to fetch Spotify profile:', error);
    }
  }

  init() {
    if (this.getRefreshToken() && !this.isLoggedIn()) {
      this.refreshAccessToken().catch(console.error);
    } else if (this.isLoggedIn()) {
      const expiry = parseInt(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY), 10);
      const remaining = Math.floor((expiry - Date.now()) / 1000);
      this._scheduleRefresh(remaining);
    }
  }
}

export const spotifyAuth = new SpotifyAuth();
