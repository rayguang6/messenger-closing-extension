// Facebook Chat AI Assistant - Content Script
console.log('🤖 Facebook Chat AI Assistant loaded!');

// DeepSeek API integration
// NOTE: Chrome extensions do not support .env files. Store secrets securely, e.g., chrome.storage or prompt user for API key in settings.
// For basic obfuscation, do not assign the API key directly. Instead, use a function that joins fragments.
function getApiKey() {
    // Example: split in non-obvious places
    const part1 = 'sk-c79b3';
    const part2 = '21aec774d018f0c0';
    const part3 = '55f6ea4606d';
    return part1 + part2 + part3;
}
// Usage: getApiKey()
// NOTE: This is only basic obfuscation and does NOT provide real security.
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

//for loadings animation and state
let loadingMsgInterval = null;

/**
 * Converts an array of message objects into a readable chat transcript string.
 * Each message is formatted as "Sender: message" on its own line.
 *
 * Example input:
 * [
 *   { sender: "Alice", message: "Hi there!" },
 *   { sender: "Bob", message: "Hello, how can I help you?" }
 * ]
 *
 * Output:
 * Alice: Hi there!
 * Bob: Hello, how can I help you?
 *
 * @param {Array<{sender: string, message: string}>} messages - The conversation messages.
 * @returns {string} - The formatted chat transcript.
 */
function formatConversationAsTranscript(messages) {
    return messages.map(m => `${m.sender}: ${m.message}`).join('\n');
}

async function callDeepSeekAPI(conversation, guide, context = '') {
    try {
        // Do NOT trim or limit the conversation; send all scraped messages
        const transcript = formatConversationAsTranscript(conversation);
        const systemPrompt = `
You are an expert sales coach specializing in closing web design and digital marketing deals via Facebook Messenger.

Analyze the conversation and suggest 3 strategic reply options. For each suggestion, provide:
- stage: The current sales stage (Opening, Discovery, Trial Close, Objection Handling, Close)
- suggestion: The exact reply text to send (natural, human, not robotic)
- reason: An object with two keys:
    - en: Brief explanation in English of why this approach works (clear and concise)
    - zh: Friendly, conversational explanation in Chinese, as if you’re a Malaysian sales mentor talking to a friend. Use simple, natural language, and add a bit of local flavor or encouragement (e.g., “这样做比较容易拉近关系啦！”). Avoid robotic or overly formal language.

Key principles:
- Always end with questions to keep the conversation flowing
- Use "magic questions" (answer questions with questions) when unclear
- Build rapport before closing
- Match the conversation stage
- Sound natural and human, never robotic or pushy

Respond ONLY in valid JSON format as an array of objects with keys: stage, suggestion, reason (reason must be an object with en and zh). Do NOT include any markdown, code blocks, or extra commentary.
Example:
[
  {
    "stage": "Discovery",
    "suggestion": "Can you share a bit about your offer and what you're selling?",
    "reason": {
      "en": "Opens discovery phase by asking about their business to understand their needs.",
      "zh": "这样问可以让对方更放松地介绍自己啦，也比较容易聊下去。像我们大马人这样聊天，气氛会比较轻松。"
    }
  }
]
Guide:
${guide}
`;
        const messages = [
            { role: 'system', content: systemPrompt },
        ];
        if (context && context.length > 0) {
            messages.push({ role: 'user', content: '[Context] ' + context });
        }
        messages.push({ role: 'user', content: transcript });
        const payload = {
            model: 'deepseek-chat',
            messages,
            max_tokens: 800,
            temperature: 0.4,
            top_p: 0.9,
        };
        console.log('DeepSeek API Request Payload:', payload);
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getApiKey()}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('DeepSeek API HTTP Error:', response.status, text);
            return { error: 'http', status: response.status, statusText: response.statusText };
        }
        const data = await response.json();
        console.log('DeepSeek API Raw Response:', data);
        let content = data.choices?.[0]?.message?.content || '';
        if (!content) {
            return { error: 'no_content' };
        }
        // Remove Markdown code block if present
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) {
            content = codeBlockMatch[1];
        }
        content = content.trim();
        try {
            const parsed = JSON.parse(content);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                return { error: 'empty_array' };
            }
            return parsed;
        } catch (err) {
            console.warn('DeepSeek response not valid JSON. Raw content:', content, err);
            return { error: 'parse' };
        }
    } catch (error) {
        console.error('DeepSeek API Exception:', error);
        return { error: 'exception' };
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
        top: 50px;
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
        <div id="closing-coach-header" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
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
        
        <div style="padding: 16px; overflow-y: auto; max-height: 540px;">
            <div style="margin-bottom: 10px;">
                <label for="context-input" style="font-size:13px;color:#764ba2;font-weight:600;">Context (optional):</label>
                <textarea id="context-input" rows="2" placeholder="Add any extra context for the AI..." style="width:100%;margin-top:4px;margin-bottom:10px;padding:6px 8px;border-radius:6px;border:1px solid #e1e5e9;font-size:13px;resize:vertical;"></textarea>
            </div>
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
                padding-bottom: 32px;
            ">
                <div style="text-align: center; color: #6c757d; font-size: 13px; padding: 20px;">
                    No suggestions yet.<br>Start by analyzing the conversation!
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Make the panel draggable
    makePanelDraggable(panel, document.getElementById('closing-coach-header'));
    
    // Add event listeners
    setupPanelEvents();
    
    return panel;
}

// Setup panel event listeners
function setupPanelEvents() {
    // Close panel button
    document.getElementById('close-panel').addEventListener('click', () => {
        // Clear any running intervals when closing panel
        if (loadingMsgInterval) {
            clearInterval(loadingMsgInterval);
            loadingMsgInterval = null;
        }
        document.getElementById('closing-coach-panel').remove();
    });
    
    // Get suggestions button
    document.getElementById('get-suggestions-btn').addEventListener('click', () => {
        const context = document.getElementById('context-input').value.trim();
        analyzeConversation(context);
    });
}

// Updated analyzeConversation function with better error handling
function analyzeConversation(context = '') {
    const button = document.getElementById('get-suggestions-btn');
    const infoDiv = document.getElementById('conversation-info');
    const suggestionsContainer = document.getElementById('suggestions-container');
    
    // Show loading state
    button.textContent = '🔄 Analyzing...';
    button.disabled = true;
    
    // Animated/cycling loading messages with emoji
    const loadingMessages = [
      '🤖 Generating results, please wait...',
      '🍳 Cooking up your suggestions...',
      '🧠 Thinking like a sales pro...',
      '🔍 Finding the best next move...',
      '⏳ Almost there, preparing your DMs...',
      '✨ AI is analyzing your chat magic...',
      '🛠️ Sharpening those closing skills...',
      '💡 Your sales coach is on it...',
      '🚀 Making your next reply awesome...',
      '💪 Letting the AI do the heavy lifting...'
    ];
    let loadingMsgIndex = 0;
    
    // Always clear any previous interval before starting a new one
    if (loadingMsgInterval) {
        clearInterval(loadingMsgInterval);
        loadingMsgInterval = null;
    }
    
    // Show animated progress indicator and skeleton loading cards
    suggestionsContainer.innerHTML = `
      <div id="dynamic-loading-message" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 16px;">
        <div class="bouncing-dots-loader">
          <span></span><span></span><span></span>
        </div>
        <div id="loading-msg-text" style="font-size: 14px; color: #764ba2; margin-top: 8px; font-weight: 500; letter-spacing: 0.2px;">${loadingMessages[0]}</div>
      </div>
      <div class="skeleton-card shimmer"></div>
      <div class="skeleton-card shimmer"></div>
      <div class="skeleton-card shimmer"></div>
      <style>
        .skeleton-card {
          background: #f0f0f0;
          border-radius: 8px;
          height: 60px;
          margin-bottom: 12px;
          position: relative;
          overflow: hidden;
        }
        .shimmer::after {
          content: '';
          position: absolute;
          top: 0; left: -60%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
          animation: shimmer-move 1.2s infinite;
        }
        @keyframes shimmer-move {
          100% { left: 100%; }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .bouncing-dots-loader {
          display: flex;
          align-items: flex-end;
          height: 18px;
        }
        .bouncing-dots-loader span {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin: 0 2px;
          background: #764ba2;
          border-radius: 50%;
          animation: bounce 0.6s infinite alternate;
        }
        .bouncing-dots-loader span:nth-child(2) {
          animation-delay: 0.12s;
        }
        .bouncing-dots-loader span:nth-child(3) {
          animation-delay: 0.24s;
        }
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-10px); }
        }
      </style>
    `;
    
    // Start cycling loading messages
    loadingMsgInterval = setInterval(() => {
      loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
      const msgEl = document.getElementById('loading-msg-text');
      if (msgEl) msgEl.textContent = loadingMessages[loadingMsgIndex];
    }, 1000);
    
    // Get messages
    const messages = scrapeMessagesWithContext();
    
    // Helper function to clear loading and reset button
    const clearLoadingState = () => {
        if (loadingMsgInterval) {
            clearInterval(loadingMsgInterval);
            loadingMsgInterval = null;
        }
        button.textContent = '🔍 Get Suggestions';
        button.disabled = false;
    };
    
    setTimeout(async () => {
        try {
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
                            View Fetched Messages
                        </summary>
                        <div style="margin-top: 8px; max-height: 150px; overflow-y: auto; background: #fff; border-radius: 6px; padding: 8px; border: 1px solid #e1e5e9;">
                            ${messagesHtml}
                        </div>
                    </details>
                `;
                
                // Call DeepSeek API for suggestions
                const aiResponse = await callDeepSeekAPI(messages, window.CLOSING_GUIDE || 'Default sales guide', context);
                
                if (aiResponse && Array.isArray(aiResponse) && aiResponse.length > 0) {
                    displaySuggestions(aiResponse, suggestionsContainer);
                } else {
                    // User-friendly error messages only
                    let errorMsg = '<strong>❌ AI Request Failed</strong><br>';
                    if (aiResponse && aiResponse.error) {
                        switch (aiResponse.error) {
                            case 'http':
                                errorMsg += 'A network or server error occurred.';
                                break;
                            case 'no_content':
                                errorMsg += 'No content returned from AI.';
                                break;
                            case 'empty_array':
                                errorMsg += 'No suggestions found for this conversation.';
                                break;
                            case 'parse':
                                errorMsg += 'AI response could not be understood.';
                                break;
                            case 'exception':
                                errorMsg += 'An unexpected error occurred.';
                                break;
                            default:
                                errorMsg += 'Unknown error.';
                        }
                    } else {
                        errorMsg += 'Unknown error or no response.';
                    }
                    suggestionsContainer.innerHTML = `
                        <div style=\"text-align:center;color:#dc3545;font-size:13px;padding:20px;\">
                            ${errorMsg}<br>
                            <button id=\"try-again-btn\" style=\"margin-top:12px;background:#667eea;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;\">🔄 Try Again</button>
                        </div>
                    `;
                    // Add Try Again button handler
                    const tryAgainBtn = document.getElementById('try-again-btn');
                    if (tryAgainBtn) {
                        tryAgainBtn.addEventListener('click', () => {
                            analyzeConversation(context);
                        });
                    }
                }
            } else {
                infoDiv.innerHTML = `
                    <strong>⚠️ No Messages Found</strong><br>
                    Make sure you're in a chat conversation and try again.
                `;
                suggestionsContainer.innerHTML = `
                    <div style=\"text-align: center; color: #dc3545; font-size: 13px; padding: 20px;\">
                        No conversation detected.<br>
                        Open a chat and try again.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Unexpected error in analyzeConversation:', error);
            suggestionsContainer.innerHTML = `
                <div style=\"text-align:center;color:#dc3545;font-size:13px;padding:20px;\">
                    <strong>💥 Unexpected Error</strong><br>
                    Something went wrong. Please try again.<br>
                    <button id=\"try-again-btn\" style=\"margin-top:12px;background:#667eea;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;\">🔄 Try Again</button>
                </div>
            `;
            // Add Try Again button handler
            const tryAgainBtn = document.getElementById('try-again-btn');
            if (tryAgainBtn) {
                tryAgainBtn.addEventListener('click', () => {
                    analyzeConversation(context);
                });
            }
        } finally {
            clearLoadingState();
        }
    }, 1000);
}

// Helper function to display suggestions
function displaySuggestions(suggestions, container) {
    const suggestionsHtml = suggestions.map((s, index) => {
        let reasonHtml = '';
        if (typeof s.reason === 'object' && s.reason !== null) {
            reasonHtml = `
                <div style="border-top:1px solid #e1e5e9;margin-top:12px;padding-top:10px;background:#f6f8fa;border-radius:0 0 8px 8px;">
                    <div style="font-size:12px;font-weight:600;color:#764ba2;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
                        🧠 Why this works
                        <span style="font-size:11px;font-weight:400;color:#888;">(for your learning, not for copying)</span>
                    </div>
                    <div style="font-size:14px;color:#333;margin-bottom:2px;">
                        ${s.reason.en || ''}
                    </div>
                    <div style="font-size:14px;color:#333;">
                        ${s.reason.zh || ''}
                    </div>
                </div>
            `;
        } else {
            reasonHtml = `<div style="border-top:1px solid #e1e5e9;margin-top:12px;padding-top:10px;background:#f6f8fa;border-radius:0 0 8px 8px;">
                <div style="font-size:12px;font-weight:600;color:#764ba2;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
                    🧠 Why this works
                    <span style="font-size:11px;font-weight:400;color:#888;">(for your learning, not for copying)</span>
                </div>
                <div style="font-size:13px;color:#333;">${s.reason || 'No reason provided'}</div>
            </div>`;
        }
        return `
        <div style="position:relative;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:18px 16px 10px 16px;margin-bottom:18px;box-shadow:0 2px 8px rgba(102,126,234,0.04);">
            <button 
                class="copy-btn" 
                data-text="${(s.suggestion || '').replace(/"/g, '&quot;')}"
                title="Copy reply"
                style="
                    position:absolute;top:12px;right:12px;
                    background:#e1e5e9;
                    color:#667eea;
                    border:none;
                    border-radius:4px;
                    padding:4px 10px;
                    font-size:13px;
                    cursor:pointer;
                    transition:background 0.2s;
                    font-weight:600;
                    z-index:2;
                "
            >
                📋 Copy
            </button>
            <div style="font-size:13px;color:#764ba2;font-weight:600;margin-bottom:6px;">
                ${s.stage || `Suggestion ${index + 1}`}
            </div>
            <div style="font-size:16px;font-weight:600;margin-bottom:10px;line-height:1.5;color:#222;">
                ${s.suggestion || 'No suggestion available'}
            </div>
            ${reasonHtml}
        </div>
        `;
    }).join('');
    
    container.innerHTML = suggestionsHtml;
    
    // Add copy functionality
    container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.text;
            if (text && text !== '') {
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = '✅ Copied!';
                    setTimeout(() => {
                        btn.textContent = '📋 Copy';
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
                // Clear any running intervals when hiding panel
                if (loadingMsgInterval) {
                    clearInterval(loadingMsgInterval);
                    loadingMsgInterval = null;
                }
                panel.remove();
                sendResponse({ success: true, message: 'Panel hidden' });
            } else {
                sendResponse({ success: false, message: 'Panel not found' });
            }
            break;
            
        case 'refresh':
            // Clear any running intervals
            if (loadingMsgInterval) {
                clearInterval(loadingMsgInterval);
                loadingMsgInterval = null;
            }
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

// Add this helper function after createSidePanel
function makePanelDraggable(panel, handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    // Set initial position (top-right, but using left for easier dragging)
    panel.style.left = (window.innerWidth - panel.offsetWidth - 20) + 'px';
    panel.style.top = '50px';
    panel.style.right = '';
    
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(panel.style.left, 10);
        startTop = parseInt(panel.style.top, 10);
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;
        
        // Constrain within viewport
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
        
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });
}

// Start the extension
initializeExtension();