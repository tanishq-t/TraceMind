(function() {
    'use strict';
  
    let lastUrl = location.href;
    let contentData = null;
    let timeSpent = 0;
    let startTime = Date.now();
  
    function extractArticleContent() {
        const selectors = [
            'article',
            '[role="main"]',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            'main',
            '.story-body',
            '.article-body'
        ];
  
        let content = '';
        let title = '';
        let author = '';
  
        title = document.title || '';
        
        const authorSelectors = [
            '[rel="author"]',
            '.author',
            '.byline',
            '[data-author]',
            '.post-author'
        ];
        
        for (let selector of authorSelectors) {
            const authorEl = document.querySelector(selector);
            if (authorEl) {
                author = authorEl.textContent.trim();
                break;
            }
        }
  
        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                content = element.textContent.trim();
                if (content.length > 200) {
                    break;
                }
            }
        }
  
        if (content.length < 200) {
            content = document.body.textContent.trim();
        }
  
        return {
            title: title,
            author: author,
            content: content.substring(0, 3000),
            url: window.location.href,
            domain: window.location.hostname,
            timestamp: Date.now(),
            type: 'article'
        };
    }
  
    function extractVideoContent() {
        let videoData = null;
  
        if (window.location.hostname.includes('youtube.com')) {
            videoData = {
                title: document.title.replace(' - YouTube', ''),
                channel: document.querySelector('#channel-name a, #owner-name a')?.textContent?.trim() || '',
                description: document.querySelector('#description')?.textContent?.trim()?.substring(0, 500) || '',
                url: window.location.href,
                domain: 'youtube.com',
                timestamp: Date.now(),
                type: 'video',
                platform: 'YouTube'
            };
        }
        else if (window.location.hostname.includes('vimeo.com')) {
            videoData = {
                title: document.querySelector('.player_title')?.textContent?.trim() || document.title,
                channel: document.querySelector('.byline a')?.textContent?.trim() || '',
                description: document.querySelector('.description')?.textContent?.trim()?.substring(0, 500) || '',
                url: window.location.href,
                domain: 'vimeo.com',
                timestamp: Date.now(),
                type: 'video',
                platform: 'Vimeo'
            };
        }
        else if (document.querySelector('video')) {
            videoData = {
                title: document.title,
                channel: window.location.hostname,
                description: document.querySelector('meta[name="description"]')?.content || '',
                url: window.location.href,
                domain: window.location.hostname,
                timestamp: Date.now(),
                type: 'video',
                platform: 'Other'
            };
        }
  
        return videoData;
    }
  
    function isContentWorthTracking(data) {
        if (!data) return false;
        
        if (data.content && data.content.length < 100) return false;
        
        const skipDomains = ['google.com', 'gmail.com', 'calendar.google.com', 'drive.google.com'];
        if (skipDomains.some(domain => data.domain.includes(domain))) return false;
        
        const skipPatterns = ['/search', '/login', '/register', '/account', '/settings', '/admin'];
        if (skipPatterns.some(pattern => data.url.includes(pattern))) return false;
        
        return true;
    }
  
    function trackTimeSpent() {
        const now = Date.now();
        timeSpent = Math.floor((now - startTime) / 1000);
    }
  
    function sendToBackground(action, data) {
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                action: action,
                data: data
            });
        }
    }
  
    function analyzeCurrentPage() {
        let data = null;
  
        data = extractVideoContent();
        
        if (!data) {
            data = extractArticleContent();
        }
  
        trackTimeSpent();
        if (data) {
            data.timeSpent = timeSpent;
        }
  
        if (isContentWorthTracking(data)) {
            contentData = data;
            sendToBackground('trackContent', data);
        }
    }
  
    function handleUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            startTime = Date.now();
            timeSpent = 0;
            
            setTimeout(analyzeCurrentPage, 2000);
        }
    }
  
    setInterval(handleUrlChange, 1000);
  
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(analyzeCurrentPage, 2000);
        });
    } else {
        setTimeout(analyzeCurrentPage, 2000);
    }
  
    window.addEventListener('beforeunload', () => {
        trackTimeSpent();
        if (contentData) {
            contentData.timeSpent = timeSpent;
            sendToBackground('updateTimeSpent', contentData);
        }
    });
  
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            trackTimeSpent();
        } else {
            startTime = Date.now();
        }
    });
  
  })();
  