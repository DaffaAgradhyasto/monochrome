// js/admin-dashboard.js
// Admin Dashboard UI for Monochrome RBAC System

import { rbacManager, ROLES } from './accounts/rbac.js';
import { authManager } from './accounts/auth.js';

export class AdminDashboard {
  constructor(ui) {
    this.ui = ui;
    this.currentPage = 1;
    this.currentTab = 'users';
  }

  async render() {
    const role = rbacManager.getRole();
    if (!rbacManager.isAdmin()) {
      this.ui.showPage('home');
      alert('Access Denied: Admin privileges required.');
      return;
    }

    const container = document.getElementById('page-admin-dashboard');
    if (!container) {
      this.createPage();
      return this.render();
    }

    container.innerHTML = `
      <div class="admin-dashboard">
        <div class="admin-header">
          <h1>⚙️ Admin Dashboard</h1>
          <div class="admin-role-badge">
            ${role === ROLES.OWNER ? '👑' : '🛡️'} ${role.toUpperCase()}
          </div>
        </div>

        <div class="admin-tabs">
          <button class="admin-tab ${this.currentTab === 'users' ? 'active' : ''}"
                  onclick="window.adminDashboard.switchTab('users')">
            👥 Users
          </button>
          <button class="admin-tab ${this.currentTab === 'playlists' ? 'active' : ''}"
                  onclick="window.adminDashboard.switchTab('playlists')">
            🎵 Playlists
          </button>
          <button class="admin-tab ${this.currentTab === 'audit' ? 'active' : ''}"
                  onclick="window.adminDashboard.switchTab('audit')">
            📋 Audit Logs
          </button>
          ${role === ROLES.OWNER ? `
          <button class="admin-tab ${this.currentTab === 'settings' ? 'active' : ''}"
                  onclick="window.adminDashboard.switchTab('settings')" class="owner-only">
            ⚙️ Settings
          </button>
          ` : ''}
        </div>

        <div class="admin-content" id="admin-content">
          <div class="admin-loading">Loading...</div>
        </div>
      </div>
    `;

    this.ui.showPage('admin-dashboard');
    await this.loadTabContent();
  }

  createPage() {
    const pages = document.querySelector('.pages');
    if (!pages) return;

    const page = document.createElement('div');
    page.id = 'page-admin-dashboard';
    page.className = 'page';
    pages.appendChild(page);
  }

  async switchTab(tab) {
    this.currentTab = tab;
    this.currentPage = 1;
    await this.render();
  }

  async loadTabContent() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    try {
      if (this.currentTab === 'users') {
        await this.renderUsersTab(content);
      } else if (this.currentTab === 'playlists') {
        await this.renderPlaylistsTab(content);
      } else if (this.currentTab === 'audit') {
        await this.renderAuditTab(content);
      } else if (this.currentTab === 'settings') {
        await this.renderSettingsTab(content);
      }
    } catch (error) {
      content.innerHTML = `<div class="admin-error">❌ Error: ${error.message}</div>`;
    }
  }

  async renderUsersTab(container) {
    const result = await rbacManager.getAllUsers(this.currentPage, 25);
    const users = result.documents;
    const total = result.total;
    const totalPages = Math.ceil(total / 25);

    const isOwner = rbacManager.isOwner();

    container.innerHTML = `
      <div class="admin-users">
        <div class="admin-users-header">
          <h2>👥 Users (${total} total)</h2>
          <input type="text" id="admin-user-search" placeholder="🔍 Search by username..."
                 onchange="window.adminDashboard.searchUsers(this.value)" />
        </div>

        <table class="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email / User ID</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              ${isOwner ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${users.map((user) => this.renderUserRow(user, isOwner)).join('')}
          </tbody>
        </table>

        <div class="admin-pagination">
          <button ${this.currentPage === 1 ? 'disabled' : ''}
                  onclick="window.adminDashboard.loadPage(${this.currentPage - 1})">
            ← Prev
          </button>
          <span>Page ${this.currentPage} of ${totalPages}</span>
          <button ${this.currentPage >= totalPages ? 'disabled' : ''}
                  onclick="window.adminDashboard.loadPage(${this.currentPage + 1})">
            Next →
          </button>
        </div>
      </div>
    `;
  }

  renderUserRow(user, isOwner) {
    const role = user.role || 'user';
    const isBanned = user.is_banned || false;
    const userId = user.user_id || user.$id;
    const username = user.username || 'N/A';

    const createdDate = new Date(user.$createdAt).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return `
      <tr class="${isBanned ? 'user-banned' : ''}">
        <td>${username}</td>
        <td><code>${userId.substring(0, 12)}...</code></td>
        <td><span class="role-pill role-pill--${role}">${role}</span></td>
        <td>${isBanned ? '<span class="status-banned">🚫 Banned</span>' : '<span class="status-active">✅ Active</span>'}</td>
        <td>${createdDate}</td>
        ${isOwner ? `<td>${this.renderUserActions(userId, role, isBanned)}</td>` : ''}
      </tr>
    `;
  }

  renderUserActions(userId, role, isBanned) {
    const actions = [];

    // Promote/Demote (Owner only)
    if (role === 'user') {
      actions.push(
        `<button class="btn-small" onclick="window.adminDashboard.promoteUser('${userId}')">⬆️ Promote</button>`
      );
    } else if (role === 'admin') {
      actions.push(
        `<button class="btn-small btn-danger" onclick="window.adminDashboard.demoteUser('${userId}')">⬇️ Demote</button>`
      );
    }

    // Ban/Unban
    if (!isBanned) {
      actions.push(
        `<button class="btn-small btn-danger" onclick="window.adminDashboard.banUser('${userId}')">🚫 Ban</button>`
      );
    } else {
      actions.push(
        `<button class="btn-small" onclick="window.adminDashboard.unbanUser('${userId}')">✅ Unban</button>`
      );
    }

    return actions.join(' ');
  }

  async renderPlaylistsTab(container) {
    container.innerHTML = `
      <div class="admin-playlists">
        <h2>🎵 Public Playlists</h2>
        <p>Feature coming soon: Soft-delete / restore public playlists.</p>
      </div>
    `;
  }

  async renderAuditTab(container) {
    const result = await rbacManager.getAuditLogs(this.currentPage, 50);
    const logs = result.documents;
    const total = result.total;

    if (total === 0) {
      container.innerHTML = `
        <div class="admin-audit-empty">
          <p>📋 No audit logs yet.</p>
          <small>Note: Audit collection may not be configured in Appwrite yet.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-audit">
        <h2>📋 Audit Trail (${total} total)</h2>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            ${logs
              .map((log) => {
                const date = new Date(log.timestamp || log.$createdAt).toLocaleString('id-ID');
                const meta = log.meta ? JSON.parse(log.meta) : {};
                return `
                <tr>
                  <td>${date}</td>
                  <td>${log.actor_email || 'N/A'}</td>
                  <td><code>${log.action}</code></td>
                  <td><pre>${JSON.stringify(meta, null, 2)}</pre></td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async renderSettingsTab(container) {
    if (!rbacManager.isOwner()) {
      container.innerHTML = `<p>Access denied: Owner only.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="admin-settings">
        <h2>⚙️ Owner Settings</h2>
        <div class="setting-item">
          <label>Owner UID:</label>
          <input type="text" id="admin-owner-uid"
                 value="${localStorage.getItem('monochrome-owner-uid') || ''}" />
          <button onclick="window.adminDashboard.saveOwnerUid()">Save</button>
          <p><small>Set your Appwrite User $id here to gain Owner privileges.</small></p>
        </div>
      </div>
    `;
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async promoteUser(userId) {
    if (!confirm('Promote this user to Admin?')) return;
    try {
      await rbacManager.promoteToAdmin(userId);
      alert('✅ User promoted to Admin!');
      await this.render();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  }

  async demoteUser(userId) {
    if (!confirm('Demote this admin back to User?')) return;
    try {
      await rbacManager.demoteFromAdmin(userId);
      alert('✅ User demoted to User.');
      await this.render();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  }

  async banUser(userId) {
    if (!confirm('Ban this user?')) return;
    try {
      await rbacManager.setBanStatus(userId, true);
      alert('🚫 User banned.');
      await this.render();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  }

  async unbanUser(userId) {
    if (!confirm('Unban this user?')) return;
    try {
      await rbacManager.setBanStatus(userId, false);
      alert('✅ User unbanned.');
      await this.render();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  }

  async loadPage(page) {
    this.currentPage = page;
    await this.render();
  }

  async searchUsers(query) {
    this.searchQuery = query;
    this.currentPage = 1;
    await this.render();
  }

  saveOwnerUid() {
    const input = document.getElementById('admin-owner-uid');
    if (!input) return;
    localStorage.setItem('monochrome-owner-uid', input.value.trim());
    alert('✅ Owner UID saved. Refresh to apply.');
  }
}

// Export global instance
if (typeof window !== 'undefined') {
  window.AdminDashboard = AdminDashboard;
}
