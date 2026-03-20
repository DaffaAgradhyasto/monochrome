//js/history-export.js
// Playback History Export Module
// Allows users to export their recently played tracks as JSON or CSV

import { db } from './db.js';
import { showNotification } from './utils.js';

const HISTORY_STORE = 'recently-played';

/**
 * Get recently played tracks from the database
 */
async function getRecentlyPlayed() {
  try {
    const history = await db.getItem(HISTORY_STORE);
    return history || [];
  } catch {
    console.warn('[history-export] Failed to read history');
    return [];
  }
}

/**
 * Export playback history as JSON file
 */
export async function exportHistoryAsJSON() {
  const history = await getRecentlyPlayed();

  if (!history.length) {
    showNotification('No playback history to export', 'error');
    return;
  }

  const exportData = {
    exportDate: new Date().toISOString(),
    source: 'Monochrome Music Player',
    totalTracks: history.length,
    tracks: history.map((track) => ({
      id: track.id,
      title: track.title || 'Unknown',
      artists: track.artists || track.artist || 'Unknown',
      album: track.album || 'Unknown',
      duration: track.duration || 0,
      playedAt: track.playedAt || track.timestamp || null,
      quality: track.quality || null,
    })),
  };

  downloadFile(
    JSON.stringify(exportData, null, 2),
    `monochrome-history-${getDateString()}.json`,
    'application/json',
  );

  showNotification(`Exported ${history.length} tracks as JSON`, 'success');
}

/**
 * Export playback history as CSV file
 */
export async function exportHistoryAsCSV() {
  const history = await getRecentlyPlayed();

  if (!history.length) {
    showNotification('No playback history to export', 'error');
    return;
  }

  const headers = ['Title', 'Artist', 'Album', 'Duration (s)', 'Played At', 'Quality'];
  const rows = history.map((track) => [
    escapeCSV(track.title || 'Unknown'),
    escapeCSV(track.artists || track.artist || 'Unknown'),
    escapeCSV(track.album || 'Unknown'),
    track.duration || 0,
    track.playedAt || track.timestamp || '',
    track.quality || '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  downloadFile(
    csv,
    `monochrome-history-${getDateString()}.csv`,
    'text/csv',
  );

  showNotification(`Exported ${history.length} tracks as CSV`, 'success');
}

/**
 * Export playback history as M3U playlist format
 */
export async function exportHistoryAsM3U() {
  const history = await getRecentlyPlayed();

  if (!history.length) {
    showNotification('No playback history to export', 'error');
    return;
  }

  const lines = ['#EXTM3U', `#PLAYLIST:Monochrome History - ${getDateString()}`];

  for (const track of history) {
    const title = track.title || 'Unknown';
    const artists = track.artists || track.artist || 'Unknown';
    const duration = Math.round(track.duration || 0);

    lines.push(`#EXTINF:${duration},${artists} - ${title}`);
    // Use the track URL if available, otherwise use the track ID
    const trackUrl = track.url || `https://monochrome-music-player.vercel.app/track/${track.id}`;
    lines.push(trackUrl);
  }

  downloadFile(
    lines.join('\n'),
    `monochrome-history-${getDateString()}.m3u`,
    'audio/mpegurl',
  );

  showNotification(`Exported ${history.length} tracks as M3U playlist`, 'success');
}

/**
 * Get a summary of playback history
 */
export async function getHistorySummary() {
  const history = await getRecentlyPlayed();

  if (!history.length) {
    return {
      totalTracks: 0,
      uniqueTracks: 0,
      uniqueArtists: 0,
      uniqueAlbums: 0,
      totalDurationMs: 0,
    };
  }

  const uniqueTracks = new Set(history.map((t) => t.id)).size;
  const uniqueArtists = new Set(
    history.map((t) => t.artists || t.artist || 'Unknown'),
  ).size;
  const uniqueAlbums = new Set(
    history.map((t) => t.album || 'Unknown'),
  ).size;
  const totalDurationMs = history.reduce(
    (sum, t) => sum + (t.duration || 0) * 1000,
    0,
  );

  return {
    totalTracks: history.length,
    uniqueTracks,
    uniqueArtists,
    uniqueAlbums,
    totalDurationMs,
  };
}

/**
 * Clear playback history
 */
export async function clearHistory() {
  try {
    await db.removeItem(HISTORY_STORE);
    showNotification('Playback history cleared', 'success');
  } catch {
    showNotification('Failed to clear history', 'error');
  }
}

// === Helper Functions ===

function escapeCSV(str) {
  if (typeof str !== 'string') return str;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getDateString() {
  return new Date().toISOString().split('T')[0];
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
