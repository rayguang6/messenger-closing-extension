// Facebook Chat AI Assistant - Content Script
console.log('🤖 Facebook Chat AI Assistant loaded!');

// DeepSeek API integration
// NOTE: Chrome extensions do not support .env files. Store secrets securely, e.g., chrome.storage or prompt user for API key in settings.
const DEEPSEEK_API_KEY = 'sk-c79b321aec774d018f0c055f6ea4606d'; // TODO: Secure this key
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function callDeepSeekAPI(conversation, guide) {
    try {
        // Improved system prompt: extra guard rails against Markdown/code blocks
        const systemPrompt = `You are a sales closing coach. Use the following guide to analyze the conversation and provide 3 actionable reply suggestions. For each, identify the sales stage, give the reply, and explain the reasoning.\n\nYou MUST reply ONLY in valid JSON, as an array of objects with keys: stage, suggestion, reason. Do NOT include any markdown, code blocks, triple backticks, headings, or extra commentary. Reply ONLY with the JSON array. Example:\n\n[\n  {\n    \"stage\": \"Discovery\",\n    \"suggestion\": \"Great! By the way, what kind of project are you working on right now? Are you building something new or improving an existing one?\",\n    \"reason\": \"Shifts from small talk to a business-focused question and helps qualify the lead.\"\n  }\n]\n\nGuide:\n${guide}`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(conversation) }
        ];
        const payload = {
            model: 'deepseek-chat',
            messages,
            max_tokens: 500,
            temperature: 0.7
        };
        console.log('DeepSeek API Request Payload:', payload);
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('DeepSeek API Raw Response:', data);
        // Try to extract JSON block from LLM response
        let content = data.choices?.[0]?.message?.content || '';
        // Remove Markdown code block if present
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) {
            content = codeBlockMatch[1];
        }
        // Remove any leading/trailing whitespace
        content = content.trim();
        try {
            return JSON.parse(content);
        } catch (err) {
            console.warn('DeepSeek response not valid JSON. Raw content:', content);
            return { error: 'parse', raw: content };
        }
    } catch (error) {
        console.error('DeepSeek API Error:', error);
        return { error: 'exception', details: error?.message || error };
    }
}

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
            <div style="margin-bottom: 16px;">
                <button id="test-deepseek-btn" style="
                    width: 100%;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                ">
                    🧪 Test DeepSeek API
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
    
    // Test DeepSeek API button
    document.getElementById('test-deepseek-btn').addEventListener('click', () => {
        testDeepSeekAPI();
    });
}

// Updated analyzeConversation function with better error handling
function analyzeConversation() {
    const button = document.getElementById('get-suggestions-btn');
    const infoDiv = document.getElementById('conversation-info');
    const suggestionsContainer = document.getElementById('suggestions-container');
    
    // Show loading state
    button.textContent = '🔄 Analyzing...';
    button.disabled = true;
    
    // Get messages
    const messages = scrapeMessagesWithContext();
    
    setTimeout(async () => {
        if (messages.length > 0) {
            // Update conversation info
            const userMessages = messages.filter(m => m.isUser).length;
            const otherMessages = messages.length - userMessages;
            
            const messagesHtml = messages.map(m => `
                <div style="padding: 4px 0; border-bottom: 1px solid #f1f3f5; font-size: 12px; word-wrap: break-word;">
                    <strong style="color: ${m.isUser ? '#667eea' : '#764ba2'};">${m.sender}:</strong> ${m.message}
                </div>
            `).join('');

            infoDiv.innerHTML = `
                <strong>📊 Conversation Analysis:</strong><br>
                • Total messages: ${messages.length}<br>
                • Your messages: ${userMessages}<br>
                • Their messages: ${otherMessages}<br>
                • Last sender: ${messages[messages.length - 1].sender}

                <details style="margin-top: 12px;">
                    <summary style="font-weight: 600; cursor: pointer; font-size: 13px; color: #667eea; user-select: none;">
                        View Scraped Messages
                    </summary>
                    <div style="margin-top: 8px; max-height: 150px; overflow-y: auto; background: #fff; border-radius: 6px; padding: 8px; border: 1px solid #e1e5e9;">
                        ${messagesHtml}
                    </div>
                </details>
            `;
            
            // Call DeepSeek API for suggestions
            suggestionsContainer.innerHTML = '<div style="text-align:center;color:#6c757d;font-size:13px;padding:20px;">🤖 Generating AI suggestions...</div>';
            
            try {
                const aiResponse = await callDeepSeekAPI(messages, window.CLOSING_GUIDE || 'Default sales guide');
                
                if (aiResponse && Array.isArray(aiResponse)) {
                    // Success case - display suggestions
                    displaySuggestions(aiResponse, suggestionsContainer);
                } else if (aiResponse && aiResponse.fallback) {
                    // Fallback case - show fallback suggestions with error info
                    console.warn('Using fallback suggestions:', aiResponse);
                    displaySuggestions(aiResponse.fallback, suggestionsContainer);
                    
                    // Show debug info
                    if (aiResponse.raw) {
                        suggestionsContainer.innerHTML = `
                            <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:12px;margin-bottom:12px;font-size:12px;">
                                <strong>⚠️ JSON Parsing Issue</strong><br>
                                Raw AI response: <code style="font-size:11px;background:#f8f9fa;padding:2px 4px;border-radius:3px;">${aiResponse.raw.substring(0, 200)}...</code>
                            </div>
                        ` + suggestionsContainer.innerHTML;
                    }
                } else {
                    // Complete failure case
                    suggestionsContainer.innerHTML = `
                        <div style="text-align:center;color:#dc3545;font-size:13px;padding:20px;">
                            <strong>❌ AI Request Failed</strong><br>
                            ${aiResponse?.message || 'Unknown error occurred'}<br>
                            <small>Check console for details</small>
                        </div>
                    `;
                }
                
            } catch (error) {
                console.error('Unexpected error in analyzeConversation:', error);
                suggestionsContainer.innerHTML = `
                    <div style="text-align:center;color:#dc3545;font-size:13px;padding:20px;">
                        <strong>💥 Unexpected Error</strong><br>
                        ${error.message}<br>
                        <small>Check console for full details</small>
                    </div>
                `;
            }
            
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
        
    }, 1000);
}

// Helper function to display suggestions
function displaySuggestions(suggestions, container) {
    const suggestionsHtml = suggestions.map((s, index) => `
        <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:12px;margin-bottom:12px;">
            <div style="font-size:12px;color:#764ba2;font-weight:600;margin-bottom:4px;">
                ${s.stage || `Suggestion ${index + 1}`}
            </div>
            <div style="font-size:13px;margin-bottom:8px;line-height:1.4;">
                ${s.suggestion || 'No suggestion available'}
            </div>
            <div style="font-size:11px;color:#495057;opacity:0.8;margin-bottom:8px;">
                💡 ${s.reason || 'No reason provided'}
            </div>
            <button 
                class="copy-btn" 
                data-text="${(s.suggestion || '').replace(/"/g, '&quot;')}"
                style="
                    background:#28a745;
                    color:white;
                    border:none;
                    border-radius:4px;
                    padding:4px 8px;
                    font-size:11px;
                    cursor:pointer;
                    transition:background 0.2s;
                "
            >
                📋 Copy
            </button>
        </div>
    `).join('');
    
    container.innerHTML = suggestionsHtml;
    
    // Add copy functionality
    container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.text;
            if (text && text !== '') {
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = '✅ Copied!';
                    btn.style.background = '#6c757d';
                    setTimeout(() => {
                        btn.textContent = '📋 Copy';
                        btn.style.background = '#28a745';
                    }, 2000);
                }).catch(err => {
                    console.error('Copy failed:', err);
                    btn.textContent = '❌ Failed';
                    setTimeout(() => {
                        btn.textContent = '📋 Copy';
                    }, 2000);
                });
            }
        });
    });
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

// Add a test function for DeepSeek API
async function testDeepSeekAPI() {
    const testPrompt = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello GUANG. and tell me todays news' }
    ];
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: testPrompt,
                max_tokens: 50,
                temperature: 0.2
            })
        });
        const data = await response.json();
        console.log('DeepSeek Hello World Test Response:', data);
        alert('DeepSeek Test Response: ' + (data.choices?.[0]?.message?.content || JSON.stringify(data)));
    } catch (error) {
        console.error('DeepSeek Hello World Test Error:', error);
        alert('DeepSeek Test Error: ' + error.message);
    }
}