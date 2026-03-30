import { queueManager } from './storage.js';
import { syncManager } from './accounts/appwrite-sync.js';
import { authManager } from './accounts/auth.js';

const DEVICE_ID_KEY = 'monochrome-device-id-v1';
const SYNC_ENABLED_KEY = 'monochrome-queue-sync-v1';
const LAST_SYNC_KEY = 'monochrome-queue-sync-last-v1';
const SYNC_INTERVAL = 30000;
const DEBOUNCE_DELAY = 500;

let autoSyncInterval = null;
let _isSyncing = false;
let debounceTimer = null;

function debounce(func, wait) {
    return function (...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), wait);
    };
}

export const queueSyncManager = {
    _isSyncing: false,

    isEnabled() {
        return localStorage.getItem(SYNC_ENABLED_KEY) === 'true';
    },

    setEnabled(enabled) {
        localStorage.setItem(SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
    },

    isSyncing() {
        return this._isSyncing;
    },

    getLastSyncTimestamp() {
        const ts = localStorage.getItem(LAST_SYNC_KEY);
        return ts ? parseInt(ts, 10) : null;
    },

    setLastSyncTimestamp(timestamp) {
        localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
    },

    getDeviceId() {
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    },

    getQueueHash(queueState) {
        if (!queueState || !queueState.queue) return '';
        const minimal = this.minifyQueueState(queueState);
        const str = JSON.stringify(minimal);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    },

    minifyQueueState(queueState) {
        if (!queueState) return null;
        return {
            queue:
                queueState.queue?.map((track) => ({
                    id: track.id,
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    duration: track.duration,
                })) || [],
            shuffledQueue:
                queueState.shuffledQueue?.map((track) => ({
                    id: track.id,
                })) || [],
            originalQueueBeforeShuffle:
                queueState.originalQueueBeforeShuffle?.map((track) => ({
                    id: track.id,
                })) || [],
            currentQueueIndex: queueState.currentQueueIndex,
            shuffleActive: queueState.shuffleActive,
            repeatMode: queueState.repeatMode,
        };
    },

    async syncToCloud(queueState) {
        if (!this.isEnabled()) {
            console.log('Queue sync is disabled');
            return null;
        }

        if (!authManager.isAuthenticated()) {
            console.log('User not authenticated, skipping queue sync');
            return null;
        }

        const user = authManager.user;
        if (!user || !user.$id) {
            console.log('No user ID found');
            return null;
        }

        try {
            const minified = this.minifyQueueState(queueState);
            const hash = this.getQueueHash(queueState);

            const payload = {
                user_id: user.$id,
                queue_sync: JSON.stringify({
                    queue: minified,
                    hash: hash,
                    timestamp: Date.now(),
                    deviceId: this.getDeviceId(),
                }),
            };

            await syncManager.updateUserData(payload);
            this.setLastSyncTimestamp(Date.now());
            return true;
        } catch (error) {
            console.error('Failed to sync queue to cloud:', error);
            window.dispatchEvent(new CustomEvent('queue-sync-error', { detail: { error } }));
            return false;
        }
    },

    async fetchFromCloud() {
        if (!this.isEnabled()) {
            return null;
        }

        if (!authManager.isAuthenticated()) {
            return null;
        }

        try {
            const user = await syncManager.getUserData();
            if (user && user.queue_sync) {
                return JSON.parse(user.queue_sync);
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch queue from cloud:', error);
            return null;
        }
    },

    async syncQueue(player) {
        if (!this.isEnabled()) {
            return;
        }

        if (!authManager.isAuthenticated()) {
            return;
        }

        if (!navigator.onLine) {
            console.log('Offline, skipping queue sync');
            return;
        }

        if (this._isSyncing) {
            console.log('Sync already in progress');
            return;
        }

        this._isSyncing = true;
        window.dispatchEvent(new CustomEvent('queue-sync-start'));

        try {
            const currentQueue = queueManager.getQueue();
            const currentHash = this.getQueueHash(currentQueue);

            const cloudData = await this.fetchFromCloud();

            if (!cloudData) {
                if (currentQueue && currentQueue.queue && currentQueue.queue.length > 0) {
                    await this.syncToCloud(currentQueue);
                }
                window.dispatchEvent(new CustomEvent('queue-sync-complete', { detail: { synced: true } }));
                return;
            }

            const cloudQueue = cloudData.queue;
            const cloudHash = cloudData.hash;
            const cloudTimestamp = cloudData.timestamp;
            const cloudDeviceId = cloudData.deviceId;
            const localDeviceId = this.getDeviceId();

            if (cloudHash === currentHash) {
                console.log('Queue hashes match, no sync needed');
                window.dispatchEvent(new CustomEvent('queue-sync-complete', { detail: { synced: false } }));
                return;
            }

            if (cloudDeviceId === localDeviceId) {
                console.log('Cloud data is from same device, using local');
                await this.syncToCloud(currentQueue);
                window.dispatchEvent(new CustomEvent('queue-sync-complete', { detail: { synced: true } }));
                return;
            }

            const localTimestamp = this.getLastSyncTimestamp() || 0;

            let resolvedQueue = null;

            if (cloudTimestamp > localTimestamp) {
                resolvedQueue = cloudQueue;
                console.log('Using cloud queue (newer)');
            } else if (currentQueue && currentQueue.queue && currentQueue.queue.length > 0) {
                resolvedQueue = currentQueue;
                await this.syncToCloud(currentQueue);
                console.log('Using local queue (newer or same)');
                window.dispatchEvent(new CustomEvent('queue-sync-complete', { detail: { synced: true } }));
                return;
            } else {
                resolvedQueue = cloudQueue;
            }

            if (resolvedQueue && player) {
                const {
                    queue,
                    shuffledQueue,
                    originalQueueBeforeShuffle,
                    currentQueueIndex,
                    shuffleActive,
                    repeatMode,
                } = resolvedQueue;

                if (queue && queue.length > 0) {
                    player.queue = queue;
                    player.shuffledQueue = shuffledQueue || [];
                    player.originalQueueBeforeShuffle = originalQueueBeforeShuffle || [];
                    player.currentQueueIndex = currentQueueIndex || 0;
                    player.shuffleActive = shuffleActive || false;
                    player.repeatMode = repeatMode || 'none';

                    queueManager.saveQueue(player.getState ? player.getState() : player);

                    window.dispatchEvent(
                        new CustomEvent('queue-sync-complete', {
                            detail: { synced: true, source: cloudDeviceId === localDeviceId ? 'local' : 'cloud' },
                        })
                    );
                }
            }
        } catch (error) {
            console.error('Queue sync failed:', error);
            window.dispatchEvent(new CustomEvent('queue-sync-error', { detail: { error } }));
        } finally {
            this._isSyncing = false;
        }
    },

    setupAutoSync(player) {
        this.cleanup();

        if (!this.isEnabled()) {
            return;
        }

        const debouncedSync = debounce(() => {
            this.syncQueue(player);
        }, DEBOUNCE_DELAY);

        autoSyncInterval = setInterval(() => {
            if (this.isEnabled() && !this._isSyncing) {
                debouncedSync();
            }
        }, SYNC_INTERVAL);

        window.addEventListener('online', debouncedSync);
    },

    cleanup() {
        if (autoSyncInterval) {
            clearInterval(autoSyncInterval);
            autoSyncInterval = null;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    },
};

export default queueSyncManager;
