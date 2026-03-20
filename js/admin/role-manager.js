import { Databases, ID, Query } from 'appwrite';
import { client, auth } from '../accounts/config.js';

const APPWRITE_PROJECT_ID = 'fra-69ba589c0035145a5327';
const DATABASE_ID = 'monochrome-db';
const USER_ROLES_COLLECTION_ID = 'user_rolesuser_roles';

const ROLE_LEVELS = {
    guest: 0,
    user: 1,
    supporter: 2,
    moderator: 3,
    admin: 4,
    developer: 5,
};

const ROLE_PERMISSIONS = {
    guest: ['read_public'],
    user: ['read_public', 'create_playlist', 'change_settings', 'play_track'],
    supporter: ['read_public', 'create_playlist', 'change_settings', 'play_track', 'support_tools'],
    moderator: [
        'read_public',
        'create_playlist',
        'change_settings',
        'play_track',
        'moderate_content',
        'view_activity',
    ],
    admin: [
        'read_public',
        'create_playlist',
        'change_settings',
        'play_track',
        'moderate_content',
        'view_activity',
        'manage_users',
        'manage_roles',
        'view_analytics',
        'manage_content',
        'admin_action',
    ],
    developer: ['*'],
};

const SPECIAL_EMAIL = 'xarcers@proton.me';
const SPECIAL_ROLES = ['developer', 'admin', 'user', 'supporter'];

function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeRoles(roles) {
    const next = Array.isArray(roles) ? roles : [];
    const unique = [...new Set(next)].filter((role) => Object.prototype.hasOwnProperty.call(ROLE_LEVELS, role));
    return unique.length ? unique : ['guest'];
}

function buildPermissions(roles) {
    const normalized = normalizeRoles(roles);
    if (normalized.includes('developer')) return ['*'];
    return [...new Set(normalized.flatMap((role) => ROLE_PERMISSIONS[role] || []))];
}

class RoleManager {
    constructor() {
        this.databases = new Databases(client);
        this.projectId = APPWRITE_PROJECT_ID;
        this.databaseId = DATABASE_ID;
        this.collectionId = USER_ROLES_COLLECTION_ID;
    }

    get roleLevels() {
        return ROLE_LEVELS;
    }

    get collections() {
        return {
            userRoles: this.collectionId,
        };
    }

    getSpecialEmail() {
        return SPECIAL_EMAIL;
    }

    async getCurrentUser() {
        try {
            return await auth.get();
        } catch {
            return null;
        }
    }

    getHighestLevel(roles) {
        return normalizeRoles(roles).reduce((max, role) => Math.max(max, ROLE_LEVELS[role] ?? 0), 0);
    }

    async findRoleDocumentByUserId(userId) {
        if (!userId) return null;
        const { documents } = await this.databases.listDocuments(this.databaseId, this.collectionId, [
            Query.equal('user_id', userId),
            Query.limit(1),
        ]);
        return documents?.[0] || null;
    }

    async ensureSpecialEmailRole(user = null) {
        const currentUser = user || (await this.getCurrentUser());
        if (!currentUser?.email || currentUser.email.toLowerCase() !== SPECIAL_EMAIL) return null;

        const existing = await this.findRoleDocumentByUserId(currentUser.$id);
        if (existing) return existing;

        return this.setUserRoles(currentUser.$id, SPECIAL_ROLES, {
            email: currentUser.email,
            status: 'active',
            is_banned: false,
            allPermissions: true,
        });
    }

    async getUserRoles(userId) {
        if (!userId) {
            return {
                roles: ['guest'],
                permissions: ROLE_PERMISSIONS.guest,
                level: ROLE_LEVELS.guest,
                document: null,
            };
        }

        const currentUser = await this.getCurrentUser();
        if (currentUser) {
            await this.ensureSpecialEmailRole(currentUser);
        }

        const document = await this.findRoleDocumentByUserId(userId);
        if (!document) {
            return {
                roles: ['user'],
                permissions: ROLE_PERMISSIONS.user,
                level: ROLE_LEVELS.user,
                document: null,
            };
        }

        const roles = normalizeRoles(parseJsonArray(document.roles));
        const permissions = parseJsonArray(document.permissions);

        return {
            roles,
            permissions: permissions.length ? permissions : buildPermissions(roles),
            level: this.getHighestLevel(roles),
            document,
        };
    }

    async setUserRoles(userId, roles, options = {}) {
        if (!userId) throw new Error('userId is required');

        const normalizedRoles = normalizeRoles(roles);
        const permissions = options.allPermissions ? ['*'] : buildPermissions(normalizedRoles);

        const payload = {
            user_id: userId,
            email: options.email || '',
            roles: JSON.stringify(normalizedRoles),
            permissions: JSON.stringify(permissions),
            is_banned: !!options.is_banned,
            status: options.status || 'active',
            last_active: options.last_active || new Date().toISOString(),
            play_count: Number.isFinite(options.play_count) ? options.play_count : 0,
            device: options.device || 'unknown',
            updated_at: new Date().toISOString(),
        };

        const existing = await this.findRoleDocumentByUserId(userId);
        if (existing) {
            return this.databases.updateDocument(this.databaseId, this.collectionId, existing.$id, payload);
        }

        payload.created_at = new Date().toISOString();
        return this.databases.createDocument(this.databaseId, this.collectionId, ID.unique(), payload);
    }

    async hasPermission(userId, permission) {
        const roleData = await this.getUserRoles(userId);
        return roleData.permissions.includes('*') || roleData.permissions.includes(permission);
    }

    async checkRole(userId, minLevel) {
        const min = typeof minLevel === 'number' ? minLevel : ROLE_LEVELS[minLevel] ?? ROLE_LEVELS.guest;
        const roleData = await this.getUserRoles(userId);
        return roleData.level >= min;
    }
}

export { ROLE_LEVELS, ROLE_PERMISSIONS, DATABASE_ID, USER_ROLES_COLLECTION_ID, APPWRITE_PROJECT_ID };
export const roleManager = new RoleManager();
export const getUserRoles = (userId) => roleManager.getUserRoles(userId);
export const setUserRoles = (userId, roles) => roleManager.setUserRoles(userId, roles);
export const hasPermission = (userId, permission) => roleManager.hasPermission(userId, permission);
export const checkRole = (userId, minLevel) => roleManager.checkRole(userId, minLevel);
