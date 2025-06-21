// background.js - Fixed version without dynamic imports

class SmartTracker {
    constructor() {
        this.isProcessing = false;
        this.contentQueue = [];
        this.webLLM = null;
        this.modelLoaded = false;
        this.apiEndpoint = 'https://your-api-domain.com/api';
        
        this.init();
    }

    async init() {
        console.log('Smart Tracker initialized');
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // Try to initialize WebLLM if available
        await this.initializeWebLLM();
    }

    async initializeWebLLM() {
        try {
            console.log('Checking for WebLLM availability...');
            
            // Check if WebLLM is available globally (loaded via manifest)
            if (typeof window !== 'undefined' && window.webllm) {
                console.log('WebLLM found in global scope');
                this.webLLM = window.webllm;
                await this.loadModel();
            } else if (typeof self !== 'undefined' && self.webllm) {
                console.log('WebLLM found in service worker scope');
                this.webLLM = self.webllm;
                await this.loadModel();
            } else {
                throw new Error('WebLLM not available');
            }
            
        } catch (error) {
            console.error('WebLLM initialization failed:', error);
            this.modelLoaded = false;
            console.log('Using fallback scoring system');
        }
    }

    async loadModel() {
        try {
            if (this.webLLM && this.webLLM.CreateMLCEngine) {
                console.log('Loading WebLLM model...');
                
                this.engine = await this.webLLM.CreateMLCEngine("Phi-3-mini-4k-instruct-q4f16_1-MLC", {
                    initProgressCallback: (progress) => {
                        console.log(`Model loading: ${progress.text} ${Math.round(progress.progress * 100)}%`);
                    }
                });
                
                this.modelLoaded = true;
                console.log('WebLLM model successfully loaded!');
            }
        } catch (error) {
            console.error('Model loading failed:', error);
            this.modelLoaded = false;
        }
    }

    // Alternative: Use offscreen document for WebLLM
    async initializeWithOffscreen() {
        try {
            // Create offscreen document for WebLLM
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['DOM_SCRAPING'],
                justification: 'Run WebLLM for content analysis'
            });

            // Send message to offscreen document to initialize WebLLM
            const response = await chrome.runtime.sendMessage({
                action: 'initializeWebLLM'
            });

            if (response.success) {
                this.modelLoaded = true;
                console.log('WebLLM initialized in offscreen document');
            }
        } catch (error) {
            console.error('Offscreen WebLLM initialization failed:', error);
            this.modelLoaded = false;
        }
    }

    // Content analysis with WebLLM (modified for service worker)
    async analyzeContentWithWebLLM(data) {
        if (!this.modelLoaded) {
            return await this.analyzeContentFallback(data);
        }

        try {
            let analysis;

            if (this.engine) {
                // Direct WebLLM usage
                analysis = await this.runDirectAnalysis(data);
            } else {
                // Use offscreen document
                analysis = await this.runOffscreenAnalysis(data);
            }

            return analysis;

        } catch (error) {
            console.error('WebLLM analysis failed:', error);
            return await this.analyzeContentFallback(data);
        }
    }

    async runDirectAnalysis(data) {
        const prompt = `Analyze this content and provide a JSON response:
Title: "${data.title}"
Domain: "${data.domain}"
Content: "${data.content?.substring(0, 1000) || 'No content'}"
Time spent: ${data.timeSpent} seconds

Please provide:
1. Quality score (0-100)
2. Should save (true/false)
3. 2-3 sentence summary
4. 3-5 relevant tags
5. Content category

Response format: {"score": number, "shouldSave": boolean, "summary": "text", "tags": ["tag1", "tag2"], "category": "category"}`;

        const response = await this.engine.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 300
        });

        const aiResponse = response.choices[0].message.content;
        const analysis = JSON.parse(aiResponse);
        
        return {
            score: analysis.score || 50,
            shouldSave: analysis.shouldSave || false,
            summary: analysis.summary || this.generateSimpleSummary(data.content),
            tags: analysis.tags || [],
            category: analysis.category || 'general',
            analysis: {
                contentQuality: analysis.score >= 70 ? 'high' : analysis.score >= 50 ? 'medium' : 'low',
                engagementLevel: data.timeSpent > 300 ? 'high' : data.timeSpent > 60 ? 'medium' : 'low',
                aiGenerated: true
            }
        };
    }

    async runOffscreenAnalysis(data) {
        const response = await chrome.runtime.sendMessage({
            action: 'analyzeContent',
            data: data
        });

        return response.analysis;
    }

    // Fallback method remains the same
    async analyzeContentFallback(data) {
        let score = 0;
        
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
            'wikipedia.org', 'bbc.com', 'nytimes.com'
        ];
        
        if (qualityDomains.some(domain => data.domain.includes(domain))) {
            score += 25;
        }

        return {
            score,
            shouldSave: score >= 40,
            summary: this.generateSimpleSummary(data.content),
            tags: this.extractSimpleTags(data.content, data.title),
            category: 'general',
            analysis: {
                contentQuality: score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low',
                engagementLevel: data.timeSpent > 300 ? 'high' : data.timeSpent > 60 ? 'medium' : 'low',
                aiGenerated: false
            }
        };
    }

    // Rest of your methods remain the same...
    async processContent(data) {
        if (this.isProcessing) {
            this.contentQueue.push(data);
            return;
        }

        this.isProcessing = true;

        try {
            const analysis = await this.analyzeContentWithWebLLM(data);
            
            if (analysis.shouldSave) {
                await this.saveContent(data, analysis);
                console.log('Content saved with analysis:', data.title);
                
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

    generateSimpleSummary(content) {
        if (!content) return '';
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

    getModelStatus() {
        return {
            webLLMLoaded: this.modelLoaded,
            modelType: this.modelLoaded ? 'WebLLM' : 'Fallback',
            isProcessing: this.isProcessing
        };
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

    async handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'trackContent':
                await this.processContent(request.data);
                sendResponse({ success: true });
                break;
            
            case 'getModelStatus':
                sendResponse(this.getModelStatus());
                break;
            
            case 'getTrackedContent':
                const content = await this.getTrackedContent();
                sendResponse({ content });
                break;
            
            case 'getStats':
                const stats = await this.getStats();
                sendResponse({ stats });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
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

        return {
            totalItems: content.length,
            articles: content.filter(item => item.type === 'article').length,
            videos: content.filter(item => item.type === 'video').length,
            totalTimeSpent: content.reduce((sum, item) => sum + (item.timeSpent || 0), 0),
            aiAnalyzedItems: content.filter(item => item.analysis?.aiGenerated).length,
            modelStatus: this.getModelStatus(),
            topDomains: this.getTopDomains(content),
            recentActivity: content.slice(0, 10)
        };
    }

    async getSettings() {
        const result = await chrome.storage.sync.get(['settings']);
        return result.settings || { autoSync: false };
    }

    async syncToWebsite(data) {
        // Implement your sync logic here
        console.log('Syncing to website:', data.title);
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

// Initialize tracker
const tracker = new SmartTracker();