const STORAGE_KEY = 'lastSeenVersion';
const FALLBACK_CHANGELOG_PATHS = ['/changelog.json', './changelog.json'];

function parseJsonString(value, fallback) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function fetchChangelog() {
    for (const path of FALLBACK_CHANGELOG_PATHS) {
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) continue;
            const payload = await response.json();
            if (payload && Array.isArray(payload.versions)) return payload;
        } catch {
            // try next
        }
    }

    return { versions: [] };
}

class WhatsNewManager {
    constructor() {
        this.data = { versions: [] };
        this.modalId = 'whats-new-modal';
        this.activeTab = 'highlights';
        this.isReady = false;
    }

    async init() {
        if (this.isReady) return;

        this.injectStyles();
        this.data = await fetchChangelog();
        this.bindOpenTriggers();
        this.isReady = true;

        const latest = this.getLatestVersion();
        if (!latest) return;

        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (!lastSeen || lastSeen !== latest.version) {
            this.openDialog();
        }
    }

    getLatestVersion() {
        return this.data.versions?.[0] || null;
    }

    getCurrentVersion() {
        return this.getLatestVersion()?.version || '0.0.0';
    }

    saveSeenVersion(version = this.getCurrentVersion()) {
        localStorage.setItem(STORAGE_KEY, version);
    }

    bindOpenTriggers() {
        const attach = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', (event) => {
                event.preventDefault();
                this.openDialog();
            });
        };

        attach('open-whats-new-btn');
        attach('sidebar-open-whats-new-btn');
        window.addEventListener('open-whats-new', () => this.openDialog());
    }

    closeDialog() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.remove();
        }
    }

    setTab(tab) {
        this.activeTab = tab;
        const modal = document.getElementById(this.modalId);
        if (!modal) return;

        modal.querySelectorAll('.whats-new-tab').forEach((button) => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });
        modal.querySelectorAll('.whats-new-tab-panel').forEach((panel) => {
            panel.style.display = panel.dataset.tab === tab ? 'block' : 'none';
        });
    }

    buildVersionCard(version) {
        const sections = ['new', 'improved', 'fixed'];
        const titleMap = {
            new: 'New',
            improved: 'Improved',
            fixed: 'Fixed',
        };

        const sectionHtml = sections
            .map((key) => {
                const list = Array.isArray(version.changes?.[key]) ? version.changes[key] : [];
                if (!list.length) return '';
                return `
                    <section class="whats-new-change-group">
                        <h4>${titleMap[key]}</h4>
                        <ul>
                            ${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </section>
                `;
            })
            .join('');

        return `
            <article class="whats-new-version-card">
                <header>
                    <h3>v${escapeHtml(version.version)}</h3>
                    <p>${escapeHtml(version.date)} • ${escapeHtml(version.title || '')}</p>
                </header>
                ${sectionHtml}
            </article>
        `;
    }

    renderModal() {
        const latest = this.getLatestVersion();
        if (!latest) return null;

        const highlights = Array.isArray(latest.highlights) ? latest.highlights : [];
        const versions = Array.isArray(this.data.versions) ? this.data.versions : [];

        const modal = document.createElement('div');
        modal.id = this.modalId;
        modal.className = 'modal active whats-new-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content wide whats-new-content">
                <div class="whats-new-header">
                    <div>
                        <h2>What’s New in v${escapeHtml(latest.version)}</h2>
                        <p>${escapeHtml(latest.title || '')}</p>
                    </div>
                    <button class="btn-secondary" id="whats-new-close-btn" type="button">Close</button>
                </div>

                <div class="whats-new-tabs" role="tablist">
                    <button class="whats-new-tab active" data-tab="highlights" type="button">Highlights</button>
                    <button class="whats-new-tab" data-tab="changelog" type="button">Full Changelog</button>
                </div>

                <div class="whats-new-tab-panel" data-tab="highlights">
                    <div class="whats-new-highlights-grid">
                        ${highlights
                            .map(
                                (item) => `
                            <div class="whats-new-highlight-card">
                                <div class="emoji">${escapeHtml(item.icon || '✨')}</div>
                                <div>
                                    <strong>${escapeHtml(item.category || 'Update')}</strong>
                                    <p>${escapeHtml(item.text || '')}</p>
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>

                <div class="whats-new-tab-panel" data-tab="changelog" style="display:none;">
                    <div class="whats-new-history">
                        ${versions.map((v) => this.buildVersionCard(v)).join('')}
                    </div>
                </div>

                <div class="modal-actions whats-new-actions">
                    <button class="btn-secondary" id="whats-new-dont-show-btn" type="button">Don’t show again</button>
                    <button class="btn-primary" id="whats-new-ok-btn" type="button">Got it</button>
                </div>
            </div>
        `;

        return modal;
    }

    openDialog() {
        if (!this.isReady) return;

        this.closeDialog();
        const modal = this.renderModal();
        if (!modal) return;
        document.body.appendChild(modal);

        const close = () => this.closeDialog();
        modal.querySelector('.modal-overlay')?.addEventListener('click', close);
        modal.querySelector('#whats-new-close-btn')?.addEventListener('click', close);
        modal.querySelector('#whats-new-ok-btn')?.addEventListener('click', close);

        modal.querySelector('#whats-new-dont-show-btn')?.addEventListener('click', () => {
            this.saveSeenVersion();
            close();
        });

        modal.querySelectorAll('.whats-new-tab').forEach((button) => {
            button.addEventListener('click', () => this.setTab(button.dataset.tab));
        });

        this.setTab(this.activeTab);
    }

    injectStyles() {
        if (document.getElementById('whats-new-styles')) return;

        const style = document.createElement('style');
        style.id = 'whats-new-styles';
        style.textContent = `
            .whats-new-content {
                background: #1a1a1a;
                border: 1px solid rgba(255, 68, 68, 0.35);
                color: #f5f5f5;
                max-height: 85vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .whats-new-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
            }
            .whats-new-header h2 {
                margin: 0;
                color: #ff4444;
            }
            .whats-new-header p {
                margin: 6px 0 0;
                color: #cfcfcf;
            }
            .whats-new-tabs {
                display: flex;
                gap: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                padding-bottom: 8px;
            }
            .whats-new-tab {
                background: #202020;
                border: 1px solid #333;
                color: #f5f5f5;
                border-radius: 8px;
                padding: 8px 12px;
                cursor: pointer;
            }
            .whats-new-tab.active {
                border-color: #ff4444;
                color: #ff4444;
            }
            .whats-new-tab-panel {
                overflow-y: auto;
                max-height: 46vh;
                padding-right: 4px;
            }
            .whats-new-highlights-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 10px;
            }
            .whats-new-highlight-card {
                display: flex;
                gap: 10px;
                padding: 12px;
                border-radius: 10px;
                background: #202020;
                border: 1px solid #2d2d2d;
            }
            .whats-new-highlight-card .emoji {
                font-size: 1.4rem;
                line-height: 1.4rem;
            }
            .whats-new-highlight-card p {
                margin: 4px 0 0;
                color: #d3d3d3;
                font-size: 0.9rem;
            }
            .whats-new-history {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .whats-new-version-card {
                background: #202020;
                border: 1px solid #2d2d2d;
                border-radius: 10px;
                padding: 12px;
            }
            .whats-new-version-card h3 {
                margin: 0;
                color: #ff4444;
            }
            .whats-new-version-card p {
                margin: 4px 0 10px;
                color: #cfcfcf;
                font-size: 0.9rem;
            }
            .whats-new-change-group h4 {
                margin: 10px 0 6px;
            }
            .whats-new-change-group ul {
                margin: 0;
                padding-left: 18px;
            }
            .whats-new-actions {
                margin-top: auto;
            }
            @media (max-width: 640px) {
                .whats-new-content {
                    max-width: calc(100vw - 20px);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

const manager = new WhatsNewManager();

export async function initializeWhatsNew() {
    await manager.init();
}

export function openWhatsNewDialog() {
    manager.openDialog();
}

window.MonochromeWhatsNew = {
    openDialog: openWhatsNewDialog,
    initialize: initializeWhatsNew,
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeWhatsNew();
    });
} else {
    initializeWhatsNew();
}
