chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_AUDIO_BLOB") {
    try {
      const response = await fetch(msg.srcUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      chrome.runtime.sendMessage({
        type: "AUDIO_BLOB_READY",
        bytes,
        mime: blob.type,
        isAudioRequest: true,
      });

      sendResponse({ ok: true });
    } catch (err) {
      console.error("Failed to extract blob audio:", err);
      sendResponse({ ok: false, error: err.message });
    }
  }
});
