import { Databases, Query } from 'appwrite';
import { client, auth } from '../accounts/config.js';
import { roleManager, ROLE_LEVELS } from './role-manager.js';
import { activityLog, getRecentActivity } from './activity-log.js';
import { UserManager } from './user-manager.js';
import { AdminAnalytics } from './analytics.js';
import { ContentControl } from './content-control.js';

const DATABASE_ID = 'monochrome-db';
const USER_ROLES_COLLECTION_ID = 'user_rolesuser_roles';
const ACTIVITY_COLLECTION_ID = 'activity_logactivity_log';

class AdminDashboard {
    constructor() {
        this.databases = new Databases(client);
        this.currentUser = null;
        this.roleInfo = null;
        this.modules = {};
        this.tabRoot = null;
        this.contentRoot = null;
    }

    async ensureAccess() {
        this.currentUser = await auth.get();
        this.roleInfo = await roleManager.getUserRoles(this.currentUser.$id);

        if (this.roleInfo.level < ROLE_LEVELS.admin) {
            window.location.replace('/');
            return false;
        }

        await roleManager.ensureSpecialEmailRole(this.currentUser);
        return true;
    }

    async loadOverviewStats() {
        const [usersResult, activityResult] = await Promise.all([
            this.databases.listDocuments(DATABASE_ID, USER_ROLES_COLLECTION_ID, [Query.limit(1)]),
            this.databases.listDocuments(DATABASE_ID, ACTIVITY_COLLECTION_ID, [Query.limit(500)]),
        ]);

        const activities = activityResult.documents || [];
        const today = new Date().toISOString().slice(0, 10);

        const totalUsers = usersResult.total || 0;
        const activeToday = activities.filter((item) => String(item.$createdAt || '').slice(0, 10) === today).length;
        const totalStreams = activities.filter((item) => item.action === 'play_track').length;
        const errorCount = activities.filter((item) => item.action === 'error').length;

        return { totalUsers, activeToday, totalStreams, errorCount };
    }

    renderShell() {
        this.tabRoot = document.getElementById('admin-tab-nav');
        this.contentRoot = document.getElementById('admin-tab-content');

        const tabs = ['overview', 'users', 'activity', 'content', 'analytics', 'system'];

        this.tabRoot.innerHTML = tabs
            .map(
                (tab) =>
                    `<button class="admin-tab ${tab === 'overview' ? 'active' : ''}" data-tab="${tab}">${tab[0].toUpperCase()}${tab.slice(1)}</button>`
            )
            .join('');

        this.tabRoot.querySelectorAll('.admin-tab').forEach((button) => {
            button.addEventListener('click', () => this.showTab(button.dataset.tab));
        });
    }

    async showTab(tab) {
        this.tabRoot.querySelectorAll('.admin-tab').forEach((button) => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });

        if (tab === 'overview') {
            const stats = await this.loadOverviewStats();
            this.contentRoot.innerHTML = `
                <div class="admin-grid">
                    <div class="admin-card"><h3>Total Users</h3><p class="admin-kpi">${stats.totalUsers}</p></div>
                    <div class="admin-card"><h3>Active Today</h3><p class="admin-kpi">${stats.activeToday}</p></div>
                    <div class="admin-card"><h3>Total Streams</h3><p class="admin-kpi">${stats.totalStreams}</p></div>
                    <div class="admin-card"><h3>Error Count</h3><p class="admin-kpi">${stats.errorCount}</p></div>
                </div>
            `;
            return;
        }

        if (tab === 'users') {
            this.contentRoot.innerHTML = '<div id="admin-users-pane"></div>';
            this.modules.userManager = new UserManager(document.getElementById('admin-users-pane'));
            await this.modules.userManager.init();
            return;
        }

        if (tab === 'activity') {
            const logs = await getRecentActivity(100);
            this.contentRoot.innerHTML = `
                <div class="admin-card">
                    <h3>Recent Activity</h3>
                    <div class="admin-toolbar">
                        <input id="admin-activity-filter" type="search" placeholder="Filter by action/user" />
                    </div>
                    <div id="admin-activity-list" class="admin-simple-list"></div>
                </div>
            `;

            const list = this.contentRoot.querySelector('#admin-activity-list');
            const render = (items) => {
                list.innerHTML = items
                    .map(
                        (item) => `
                    <div class="admin-list-row">
                        <div>
                            <strong>${item.action}</strong>
                            <p>${item.user_id || 'anonymous'} • ${item.$createdAt || item.created_at || ''}</p>
                        </div>
                        <code>${JSON.stringify(item.detailsObject || {})}</code>
                    </div>
                `
                    )
                    .join('');
            };

            render(logs);
            this.contentRoot.querySelector('#admin-activity-filter')?.addEventListener('input', (event) => {
                const query = String(event.target.value || '').toLowerCase();
                const filtered = logs.filter(
                    (item) =>
                        String(item.action || '').toLowerCase().includes(query) ||
                        String(item.user_id || '').toLowerCase().includes(query)
                );
                render(filtered);
            });
            return;
        }

        if (tab === 'content') {
            this.contentRoot.innerHTML = '<div id="admin-content-pane"></div>';
            this.modules.contentControl = new ContentControl(document.getElementById('admin-content-pane'));
            this.modules.contentControl.init();
            return;
        }

        if (tab === 'analytics') {
            this.contentRoot.innerHTML = '<div id="admin-analytics-pane"></div>';
            this.modules.analytics = new AdminAnalytics(document.getElementById('admin-analytics-pane'));
            await this.modules.analytics.init();
            return;
        }

        if (tab === 'system') {
            this.contentRoot.innerHTML = `
                <div class="admin-card">
                    <h3>System</h3>
                    <p>Project: monochrome-db</p>
                    <p>Role level: ${this.roleInfo.level}</p>
                    <p>Permissions: ${this.roleInfo.permissions.join(', ')}</p>
                    <button id="admin-log-action" class="btn-secondary">Log Admin Action</button>
                </div>
            `;

            this.contentRoot.querySelector('#admin-log-action')?.addEventListener('click', async () => {
                await activityLog.logActivity(this.currentUser.$id, 'admin_action', {
                    type: 'manual_system_log',
                });
                alert('Admin action logged.');
            });
        }
    }

    async init() {
        const allowed = await this.ensureAccess();
        if (!allowed) return;

        this.renderShell();
        await this.showTab('overview');
        activityLog.bindAutoLogging();
    }
}

export async function initializeAdminDashboard() {
    const dashboard = new AdminDashboard();
    await dashboard.init();
    return dashboard;
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const shell = document.getElementById('admin-dashboard-shell');
        if (!shell) return;
        initializeAdminDashboard().catch((error) => {
            console.error('Failed to initialize admin dashboard:', error);
            window.location.replace('/');
        });
    });
}
