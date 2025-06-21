class SettingsManager {
    constructor() {
        this.defaultSettings = {
            websiteUrl: 'https://your-reading-list.com',
            username: '',
            apiKey: '',
            autoSync: false,
            minTimeSpent: 30,
            minContentLength: 500,
            trackVideos: true,
            trackArticles: true,
            shareByDefault: true,
            excludedDomains: 'gmail.com\ncalendar.google.com\ndrive.google.com\nfacebook.com\ntwitter.com',
            dataRetention: 365,
            qualityThreshold: 40,
            generateSummaries: true,
            extractTags: true
        };
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateConnectionStatus();
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
            const settings = response.settings || {};
            
            // Merge with defaults
            this.currentSettings = { ...this.defaultSettings, ...settings };
            
            // Populate form fields
            this.populateForm();
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.currentSettings = this.defaultSettings;
            this.populateForm();
        }
    }

    populateForm() {
        // Text inputs
        document.getElementById('websiteUrl').value = this.currentSettings.websiteUrl || '';
        document.getElementById('username').value = this.currentSettings.username || '';
        document.getElementById('apiKey').value = this.currentSettings.apiKey || '';
        document.getElementById('minTimeSpent').value = this.currentSettings.minTimeSpent || 30;
        document.getElementById('minContentLength').value = this.currentSettings.minContentLength || 500;
        document.getElementById('excludedDomains').value = this.currentSettings.excludedDomains || '';
        document.getElementById('dataRetention').value = this.currentSettings.dataRetention || 365;
        document.getElementById('qualityThreshold').value = this.currentSettings.qualityThreshold || 40;
        
        // Checkboxes
        document.getElementById('autoSync').checked = this.currentSettings.autoSync || false;
        document.getElementById('trackVideos').checked = this.currentSettings.trackVideos !== false;
        document.getElementById('trackArticles').checked = this.currentSettings.trackArticles !== false;
        document.getElementById('shareByDefault').checked = this.currentSettings.shareByDefault !== false;
        document.getElementById('generateSummaries').checked = this.currentSettings.generateSummaries !== false;
        document.getElementById('extractTags').checked = this.currentSettings.extractTags !== false;
        
        // Update quality threshold display
        this.updateQualityThresholdDisplay();
    }

    setupEventListeners() {
        // Save settings button
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Test connection button
        document.getElementById('testConnection').addEventListener('click', () => {
            this.testApiConnection();
        });

        // Reset settings button
        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetToDefaults();
        });

        // Quality threshold slider
        document.getElementById('qualityThreshold').addEventListener('input', (e) => {
            this.updateQualityThresholdDisplay();
        });

        // Real-time validation for API fields
        document.getElementById('websiteUrl').addEventListener('blur', () => {
            this.validateWebsiteUrl();
        });

        document.getElementById('apiKey').addEventListener('input', () => {
            this.updateConnectionStatus();
        });

        document.getElementById('username').addEventListener('input', () => {
            this.updateConnectionStatus();
        });
    }

    updateQualityThresholdDisplay() {
        const slider = document.getElementById('qualityThreshold');
        const display = document.getElementById('qualityValue');
        const value = parseInt(slider.value);
        
        let label = 'Medium';
        if (value < 30) label = 'Low';
        else if (value > 60) label = 'High';
        
        display.textContent = `${label} (${value})`;
    }

    validateWebsiteUrl() {
        const urlInput = document.getElementById('websiteUrl');
        const url = urlInput.value.trim();
        
        if (url && !this.isValidUrl(url)) {
            urlInput.style.borderColor = '#dc2626';
            this.showNotification('Please enter a valid website URL', 'error');
        } else {
            urlInput.style.borderColor = '#d1d5db';
        }
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async saveSettings() {
        const saveBtn = document.getElementById('saveSettings');
        const originalText = saveBtn.textContent;
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            // Collect form data
            const formData = {
                websiteUrl: document.getElementById('websiteUrl').value.trim(),
                username: document.getElementById('username').value.trim(),
                apiKey: document.getElementById('apiKey').value.trim(),
                autoSync: document.getElementById('autoSync').checked,
                minTimeSpent: parseInt(document.getElementById('minTimeSpent').value),
                minContentLength: parseInt(document.getElementById('minContentLength').value),
                trackVideos: document.getElementById('trackVideos').checked,
                trackArticles: document.getElementById('trackArticles').checked,
                shareByDefault: document.getElementById('shareByDefault').checked,
                excludedDomains: document.getElementById('excludedDomains').value.trim(),
                dataRetention: parseInt(document.getElementById('dataRetention').value),
                qualityThreshold: parseInt(document.getElementById('qualityThreshold').value),
                generateSummaries: document.getElementById('generateSummaries').checked,
                extractTags: document.getElementById('extractTags').checked
            };

            // Validate required fields
            if (formData.autoSync && (!formData.websiteUrl || !formData.username || !formData.apiKey)) {
                throw new Error('Website URL, username, and API key are required for auto-sync');
            }

            // Validate URL format
            if (formData.websiteUrl && !this.isValidUrl(formData.websiteUrl)) {
                throw new Error('Please enter a valid website URL');
            }

            // Save to chrome storage
            await chrome.runtime.sendMessage({
                action: 'saveSettings',
                data: formData
            });

            this.currentSettings = formData;
            this.updateConnectionStatus();
            this.showNotification('Settings saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification(error.message || 'Failed to save settings', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async testApiConnection() {
        const testBtn = document.getElementById('testConnection');
        const originalText = testBtn.textContent;
        
        try {
            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';
            
            const websiteUrl = document.getElementById('websiteUrl').value.trim();
            const username = document.getElementById('username').value.trim();
            const apiKey = document.getElementById('apiKey').value.trim();
            
            if (!websiteUrl || !username || !apiKey) {
                throw new Error('Please fill in all API connection fields');
            }

            // Test the API connection
            const response = await fetch(`${websiteUrl}/api/test`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showNotification(`Connection successful! Connected as ${data.username || username}`, 'success');
                this.updateConnectionStatus(true);
            } else {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            console.error('API connection test failed:', error);
            this.showNotification(error.message || 'Connection test failed', 'error');
            this.updateConnectionStatus(false);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }

    updateConnectionStatus(forceStatus = null) {
        const statusEl = document.getElementById('connectionStatus');
        const websiteUrl = document.getElementById('websiteUrl').value.trim();
        const username = document.getElementById('username').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();
        
        const hasCredentials = websiteUrl && username && apiKey;
        const isConnected = forceStatus !== null ? forceStatus : hasCredentials;
        
        if (isConnected) {
            statusEl.textContent = 'Connected';
            statusEl.className = 'status-indicator status-connected';
        } else {
            statusEl.textContent = 'Not Connected';
            statusEl.className = 'status-indicator status-disconnected';
        }
    }

    async resetToDefaults() {
        if (!confirm('Are you sure you want to reset all settings to default values? This cannot be undone.')) {
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                action: 'saveSettings',
                data: this.defaultSettings
            });

            this.currentSettings = { ...this.defaultSettings };
            this.populateForm();
            this.updateConnectionStatus();
            this.showNotification('Settings reset to defaults', 'success');

        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showNotification('Failed to reset settings', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 400px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});