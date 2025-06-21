class Dashboard {
    constructor() {
        this.allContent = [];
        this.filteredContent = [];
        this.currentFilters = {
            type: 'all',
            quality: 'all',
            search: ''
        };
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.applyFilters();
    }

    async loadData() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTrackedContent' });
            this.allContent = response.content || [];

            const statsResponse = await chrome.runtime.sendMessage({ action: 'getStats' });
            const stats = statsResponse.stats;

            this.updateStats(stats);
            this.displayContent(this.allContent);

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError();
        }
    }

    updateStats(stats) {
        document.getElementById('totalItems').textContent = stats.totalItems || 0;
        document.getElementById('totalArticles').textContent = stats.articles || 0;
        document.getElementById('totalVideos').textContent = stats.videos || 0;
        
        const hours = Math.floor((stats.totalTimeSpent || 0) / 3600);
        document.getElementById('totalHours').textContent = hours;
    }

    setupEventListeners() {
        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.currentFilters.type = e.target.value;
            this.applyFilters();
        });

        document.getElementById('qualityFilter').addEventListener('change', (e) => {
            this.currentFilters.quality = e.target.value;
            this.applyFilters();
        });

        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Add sync button
        const syncBtn = document.createElement('button');
        syncBtn.className = 'export-btn';
        syncBtn.textContent = 'Sync to Website';
        syncBtn.style.marginLeft = '10px';
        syncBtn.addEventListener('click', () => {
            this.syncToWebsite();
        });
        document.querySelector('.section-header').appendChild(syncBtn);

        document.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.content-item');
            if (itemEl) {
                const url = itemEl.dataset.url;
                if (url) {
                    chrome.tabs.create({ url: url });
                }
            }
        });
    }

    async syncToWebsite() {
        const highQualityContent = this.allContent.filter(item => 
            item.analysis?.contentQuality === 'high' && !item.synced
        );

        for (const item of highQualityContent) {
            await chrome.runtime.sendMessage({
                action: 'syncToWebsite',
                data: item
            });
        }

        alert(`Synced ${highQualityContent.length} high-quality items to website`);
        this.loadData(); // Refresh to show sync status
    }

    applyFilters() {
        this.filteredContent = this.allContent.filter(item => {
            if (this.currentFilters.type !== 'all' && item.type !== this.currentFilters.type) {
                return false;
            }

            if (this.currentFilters.quality !== 'all' && 
                item.analysis?.contentQuality !== this.currentFilters.quality) {
                return false;
            }

            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search;
                const searchable = `${item.title} ${item.domain} ${item.author || ''}`.toLowerCase();
                if (!searchable.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.displayContent(this.filteredContent);
    }

    displayContent(content) {
        const container = document.getElementById('contentList');
        
        if (!content || content.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📖</div>
                    <h3>No content found</h3>
                    <p>Try adjusting your filters or browse some articles to get started!</p>
                </div>
            `;
            return;
        }

        const contentHtml = content.map(item => this.createContentItemHtml(item)).join('');
        container.innerHTML = contentHtml;
    }

    createContentItemHtml(item) {
        const timeAgo = this.getTimeAgo(item.timestamp);
        const readTime = this.formatReadTime(item.timeSpent);
        const summary = item.analysis?.summary || 'No summary available';
        const tags = item.analysis?.tags || [];
        const syncStatus = item.synced ? '✅ Synced' : '⏳ Not synced';

        return `
            <div class="content-item" data-url="${item.url}">
                <div class="item-header">
                    <div class="item-title">${this.escapeHtml(item.title)}</div>
                    <div class="item-meta">
                        <span class="meta-item">⏱️ ${readTime}</span>
                        <span class="meta-item">🕒 ${timeAgo}</span>
                        <span class="meta-item" style="color: ${item.synced ? '#059669' : '#d97706'}">${syncStatus}</span>
                    </div>
                </div>
                
                ${summary ? `<div class="item-summary">${this.escapeHtml(summary)}</div>` : ''}
                
                <div class="item-meta">
                    <span class="domain-badge">${item.domain}</span>
                    <span class="type-badge type-${item.type}">${item.type}</span>
                    ${item.analysis?.contentQuality ? 
                        `<span class="quality-badge quality-${item.analysis.contentQuality}">${item.analysis.contentQuality}</span>` 
                        : ''}
                    ${item.author ? `<span class="meta-item">👤 ${this.escapeHtml(item.author)}</span>` : ''}
                </div>
                
                ${tags.length > 0 ? `
                    <div class="tags">
                        ${tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        if (weeks < 4) return `${weeks}w ago`;
        if (months < 12) return `${months}mo ago`;
        
        return date.toLocaleDateString();
    }

    formatReadTime(seconds) {
        if (!seconds) return '0s';
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (mins === 0) return `${secs}s`;a
        if (mins < 60) return `${mins}m ${secs}s`;
        
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hours}h ${remainingMins}m`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    exportData() {
        const exportData = {
            exportDate: new Date().toISOString(),
            totalItems: this.allContent.length,
            content: this.allContent.map(item => ({
                title: item.title,
                url: item.url,
                domain: item.domain,
                type: item.type,
                author: item.author,
                timestamp: item.timestamp,
                timeSpent: item.timeSpent,
                summary: item.analysis?.summary,
                quality: item.analysis?.contentQuality,
                tags: item.analysis?.tags,
                synced: item.synced
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `smart-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showError() {
        const container = document.getElementById('contentList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Error loading content</h3>
                <p>Please refresh the page or check your extension settings.</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});