class SmartTracker {
    constructor() {
        this.isProcessing = false;
        this.contentQueue = [];
        this.aiModel = null;
        this.modelLoaded = false;
        this.apiEndpoint = 'https://your-api-domain.com/api'; // Update this
        
        this.init();
    }
  
    async init() {
        console.log('Smart Tracker initialized');
        
        // Listen for messages from content scripts
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
  
        // Initialize AI model
        this.initializeAI();
    }
  
    async initializeAI() {
        try {
            console.log('Initializing local AI model...');
            // Simple scoring system (WebLLM integration can be added later)
            this.modelLoaded = true;
            console.log('AI model ready');
        } catch (error) {
            console.error('Failed to initialize AI model:', error);
        }
    }
  
    async handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'trackContent':
                await this.processContent(request.data);
                sendResponse({ success: true });
                break;
            
            case 'updateTimeSpent':
                await this.updateTimeSpent(request.data);
                sendResponse({ success: true });
                break;
            
            case 'getTrackedContent':
                const content = await this.getTrackedContent();
                sendResponse({ content });
                break;
            
            case 'getStats':
                const stats = await this.getStats();
                sendResponse({ stats });
                break;
  
            case 'syncToWebsite':
                await this.syncToWebsite(request.data);
                sendResponse({ success: true });
                break;
  
            case 'getSettings':
                const settings = await this.getSettings();
                sendResponse({ settings });
                break;
  
            case 'saveSettings':
                await this.saveSettings(request.data);
                sendResponse({ success: true });
                break;
        }
    }
  
    async processContent(data) {
        if (this.isProcessing) {
            this.contentQueue.push(data);
            return;
        }
  
        this.isProcessing = true;
        const settings = await this.getSettings();
  
        try {
            const analysis = await this.analyzeContent(data);
            
            if (analysis.shouldSave) {
                await this.saveContent(data, analysis);
                console.log('Content saved:', data.title);
                
                // Auto-sync to website if enabled
                const settings = await this.getSettings();
                if (settings.autoSync && analysis.score >= 60) {
                    await this.syncToWebsite(data);
                }
            }
  
        } catch (error) {
            console.error('Error processing content:', error);
        } finally {
            this.isProcessing = false;
            
            if (this.contentQueue.length > 0) {
                const nextContent = this.contentQueue.shift();
                setTimeout(() => this.processContent(nextContent), 1000);
            }
        }
    }
  
    async analyzeContent(data) {
        let score = 0;
        let shouldSave = false;
        let summary = '';
        let tags = [];
  
        // Content length check
        if (data.content && data.content.length > 500) score += 20;
        if (data.content && data.content.length > 1500) score += 20;
  
        // Time spent check
        if (data.timeSpent > 30) score += 15;
        if (data.timeSpent > 120) score += 15;
        if (data.timeSpent > 300) score += 20;
  
        // Domain reputation
        const qualityDomains = [
            'medium.com', 'dev.to', 'stackoverflow.com', 'github.com',
            'arxiv.org', 'news.ycombinator.com', 'reddit.com',
            'wikipedia.org', 'bbc.com', 'nytimes.com', 'theguardian.com',
            'youtube.com', 'vimeo.com', 'coursera.org', 'udemy.com'
        ];
        
        if (qualityDomains.some(domain => data.domain.includes(domain))) {
            score += 25;
        }
  
        if (data.type === 'video') {
            score += 15;
        }
  
        if (data.content) {
            summary = this.generateSimpleSummary(data.content);
            tags = this.extractSimpleTags(data.content, data.title);
        }
  
        shouldSave = score >= 40;
  
        return {
            score,
            shouldSave,
            summary,
            tags,
            analysis: {
                contentQuality: score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low',
                engagementLevel: data.timeSpent > 300 ? 'high' : data.timeSpent > 60 ? 'medium' : 'low'
            }
        };
    }
  
    generateSimpleSummary(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const summary = sentences.slice(0, 3).join('. ').trim();
        return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    }
  
    extractSimpleTags(content, title) {
        const commonWords = [
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
        ];
  
        const text = (title + ' ' + content).toLowerCase();
        const words = text.match(/\b\w{4,}\b/g) || [];
        
        const wordCount = {};
        words.forEach(word => {
            if (!commonWords.includes(word)) {
                wordCount[word] = (wordCount[word] || 0) + 1;
            }
        });
  
        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }
  
    async saveContent(data, analysis) {
        const contentItem = {
            id: Date.now() + Math.random(),
            ...data,
            analysis,
            createdAt: new Date().toISOString(),
            isPublic: true,
            synced: false
        };
  
        const result = await chrome.storage.local.get(['trackedContent']) || {};
        const existingContent = result.trackedContent || [];
  
        const duplicate = existingContent.find(item => 
            item.url === data.url || 
            (item.title === data.title && item.domain === data.domain)
        );
  
        if (!duplicate) {
            existingContent.unshift(contentItem);
            
            if (existingContent.length > 1000) {
                existingContent.splice(1000);
            }
  
            await chrome.storage.local.set({ trackedContent: existingContent });
        }
    }
  
    async syncToWebsite(data) {
        try {
            const settings = await this.getSettings();
            if (!settings.apiKey || !settings.username) {
                console.log('API key or username not configured');
                return;
            }
  
            const response = await fetch(`${this.apiEndpoint}/content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    title: data.title,
                    url: data.url,
                    domain: data.domain,
                    type: data.type,
                    author: data.author,
                    summary: data.analysis?.summary,
                    tags: data.analysis?.tags,
                    timeSpent: data.timeSpent,
                    quality: data.analysis?.contentQuality,
                    isPublic: data.isPublic !== false
                })
            });
  
            if (response.ok) {
                // Mark as synced
                const result = await chrome.storage.local.get(['trackedContent']);
                const content = result.trackedContent || [];
                const item = content.find(item => item.url === data.url);
                if (item) {
                    item.synced = true;
                    await chrome.storage.local.set({ trackedContent: content });
                }
                console.log('Content synced to website');
            }
        } catch (error) {
            console.error('Error syncing to website:', error);
        }
    }
  
    async getSettings() {
        const result = await chrome.storage.local.get(['settings']);
        return result.settings || {
            autoSync: false,
            apiKey: '',
            username: '',
            website: 'https://your-website.com'
        };
    }
  
    async saveSettings(settings) {
        await chrome.storage.local.set({ settings });
    }
  
    async updateTimeSpent(data) {
        const result = await chrome.storage.local.get(['trackedContent']);
        const content = result.trackedContent || [];
        
        const item = content.find(item => item.url === data.url);
        if (item) {
            item.timeSpent = data.timeSpent;
            await chrome.storage.local.set({ trackedContent: content });
        }
    }
  
    async getTrackedContent(limit = 50) {
        const result = await chrome.storage.local.get(['trackedContent']);
        const content = result.trackedContent || [];
        return content.slice(0, limit);
    }
  
    async getStats() {
        const result = await chrome.storage.local.get(['trackedContent']);
        const content = result.trackedContent || [];
  
        const stats = {
            totalItems: content.length,
            articles: content.filter(item => item.type === 'article').length,
            videos: content.filter(item => item.type === 'video').length,
            totalTimeSpent: content.reduce((sum, item) => sum + (item.timeSpent || 0), 0),
            syncedItems: content.filter(item => item.synced).length,
            topDomains: this.getTopDomains(content),
            recentActivity: content.slice(0, 10)
        };
  
        return stats;
    }
  
    getTopDomains(content) {
        const domainCount = {};
        content.forEach(item => {
            domainCount[item.domain] = (domainCount[item.domain] || 0) + 1;
        });
  
        return Object.entries(domainCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([domain, count]) => ({ domain, count }));
    }
  }
  
  const tracker = new SmartTracker();
  