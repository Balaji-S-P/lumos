// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lumosAsk",
    title: "Ask Lumos ✨",
    contexts: ["selection", "audio"],
  });
});

// When user clicks context menu, open popup or send to content script
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "lumosAsk") return;
  const selectedText = info.selectionText || "";
  const audioUrl = info.srcUrl || "";

  // Validate that it's actually audio, not PDF embeddings
  if (
    audioUrl &&
    (info.mediaType !== "audio" ||
      audioUrl.includes(".pdf") ||
      audioUrl.includes("chrome-extension://"))
  ) {
    // Store selected text if there is any
    if (selectedText) {
      await chrome.storage.local.set({
        lumosSelectedText: selectedText,
        lumosTabId: tab.id,
      });
      chrome.action.openPopup();
    }
    return;
  }

  // Store selected text in storage for the popup to retrieve
  if (selectedText) {
    await chrome.storage.local.set({
      lumosSelectedText: selectedText,
      lumosTabId: tab.id,
    });
  }
  if (audioUrl && audioUrl.startsWith("blob:")) {
    chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_AUDIO_BLOB",
      srcUrl: audioUrl,
    });
    // Mark this as an audio-only request
    await chrome.storage.local.set({
      lumosIsAudioRequest: true,
    });
  } else if (audioUrl) {
    // Fetch directly if it's a normal audio URL
    const res = await fetch(audioUrl);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));

    await chrome.storage.local.set({
      lumosAudioBlob: bytes,
      lumosAudioMime: blob.type || "audio/mpeg",
      lumosIsAudioRequest: true,
    });
  }
  // Open extension popup
  chrome.action.openPopup();
});
// background.js
let popupPort = null;

// Popup connects via port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupPort = port;

    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});

// Relay messages from tools.js to popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "SHOW_DOWNLOAD_TRANSLATOR") {
    if (popupPort) {
      popupPort.postMessage(msg); // ask popup to show download button
    } else {
      console.warn("Popup not connected yet!");
    }
  }

  // Relay confirmation from popup back to tools.js
  if (msg.type === "USER_CONFIRMED_TRANSLATOR") {
    chrome.runtime.sendMessage(msg); // resolves promise in tools.js
  }
  if (msg.type === "AUDIO_BLOB_READY") {
    await chrome.storage.local.set({
      lumosAudioBlob: msg.bytes,
      lumosAudioMime: msg.mime || "audio/mpeg",
      lumosIsAudioRequest: true,
    });
  }
  sendResponse({ ok: true });
  return true;
});
