// background.js

// Open Side Panel when the extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Setup Context Menu for "Save Snippet"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "aura-save-snippet",
    title: "Save to Aura Snippets",
    contexts: ["selection"]
  });
});

// Handle Context Menu Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "aura-save-snippet" && info.selectionText) {
    // We'll send a message to the sidepanel or save it directly to storage
    // Saving directly to storage is safer as sidepanel might be closed
    const snippet = {
      id: Date.now().toString(),
      text: info.selectionText,
      url: tab.url,
      title: tab.title,
      date: new Date().toISOString()
    };

    chrome.storage.local.get({ snippets: [] }, (result) => {
      const snippets = result.snippets;
      snippets.unshift(snippet);
      chrome.storage.local.set({ snippets }, () => {
        console.log("Snippet saved from context menu");
        // Optional: Notify user or Badge update
      });
    });
  }
});
