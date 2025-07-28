// Facebook Chat AI Assistant - Content Script
console.log('🤖 Facebook Chat AI Assistant loaded!');

// Configuration: Coze as primary, DeepSeek as fallback
const USE_COZE = true; // Primary: Coze, Fallback: DeepSeek
const COZE_BOT_ID = '7514582312970174501';
const COZE_USER_ID = 'aihuat';
const COZE_API_TOKEN = 'pat_BKRD00FVjNiFww33AMeziBBxNf'+'uht5SydEr4md3gOadL755IGsRb0hdvWjv6fR58';

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

async function callDeepSeekAPI(conversation, guide, context = '', stage = 'Opening') {
    const requestId = Date.now().toString(36);
    
    try {
        // Do NOT trim or limit the conversation; send all scraped messages
        const transcript = formatConversationAsTranscript(conversation);
        const systemPrompt = `
You are an expert sales coach specializing in closing web design and digital marketing deals via Facebook Messenger.

In the transcript, 'Me' refers to the user (the salesperson), and all other names are clients.

The current sales stage is: ${stage}.

Analyze the conversation and suggest 3 strategic reply options for this stage. For each suggestion, provide:
- suggestion: The exact reply text to send (natural, human, not robotic)
- reason: An object with two keys:
    - en: Brief explanation in English of why this approach works (clear and concise)
    - zh: Friendly, conversational explanation in Chinese, as if you’re a Malaysian sales mentor talking to a friend. Use simple, natural language, and add a bit of local flavor or encouragement (e.g., “这样做比较容易拉近关系啦！”). Avoid robotic or overly formal language.

Key principles:
- Always end with questions to keep the conversation flowing
- Use "magic questions" (answer questions with questions) when unclear
- Build rapport before closing
- Match the conversation stage as provided by the user
- Sound natural and human, never robotic or pushy

# Your chatting style:
- Always end with questions to keep the conversation flowing
- only suggest your reply from the perspective of the current user (referenced as "You sent" in the message ), not the other party (usually have a name).
- do not always give our main website url to customer and ask them to refer themselves, instead, help give them the info in your replies.
- your tone is friendly, honest, practical and also fun.
- your replies should sound human and natural, never robotic.
- no " symbols in all replies.
- do not use same greetings or salutation all the time, vary your them or avoid using completely.
- no emoticons.
- do not use - in any part of your sentence. In most case - can be replaced by comma or ellipsis ...
- Always capitalise Human names and first letter after a fullstop or question mark.
- strictly no exclamation marks in all your replies.
- Use "magic questions" (answer questions with questions) when unclear
- Build rapport before closing
- always vary your sentences in every reply.
- always use simple words.
- Match the conversation stage
- Sound natural and human, never robotic or pushy

Respond ONLY in valid JSON format as an array of objects with keys: suggestion, reason (reason must be an object with en and zh). Do NOT include any markdown, code blocks, or extra commentary.
Example:
[
  {
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
        console.log('[LLM DEBUG] System prompt sent to LLM:', systemPrompt);
        const messages = [
            { role: 'system', content: systemPrompt },
        ];
        if (context && context.length > 0) {
            console.log('[LLM DEBUG] Context sent to LLM:', context);
            messages.push({ role: 'user', content: '[Context] ' + context });
        }
        messages.push({ role: 'user', content: transcript });
        const payload = {
            model: 'deepseek-chat',
            messages,
            max_tokens: 500,
            temperature: 0.7
        };
        console.log('[LLM DEBUG] Full payload sent to LLM:', JSON.stringify(payload, null, 2));
        const requestStartTime = Date.now();
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
        let content = data.choices?.[0]?.message?.content || '';
        if (!content) {
            console.error(`[DEEPSEEK-${requestId}] No content in response`);
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
                console.error(`[DEEPSEEK-${requestId}] Empty array returned`);
                return { error: 'empty_array' };
            }
            return parsed;
        } catch (err) {
            console.error(`[DEEPSEEK-${requestId}] JSON parse error:`, err.message);
            return { error: 'parse' };
        }
    } catch (error) {
        console.error(`[DEEPSEEK-${requestId}] Exception:`, error.message);
        return { error: 'exception' };
    }
}

// Coze API integration
async function callCozeAPI(conversation, guide, context = '', stage = 'Opening') {
    const requestId = Date.now().toString(36);
    
    try {
        // Do NOT trim or limit the conversation; send all scraped messages
        const transcript = formatConversationAsTranscript(conversation);
        
        // Prepare the message content for Coze - keep conversation clean
        const messageContent = transcript;
        
        const payload = {
            bot_id: COZE_BOT_ID,
            user_id: COZE_USER_ID,
            stream: true, // Enable streaming for better UX
            custom_variables: {
                stage: stage,
                context: context || ''
            },
            additional_messages: [
                {
                    role: 'user',
                    type: 'question',
                    content_type: 'text',
                    content: messageContent
                }
            ]
        };
        
        console.log(`[COZE-${requestId}] API Call - Stage: "${stage}", Context: "${context}", Messages: ${conversation.length}`);
        console.log(`[COZE-${requestId}] Full Payload:`, payload);
        console.log(`[COZE-${requestId}] Note: Coze can access stage as {{stage}} and context as {{context}}`);
        
        const requestStartTime = Date.now();
        
        // Add timeout and retry logic
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        let response;
        try {
            response = await fetch('https://api.coze.cn/v3/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${COZE_API_TOKEN}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const text = await response.text();
                console.error(`[COZE-${requestId}] HTTP Error: ${response.status} - ${text}`);
                return { error: 'http', status: response.status, statusText: response.statusText };
            }
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
                console.error(`[COZE-${requestId}] Request timeout after 30 seconds`);
                return { error: 'timeout' };
            } else if (fetchError.message === 'Failed to fetch') {
                console.error(`[COZE-${requestId}] Network error - possible causes: CORS, network issue, or API endpoint down`);
                return { error: 'network', details: fetchError.message };
            } else {
                console.error(`[COZE-${requestId}] Fetch error:`, fetchError.message);
                return { error: 'fetch', details: fetchError.message };
            }
        }
        
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let finalContentReceived = false;
        let buffer = ''; // Buffer to handle incomplete lines/events
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    processBuffer();
                    break;
                }
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                

                
                processBuffer();
            }
        } finally {
            reader.releaseLock();
        }
        
        function processBuffer() {
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            
            for (const part of parts) {
                if (part.trim() === '') continue;
                
                const lines = part.split('\n');
                if (lines.length < 2) continue;
                
                const eventLine = lines[0];
                const dataLine = lines.slice(1).join('\n');
                
                if (!eventLine.startsWith('event:') || !dataLine.startsWith('data:')) {
                    continue;
                }
                
                try {
                    const eventType = eventLine.substring('event:'.length).trim();
                    const eventData = JSON.parse(dataLine.substring('data:'.length));
                    
                    if (eventData.type === 'answer' && eventData.content) {
                        if (eventType === 'conversation.message.delta') {
                            fullContent += eventData.content;
                        } else if (eventType === 'conversation.message.completed') {
                            fullContent = eventData.content;
                            finalContentReceived = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Silently ignore parsing errors
                }
            }
            
            if (finalContentReceived) {
                buffer = '';
            }
        }
        
        if (!fullContent) {
            console.error(`[COZE-${requestId}] No content received`);
            return { error: 'no_content' };
        }
        
        // Remove Markdown code block if present
        const codeBlockMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) {
            fullContent = codeBlockMatch[1];
        }
        fullContent = fullContent.trim();
        
        try {
            const parsed = JSON.parse(fullContent);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                console.error(`[COZE-${requestId}] Empty array returned`);
                return { error: 'empty_array' };
            }
            return parsed;
        } catch (err) {
            console.error(`[COZE-${requestId}] JSON parse error:`, err.message);
            return { error: 'parse' };
        }
    } catch (error) {
        console.error(`[COZE-${requestId}] Exception:`, error.message);
        return { error: 'exception' };
    }
}



// Combine all guides into one string for the LLM
function getAllGuidesText() {
  return [
    window.CLOSING_GUIDE,
    window.CLOSING_GUIDE2,
    window.CLOSING_GUIDE3
  ].filter(Boolean).join('\n\n---\n\n');
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
                // Normalize sender: label all user messages as 'Me', and handle 'replied to you' as client
                let normalizedSender = lastSender;
                if (
                    lastSender === "You" ||
                    lastSender.startsWith("You sent") ||
                    lastSender.startsWith("You replied")
                ) {
                    normalizedSender = "Me";
                } else if (lastSender.includes("replied to you")) {
                    // Extract client name from 'X replied to you'
                    normalizedSender = lastSender.replace(/ replied to you.*/, '').trim();
                }
                messages.push({
                    sender: normalizedSender,
                    message: text,
                    isUser: normalizedSender === "Me"
                });
            }
        }
    });

    return messages;
}

// Sales stages for dropdown
const SALES_STAGES = [
    'Opening',
    'Discovery',
    'Objection Handling',
    'Trial Close (testimonial)',
    'Trial Close (paid)',
];

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
                <div style="font-size: 12px; opacity: 0.9;">AI Sales Assistant (${USE_COZE ? 'Coze' : 'DeepSeek'})</div>
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
                <label for="stage-select" style="font-size:13px;color:#764ba2;font-weight:600;">Sales Stage:</label>
                <select id="stage-select" style="width:100%;margin-top:4px;margin-bottom:10px;padding:6px 8px;border-radius:6px;border:1px solid #e1e5e9;font-size:13px;">
                    ${SALES_STAGES.map(stage => `<option value="${stage}">${stage}</option>`).join('')}
                </select>
            </div>
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
        const stage = document.getElementById('stage-select').value;
        console.log(`[DEBUG] Starting analysis with ${USE_COZE ? 'Coze' : 'DeepSeek'} API`);
        analyzeConversation(context, stage);
    });
}

// Updated analyzeConversation function with better error handling
function analyzeConversation(context = '', stage = 'Opening') {
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

    // Show progress bar and skeleton loading cards
    suggestionsContainer.innerHTML = `
      <div id="dynamic-loading-message" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 16px;">
        <div style="width: 100%; display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="flex: 1; background: #f0f0f0; border-radius: 10px; height: 8px; overflow: hidden;">
            <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 10px; transition: width 0.3s ease-out; position: relative; overflow: hidden; box-shadow: 0 0 10px rgba(102, 126, 234, 0.3);">
              <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 1.5s infinite;"></div>
              <div style="position: absolute; top: 0; right: 0; width: 20px; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6)); animation: glow 2s infinite;"></div>
            </div>
          </div>
          <div id="progress-text" style="font-size: 14px; color: #667eea; font-weight: 600; min-width: 40px; text-align: right; animation: bounceText 0.5s ease-out;">0%</div>
        </div>
        <div id="loading-msg-text" style="font-size: 13px; color: #764ba2; font-weight: 500; letter-spacing: 0.2px; text-align: center; max-width: 280px; line-height: 1.4;">${loadingMessages[0]}</div>
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
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        @keyframes bounceText {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

      </style>
    `;

    // Progress bar setup
    let progress = 0;
    const targetTime = 25000; // 20 seconds
    const progressStep = 100 / (targetTime / 100); // Progress per 100ms
    
    // Typewriter effect function
    let isTyping = false;
    function typewriterEffect(element, text) {
      if (isTyping) return; // Prevent overlapping typewriter effects
      
      isTyping = true;
      element.textContent = '';
      let i = 0;
      const speed = 100; // ms per character
      
      function typeChar() {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          setTimeout(typeChar, speed);
        } else {
          isTyping = false; // Allow next typewriter effect
        }
      }
      typeChar();
    }
    

    
    // Start progress bar animation with cycling messages
    loadingMsgInterval = setInterval(() => {
      progress += progressStep;
      if (progress > 95) progress = 95; // Don't reach 100% until done
      
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const loadingText = document.getElementById('loading-msg-text');
      
      if (progressBar) progressBar.style.width = progress + '%';
      if (progressText) {
        progressText.textContent = Math.round(progress) + '%';
        // Trigger bounce animation
        progressText.style.animation = 'none';
        progressText.offsetHeight; // Trigger reflow
        progressText.style.animation = 'bounceText 0.5s ease-out';
      }
      
      // Update message every 2 seconds with typewriter effect
      if (Math.round(progress) % 20 === 0 && Math.round(progress) > 0) {
        loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
        if (loadingText && !isTyping) {
          const newMessage = loadingMessages[loadingMsgIndex];
          typewriterEffect(loadingText, newMessage);
        }
      }
    }, 100); // 100ms updates for smooth animation

    const analysisStartTime = Date.now();
    
    // Get messages
    const messages = scrapeMessagesWithContext();
    
    console.log(`[FACEBOOK] Messages:`, formatConversationAsTranscript(messages));

    // Helper function to clear loading and reset button
        const clearLoadingState = () => {
      if (loadingMsgInterval) {
        clearInterval(loadingMsgInterval);
        loadingMsgInterval = null;
      }
      
      // Complete progress bar to 100%
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const loadingText = document.getElementById('loading-msg-text');
      
      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = '100%';
      if (loadingText) loadingText.textContent = '✅ Complete!';
      
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

                // Call API for suggestions using all guides
                const allGuides = getAllGuidesText();
                let aiResponse;
                let usedFallback = false;
                
                // Try Coze first (primary), fallback to DeepSeek if needed
                try {
                    console.log('[LLM] Using Coze');
                    aiResponse = await callCozeAPI(messages, allGuides, context, stage);
                    
                    // Check if Coze failed and we need fallback
                    if (aiResponse && aiResponse.error) {
                        console.log('[LLM] Coze failed, trying DeepSeek');
                        usedFallback = true;
                        aiResponse = await callDeepSeekAPI(messages, allGuides, context, stage);
                    }
                } catch (error) {
                    console.log('[LLM] Coze exception, trying DeepSeek');
                    usedFallback = true;
                    aiResponse = await callDeepSeekAPI(messages, allGuides, context, stage);
                }

                if (aiResponse && Array.isArray(aiResponse) && aiResponse.length > 0) {
                    console.log(`[RESPONSE] Got ${aiResponse.length} suggestions from ${usedFallback ? 'DeepSeek' : 'Coze'}`);
                    console.log(`[RESPONSE] Data:`, aiResponse);
                    console.log(`[TIME] Total: ${Date.now() - analysisStartTime}ms`);
                    displaySuggestions(aiResponse, suggestionsContainer);
                } else {
                    // User-friendly error messages only
                    let errorMsg = '<strong>❌ AI Request Failed</strong><br>';
                    if (aiResponse && aiResponse.error) {
                        switch (aiResponse.error) {
                            case 'http':
                                errorMsg += 'A network or server error occurred.';
                                break;
                            case 'network':
                                errorMsg += 'Network connection issue. Please check your internet.';
                                break;
                            case 'timeout':
                                errorMsg += 'Request timed out. Please try again.';
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
                            analyzeConversation(context, stage);
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
                    analyzeConversation(context, stage);
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