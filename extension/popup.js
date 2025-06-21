// popup.js - Popup interface logic

class PopupManager {
  constructor() {
      this.init();
  }

  async init() {
      await this.loadData();
      this.setupEventListeners();
  }

  async loadData() {
      try {
          // Get stats from background script
          const response = await chrome.runtime.sendMessage({ action: 'getStats' });
          const stats = response.stats;

          this.updateStats(stats);
          this.displayRecentItems(stats.recentActivity);

      } catch (error) {
          console.error('Error loading data:', error);
          this.showError();
      }
  }

  updateStats(stats) {
      const totalItemsEl = document.getElementById('totalItems');
      const totalTimeEl = document.getElementById('totalTime');

      totalItemsEl.textContent = stats.totalItems || 0;
      
      const hours = Math.floor((stats.totalTimeSpent || 0) / 3600);
      totalTimeEl.textContent = hours;
  }

  displayRecentItems(items) {
      const container = document.getElementById('recentItems');
      
      if (!items || items.length === 0) {
          container.innerHTML = `
              <div class="empty-state">
                  <div style="font-size: 48px; margin-bottom: 10px;">📖</div>
                  <div style="font-weight: 500; margin-bottom: 5px;">No content tracked yet</div>
                  <div style="font-size: 12px;">Browse some articles or watch videos to get started!</div>
              </div>
          `;
          return;
      }

      const itemsHtml = items.map(item => this.createItemHtml(item)).join('');
      container.innerHTML = itemsHtml;
  }

  createItemHtml(item) {
      const timeAgo = this.getTimeAgo(item.timestamp);
      const readTime = this.formatReadTime(item.timeSpent);
      const qualityClass = this.getQualityClass(item.analysis?.contentQuality);
      
      return `
          <div class="recent-item" data-url="${item.url}">
              <div class="item-title">${this.escapeHtml(item.title)}</div>
              <div class="item-meta">
                  <div>
                      <span class="item-domain">${item.domain}</span>
                      ${item.analysis?.contentQuality ? `<span class="quality-badge quality-${item.analysis.contentQuality}">${item.analysis.contentQuality}</span>` : ''}
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                      <span>${readTime}</span>
                      <span>${timeAgo}</span>
                  </div>
              </div>
          </div>
      `;
  }

  getQualityClass(quality) {
      switch (quality) {
          case 'high': return 'quality-high';
          case 'medium': return 'quality-medium';
          case 'low': return 'quality-low';
          default: return '';
      }
  }

  getTimeAgo(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 1) return 'now';
      if (minutes < 60) return `${minutes}m`;
      if (hours < 24) return `${hours}h`;
      return `${days}d`;
  }

  formatReadTime(seconds) {
      if (!seconds) return '0s';
      
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      
      if (mins === 0) return `${secs}s`;
      if (secs === 0) return `${mins}m`;
      return `${mins}m ${secs}s`;
  }

  escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  }

  setupEventListeners() {
      // View All button
      document.getElementById('viewAllBtn').addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      });

      // Settings button
      document.getElementById('settingsBtn').addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      });

      // Click on recent items to open URL
      document.addEventListener('click', (e) => {
          const itemEl = e.target.closest('.recent-item');
          if (itemEl) {
              const url = itemEl.dataset.url;
              if (url) {
                  chrome.tabs.create({ url: url });
              }
          }
      });

      // Refresh button (hidden, can be triggered by clicking header)
      document.querySelector('.header').addEventListener('click', () => {
          this.loadData();
      });
  }

  showError() {
      const container = document.getElementById('recentItems');
      container.innerHTML = `
          <div class="empty-state">
              <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
              <div style="font-weight: 500; margin-bottom: 5px;">Error loading data</div>
              <div style="font-size: 12px;">Please try refreshing the extension</div>
          </div>
      `;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});