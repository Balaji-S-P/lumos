// popup/popup.js
import { planExecution } from "../orchestrator/planner.js";
import { initializeModels } from "../orchestrator/tools.js";
const selectedTextBox = document.getElementById("selectedTextBox");
const instructionInput = document.getElementById("instruction");
const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const outputDiv = document.getElementById("output");
const progressDiv = document.getElementById("progress");
const stackDisplay = document.getElementById("stackDisplay");
const stackContent = document.getElementById("stackContent");
const downloadBtn = document.getElementById("downloadBtn");
const statusDiv = document.getElementById("translatorStatus");
const audioIndicator = document.getElementById("audioIndicator");
let currentSelectedText = "";

function setProgress(msg) {
  progressDiv.innerText = msg;
}

function setOutput(text) {
  outputDiv.innerText = text;
}

function showStackDisplay() {
  stackDisplay.style.display = "block";
}

function hideStackDisplay() {
  stackDisplay.style.display = "none";
}

function clearStackDisplay() {
  stackContent.innerHTML = "";
}

function addStackItem(functionName, args, status = "pending") {
  const stackItem = document.createElement("div");
  stackItem.className = `stack-item ${status}`;

  const functionDiv = document.createElement("div");
  functionDiv.className = "stack-function";
  functionDiv.textContent = `→ ${functionName}()`;

  const argsDiv = document.createElement("div");
  argsDiv.className = "stack-args";
  argsDiv.textContent = `Args: ${JSON.stringify(args, null, 2)}`;

  stackItem.appendChild(functionDiv);
  stackItem.appendChild(argsDiv);
  stackContent.appendChild(stackItem);

  // Scroll to bottom
  stackContent.scrollTop = stackContent.scrollHeight;
}

function updateStackItem(functionName, result, status = "completed") {
  const stackItems = stackContent.querySelectorAll(".stack-item");
  for (let item of stackItems) {
    const functionDiv = item.querySelector(".stack-function");
    if (functionDiv && functionDiv.textContent.includes(functionName)) {
      item.className = `stack-item ${status}`;

      // Add result if provided
      if (result) {
        let resultDiv = item.querySelector(".stack-result");
        if (!resultDiv) {
          resultDiv = document.createElement("div");
          resultDiv.className = "stack-result";
          item.appendChild(resultDiv);
        }
        resultDiv.textContent = `Result: ${result}`;
      }
      break;
    }
  }
}

// Note: We now use storage-based communication instead of messages

// Check for stored selected text first, then try to get selection from active tab
async function fetchSelectedText() {
  try {
    // Check if this is an audio-only request
    const audioCheck = await chrome.storage.local.get(["lumosIsAudioRequest"]);
    if (audioCheck.lumosIsAudioRequest) {
      audioIndicator.style.display = "flex";
      selectedTextBox.innerText = "🎙️ Audio ready for transcription";
      currentSelectedText = "";
      return;
    }

    // First, check if we have stored selected text from context menu
    const stored = await chrome.storage.local.get([
      "lumosSelectedText",
      "lumosTabId",
    ]);
    if (stored.lumosSelectedText) {
      currentSelectedText = stored.lumosSelectedText;
      selectedTextBox.innerText = stored.lumosSelectedText;
      // Clear the stored text after using it
      await chrome.storage.local.remove(["lumosSelectedText", "lumosTabId"]);
      return;
    }

    // If no stored text, try to get selection from active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    const sel = res?.[0]?.result || "";
    currentSelectedText = sel;
    selectedTextBox.innerText = sel || "No text selected yet.";
  } catch (e) {
    console.warn("Could not fetch selection:", e);
  }
}

runBtn.addEventListener("click", async () => {
  const instr = instructionInput.value.trim();
  if (!instr) {
    alert("Please add an instruction.");
    return;
  }
  // if (!currentSelectedText) {
  //   alert(
  //     "No selected text. Select text in page, then use context menu or open popup."
  //   );
  //   return;
  // }

  setProgress("Initializing...");
  setOutput("");
  showStackDisplay();
  clearStackDisplay();
  runBtn.disabled = true;

  try {
    // Check if this is an audio-only request
    const storage = await chrome.storage.local.get(["lumosIsAudioRequest"]);
    const isAudioRequest = storage.lumosIsAudioRequest;

    // Ensure models are initialized before running
    await initializeModels();

    setProgress("Planning...");

    // Pass empty text for audio-only requests since audio is in storage
    const textToProcess = isAudioRequest ? "" : currentSelectedText;
    const res = await planExecution(instr, textToProcess);

    // Clear the audio request flag after processing
    if (isAudioRequest) {
      await chrome.storage.local.remove(["lumosIsAudioRequest"]);
    }

    setProgress("Done");
    setOutput(res);
  } catch (error) {
    console.error("Error during execution:", error);
    setProgress("Error");
    setOutput(`Error: ${error.message}`);
  } finally {
    runBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  instructionInput.value = "";
  outputDiv.innerText = "";
  progressDiv.innerText = "Idle";
  hideStackDisplay();
  clearStackDisplay();
  audioIndicator.style.display = "none";
});

// Listen for stack events from the planner
function setupStackEventListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.lumosStackEvent) {
      const event = changes.lumosStackEvent.newValue;
      if (event) {
        handleStackEvent(event);
      }
    }
  });
}

function handleStackEvent(event) {
  switch (event.type) {
    case "planningStart":
      addStackItem(
        "Planning",
        { instruction: event.data.instruction },
        "active"
      );
      break;
    case "planningComplete":
      updateStackItem("Planning", event.data.finalResponse, "completed");
      break;
    case "functionStart":
      addStackItem(event.data.functionName, event.data.args, "active");
      break;
    case "functionComplete":
      updateStackItem(event.data.functionName, event.data.result, "completed");
      break;
    case "functionError":
      updateStackItem(event.data.functionName, event.data.error, "error");
      break;
  }
}
const port = chrome.runtime.connect({ name: "popup" });
// Listen for request to show download button
port.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "SHOW_DOWNLOAD_TRANSLATOR") {
    // Show the download button and status
    downloadBtn.style.display = "block";
    statusDiv.style.display = "block";
    statusDiv.innerText = `Model needed: ${msg.src} → ${msg.des}`;

    // Set up the download button click handler
    downloadBtn.onclick = async () => {
      statusDiv.innerText = "Downloading model...";
      downloadBtn.disabled = true;

      try {
        // ✅ This call now has a user gesture
        const translator = await Translator.create({
          sourceLanguage: msg.src,
          targetLanguage: msg.des,
        });

        // Send confirmation back to the tools.js
        chrome.runtime.sendMessage({ type: "USER_CONFIRMED_TRANSLATOR" });
        statusDiv.innerText = "✅ Translator ready!";
        downloadBtn.style.display = "none";

        // Hide status after a delay
        setTimeout(() => {
          statusDiv.style.display = "none";
        }, 3000);
        downloadBtn.disabled = false;
      } catch (err) {
        console.error("Download failed:", err);
        statusDiv.innerText = `Error: ${err.message}`;
        downloadBtn.disabled = false;
      }
    };
  }
  if (msg.type === "EXTRACT_AUDIO_BLOB") {
    const { srcUrl } = msg;
    if (!srcUrl) return;

    const response = await fetch(srcUrl, { mode: "cors" });
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));

    await chrome.storage.local.set({
      lumosAudioBlob: bytes,
      lumosAudioMime: blob.type || "audio/mpeg",
    });
  }
});

// When popup loads try to fetch selection
fetchSelectedText();
setupStackEventListener();

// Initialize AI models when popup loads
initializeModels();
