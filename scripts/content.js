// scripts/content.js

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractContent") {
        const content = extractPageContent();
        sendResponse({ content: content });
    } else if (request.action === "ping") {
        sendResponse({ status: "pong" });
    }
    return true;
});

function extractPageContent() {
    // Check if body exists
    if (!document.body) return "";

    // Simple extraction: Get all text from body
    // Can be improved with Readability.js later
    return document.body.innerText || "";
}

console.log("Aura AI Content Script Loaded");
