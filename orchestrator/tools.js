export async function summarize(
  text,
  sharedContext = "This is a scientific article"
) {
  if (!text) return "";
  const options = {
    sharedContext,
    expectedInputLanguages: ["en", "ja", "es"],
    outputLanguage: "en",
    expectedContextLanguages: ["en"],
    type: "key-points",
    format: "markdown",
    length: "medium",
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {});
    },
  };
  let summarizer;
  const availability = await Summarizer.availability();
  if (availability === "unavailable") return;
  if (availability == "available") {
    summarizer = await Summarizer.create();
  } else {
    summarizer = await Summarizer.create();
    summarizer.addEventListener("downloadprogress", (e) => {});
  }
  const res = await summarizer.summarize(text, options);
  return res?.summary || String(res) || "";
}

export async function rewrite(
  text,
  tone = "more-formal",
  context = "This is a scientific article"
) {
  if (!text) return "";
  const options = {
    tone,
    context,
    format: "plain-text",
    length: "shorter",
    expectedInputLanguages: ["en", "ja", "es"],
    expectedContextLanguages: ["en", "ja", "es"],
    outputLanguage: "en",
  };
  const available = await Rewriter.availability();
  let rewriter;
  if (available === "unavailable") {
    // The Rewriter API isn't usable.
    return;
  }
  if (available === "available") {
    // The Rewriter API can be used immediately .
    rewriter = await Rewriter.create(options);
  } else {
    // The Rewriter can be used after the model is downloaded.
    rewriter = await Rewriter.create(options);
    rewriter.addEventListener("downloadprogress", (e) => {});
  }
  const res = await rewriter.rewrite(text, options);
  return res?.rewrite || String(res) || "";
}

export async function prompt(question) {
  let content = [];
  const { lumosAudioBlob, lumosAudioMime } = await chrome.storage.local.get([
    "lumosAudioBlob",
    "lumosAudioMime",
  ]);
  let arrayBuffer = lumosAudioBlob ? new Uint8Array(lumosAudioBlob) : null;
  let options = {
    expectedInputs: [
      {
        type: "text",
      },
    ],
  };
  if (lumosAudioBlob) {
    options.expectedInputs.push({
      type: "audio",
    });
  }
  if (lumosAudioBlob && question) {
    content.push({
      role: "user",
      content: [
        { type: "audio", value: arrayBuffer },
        { type: "text", value: question },
      ],
    });
  } else {
    content.push({
      role: "user",
      content: [{ type: "text", value: question }],
    });
  }
  let languageModel;
  const availability = await LanguageModel.availability();
  if (availability === "unavailable") return;
  if (availability == "available") {
    languageModel = await LanguageModel.create(options);
  } else {
    languageModel = await LanguageModel.create(options);
    languageModel.addEventListener("downloadprogress", (e) => {});
  }
  let res;
  try {
    res = await languageModel.prompt(content);
    return res || String(res) || "";
  } catch (error) {
    console.error("Prompt API Error:", error);
    return `Error: Prompt failed - ${error.message}`;
  } finally {
    await chrome.storage.local.remove(["lumosAudioBlob", "lumosAudioMime"]);
  }
}

export async function translate(
  text,
  sourceLanguage = "en",
  targetLanguage = "en"
) {
  if (!text) return "Error: No text provided for translation";
  const options = {
    sourceLanguage,
    targetLanguage,
  };
  const available = await Translator.availability({
    sourceLanguage,
    targetLanguage,
  });
  let translator;
  if (available === "unavailable") {
    console.log(
      "Translator unavailable for",
      sourceLanguage,
      "to",
      targetLanguage
    );
    return `Error: Translation from ${sourceLanguage} to ${targetLanguage} is not available`;
  }

  try {
    if (available == "available") {
      translator = await Translator.create(options);
    } else if (available === "downloadable" || available === "downloading") {
      // Send message to popup to show download button

      chrome.runtime.sendMessage({
        type: "SHOW_DOWNLOAD_TRANSLATOR",
        src: sourceLanguage,
        des: targetLanguage,
      });

      // Wait for user to confirm download
      await waitForUserGesture();

      // Now create the translator after user gesture
      translator = await Translator.create(options);
    } else {
      translator = await Translator.create(options);
      translator.addEventListener("downloadprogress", (e) => {});
    }

    const res = await translator.translate(text);
    return res || String(res) || "";
  } catch (error) {
    console.error("Translation error:", error);
    if (error.name === "NotAllowedError") {
      return "Error: User gesture required for translation. Please try running the task again.";
    }
    return `Error: Translation failed - ${error.message}`;
  }
}
function waitForUserGesture() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error("User gesture timeout"));
    }, 60000); // 1 min max

    function listener(msg, sender, sendResponse) {
      if (msg.type === "USER_CONFIRMED_TRANSLATOR") {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(true);
      }
    }

    chrome.runtime.onMessage.addListener(listener);
  });
}
export async function languageDetector(text) {
  if (!text) return "";

  const available = await LanguageDetector.availability();
  if (available === "unavailable") return;
  let languageDetector;
  if (available == "available") {
    languageDetector = await LanguageDetector.create();
  } else {
    languageDetector = await LanguageDetector.create();
    languageDetector.addEventListener("downloadprogress", (e) => {});
  }
  const res = await languageDetector.detect(text);
  return res[0]?.detectedLanguage || String(res) || "";
}
export async function proofReader(text) {
  if (!text) return "";
  const available = await ProofReader.availability();
  const options = {
    expectedInputLanguages: ["en", "ja", "es"],
  };
  if (available === "unavailable") return;
  let proofReader;

  proofReader = await ProofReader.create(options);
  proofReader.addEventListener("downloadprogress", (e) => {});
  const res = await proofReader.proof(text);
  return res || String(res) || "";
}
export async function initializeModels() {
  try {
    // Call create() once under gesture
    const summarizerState = await Summarizer.availability();
    if (
      summarizerState !== "unavailable" ||
      summarizerState == "downloadable"
    ) {
      await Summarizer.create();
    }

    const rewriterState = await Rewriter.availability();
    if (rewriterState !== "unavailable" || rewriterState == "downloadable") {
      await Rewriter.create();
    }

    const translatorState = await Translator.availability({
      sourceLanguage: "en",
      targetLanguage: "hi",
    });
    if (
      translatorState !== "unavailable" ||
      translatorState == "downloadable"
    ) {
      await Translator.create({ sourceLanguage: "en", targetLanguage: "hi" });
    }

    const lmState = await LanguageModel.availability();
    if (lmState !== "unavailable" || lmState == "downloadable") {
      await LanguageModel.create();
    }
  } catch (err) {
    console.error("⚠️ Model initialization error:", err);
  }
}
export async function ensureTranslatorReady(src, dest) {
  const status = await Translator.availability({
    sourceLanguage: src,
    targetLanguage: dest,
  });

  if (status === "downloadable" || status === "downloading") {
    return new Promise((resolve, reject) => {
      // Ask user to allow model download
      const confirmed = confirm(
        `A translation model for ${src} → ${dest.toUpperCase()} needs to be downloaded. Do you want to continue?`
      );

      if (!confirmed) {
        reject("User cancelled model download");
        return;
      }

      // ✅ User gesture is active here!
      Translator.create({ sourceLanguage: src, targetLanguage: dest })
        .then((translator) => {
          resolve(translator);
        })
        .catch(reject);
    });
  }
}
