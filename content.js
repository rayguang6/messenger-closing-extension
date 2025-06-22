// Facebook Chat AI Assistant - Content Script
console.log('🤖 Facebook Chat AI Assistant loaded!');

// Your working message scraping function (cleaned up)
function scrapeMessagesWithContext() {
    const messageNodes = document.querySelectorAll('div[data-scope="messages_table"][role="gridcell"]');
    const messages = [];
    let lastSender = 'Unknown Sender';
    
    messageNodes.forEach(node => {
        const senderElement = node.querySelector('h5');
        if (senderElement) {
            lastSender = senderElement.innerText.trim();
        }
        
        const textElement = node.querySelector('.x1gslohp');
        if (textElement) {
            const text = textElement.innerText.trim();
            if (text) {
                messages.push({
                    sender: lastSender,
                    message: text,
                    isUser: lastSender.includes('You sent') || lastSender.includes('You replied')
                });
            }
        }
    });
    
    return messages;
}

// Create side panel
function createSidePanel() {
    // Remove existing panel if it exists
    const existingPanel = document.getElementById('closing-coach-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'closing-coach-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        max-height: 600px;
        background: white;
        border: 1px solid #e1e5e9;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
    `;
    
    panel.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">🤖 Closing Coach</h3>
                <div style="font-size: 12px; opacity: 0.9;">AI Sales Assistant</div>
            </div>
            <button id="close-panel" style="
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
                font-size: 14px;
            ">✕</button>
        </div>
        
        <div style="padding: 16px;">
            <div style="margin-bottom: 16px;">
                <button id="get-suggestions-btn" style="
                    width: 100%;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                ">
                    🔍 Get Suggestions
                </button>
            </div>
            
            <div id="conversation-info" style="
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 16px;
                font-size: 13px;
                color: #495057;
            ">
                Click "Get Suggestions" to analyze the conversation
            </div>
            
            <div id="suggestions-container" style="
                max-height: 300px;
                overflow-y: auto;
            ">
                <div style="text-align: center; color: #6c757d; font-size: 13px; padding: 20px;">
                    No suggestions yet.<br>Start by analyzing the conversation!
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Add event listeners
    setupPanelEvents();
    
    return panel;
}

// Setup panel event listeners
function setupPanelEvents() {
    // Close panel button
    document.getElementById('close-panel').addEventListener('click', () => {
        document.getElementById('closing-coach-panel').remove();
    });
    
    // Get suggestions button
    document.getElementById('get-suggestions-btn').addEventListener('click', () => {
        analyzeConversation();
    });
}

// Analyze conversation and show results
function analyzeConversation() {
    const button = document.getElementById('get-suggestions-btn');
    const infoDiv = document.getElementById('conversation-info');
    const suggestionsContainer = document.getElementById('suggestions-container');
    
    // Show loading state
    button.textContent = '🔄 Analyzing...';
    button.disabled = true;
    
    // Get messages
    const messages = scrapeMessagesWithContext();
    
    setTimeout(() => { // Simulate processing time
        if (messages.length > 0) {
            // Update conversation info
            const userMessages = messages.filter(m => m.isUser).length;
            const otherMessages = messages.length - userMessages;
            
            infoDiv.innerHTML = `
                <strong>📊 Conversation Analysis:</strong><br>
                • Total messages: ${messages.length}<br>
                • Your messages: ${userMessages}<br>
                • Their messages: ${otherMessages}<br>
                • Last sender: ${messages[messages.length - 1].sender}
            `;
            
            // Show simple suggestions (we'll improve this later)
            suggestionsContainer.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #495057;">💡 Suggested Responses:</h4>
                </div>
                
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px;">That's great to hear! Can you tell me more about what you're looking for specifically?</p>
                    <button class="copy-btn" data-text="That's great to hear! Can you tell me more about what you're looking for specifically?" style="
                        background: #28a745; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; float: right;
                    ">Copy</button>
                    <div style="clear: both;"></div>
                </div>
                
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px;">I understand your needs. What's your timeline for this project?</p>
                    <button class="copy-btn" data-text="I understand your needs. What's your timeline for this project?" style="
                        background: #28a745; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; float: right;
                    ">Copy</button>
                    <div style="clear: both;"></div>
                </div>
                
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px;">Perfect! What's your budget range for this type of project?</p>
                    <button class="copy-btn" data-text="Perfect! What's your budget range for this type of project?" style="
                        background: #28a745; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; float: right;
                    ">Copy</button>
                    <div style="clear: both;"></div>
                </div>
            `;
            
            // Add copy functionality
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(btn.dataset.text);
                    btn.textContent = 'Copied!';
                    btn.style.background = '#6c757d';
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                        btn.style.background = '#28a745';
                    }, 1000);
                });
            });
            
        } else {
            infoDiv.innerHTML = `
                <strong>⚠️ No Messages Found</strong><br>
                Make sure you're in a chat conversation and try again.
            `;
            suggestionsContainer.innerHTML = `
                <div style="text-align: center; color: #dc3545; font-size: 13px; padding: 20px;">
                    No conversation detected.<br>
                    Open a chat and try again.
                </div>
            `;
        }
        
        // Reset button
        button.textContent = '🔍 Get Suggestions';
        button.disabled = false;
        
        // Log to console for debugging
        console.log('📊 Conversation analysis:', {
            messageCount: messages.length,
            messages: messages
        });
        
    }, 1000); // 1 second delay to show loading
}

// Add message listener for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Message received from popup:', request);
    
    switch (request.action) {
        case 'showPanel':
            createSidePanel();
            sendResponse({ success: true, message: 'Panel shown' });
            break;
            
        case 'hidePanel':
            const panel = document.getElementById('closing-coach-panel');
            if (panel) {
                panel.remove();
                sendResponse({ success: true, message: 'Panel hidden' });
            } else {
                sendResponse({ success: false, message: 'Panel not found' });
            }
            break;
            
        case 'refresh':
            // Remove existing panel and recreate
            const existingPanel = document.getElementById('closing-coach-panel');
            if (existingPanel) {
                existingPanel.remove();
            }
            setTimeout(() => {
                createSidePanel();
            }, 500);
            sendResponse({ success: true, message: 'Extension refreshed' });
            break;
            
        default:
            sendResponse({ success: false, message: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async response
});

// Initialize the extension (modified to not auto-show panel)
function initializeExtension() {
    if (window.location.hostname === 'www.facebook.com') {
        console.log('✅ Closing Coach loaded on Facebook');
        console.log('💡 Click the extension icon to show/hide the AI panel');
        
        // Don't auto-create panel anymore - let user control it via popup
        // createSidePanel();
    }
}

// Start the extension
initializeExtension();