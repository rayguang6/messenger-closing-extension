// background.js

chrome.action.onClicked.addListener(async (tab) => {
  // Only run on Facebook or Messenger
  if (tab.url && (tab.url.includes('facebook.com') || tab.url.includes('messenger.com'))) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'showPanel' });
    } catch (err) {
      console.warn('Could not send showPanel message:', err);
    }
  } else {
    // Optionally, open Facebook in a new tab if not already there
    // chrome.tabs.create({ url: 'https://www.facebook.com/messages' });
    // Or show a notification (not implemented here)
  }
}); 