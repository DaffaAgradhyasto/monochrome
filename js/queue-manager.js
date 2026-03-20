// js/queue-manager.js
// Advanced queue management with save/load named queues
// Allows users to save their current queue as a named preset and restore it later

const STORAGE_KEY = 'monochrome-saved-queues-v1';
const MAX_SAVED_QUEUES = 50;
const MAX_QUEUE_NAME_LENGTH = 100;

let savedQueues = {};
let onQueueChangeCallbacks = [];

// Load saved queues from localStorage
function loadSavedQueues() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      savedQueues = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[QueueManager] Failed to load saved queues:', e);
    savedQueues = {};
  }
  return savedQueues;
}

// Persist saved queues to localStorage
function persistQueues() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedQueues));
  } catch (e) {
    console.warn('[QueueManager] Failed to persist queues:', e);
  }
}

// Notify listeners of queue changes
function notifyChange(action, queueName) {
  onQueueChangeCallbacks.forEach(cb => {
    try { cb({ action, queueName, queues: { ...savedQueues } }); }
    catch (e) { console.warn('[QueueManager] Callback error:', e); }
  });
}

// Initialize the queue manager
export function initQueueManager() {
  loadSavedQueues();
  console.log('[QueueManager] Initialized with', Object.keys(savedQueues).length, 'saved queues');
}

// Save the current queue with a name
export function saveQueue(name, tracks, metadata = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Queue name is required');
  }

  const trimmedName = name.trim().slice(0, MAX_QUEUE_NAME_LENGTH);
  if (!trimmedName) throw new Error('Queue name cannot be empty');

  // Check max limit
  const existingNames = Object.keys(savedQueues);
  if (!savedQueues[trimmedName] && existingNames.length >= MAX_SAVED_QUEUES) {
    throw new Error(`Maximum of ${MAX_SAVED_QUEUES} saved queues reached. Delete some to save more.`);
  }

  const queueData = {
    name: trimmedName,
    tracks: tracks.map(t => ({
      id: t.id,
      title: t.title || t.name || 'Unknown',
      artists: t.artists || t.artist || 'Unknown',
      album: t.album || '',
      duration: t.duration || 0,
      thumbnail: t.thumbnail || t.cover || '',
    })),
    trackCount: tracks.length,
    totalDuration: tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    createdAt: savedQueues[trimmedName]?.createdAt || Date.now(),
    updatedAt: Date.now(),
    description: metadata.description || '',
    tags: metadata.tags || [],
    autoSaved: metadata.autoSaved || false,
  };

  savedQueues[trimmedName] = queueData;
  persistQueues();
  notifyChange('save', trimmedName);

  return queueData;
}

// Load a saved queue by name
export function loadQueue(name) {
  const queue = savedQueues[name];
  if (!queue) {
    throw new Error(`Queue "${name}" not found`);
  }
  notifyChange('load', name);
  return { ...queue, tracks: [...queue.tracks] };
}

// Delete a saved queue
export function deleteQueue(name) {
  if (!savedQueues[name]) {
    throw new Error(`Queue "${name}" not found`);
  }
  delete savedQueues[name];
  persistQueues();
  notifyChange('delete', name);
}

// Rename a saved queue
export function renameQueue(oldName, newName) {
  if (!savedQueues[oldName]) {
    throw new Error(`Queue "${oldName}" not found`);
  }

  const trimmedNew = newName.trim().slice(0, MAX_QUEUE_NAME_LENGTH);
  if (!trimmedNew) throw new Error('New name cannot be empty');

  if (savedQueues[trimmedNew] && trimmedNew !== oldName) {
    throw new Error(`Queue "${trimmedNew}" already exists`);
  }

  const queue = savedQueues[oldName];
  queue.name = trimmedNew;
  queue.updatedAt = Date.now();

  if (trimmedNew !== oldName) {
    delete savedQueues[oldName];
  }
  savedQueues[trimmedNew] = queue;

  persistQueues();
  notifyChange('rename', trimmedNew);
}

// Get all saved queue names with metadata
export function listQueues(sortBy = 'updatedAt') {
  const queues = Object.values(savedQueues);

  switch (sortBy) {
    case 'name':
      queues.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'createdAt':
      queues.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'trackCount':
      queues.sort((a, b) => b.trackCount - a.trackCount);
      break;
    case 'updatedAt':
    default:
      queues.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
  }

  return queues.map(q => ({
    name: q.name,
    trackCount: q.trackCount,
    totalDuration: q.totalDuration,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    description: q.description,
    tags: q.tags,
    autoSaved: q.autoSaved,
  }));
}

// Search queues by name or tag
export function searchQueues(query) {
  if (!query) return listQueues();

  const lower = query.toLowerCase();
  return Object.values(savedQueues)
    .filter(q =>
      q.name.toLowerCase().includes(lower) ||
      q.description?.toLowerCase().includes(lower) ||
      q.tags?.some(t => t.toLowerCase().includes(lower)) ||
      q.tracks?.some(t =>
        t.title?.toLowerCase().includes(lower) ||
        t.artists?.toLowerCase().includes(lower)
      )
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(q => ({
      name: q.name,
      trackCount: q.trackCount,
      totalDuration: q.totalDuration,
      updatedAt: q.updatedAt,
    }));
}

// Merge two queues together
export function mergeQueues(name1, name2, newName) {
  const q1 = savedQueues[name1];
  const q2 = savedQueues[name2];
  if (!q1 || !q2) throw new Error('One or both queues not found');

  // Deduplicate by track ID
  const seen = new Set();
  const mergedTracks = [];
  for (const t of [...q1.tracks, ...q2.tracks]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      mergedTracks.push(t);
    }
  }

  return saveQueue(newName || `${name1} + ${name2}`, mergedTracks, {
    description: `Merged from "${name1}" and "${name2}"`,
  });
}

// Duplicate a queue
export function duplicateQueue(name, newName) {
  const queue = savedQueues[name];
  if (!queue) throw new Error(`Queue "${name}" not found`);

  const dupName = newName || `${name} (copy)`;
  return saveQueue(dupName, queue.tracks, {
    description: queue.description,
    tags: [...(queue.tags || [])],
  });
}

// Auto-save the current queue (called periodically or on changes)
export function autoSaveCurrentQueue(tracks) {
  if (!tracks || tracks.length === 0) return null;

  return saveQueue('__auto_save__', tracks, {
    description: 'Auto-saved queue',
    autoSaved: true,
  });
}

// Get the auto-saved queue
export function getAutoSavedQueue() {
  return savedQueues['__auto_save__'] || null;
}

// Export a queue as JSON
export function exportQueueAsJSON(name) {
  const queue = savedQueues[name];
  if (!queue) throw new Error(`Queue "${name}" not found`);

  const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `queue-${name.replace(/[^a-z0-9]/gi, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import a queue from JSON
export function importQueueFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.name || !Array.isArray(data.tracks)) {
      throw new Error('Invalid queue format');
    }
    return saveQueue(data.name, data.tracks, {
      description: data.description,
      tags: data.tags,
    });
  } catch (e) {
    throw new Error('Failed to import queue: ' + e.message);
  }
}

// Get queue statistics
export function getQueueStats() {
  const queues = Object.values(savedQueues).filter(q => !q.autoSaved);
  return {
    totalQueues: queues.length,
    totalTracks: queues.reduce((sum, q) => sum + q.trackCount, 0),
    totalDuration: queues.reduce((sum, q) => sum + q.totalDuration, 0),
    oldestQueue: queues.length > 0
      ? queues.reduce((oldest, q) => q.createdAt < oldest.createdAt ? q : oldest).name
      : null,
    newestQueue: queues.length > 0
      ? queues.reduce((newest, q) => q.createdAt > newest.createdAt ? q : newest).name
      : null,
    largestQueue: queues.length > 0
      ? queues.reduce((largest, q) => q.trackCount > largest.trackCount ? q : largest).name
      : null,
  };
}

// Register callback for queue changes
export function onQueueChange(callback) {
  if (typeof callback === 'function') {
    onQueueChangeCallbacks.push(callback);
  }
  return () => {
    onQueueChangeCallbacks = onQueueChangeCallbacks.filter(cb => cb !== callback);
  };
}

// Clear all saved queues
export function clearAllQueues(keepAutoSave = true) {
  const autoSave = keepAutoSave ? savedQueues['__auto_save__'] : null;
  savedQueues = {};
  if (autoSave) savedQueues['__auto_save__'] = autoSave;
  persistQueues();
  notifyChange('clearAll', null);
}

// Export for settings/UI integration
export const queueManagerSettings = {
  get queues() { return listQueues(); },
  get stats() { return getQueueStats(); },
  save: saveQueue,
  load: loadQueue,
  delete: deleteQueue,
  rename: renameQueue,
  search: searchQueues,
  merge: mergeQueues,
  duplicate: duplicateQueue,
  exportJSON: exportQueueAsJSON,
  importJSON: importQueueFromJSON,
  autoSave: autoSaveCurrentQueue,
  getAutoSaved: getAutoSavedQueue,
  clearAll: clearAllQueues,
  onChange: onQueueChange,
};

// Auto-initialize
initQueueManager();
