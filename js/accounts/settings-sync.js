// js/accounts/settings-sync.js
// Auto-syncs all monochrome settings to PocketBase cloud
import { syncManager } from './pocketbase.js';
import { authManager } from './auth.js';

let _syncTimer = null;

function collectAllSettings() {
    const settings = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('monochrome-')) {
            try {
                settings[key] = JSON.parse(localStorage.getItem(key));
            } catch {
                settings[key] = localStorage.getItem(key);
            }
        }
    }
    // Also capture non-prefixed settings keys
    const extraKeys = [
        'playback-quality', 'filename-template',
        'zip-folder-template', 'lyricsRomajiMode',
        'community-theme', 'custom_theme_css'
    ];
    extraKeys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) settings[key] = val;
    });
    return settings;
}

function syncSettingsToCloud() {
    if (!authManager.user) return;
    const settings = collectAllSettings();
    syncManager.syncSettings(settings).catch(err => {
        console.error('[SettingsSync] Failed to sync:', err);
    });
}

function debouncedSync() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncSettingsToCloud, 2000);
}

// Intercept localStorage.setItem to auto-trigger sync
const _originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
    _originalSetItem(key, value);
    if (key && (key.startsWith('monochrome-') ||
        ['playback-quality', 'filename-template',
         'zip-folder-template', 'lyricsRomajiMode'].includes(key))) {
        debouncedSync();
    }
};

console.log('[SettingsSync] Cloud settings sync initialized');

export { syncSettingsToCloud, collectAllSettings };
