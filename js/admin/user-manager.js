import { Databases, Query } from 'appwrite';
import { client, auth } from '../accounts/config.js';
import { roleManager, ROLE_LEVELS } from './role-manager.js';
import { logActivity } from './activity-log.js';

const DATABASE_ID = 'monochrome-db';
const USER_ROLES_COLLECTION_ID = 'user_rolesuser_roles';
const ASSIGNABLE_ROLES = ['guest', 'user', 'supporter', 'moderator', 'admin', 'developer'];

function parseArray(input) {
    if (Array.isArray(input)) return input;
    if (typeof input !== 'string') return [];
    try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export class UserManager {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.databases = new Databases(client);
        this.users = [];
        this.currentUser = null;
        this.currentUserRoleLevel = ROLE_LEVELS.guest;
    }

    async init() {
        this.currentUser = await auth.get();
        const roleData = await roleManager.getUserRoles(this.currentUser?.$id);
        this.currentUserRoleLevel = roleData.level;
        await this.loadUsers();
        this.render();
    }

    canModifyRoles() {
        return this.currentUserRoleLevel >= ROLE_LEVELS.admin;
    }

    async loadUsers() {
        const { documents } = await this.databases.listDocuments(DATABASE_ID, USER_ROLES_COLLECTION_ID, [
            Query.limit(500),
            Query.orderDesc('$updatedAt'),
        ]);

        this.users = (documents || []).map((doc) => ({
            ...doc,
            roleList: parseArray(doc.roles),
            permissionList: parseArray(doc.permissions),
            isBanned: !!doc.is_banned,
        }));
    }

    filterUsers(query, role, status) {
        const q = String(query || '').trim().toLowerCase();
        return this.users.filter((user) => {
            const emailMatch = !q || String(user.email || '').toLowerCase().includes(q);
            const roleMatch = !role || user.roleList.includes(role);
            const statusMatch = !status || (status === 'banned' ? user.isBanned : !user.isBanned);
            return emailMatch && roleMatch && statusMatch;
        });
    }

    async updateUserRoles(userId, nextRoles) {
        if (!this.canModifyRoles()) return;
        await roleManager.setUserRoles(userId, nextRoles);
        await logActivity(this.currentUser?.$id, 'admin_action', {
            type: 'set_roles',
            targetUser: userId,
            roles: nextRoles,
        });
        await this.loadUsers();
        this.renderTable();
    }

    async toggleBan(user) {
        if (!this.canModifyRoles()) return;
        await this.databases.updateDocument(DATABASE_ID, USER_ROLES_COLLECTION_ID, user.$id, {
            is_banned: !user.isBanned,
            updated_at: new Date().toISOString(),
        });
        await logActivity(this.currentUser?.$id, 'admin_action', {
            type: user.isBanned ? 'unban_user' : 'ban_user',
            targetUser: user.user_id,
        });
        await this.loadUsers();
        this.renderTable();
    }

    render() {
        this.rootEl.innerHTML = `
            <div class="admin-card">
                <div class="admin-toolbar">
                    <input id="admin-user-search" type="search" placeholder="Search by email" />
                    <select id="admin-user-role-filter">
                        <option value="">All roles</option>
                        ${ASSIGNABLE_ROLES.map((role) => `<option value="${role}">${role}</option>`).join('')}
                    </select>
                    <select id="admin-user-status-filter">
                        <option value="">All status</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                    </select>
                </div>
                <div id="admin-user-table-wrap"></div>
            </div>
        `;

        ['admin-user-search', 'admin-user-role-filter', 'admin-user-status-filter'].forEach((id) => {
            this.rootEl.querySelector(`#${id}`)?.addEventListener('input', () => this.renderTable());
            this.rootEl.querySelector(`#${id}`)?.addEventListener('change', () => this.renderTable());
        });

        this.renderTable();
    }

    renderTable() {
        const search = this.rootEl.querySelector('#admin-user-search')?.value || '';
        const role = this.rootEl.querySelector('#admin-user-role-filter')?.value || '';
        const status = this.rootEl.querySelector('#admin-user-status-filter')?.value || '';
        const rows = this.filterUsers(search, role, status);

        const wrap = this.rootEl.querySelector('#admin-user-table-wrap');
        if (!wrap) return;

        wrap.innerHTML = `
            <div class="admin-table-scroll">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Roles</th>
                            <th>Status</th>
                            <th>Last active</th>
                            <th>Play count</th>
                            <th>Device</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                            .map(
                                (user) => `
                            <tr>
                                <td>${user.email || '-'}</td>
                                <td>${user.roleList.join(', ') || 'guest'}</td>
                                <td>${user.isBanned ? 'Banned' : 'Active'}</td>
                                <td>${user.last_active || '-'}</td>
                                <td>${Number(user.play_count || 0)}</td>
                                <td>${user.device || '-'}</td>
                                <td>
                                    <select data-role-select="${user.user_id}" ${!this.canModifyRoles() ? 'disabled' : ''}>
                                        ${ASSIGNABLE_ROLES.map((r) => `<option value="${r}" ${user.roleList.includes(r) ? 'selected' : ''}>${r}</option>`).join('')}
                                    </select>
                                    <button data-ban-toggle="${user.$id}" class="btn-secondary" ${!this.canModifyRoles() ? 'disabled' : ''}>
                                        ${user.isBanned ? 'Unban' : 'Ban'}
                                    </button>
                                </td>
                            </tr>
                        `
                            )
                            .join('')}
                    </tbody>
                </table>
            </div>
        `;

        wrap.querySelectorAll('[data-role-select]').forEach((select) => {
            select.addEventListener('change', async (event) => {
                const userId = event.target.getAttribute('data-role-select');
                const roleValue = event.target.value;
                await this.updateUserRoles(userId, [roleValue]);
            });
        });

        wrap.querySelectorAll('[data-ban-toggle]').forEach((button) => {
            button.addEventListener('click', async (event) => {
                const docId = event.target.getAttribute('data-ban-toggle');
                const user = this.users.find((entry) => entry.$id === docId);
                if (!user) return;
                await this.toggleBan(user);
            });
        });
    }
}
