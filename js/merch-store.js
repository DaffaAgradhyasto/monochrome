//js/merch-store.js
// Merch Store Integration - Fetch and display artist merchandise

import { SVG_LINK, SVG_SHARE } from './icons.js';

export class MerchStoreManager {
    constructor() {
        this.cache = new Map();
        this.providers = [
            'https://merch-api.example.com', // Placeholder - can be replaced with real APIs
        ];
    }

    /**
     * Fetch merchandise for an artist
     * @param {string} artistName - Artist name to search for
     * @param {string} artistId - Optional artist ID for better matching
     * @returns {Promise<Array>} Array of merchandise items
     */
    async fetchMerch(artistName, artistId = null) {
        const cacheKey = `merch_${artistId || artistName}`;
        
        // Check cache first (5 minute TTL)
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
                return cached.data;
            }
        }

        try {
            // Try multiple merch providers
            const merchItems = await this.fetchFromProviders(artistName, artistId);
            
            // Cache the results
            this.cache.set(cacheKey, {
                data: merchItems,
                timestamp: Date.now(),
            });

            return merchItems;
        } catch (error) {
            console.warn('Failed to fetch merchandise:', error);
            return [];
        }
    }

    /**
     * Fetch from multiple merchandise providers
     */
    async fetchFromProviders(artistName, artistId) {
        const allItems = [];

        // Provider 1: Music merchandise aggregator API (placeholder)
        try {
            const response = await fetch(
                `https://api.musicmerch.com/search?artist=${encodeURIComponent(artistName)}&limit=12`,
                {
                    headers: {
                        'User-Agent': 'Monochrome/2.0.0',
                        'Accept': 'application/json',
                    },
                }
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.items && Array.isArray(data.items)) {
                    allItems.push(...this.normalizeMerchItems(data.items, 'musicmerch'));
                }
            }
        } catch (e) {
            console.debug('MusicMerch API not available:', e.message);
        }

        // Provider 2: Bandcamp-style search
        try {
            const bandcampItems = await this.searchBandcamp(artistName);
            if (bandcampItems.length > 0) {
                allItems.push(...bandcampItems);
            }
        } catch (e) {
            console.debug('Bandcamp search failed:', e.message);
        }

        // Provider 3: Generic merchandise search via web scraping alternative
        try {
            const genericItems = await this.searchGenericMerch(artistName);
            if (genericItems.length > 0) {
                allItems.push(...genericItems);
            }
        } catch (e) {
            console.debug('Generic merch search failed:', e.message);
        }

        // Remove duplicates based on product URL
        const seen = new Set();
        return allItems.filter(item => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });
    }

    /**
     * Search Bandcamp for artist merchandise
     */
    async searchBandcamp(artistName) {
        // Note: This is a placeholder - real implementation would use Bandcamp API or scraping
        const items = [];
        
        // Simulated Bandcamp results (in production, this would call actual API)
        const searchUrl = `https://bandcamp.com/search?q=${encodeURIComponent(artistName)}&item_type=merch`;
        
        // For now, return empty - real implementation would parse Bandcamp search
        return items;
    }

    /**
     * Search for generic merchandise using available APIs
     */
    async searchGenericMerch(artistName) {
        const items = [];
        
        // Use iTunes Search API as a proxy for finding artist-related products
        try {
            const response = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(artistName + ' merchandise')}&media=music&limit=5`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.results) {
                    // Filter for non-music items if any
                    const merchResults = data.results
                        .filter(result => result.kind !== 'song' && result.kind !== 'music-video')
                        .map(item => ({
                            id: item.trackId || item.collectionId,
                            title: item.trackName || item.collectionName,
                            artist: item.artistName || artistName,
                            price: item.price || 'N/A',
                            currency: item.currency || 'USD',
                            image: item.artworkUrl100 || item.artworkUrl600,
                            url: item.trackViewUrl || item.collectionViewUrl,
                            provider: 'iTunes',
                            type: 'digital',
                        }));
                    
                    items.push(...merchResults);
                }
            }
        } catch (e) {
            console.debug('iTunes search failed:', e.message);
        }

        return items;
    }

    /**
     * Normalize merchandise items from different providers
     */
    normalizeMerchItems(items, provider) {
        return items.map(item => ({
            id: item.id || item.sku || `merch_${provider}_${Date.now()}_${Math.random()}`,
            title: item.name || item.title || 'Merchandise Item',
            artist: item.artist || item.brand || '',
            description: item.description || '',
            price: item.price || 'N/A',
            currency: item.currency || 'USD',
            image: item.image || item.imageUrl || item.thumbnail || '',
            url: item.url || item.link || item.productUrl || '#',
            provider: provider,
            type: item.type || 'physical',
            categories: item.categories || [],
            sizes: item.sizes || [],
            colors: item.colors || [],
            inStock: item.inStock !== undefined ? item.inStock : true,
        }));
    }

    /**
     * Create HTML for a merchandise card
     */
    createMerchCardHTML(item) {
        const { title, artist, price, currency, image, url, provider, inStock } = item;
        
        const imageUrl = image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJhcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
        
        const priceDisplay = price === 'N/A' ? '' : `${currency === 'USD' ? '$' : currency}${price}`;
        const stockBadge = inStock 
            ? '<span class="merch-stock in-stock">In Stock</span>' 
            : '<span class="merch-stock out-of-stock">Out of Stock</span>';
        
        return `
            <div class="merch-card" data-merch-id="${item.id}" data-merch-url="${url}">
                <div class="merch-card-image">
                    <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJhcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='" />
                    ${stockBadge}
                </div>
                <div class="merch-card-details">
                    <h3 class="merch-title">${this.escapeHtml(title)}</h3>
                    ${artist ? `<p class="merch-artist">${this.escapeHtml(artist)}</p>` : ''}
                    <div class="merch-footer">
                        ${priceDisplay ? `<span class="merch-price">${priceDisplay}</span>` : ''}
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="merch-link-btn" title="View on ${provider}">
                            ${SVG_SHARE(16)}
                            <span>View</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create skeleton loader for merch cards
     */
    createSkeletonMerchCard() {
        return `
            <div class="merch-card skeleton">
                <div class="merch-card-image">
                    <div class="skeleton-placeholder" style="width: 100%; height: 200px;"></div>
                </div>
                <div class="merch-card-details">
                    <div class="skeleton-placeholder" style="height: 18px; width: 80%; margin-bottom: 8px;"></div>
                    <div class="skeleton-placeholder" style="height: 14px; width: 60%; margin-bottom: 12px;"></div>
                    <div class="merch-footer">
                        <div class="skeleton-placeholder" style="height: 16px; width: 50px;"></div>
                        <div class="skeleton-placeholder" style="height: 32px; width: 60px;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render merchandise section on artist page
     */
    async renderMerchSection(artistName, artistId, containerId = 'artist-detail-merch') {
        const container = document.getElementById(containerId);
        const section = document.getElementById('artist-section-merch');
        
        if (!container || !section) return;

        // Show skeleton loaders
        container.innerHTML = Array(6).fill(this.createSkeletonMerchCard()).join('');
        section.style.display = 'block';

        try {
            const merchItems = await this.fetchMerch(artistName, artistId);
            
            if (merchItems.length === 0) {
                section.style.display = 'none';
                return;
            }

            container.innerHTML = merchItems.map(item => this.createMerchCardHTML(item)).join('');
            
            // Add click handlers for merch cards
            container.querySelectorAll('.merch-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Don't trigger if clicking the link button
                    if (e.target.closest('.merch-link-btn')) return;
                    
                    const url = card.dataset.merchUrl;
                    if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                });
            });

            section.style.display = 'block';
        } catch (error) {
            console.error('Error rendering merch section:', error);
            section.style.display = 'none';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear merchandise cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
export const merchStoreManager = new MerchStoreManager();
