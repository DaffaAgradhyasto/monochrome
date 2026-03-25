// js/hot-new.js
// Hot & New page - Trending albums, tracks, playlists, genres and new releases

import { navigate } from './router.js';
import {
  createQualityBadgeHTML,
  hasExplicitContent,
  getTrackArtistsHTML,
  getTrackYearDisplay,
  formatDuration,
  createPlaceholder,
} from './utils.js';

// Genres available on TIDAL (matching monochrome.tf)
const GENRES = [
  'Hip-Hop',
  'R&B / Soul',
  'Blues',
  'Classical',
  'Country',
  'Dance & Electronic',
  'Folk / Americana',
  'Global',
  'Gospel / Christian',
  'Jazz',
  'K-Pop',
  'Kids',
  'Latin',
  'Metal',
  'Pop',
  'Reggae / Dancehall',
  'Legacy',
  'Rock / Indie',
];

// Featured editorial playlist IDs (known TIDAL playlists)
const FEATURED_PLAYLIST_IDS = [
  '84397043-7c0c-49c4-95ff-5f46680c1b5d', // TIDAL's Top Hits
  '69c0b5d9-9d12-4da5-98bc-b00ddae30a26', // Pop Hits
  '8c16e76d-7a5c-42c2-8ee6-fc37571c52be', // Rock Hits
  'a7b37d78-5d5e-4e8e-9e37-9d4c71d40dc2', // Rap Hits
];

// New arrivals editorial playlist IDs
const EDITORIAL_PLAYLIST_IDS = [
  '9044b2c0-3e45-4ae6-9fa7-72e8c7da5551', // New Arrivals
];

// Trending search queries to get content
const TRENDING_QUERIES = [
  'top hits 2026',
  'new releases 2026',
  'trending music',
];

/**
 * Renders the Hot & New page.
 * @param {object} api - MusicAPI instance
 * @param {HTMLElement} container - The main content container
 * @param {object} player - Player instance
 * @param {Function} handleTrackAction - Function to handle track actions
 * @param {Function} createAlbumCard - Function to create album card HTML
 * @param {Function} createTrackRow - Function to create track row HTML
 */
export async function renderHotNewContent(api, container, player, handleTrackAction, createAlbumCard, createTrackRow) {
  container.innerHTML = `
    <div class="hot-new-page">
      <section class="home-section genres-section">
        <h2>Genres</h2>
        <div class="genres-grid">
          ${GENRES.map(genre => `
            <button class="genre-pill" data-genre="${genre}">
              <h3>${genre}</h3>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="home-section">
        <h2>Trending Albums</h2>
        <div class="album-grid trending-albums-grid" id="trending-albums-grid">
          ${createPlaceholder('album', 10)}
        </div>
      </section>

      <section class="home-section">
        <h2>Trending Tracks</h2>
        <div class="track-list" id="trending-tracks-list">
          ${createPlaceholder('track', 5)}
        </div>
      </section>

      <section class="home-section">
        <h2>New Albums</h2>
        <div class="album-grid new-albums-grid" id="new-albums-grid">
          ${createPlaceholder('album', 10)}
        </div>
      </section>

      <section class="home-section">
        <h2>New Tracks</h2>
        <div class="track-list" id="new-tracks-list">
          ${createPlaceholder('track', 5)}
        </div>
      </section>
    </div>
  `;

  // Set up genre pill click handlers
  container.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const genre = pill.dataset.genre;
      navigate(`/search/${encodeURIComponent(genre)}`);
    });
  });

  // Load trending albums
  loadTrendingAlbums(api, container, createAlbumCard);

  // Load trending tracks
  loadTrendingTracks(api, container, player, handleTrackAction, createTrackRow);

  // Load new releases
  loadNewReleases(api, container, createAlbumCard, createTrackRow, player, handleTrackAction);
}

async function loadTrendingAlbums(api, container, createAlbumCard) {
  const grid = container.querySelector('#trending-albums-grid');
  if (!grid) return;

  try {
    // Search for trending/new albums
    const [result1, result2] = await Promise.allSettled([
      api.searchAlbums('top albums 2026'),
      api.searchAlbums('new albums 2026'),
    ]);

    const albums = [];
    const seenIds = new Set();

    const addAlbums = (result) => {
      if (result.status === 'fulfilled' && result.value?.items) {
        for (const album of result.value.items) {
          if (!seenIds.has(album.id)) {
            seenIds.add(album.id);
            albums.push(album);
          }
        }
      }
    };

    addAlbums(result1);
    addAlbums(result2);

    if (albums.length === 0) {
      grid.innerHTML = '<p class="empty-message">No trending albums available.</p>';
      return;
    }

    grid.innerHTML = albums.slice(0, 20).map(album => createAlbumCard(album)).join('');
  } catch (error) {
    console.error('[Hot & New] Failed to load trending albums:', error);
    grid.innerHTML = '<p class="empty-message">Failed to load trending albums.</p>';
  }
}

async function loadTrendingTracks(api, container, player, handleTrackAction, createTrackRow) {
  const list = container.querySelector('#trending-tracks-list');
  if (!list) return;

  try {
    const result = await api.searchTracks('top hits 2026');
    const tracks = result?.items || [];

    if (tracks.length === 0) {
      list.innerHTML = '<p class="empty-message">No trending tracks available.</p>';
      return;
    }

    list.innerHTML = tracks.slice(0, 10).map((track, index) =>
      createTrackRow(track, index, tracks)
    ).join('');
  } catch (error) {
    console.error('[Hot & New] Failed to load trending tracks:', error);
    list.innerHTML = '<p class="empty-message">Failed to load trending tracks.</p>';
  }
}

async function loadNewReleases(api, container, createAlbumCard, createTrackRow, player, handleTrackAction) {
  const albumGrid = container.querySelector('#new-albums-grid');
  const trackList = container.querySelector('#new-tracks-list');

  try {
    const [albumResult, trackResult] = await Promise.allSettled([
      api.searchAlbums('new 2026'),
      api.searchTracks('new 2026'),
    ]);

    // New Albums
    if (albumGrid) {
      const albums = albumResult.status === 'fulfilled' ? (albumResult.value?.items || []) : [];
      if (albums.length === 0) {
        albumGrid.innerHTML = '<p class="empty-message">No new albums available.</p>';
      } else {
        albumGrid.innerHTML = albums.slice(0, 20).map(album => createAlbumCard(album)).join('');
      }
    }

    // New Tracks
    if (trackList) {
      const tracks = trackResult.status === 'fulfilled' ? (trackResult.value?.items || []) : [];
      if (tracks.length === 0) {
        trackList.innerHTML = '<p class="empty-message">No new tracks available.</p>';
      } else {
        trackList.innerHTML = tracks.slice(0, 10).map((track, index) =>
          createTrackRow(track, index, tracks)
        ).join('');
      }
    }
  } catch (error) {
    console.error('[Hot & New] Failed to load new releases:', error);
    if (albumGrid) albumGrid.innerHTML = '<p class="empty-message">Failed to load new albums.</p>';
    if (trackList) trackList.innerHTML = '<p class="empty-message">Failed to load new tracks.</p>';
  }
}
