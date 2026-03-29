import { db } from './db.js';
import { escapeHtml } from './utils.js';
import { showNotification } from './downloads.js';

const TAG_COLORS = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#14b8a6',
];

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function buildAssignmentId(tagId, itemType, itemId) {
    return `${tagId}:${itemType}:${itemId}`;
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

export class TaggingSystem {
    constructor() {
        this._tags = [];
        this._loadTags();
    }

    async _loadTags() {
        try {
            const tags = await db.performTransaction('tags', 'readonly', (store) => store.getAll());
            this._tags = tags || [];
        } catch {
            this._tags = [];
        }
    }

    async _saveTag(tag) {
        await db.performTransaction('tags', 'readwrite', (store) => store.put(tag));
    }

    async _deleteTagStore(tagId) {
        await db.performTransaction('tags', 'readwrite', (store) => store.delete(tagId));
    }

    async createTag(name, color) {
        const trimmed = name.trim();
        if (!trimmed) {
            showNotification('Tag name cannot be empty', 'error');
            return null;
        }
        if (this._tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
            showNotification('A tag with that name already exists', 'error');
            return null;
        }
        const tag = {
            id: generateId(),
            name: trimmed,
            color: color || TAG_COLORS[this._tags.length % TAG_COLORS.length],
            createdAt: Date.now(),
        };
        this._tags.push(tag);
        await this._saveTag(tag);
        window.dispatchEvent(new CustomEvent('tags-changed'));
        return tag;
    }

    async deleteTag(tagId) {
        const idx = this._tags.findIndex((t) => t.id === tagId);
        if (idx === -1) return;
        this._tags.splice(idx, 1);
        await this._deleteTagStore(tagId);

        const assignments = await db.performTransaction('tag_assignments', 'readonly', (store) => store.getAll());
        if (assignments) {
            await db.performTransaction('tag_assignments', 'readwrite', (store) => {
                for (const a of assignments) {
                    if (a.tagId === tagId) store.delete(a.id);
                }
            });
        }
        window.dispatchEvent(new CustomEvent('tags-changed'));
    }

    async renameTag(tagId, newName) {
        const tag = this._tags.find((t) => t.id === tagId);
        if (!tag) return;
        const trimmed = newName.trim();
        if (!trimmed) {
            showNotification('Tag name cannot be empty', 'error');
            return;
        }
        if (this._tags.some((t) => t.id !== tagId && t.name.toLowerCase() === trimmed.toLowerCase())) {
            showNotification('A tag with that name already exists', 'error');
            return;
        }
        tag.name = trimmed;
        await this._saveTag(tag);
        window.dispatchEvent(new CustomEvent('tags-changed'));
    }

    async addTagToItem(tagId, itemType, itemId) {
        const assignmentId = buildAssignmentId(tagId, itemType, itemId);
        const assignment = {
            id: assignmentId,
            tagId,
            itemType,
            itemId,
            assignedAt: Date.now(),
        };
        await db.performTransaction('tag_assignments', 'readwrite', (store) => store.put(assignment));
        window.dispatchEvent(new CustomEvent('tags-changed'));
    }

    async removeTagFromItem(tagId, itemType, itemId) {
        const assignmentId = buildAssignmentId(tagId, itemType, itemId);
        await db.performTransaction('tag_assignments', 'readwrite', (store) => store.delete(assignmentId));
        window.dispatchEvent(new CustomEvent('tags-changed'));
    }

    async getTagsForItem(itemType, itemId) {
        const assignments = await db.performTransaction('tag_assignments', 'readonly', (store) => store.getAll());
        if (!assignments) return [];
        const tagIds = new Set(
            assignments
                .filter((a) => a.itemType === itemType && String(a.itemId) === String(itemId))
                .map((a) => a.tagId)
        );
        return this._tags.filter((t) => tagIds.has(t.id));
    }

    async getItemsByTag(tagId) {
        const assignments = await db.performTransaction('tag_assignments', 'readonly', (store) => store.getAll());
        if (!assignments) return [];
        return assignments.filter((a) => a.tagId === tagId).map((a) => ({ itemType: a.itemType, itemId: a.itemId }));
    }

    async getAllTags() {
        await this._loadTags();
        return [...this._tags];
    }

    async getTagCounts() {
        const assignments = await db.performTransaction('tag_assignments', 'readonly', (store) => store.getAll());
        if (!assignments) return {};
        const counts = {};
        for (const a of assignments) {
            counts[a.tagId] = (counts[a.tagId] || 0) + 1;
        }
        return counts;
    }

    async getAutoSuggestedTags(itemType, itemId) {
        const item = await this._fetchItemDetails(itemType, itemId);
        if (!item) return [];

        const assignments = await db.performTransaction('tag_assignments', 'readonly', (store) => store.getAll());
        if (!assignments || assignments.length === 0) return [];

        const relatedIds = await this._getRelatedItemIds(itemType, item);
        if (relatedIds.length === 0) return [];

        const tagFrequency = {};
        for (const a of assignments) {
            if (relatedIds.some((r) => r.type === a.itemType && String(r.id) === String(a.itemId))) {
                tagFrequency[a.tagId] = (tagFrequency[a.tagId] || 0) + 1;
            }
        }

        const itemTagIds = new Set(
            assignments
                .filter((a) => a.itemType === itemType && String(a.itemId) === String(itemId))
                .map((a) => a.tagId)
        );

        return Object.entries(tagFrequency)
            .filter(([tagId]) => !itemTagIds.has(tagId))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tagId, count]) => ({ tag: this._tags.find((t) => t.id === tagId), count }))
            .filter((s) => s.tag);
    }

    async _fetchItemDetails(itemType, itemId) {
        try {
            let storeName;
            switch (itemType) {
                case 'track':
                    storeName = 'tracks';
                    break;
                case 'album':
                    storeName = 'albums';
                    break;
                case 'artist':
                    storeName = 'artists';
                    break;
                default:
                    return null;
            }
            const result = await db.performTransaction(storeName, 'readonly', (store) => store.get(itemId));
            return result || null;
        } catch {
            return null;
        }
    }

    async _getRelatedItemIds(itemType, item) {
        const related = [];
        try {
            if (itemType === 'track') {
                if (item.albumId) related.push({ type: 'album', id: item.albumId });
                if (item.artistId) related.push({ type: 'artist', id: item.artistId });
                const allTracks = await db.performTransaction('tracks', 'readonly', (store) => store.getAll());
                if (allTracks) {
                    const sameAlbum = allTracks.filter((t) => t.albumId === item.albumId && t.id !== item.id);
                    for (const t of sameAlbum.slice(0, 10)) related.push({ type: 'track', id: t.id });
                }
            } else if (itemType === 'album') {
                const allTracks = await db.performTransaction('tracks', 'readonly', (store) => store.getAll());
                if (allTracks) {
                    const albumTracks = allTracks.filter((t) => t.albumId === item.id);
                    for (const t of albumTracks) related.push({ type: 'track', id: t.id });
                    if (albumTracks.length > 0 && albumTracks[0].artistId) {
                        related.push({ type: 'artist', id: albumTracks[0].artistId });
                    }
                }
            } else if (itemType === 'artist') {
                const allTracks = await db.performTransaction('tracks', 'readonly', (store) => store.getAll());
                if (allTracks) {
                    const artistTracks = allTracks.filter((t) => t.artistId === item.id);
                    for (const t of artistTracks.slice(0, 20)) related.push({ type: 'track', id: t.id });
                    const albumIds = new Set(artistTracks.map((t) => t.albumId).filter(Boolean));
                    for (const albumId of albumIds) related.push({ type: 'album', id: albumId });
                }
            }
        } catch {
            // return what we have
        }
        return related;
    }

    async getTagPillsHTML(itemType, itemId) {
        const tags = await this.getTagsForItem(itemType, itemId);
        if (tags.length === 0) return '';
        return tags
            .map(
                (t) =>
                    `<span class="ts-pill" style="background:${hexToRgba(t.color, 0.2)};color:${t.color};border:1px solid ${hexToRgba(t.color, 0.4)}" data-tag-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</span>`
            )
            .join('');
    }

    renderTagPicker(container, itemType, itemId, onTagChange) {
        container.innerHTML = '';
        const picker = document.createElement('div');
        picker.className = 'ts-picker';

        const header = document.createElement('div');
        header.className = 'ts-picker-header';
        header.innerHTML = '<span class="ts-picker-title">Tags</span>';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ts-picker-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            picker.classList.remove('ts-picker--open');
        });
        header.appendChild(closeBtn);
        picker.appendChild(header);

        const tagList = document.createElement('div');
        tagList.className = 'ts-picker-list';
        picker.appendChild(tagList);

        const createSection = document.createElement('div');
        createSection.className = 'ts-picker-create';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'ts-picker-input';
        nameInput.placeholder = 'New tag name...';

        const colorWrapper = document.createElement('div');
        colorWrapper.className = 'ts-picker-colors';
        let selectedColor = TAG_COLORS[0];

        TAG_COLORS.forEach((color, i) => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'ts-picker-swatch' + (i === 0 ? ' ts-picker-swatch--active' : '');
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                colorWrapper
                    .querySelectorAll('.ts-picker-swatch')
                    .forEach((s) => s.classList.remove('ts-picker-swatch--active'));
                swatch.classList.add('ts-picker-swatch--active');
                selectedColor = color;
            });
            colorWrapper.appendChild(swatch);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'ts-picker-add';
        addBtn.textContent = '+ Add';

        addBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) return;
            const tag = await this.createTag(name, selectedColor);
            if (tag) {
                nameInput.value = '';
                await this.addTagToItem(tag.id, itemType, itemId);
                this._renderPickerList(tagList, itemType, itemId, onTagChange);
                if (onTagChange) onTagChange();
            }
        });

        nameInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') addBtn.click();
        });

        createSection.appendChild(nameInput);
        createSection.appendChild(colorWrapper);
        createSection.appendChild(addBtn);
        picker.appendChild(createSection);

        container.appendChild(picker);

        this._renderPickerList(tagList, itemType, itemId, onTagChange);

        requestAnimationFrame(() => picker.classList.add('ts-picker--open'));
    }

    async _renderPickerList(tagList, itemType, itemId, onTagChange) {
        const allTags = await this.getAllTags();
        const itemTags = await this.getTagsForItem(itemType, itemId);
        const itemTagIds = new Set(itemTags.map((t) => t.id));

        tagList.innerHTML = '';

        if (allTags.length === 0) {
            tagList.innerHTML = '<div class="ts-picker-empty">No tags yet. Create one below.</div>';
            return;
        }

        for (const tag of allTags) {
            const row = document.createElement('label');
            row.className = 'ts-picker-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = itemTagIds.has(tag.id);
            checkbox.dataset.tagId = tag.id;

            checkbox.addEventListener('change', async () => {
                if (checkbox.checked) {
                    await this.addTagToItem(tag.id, itemType, itemId);
                } else {
                    await this.removeTagFromItem(tag.id, itemType, itemId);
                }
                if (onTagChange) onTagChange();
            });

            const dot = document.createElement('span');
            dot.className = 'ts-picker-dot';
            dot.style.backgroundColor = tag.color;

            const label = document.createElement('span');
            label.className = 'ts-picker-label';
            label.textContent = tag.name;

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'ts-picker-delete';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Delete tag';
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm(`Delete tag "${tag.name}"? This will remove it from all items.`)) {
                    await this.deleteTag(tag.id);
                    this._renderPickerList(tagList, itemType, itemId, onTagChange);
                    if (onTagChange) onTagChange();
                }
            });

            row.appendChild(checkbox);
            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(deleteBtn);
            tagList.appendChild(row);
        }
    }

    renderTagCloud(container) {
        container.innerHTML = '';
        const cloud = document.createElement('div');
        cloud.className = 'ts-cloud';

        const title = document.createElement('h3');
        title.className = 'ts-cloud-title';
        title.textContent = 'Browse by Tag';
        cloud.appendChild(title);

        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'ts-cloud-pills';
        pillsContainer.innerHTML = '<div class="ts-cloud-loading">Loading tags...</div>';
        cloud.appendChild(pillsContainer);

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'ts-cloud-results';
        cloud.appendChild(resultsContainer);

        container.appendChild(cloud);

        this._populateCloud(pillsContainer, resultsContainer);
    }

    async _populateCloud(pillsContainer, resultsContainer) {
        const allTags = await this.getAllTags();
        const counts = await this.getTagCounts();

        pillsContainer.innerHTML = '';

        if (allTags.length === 0) {
            pillsContainer.innerHTML =
                '<div class="ts-cloud-empty">No tags yet. Create tags to organize your library.</div>';
            return;
        }

        const maxCount = Math.max(...Object.values(counts), 1);

        for (const tag of allTags) {
            const count = counts[tag.id] || 0;
            const scale = 0.75 + (count / maxCount) * 0.5;

            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'ts-cloud-pill';
            pill.style.backgroundColor = hexToRgba(tag.color, 0.15);
            pill.style.color = tag.color;
            pill.style.borderColor = hexToRgba(tag.color, 0.3);
            pill.style.fontSize = `${scale}rem`;
            pill.dataset.tagId = tag.id;
            pill.innerHTML = `${escapeHtml(tag.name)} <span class="ts-cloud-count">${count}</span>`;

            pill.addEventListener('click', () => {
                pillsContainer
                    .querySelectorAll('.ts-cloud-pill')
                    .forEach((p) => p.classList.remove('ts-cloud-pill--active'));
                pill.classList.add('ts-cloud-pill--active');
                this._showCloudResults(resultsContainer, tag);
            });

            pillsContainer.appendChild(pill);
        }
    }

    async _showCloudResults(resultsContainer, tag) {
        resultsContainer.innerHTML = '';
        const items = await this.getItemsByTag(tag.id);

        if (items.length === 0) {
            resultsContainer.innerHTML = `<div class="ts-cloud-empty">No items tagged with "${escapeHtml(tag.name)}"</div>`;
            return;
        }

        const grouped = { track: [], album: [], artist: [] };
        for (const item of items) {
            if (grouped[item.itemType]) grouped[item.itemType].push(item);
        }

        const typeLabels = { track: 'Tracks', album: 'Albums', artist: 'Artists' };

        for (const [type, typeItems] of Object.entries(grouped)) {
            if (typeItems.length === 0) continue;

            const section = document.createElement('div');
            section.className = 'ts-cloud-section';

            const heading = document.createElement('h4');
            heading.className = 'ts-cloud-section-title';
            heading.textContent = `${typeLabels[type]} (${typeItems.length})`;
            section.appendChild(heading);

            const list = document.createElement('ul');
            list.className = 'ts-cloud-list';

            for (const item of typeItems) {
                const detail = await this._fetchItemDetails(item.itemType, item.itemId);
                const li = document.createElement('li');
                li.className = 'ts-cloud-list-item';
                li.dataset.itemType = item.itemType;
                li.dataset.itemId = item.itemId;

                if (detail) {
                    const name = detail.name || detail.title || 'Unknown';
                    li.textContent = name;
                } else {
                    li.textContent = `${type} #${item.itemId}`;
                }
                list.appendChild(li);
            }

            section.appendChild(list);
            resultsContainer.appendChild(section);
        }
    }

    renderTagFilter(container, onFilterChange) {
        container.innerHTML = '';
        const filter = document.createElement('div');
        filter.className = 'ts-filter';

        const label = document.createElement('span');
        label.className = 'ts-filter-label';
        label.textContent = 'Filter by tag:';
        filter.appendChild(label);

        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'ts-filter-pills';
        pillsContainer.innerHTML = '<div class="ts-filter-loading">Loading...</div>';
        filter.appendChild(pillsContainer);

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'ts-filter-clear';
        clearBtn.textContent = 'Clear';
        clearBtn.style.display = 'none';
        clearBtn.addEventListener('click', () => {
            pillsContainer
                .querySelectorAll('.ts-filter-pill')
                .forEach((p) => p.classList.remove('ts-filter-pill--active'));
            clearBtn.style.display = 'none';
            if (onFilterChange) onFilterChange(null);
        });
        filter.appendChild(clearBtn);

        container.appendChild(filter);

        this._populateFilter(pillsContainer, clearBtn, onFilterChange);
    }

    async _populateFilter(pillsContainer, clearBtn, onFilterChange) {
        const allTags = await this.getAllTags();
        pillsContainer.innerHTML = '';

        if (allTags.length === 0) {
            pillsContainer.innerHTML = '<span class="ts-filter-empty">No tags</span>';
            return;
        }

        let activeTagId = null;

        for (const tag of allTags) {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'ts-filter-pill';
            pill.style.setProperty('--tag-color', tag.color);
            pill.style.backgroundColor = hexToRgba(tag.color, 0.15);
            pill.style.color = tag.color;
            pill.style.borderColor = hexToRgba(tag.color, 0.3);
            pill.textContent = tag.name;
            pill.dataset.tagId = tag.id;

            pill.addEventListener('click', () => {
                if (pill.classList.contains('ts-filter-pill--active')) {
                    pill.classList.remove('ts-filter-pill--active');
                    activeTagId = null;
                    clearBtn.style.display = 'none';
                    if (onFilterChange) onFilterChange(null);
                } else {
                    pillsContainer
                        .querySelectorAll('.ts-filter-pill')
                        .forEach((p) => p.classList.remove('ts-filter-pill--active'));
                    pill.classList.add('ts-filter-pill--active');
                    activeTagId = tag.id;
                    clearBtn.style.display = '';
                    if (onFilterChange) onFilterChange(tag.id);
                }
            });

            pillsContainer.appendChild(pill);
        }
    }

    async getFilteredItemIds(tagId, itemType) {
        if (!tagId) return null;
        const items = await this.getItemsByTag(tagId);
        return items.filter((i) => i.itemType === itemType).map((i) => i.itemId);
    }
}
