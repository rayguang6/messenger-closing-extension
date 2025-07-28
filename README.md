# Facebook Chat AI Assistant

A Chrome extension that provides AI-powered sales coaching suggestions for Facebook Messenger conversations.

## Features

- 🤖 **AI Sales Coaching**: Get strategic reply suggestions based on conversation context
- 📊 **Sales Stage Analysis**: Tailored suggestions for different sales stages (Opening, Discovery, Objection Handling, etc.)
- 🎯 **Context-Aware**: Analyzes your conversation and provides relevant suggestions
- 📋 **Easy Copy**: One-click copy suggestions to clipboard
- 🎨 **Beautiful UI**: Clean, modern interface that integrates seamlessly with Facebook

## Installation

### 1) Download Code
![Group 13](https://github.com/user-attachments/assets/2a18f42f-3883-4285-a0f0-e2644d8fb2ec)

### 2) Unpack and Load at Chrome Extension
go to chrome://extensions/
- developer mode
- "Load Unpacked" and select the folder
![WhatsApp Image 2025-07-14 at 17 10 42](https://github.com/user-attachments/assets/09a0746e-2bc9-4f3f-9f4b-663047715128)

## Configuration

### API Selection

The extension supports two AI providers:

1. **Coze API** (Default) - Uses your custom Coze bot
2. **DeepSeek API** - Alternative LLM provider

To switch between APIs, edit `content.js` and change:

```javascript
const USE_COZE = true; // Set to false for DeepSeek, true for Coze
```

### Coze Configuration

If using Coze API, update these variables in `content.js`:

```javascript
const COZE_BOT_ID = '7514582312970174501'; // Your bot ID
const COZE_USER_ID = 'aihuat'; // Your user ID  
const COZE_API_TOKEN = 'pat_BKRD00FVjNiFww33AMeziBBxNfuht5SydEr4md3gOadL755IGsRb0hdvWjv6fR58'; // Your API token
```

## Usage

1. Navigate to Facebook Messenger
2. Click the extension icon to open the AI panel
3. Select the current sales stage
4. Add optional context if needed
5. Click "Get Suggestions" to analyze the conversation
6. Copy and use the suggested replies

## Testing

Use the test page at `testing/coze-test.html` to verify API connections and functionality.

## Development

The extension includes:
- `content.js` - Main extension logic and UI
- `guide.js`, `guide2.js`, `guide3.js` - Sales coaching guides
- `background.js` - Extension background script
- `manifest.json` - Extension configuration
