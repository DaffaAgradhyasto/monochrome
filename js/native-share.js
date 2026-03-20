//js/native-share.js
// Native Share API Integration - Uses the Web Share API for native device sharing
// Falls back to clipboard copy on unsupported browsers

import { getShareUrl, getTrackTitle, getTrackArtists, showNotification } from './utils.js';

/**
 * Check if the Web Share API is available
 */
export function isNativeShareSupported() {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Share the currently playing track using the native share dialog
 * Falls back to copying the URL to clipboard if not supported
 */
export async function shareCurrentTrack(trackData) {
  if (!trackData) {
    showNotification('No track is currently playing', 'error');
    return false;
  }

  const title = getTrackTitle(trackData) || 'Unknown Track';
  const artists = getTrackArtists(trackData) || 'Unknown Artist';
  const shareUrl = getShareUrl(trackData);

  const shareData = {
    title: `${title} - ${artists}`,
    text: `Listen to "${title}" by ${artists} on Monochrome`,
    url: shareUrl,
  };

  if (isNativeShareSupported()) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      // User cancelled the share dialog - not an error
      if (err.name === 'AbortError') return false;
      // Fall through to clipboard fallback
      console.warn('[native-share] Share API failed, falling back to clipboard:', err);
    }
  }

  // Fallback: copy to clipboard
  return copyToClipboard(shareUrl, `${title} - ${artists}`);
}

/**
 * Share an album
 */
export async function shareAlbum(albumData) {
  if (!albumData) return false;

  const title = albumData.title || 'Unknown Album';
  const artists = albumData.artists || albumData.artist || 'Unknown Artist';
  const url = `${window.location.origin}/album/${albumData.id}`;

  const shareData = {
    title: `${title} - ${artists}`,
    text: `Check out "${title}" by ${artists} on Monochrome`,
    url,
  };

  if (isNativeShareSupported()) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  return copyToClipboard(url, `${title} - ${artists}`);
}

/**
 * Share a playlist
 */
export async function sharePlaylist(playlistData) {
  if (!playlistData) return false;

  const title = playlistData.title || 'Playlist';
  const url = `${window.location.origin}/playlist/${playlistData.id}`;

  const shareData = {
    title,
    text: `Check out this playlist: "${title}" on Monochrome`,
    url,
  };

  if (isNativeShareSupported()) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  return copyToClipboard(url, title);
}

/**
 * Share an artist profile
 */
export async function shareArtist(artistData) {
  if (!artistData) return false;

  const name = artistData.name || 'Unknown Artist';
  const url = `${window.location.origin}/artist/${artistData.id}`;

  const shareData = {
    title: name,
    text: `Check out ${name} on Monochrome`,
    url,
  };

  if (isNativeShareSupported()) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  return copyToClipboard(url, name);
}

/**
 * Generic share with custom data
 */
export async function shareCustom({ title, text, url }) {
  if (isNativeShareSupported()) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  return copyToClipboard(url || text, title);
}

/**
 * Copy text to clipboard with notification
 */
async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification(
      label ? `Link copied: ${label}` : 'Link copied to clipboard',
      'success',
    );
    return true;
  } catch {
    // Final fallback: use deprecated execCommand
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showNotification('Link copied to clipboard', 'success');
      return true;
    } catch {
      showNotification('Failed to copy link', 'error');
      return false;
    }
  }
}
