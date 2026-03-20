const STORAGE_KEY = 'admin-content-control-v1';

function readState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return {
            featureFlags: parsed.featureFlags || { homepageFeatured: true, experimentalPlayer: false },
            blacklistedTracks: Array.isArray(parsed.blacklistedTracks) ? parsed.blacklistedTracks : [],
            blacklistedArtists: Array.isArray(parsed.blacklistedArtists) ? parsed.blacklistedArtists : [],
            publicPlaylists: Array.isArray(parsed.publicPlaylists) ? parsed.publicPlaylists : [],
        };
    } catch {
        return {
            featureFlags: { homepageFeatured: true, experimentalPlayer: false },
            blacklistedTracks: [],
            blacklistedArtists: [],
            publicPlaylists: [],
        };
    }
}

function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export class ContentControl {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.state = readState();
    }

    init() {
        this.render();
    }

    addListItem(key, value) {
        const clean = String(value || '').trim();
        if (!clean) return;
        this.state[key] = [...new Set([...this.state[key], clean])];
        saveState(this.state);
        this.render();
    }

    removeListItem(key, value) {
        this.state[key] = this.state[key].filter((entry) => entry !== value);
        saveState(this.state);
        this.render();
    }

    setFeatureFlag(name, enabled) {
        this.state.featureFlags[name] = enabled;
        saveState(this.state);
    }

    setPlaylistStatus(id, status) {
        this.state.publicPlaylists = this.state.publicPlaylists.map((item) =>
            item.id === id ? { ...item, status } : item
        );
        saveState(this.state);
        this.render();
    }

    renderTagList(title, key) {
        return `
            <div class="admin-card">
                <h3>${title}</h3>
                <div class="admin-inline-form">
                    <input type="text" data-input="${key}" placeholder="Add item" />
                    <button class="btn-secondary" data-add="${key}">Add</button>
                </div>
                <div class="admin-tags">
                    ${this.state[key]
                        .map(
                            (item) => `
                        <span class="admin-tag">
                            ${item}
                            <button type="button" data-remove="${key}" data-value="${item}">×</button>
                        </span>
                    `
                        )
                        .join('')}
                </div>
            </div>
        `;
    }

    render() {
        this.rootEl.innerHTML = `
            <div class="admin-grid two">
                <div class="admin-card">
                    <h3>Feature Flags</h3>
                    ${Object.entries(this.state.featureFlags)
                        .map(
                            ([name, enabled]) => `
                        <label class="admin-switch-row">
                            <span>${name}</span>
                            <input type="checkbox" data-flag="${name}" ${enabled ? 'checked' : ''} />
                        </label>
                    `
                        )
                        .join('')}
                </div>

                ${this.renderTagList('Blacklisted Tracks', 'blacklistedTracks')}
                ${this.renderTagList('Blacklisted Artists', 'blacklistedArtists')}

                <div class="admin-card">
                    <h3>Public Playlists</h3>
                    <div class="admin-simple-list">
                        ${this.state.publicPlaylists
                            .map(
                                (playlist) => `
                            <div class="admin-list-row">
                                <span>${playlist.name} (${playlist.status || 'pending'})</span>
                                <div>
                                    <button class="btn-secondary" data-approve="${playlist.id}">Approve</button>
                                    <button class="btn-secondary danger" data-reject="${playlist.id}">Reject</button>
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>
            </div>
        `;

        this.rootEl.querySelectorAll('[data-flag]').forEach((el) => {
            el.addEventListener('change', (event) => {
                this.setFeatureFlag(event.target.dataset.flag, event.target.checked);
            });
        });

        this.rootEl.querySelectorAll('[data-add]').forEach((button) => {
            button.addEventListener('click', () => {
                const key = button.dataset.add;
                const input = this.rootEl.querySelector(`[data-input="${key}"]`);
                this.addListItem(key, input?.value || '');
            });
        });

        this.rootEl.querySelectorAll('[data-remove]').forEach((button) => {
            button.addEventListener('click', () => {
                this.removeListItem(button.dataset.remove, button.dataset.value);
            });
        });

        this.rootEl.querySelectorAll('[data-approve]').forEach((button) => {
            button.addEventListener('click', () => this.setPlaylistStatus(button.dataset.approve, 'approved'));
        });

        this.rootEl.querySelectorAll('[data-reject]').forEach((button) => {
            button.addEventListener('click', () => this.setPlaylistStatus(button.dataset.reject, 'rejected'));
        });
    }
}
