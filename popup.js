// Popup control script
console.log('🎛️ Popup script loaded');

// Check if we're on Facebook and update status
async function checkStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const infoText = document.getElementById('info-text');
        
        if (tab.url && tab.url.includes('facebook.com')) {
            statusDot.className = 'status-indicator status-active';
            statusText.textContent = 'Active on Facebook';
            infoText.textContent = 'Ready to assist with your conversations!';
            
            // Enable buttons
            document.getElementById('show-panel-btn').disabled = false;
            document.getElementById('hide-panel-btn').disabled = false;
        } else {
            statusDot.className = 'status-indicator status-inactive';
            statusText.textContent = 'Not on Facebook';
            infoText.textContent = 'Navigate to Facebook.com to use the AI assistant';
            
            // Disable buttons
            document.getElementById('show-panel-btn').disabled = true;
            document.getElementById('hide-panel-btn').disabled = true;
        }
    } catch (error) {
        console.error('Error checking status:', error);
        document.getElementById('status-text').textContent = 'Error checking status';
    }
}

// Send message to content script
async function sendMessageToContentScript(action) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.id) {
            const response = await chrome.tabs.sendMessage(tab.id, { action: action });
            console.log('Response from content script:', response);
            return response;
        }
    } catch (error) {
        console.error('Error sending message:', error);
        return { success: false, error: error.message };
    }
}

// Set up button event listeners
function setupEventListeners() {
    // Show panel button
    document.getElementById('show-panel-btn').addEventListener('click', async () => {
        const btn = document.getElementById('show-panel-btn');
        btn.textContent = '⏳ Opening...';
        btn.disabled = true;
        
        const result = await sendMessageToContentScript('showPanel');
        
        setTimeout(() => {
            btn.textContent = '📱 Show AI Panel';
            btn.disabled = false;
            
            if (result && result.success) {
                document.getElementById('info-text').textContent = 'AI Panel is now visible on Facebook!';
            } else {
                document.getElementById('info-text').textContent = 'Error: Make sure you\'re on Facebook.com';
            }
        }, 500);
    });
    
    // Hide panel button
    document.getElementById('hide-panel-btn').addEventListener('click', async () => {
        const btn = document.getElementById('hide-panel-btn');
        btn.textContent = '⏳ Hiding...';
        btn.disabled = true;
        
        const result = await sendMessageToContentScript('hidePanel');
        
        setTimeout(() => {
            btn.textContent = '🙈 Hide Panel';
            btn.disabled = false;
            
            if (result && result.success) {
                document.getElementById('info-text').textContent = 'AI Panel has been hidden';
            }
        }, 500);
    });
    
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        const btn = document.getElementById('refresh-btn');
        btn.textContent = '⏳ Refreshing...';
        btn.disabled = true;
        
        await sendMessageToContentScript('refresh');
        
        setTimeout(() => {
            btn.textContent = '🔄 Refresh Extension';
            btn.disabled = false;
            document.getElementById('info-text').textContent = 'Extension refreshed successfully!';
        }, 1000);
    });

    // Open Testing Panel button
    document.getElementById('open-testing-btn').addEventListener('click', () => {
        const url = chrome.runtime.getURL('testing/testing.html');
        chrome.tabs.create({ url });
    });
}

// Initialize popup
function initializePopup() {
    checkStatus();
    setupEventListeners();
    
    // Update status every few seconds
    setInterval(checkStatus, 3000);
}

// Start when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}