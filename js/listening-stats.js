//js/listening-stats.js
// Listening Statistics Module - Tracks play counts, listening time, and generates insights
// Uses IndexedDB for persistent storage via the existing db.js module

import { db } from './db.js';

const STATS_STORE = 'listening-stats';
const STATS_VERSION = 1;

// In-memory session tracking
let sessionStartTime = null;
let currentTrackId = null;
let totalSessionTime = 0;

/**
 * Initialize the listening stats database store
 */
export async function initListeningStats() {
  try {
    const existingStats = await getStats();
    if (!existingStats) {
      await db.setItem(STATS_STORE, {
        version: STATS_VERSION,
        tracks: {},
        artists: {},
        albums: {},
        dailyListening: {},
        totalListeningMs: 0,
        totalTracksPlayed: 0,
        createdAt: Date.now(),
      });
    }
  } catch {
    console.warn('[listening-stats] Failed to initialize stats store');
  }
}

/**
 * Get current stats from storage
 */
async function getStats() {
  try {
    return await db.getItem(STATS_STORE);
  } catch {
    return null;
  }
}

/**
 * Record that a track has started playing
 */
export function onTrackStart(trackData) {
  if (!trackData?.id) return;

  sessionStartTime = Date.now();
  currentTrackId = trackData.id;

  // Fire-and-forget the async stats update
  recordTrackPlay(trackData).catch(() => {});
}

/**
 * Record that the current track has ended or been skipped
 */
export function onTrackEnd() {
  if (!sessionStartTime || !currentTrackId) return;

  const listenedMs = Date.now() - sessionStartTime;
  totalSessionTime += listenedMs;

  // Update listening duration async
  updateListeningDuration(currentTrackId, listenedMs).catch(() => {});

  sessionStartTime = null;
  currentTrackId = null;
}

/**
 * Record a track play event
 */
async function recordTrackPlay(trackData) {
  const stats = await getStats();
  if (!stats) return;

  const { id, title, artists, album, duration } = trackData;
  const today = new Date().toISOString().split('T')[0];

  // Update track stats
  if (!stats.tracks[id]) {
    stats.tracks[id] = {
      title: title || 'Unknown',
      artists: artists || 'Unknown',
      album: album || 'Unknown',
      playCount: 0,
      totalListenedMs: 0,
      duration: duration || 0,
      firstPlayed: Date.now(),
      lastPlayed: Date.now(),
    };
  }
  stats.tracks[id].playCount++;
  stats.tracks[id].lastPlayed = Date.now();
  stats.tracks[id].title = title || stats.tracks[id].title;

  // Update artist stats
  const artistName = artists || 'Unknown';
  if (!stats.artists[artistName]) {
    stats.artists[artistName] = {
      playCount: 0,
      totalListenedMs: 0,
      firstPlayed: Date.now(),
    };
  }
  stats.artists[artistName].playCount++;

  // Update album stats
  const albumName = album || 'Unknown';
  if (!stats.albums[albumName]) {
    stats.albums[albumName] = {
      artists: artistName,
      playCount: 0,
      totalListenedMs: 0,
      firstPlayed: Date.now(),
    };
  }
  stats.albums[albumName].playCount++;

  // Update daily listening
  if (!stats.dailyListening[today]) {
    stats.dailyListening[today] = { playCount: 0, totalMs: 0 };
  }
  stats.dailyListening[today].playCount++;

  stats.totalTracksPlayed++;

  await db.setItem(STATS_STORE, stats);
}

/**
 * Update the total listening duration for a track
 */
async function updateListeningDuration(trackId, durationMs) {
  const stats = await getStats();
  if (!stats) return;

  const today = new Date().toISOString().split('T')[0];

  if (stats.tracks[trackId]) {
    stats.tracks[trackId].totalListenedMs += durationMs;
  }

  // Also update artist and daily totals
  const track = stats.tracks[trackId];
  if (track) {
    const artistName = track.artists;
    if (stats.artists[artistName]) {
      stats.artists[artistName].totalListenedMs += durationMs;
    }
    const albumName = track.album;
    if (stats.albums[albumName]) {
      stats.albums[albumName].totalListenedMs += durationMs;
    }
  }

  if (stats.dailyListening[today]) {
    stats.dailyListening[today].totalMs += durationMs;
  }

  stats.totalListeningMs += durationMs;

  await db.setItem(STATS_STORE, stats);
}

/**
 * Get top tracks sorted by play count
 */
export async function getTopTracks(limit = 10) {
  const stats = await getStats();
  if (!stats) return [];

  return Object.entries(stats.tracks)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * Get top artists sorted by play count
 */
export async function getTopArtists(limit = 10) {
  const stats = await getStats();
  if (!stats) return [];

  return Object.entries(stats.artists)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * Get top albums sorted by play count
 */
export async function getTopAlbums(limit = 10) {
  const stats = await getStats();
  if (!stats) return [];

  return Object.entries(stats.albums)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * Get total listening time formatted as a human-readable string
 */
export async function getTotalListeningTime() {
  const stats = await getStats();
  if (!stats) return '0 minutes';

  const totalMs = stats.totalListeningMs + totalSessionTime;
  return formatDuration(totalMs);
}

/**
 * Get listening stats overview for display
 */
export async function getStatsOverview() {
  const stats = await getStats();
  if (!stats) {
    return {
      totalTracks: 0,
      totalArtists: 0,
      totalAlbums: 0,
      totalPlays: 0,
      totalListeningTime: '0 minutes',
      streakDays: 0,
    };
  }

  const uniqueTracks = Object.keys(stats.tracks).length;
  const uniqueArtists = Object.keys(stats.artists).length;
  const uniqueAlbums = Object.keys(stats.albums).length;
  const streak = calculateStreak(stats.dailyListening);

  return {
    totalTracks: uniqueTracks,
    totalArtists: uniqueArtists,
    totalAlbums: uniqueAlbums,
    totalPlays: stats.totalTracksPlayed,
    totalListeningTime: formatDuration(stats.totalListeningMs),
    streakDays: streak,
  };
}

/**
 * Get daily listening data for the last N days (for chart display)
 */
export async function getDailyListeningData(days = 30) {
  const stats = await getStats();
  if (!stats) return [];

  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = stats.dailyListening[dateStr] || { playCount: 0, totalMs: 0 };

    result.push({
      date: dateStr,
      playCount: dayData.playCount,
      minutesListened: Math.round(dayData.totalMs / 60000),
    });
  }

  return result;
}

/**
 * Export all stats as JSON
 */
export async function exportStatsAsJSON() {
  const stats = await getStats();
  if (!stats) return null;

  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `monochrome-stats-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export stats as CSV
 */
export async function exportStatsAsCSV() {
  const stats = await getStats();
  if (!stats) return null;

  const rows = [['Track', 'Artist', 'Album', 'Play Count', 'Total Listened (min)', 'First Played', 'Last Played']];

  for (const [, data] of Object.entries(stats.tracks)) {
    rows.push([
      `"${(data.title || '').replace(/"/g, '""')}"`,
      `"${(data.artists || '').replace(/"/g, '""')}"`,
      `"${(data.album || '').replace(/"/g, '""')}"`,
      data.playCount,
      Math.round(data.totalListenedMs / 60000),
      new Date(data.firstPlayed).toISOString(),
      new Date(data.lastPlayed).toISOString(),
    ]);
  }

  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `monochrome-stats-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Clear all listening stats
 */
export async function clearStats() {
  await db.removeItem(STATS_STORE);
  totalSessionTime = 0;
  sessionStartTime = null;
  currentTrackId = null;
}

// === Helper Functions ===

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function calculateStreak(dailyListening) {
  const today = new Date();
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (dailyListening[dateStr] && dailyListening[dateStr].playCount > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}
