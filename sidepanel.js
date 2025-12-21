// sidepanel.js

// Import LLM Utils
import { callLLM } from './scripts/llm_utils.js';

const DEFAULT_API_KEY = "AIzaSyAvQ5QdMb8g3maRPCnR1LJXiie_1cPxYpA";
const MODEL_NAME = 'gemini-flash-latest';

// Debug Logger
function log(msg) {
  console.log(msg);
  const info = document.getElementById('debug-log-console');
  if (info) {
    info.innerHTML += `<div>[INFO] ${msg}</div>`;
    info.scrollTop = info.scrollHeight;
  }
}

function errorLog(msg) {
  console.error(msg);
  const info = document.getElementById('debug-log-console');
  if (info) {
    info.innerHTML += `<div style="color: #ef4444;">[ERROR] ${msg}</div>`;
    info.scrollTop = info.scrollHeight;
  }
  // Also show visible toast for critical errors
  showErrorToast(msg);
}

function showErrorToast(msg) {
  const toast = document.getElementById('connection-error-toast');
  if (toast) {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 5000); // Hide after 5s
  }
}

// Main Initialization
function init() {
  try {
    log("Initializing Side Panel...");
    setupTabs();
    setupSettings();
    setupSummarize();
    setupChat();
    loadSnippets();
    checkConnection(); // Proactive check
    log("Side Panel Initialized Successfully");
  } catch (err) {
    errorLog("Init Error: " + err.message);
  }
}

async function checkConnection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Skip check for internal chrome pages
    if (tab.url.startsWith('chrome://')) return;

    await chrome.tabs.sendMessage(tab.id, { action: "ping" }).catch(err => {
      // If this fails, content script likely not loaded
      if (err.message.includes("Receiver does not exist") || err.message.includes("Could not establish connection")) {
        showErrorToast("⚠️ Please RELOAD the webpage to activate the extension.");
      }
    });
  } catch (e) {
    console.log("Connection check skipped", e);
  }
}

// Ensure init runs whether loaded or loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// --- Tab Switching ---
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const viewId = tab.getAttribute('data-tab');
      document.getElementById(viewId).classList.add('active');
    });
  });
}

// --- Settings ---
function setupSettings() {
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-settings-btn');
  const testBtn = document.getElementById('test-connection-btn');
  const statusMsg = document.getElementById('settings-status');

  chrome.storage.local.get(['apiKey'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    } else {
      apiKeyInput.value = DEFAULT_API_KEY;
    }
  });

  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();


    chrome.storage.local.set({ apiKey: key }, () => {
      statusMsg.textContent = 'Settings saved!';
      statusMsg.style.color = '#4ade80';
      setTimeout(() => statusMsg.textContent = '', 2000);
    });
  });

  testBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showErrorToast("Please enter an API Key first.");
      return;
    }

    testBtn.textContent = "Testing...";
    testBtn.disabled = true;
    statusMsg.textContent = "";

    try {
      // Simple hello world call
      await callLLM(key, MODEL_NAME, "You are a ping bot.", "Ping");
      statusMsg.textContent = "Connection Successful! ✅";
      statusMsg.style.color = '#4ade80';
    } catch (err) {
      errorLog("Test Failed: " + err.message);
      statusMsg.textContent = "Connection Failed ❌";
      statusMsg.style.color = '#ef4444';
    } finally {
      testBtn.textContent = "Test Connection";
      testBtn.disabled = false;
    }
  });
}

// --- Summarize ---
function setupSummarize() {
  const btn = document.getElementById('summarize-btn');
  const output = document.getElementById('summary-content');
  const markdownBody = output.querySelector('.markdown-body');

  btn.addEventListener('click', async () => {
    output.classList.remove('hidden');
    output.classList.add('loading');
    markdownBody.innerHTML = '<p>Analysing page content...</p>';
    btn.disabled = true;

    try {
      log("Starting summarization...");
      // 1. Get Active Tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("No active tab found");
      log("Active tab found: " + tab.id);

      // 2. Get Page Content
      log("Sending extractContent message...");
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extractContent" }).catch(err => {
        throw new Error("Connection failed. Please RELOAD the web page and try again.");
      });

      if (!response || !response.content) throw new Error("Could not extract page content");
      log("Content extracted efficiently.");

      const pageContent = response.content.substring(0, 15000); // Limit context

      // 3. Get Settings
      const settings = await chrome.storage.local.get(['apiKey']);
      // Use saved key or default
      const effectiveKey = settings.apiKey || DEFAULT_API_KEY;

      if (!effectiveKey) throw new Error("Please set your API Key in Settings.");

      // 4. Call LLM
      const systemPrompt = "You are a helpful assistant that summarizes web pages. Provide 5 clear, concise bullet points summarizing the key information. Use Markdown formatting.";
      const summary = await callLLM(effectiveKey, MODEL_NAME, systemPrompt, `Summarize this text: \n\n${pageContent}`);




      // 5. Render
      markdownBody.innerHTML = parseMarkdown(summary); // Simple parser or text
    } catch (error) {
      errorLog("Summarize Error: " + error.message);
      markdownBody.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
    } finally {
      btn.disabled = false;
      output.classList.remove('loading');
    }
  });
}

// --- Chat ---
function setupChat() {
  const sendBtn = document.getElementById('send-chat-btn');
  const input = document.getElementById('chat-input');

  sendBtn.addEventListener('click', () => handleChat());
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  });

  async function handleChat() {
    const text = input.value.trim();
    if (!text) return;

    addMessage('user', text);
    input.value = '';

    const botMsgId = addMessage('bot', 'Typing...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extractContent" });
      const pageContent = (response && response.content) ? response.content.substring(0, 10000) : "No page content available.";

      const settings = await chrome.storage.local.get(['apiKey']);
      const effectiveKey = settings.apiKey || DEFAULT_API_KEY;

      const systemPrompt = `You are a helpful assistant answering questions about the current web page. Use the provided page context to answer. If the answer is not in the context, say so. Context: \n\n${pageContent}`;

      const reply = await callLLM(effectiveKey, MODEL_NAME, systemPrompt, text);




      updateMessage(botMsgId, parseMarkdown(reply));
    } catch (error) {
      updateMessage(botMsgId, `Error: ${error.message}`);
    }
  }
}

function addMessage(sender, text) {
  const history = document.getElementById('chat-history');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${sender}`;
  // Use a unique ID for bot messages to update them
  const id = 'msg-' + Date.now();
  msgDiv.id = id;
  msgDiv.innerHTML = `<p>${text}</p>`;
  history.appendChild(msgDiv);
  history.scrollTop = history.scrollHeight;
  return id;
}

function updateMessage(id, html) {
  const msgDiv = document.getElementById(id);
  if (msgDiv) {
    msgDiv.innerHTML = html; // Assume HTML is safe-ish or use sanitizer in real app
  }
}

// --- Snippets ---
function loadSnippets() {
  const list = document.getElementById('snippets-list');

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.snippets) {
      renderSnippets(changes.snippets.newValue);
    }
  });

  chrome.storage.local.get({ snippets: [] }, (result) => {
    renderSnippets(result.snippets);
  });
}

function renderSnippets(snippets) {
  const list = document.getElementById('snippets-list');
  const emptyState = document.querySelector('.empty-state');

  list.innerHTML = '';

  if (!snippets || snippets.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  snippets.forEach(s => {
    const li = document.createElement('li');
    li.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      margin-bottom: 8px;
      padding: 12px;
      border-radius: 8px;
      list-style: none;
      border: 1px solid rgba(255, 255, 255, 0.05);
    `;
    li.innerHTML = `
      <p style="font-size: 0.9rem; color: #fff; margin-bottom: 4px;">"${s.text}"</p>
      <div style="font-size: 0.75rem; color: #a1a1aa; display: flex; justify-content: space-between;">
        <span>${new Date(s.date).toLocaleDateString()}</span>
        <button class="delete-btn" data-id="${s.id}" style="background:none; border:none; color: #ef4444; cursor:pointer;">Delete</button>
      </div>
    `;
    list.appendChild(li);

    li.querySelector('.delete-btn').addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      chrome.storage.local.get({ snippets: [] }, (res) => {
        const newSnippets = res.snippets.filter(snip => snip.id !== id);
        chrome.storage.local.set({ snippets: newSnippets });
      });
    });
  });
}

// Simple Markdown Parser (Bold, Italic, Lists, Newlines)
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  // Handle lists slightly better if possible, but simple replacement for now
  // Convert - to bullet
  html = html.replace(/<br>\s*-\s/g, '<br>• ');
  return html;
}

