import { Databases, ID, Query } from 'appwrite';
import { client } from '../accounts/config.js';

const DATABASE_ID = 'monochrome-db';
const ACTIVITY_COLLECTION_ID = 'activity_logactivity_log';
const ALLOWED_ACTIONS = new Set([
    'login',
    'logout',
    'play_track',
    'create_playlist',
    'change_settings',
    'admin_action',
    'session_end',
    'visibility_hidden',
]);

function asJsonString(input) {
    try {
        return JSON.stringify(input ?? {});
    } catch {
        return JSON.stringify({ note: 'unserializable_details' });
    }
}

function parseDetails(details) {
    if (typeof details !== 'string') return details || {};
    try {
        return JSON.parse(details);
    } catch {
        return {};
    }
}

class ActivityLog {
    constructor() {
        this.databases = new Databases(client);
    }

    async logActivity(userId, action, details = {}) {
        if (!ALLOWED_ACTIONS.has(action)) {
            throw new Error(`Unsupported action: ${action}`);
        }

        return this.databases.createDocument(DATABASE_ID, ACTIVITY_COLLECTION_ID, ID.unique(), {
            user_id: userId || 'anonymous',
            action,
            details: asJsonString(details),
            created_at: new Date().toISOString(),
        });
    }

    async getRecentActivity(limit = 50) {
        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 250);
        const { documents } = await this.databases.listDocuments(DATABASE_ID, ACTIVITY_COLLECTION_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(safeLimit),
        ]);

        return (documents || []).map((item) => ({
            ...item,
            detailsObject: parseDetails(item.details),
        }));
    }

    async getActivityByUser(userId) {
        if (!userId) return [];

        const { documents } = await this.databases.listDocuments(DATABASE_ID, ACTIVITY_COLLECTION_ID, [
            Query.equal('user_id', userId),
            Query.orderDesc('$createdAt'),
            Query.limit(250),
        ]);

        return (documents || []).map((item) => ({
            ...item,
            detailsObject: parseDetails(item.details),
        }));
    }

    bindAutoLogging(userId = 'anonymous') {
        window.addEventListener('pagehide', () => {
            const pending = this.logActivity(userId || 'anonymous', 'session_end', { source: 'pagehide' });
            void pending;
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'hidden') return;
            const pending = this.logActivity(userId || 'anonymous', 'visibility_hidden', { source: 'visibility_hidden' });
            void pending;
        });
    }
}

export const activityLog = new ActivityLog();
export const logActivity = (userId, action, details) => activityLog.logActivity(userId, action, details);
export const getRecentActivity = (limit) => activityLog.getRecentActivity(limit);
export const getActivityByUser = (userId) => activityLog.getActivityByUser(userId);
