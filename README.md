# Lumos — On-device AI Companion

<div align="center">

✨ **Lumos** is a powerful Chrome extension that brings AI-powered text processing and audio transcription capabilities directly to your browser—all running completely on-device for maximum privacy.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome)](https://chrome.google.com/webstore)
[![Privacy First](https://img.shields.io/badge/Privacy-On--Device-green)](https://github.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)

</div>

## 🌟 Features

### Text Processing

- **Summarize** - Extract key points from any text
- **Rewrite** - Transform text tone (formal, casual, or as-is)
- **Translate** - Translate between multiple languages
- **Language Detection** - Automatically detect text language
- **Chain Operations** - Combine multiple operations (e.g., "summarize and translate")

### Audio Processing

- **Audio Transcription** - Transcribe audio content from web pages
- **Audio Selection** - Right-click on audio elements to transcribe
- **Visual Indicators** - Clear UI indicators when audio is selected

### Privacy & Security

- 🛡️ **100% On-Device Processing** - All AI operations run locally using Chrome's built-in AI APIs
- 🔒 **No Data Sent to Servers** - Your text and audio never leave your device
- 🚫 **No Tracking** - Completely private and anonymous

### User Experience

- 🎨 **Beautiful UI** - Modern, gradient-based interface
- 🚀 **Context Menu Integration** - Right-click to access Lumos anywhere
- 📊 **Function Stack Visualization** - See what operations are being performed in real-time
- ⚡ **Fast & Responsive** - Optimized for quick results

## 🏗️ Architecture

```
lumos/
├── background.js          # Service worker for context menu & message handling
├── content.js             # Content script for audio blob extraction
├── manifest.json          # Extension configuration
├── orchestrator/
│   ├── planner.js         # LLM-based execution planner
│   └── tools.js           # AI model integrations (summarize, translate, etc.)
└── popup/
    ├── popup.html         # Extension popup UI
    ├── popup.js           # Popup logic & orchestration
    └── popup.css          # Styling
```

## 🚀 Installation

### Prerequisites

- Google Chrome (or Chromium-based browser)
- Chrome 126+ with AI API support enabled

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/lumos.git
   cd lumos
   ```

2. **Load the extension in Chrome**

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `lumos` directory

3. **Enable Chrome AI APIs**
   - Ensure your Chrome version supports the AI APIs
   - The extension uses Chrome's on-device AI models

## 📖 Usage

### Text Processing

1. **Select text** on any webpage
2. **Right-click** and choose "Ask Lumos ✨"
3. **Enter your instruction** in the popup (e.g., "summarize this", "translate to Spanish")
4. **Click Run** and watch the magic happen!

### Audio Transcription

1. **Right-click on an audio element** on a webpage
2. **Select "Ask Lumos ✨"**
3. **Enter instruction** like "transcribe this audio"
4. **Click Run** - Lumos will transcribe the audio

### Example Instructions

- `"summarize this"`
- `"rewrite this more formally"`
- `"translate this to French"`
- `"transcribe this audio"`
- `"summarize and translate to Spanish"`
- `"rewrite in simple form and translate to Tamil"`

## 🛠️ Technology Stack

- **Chrome Extension APIs**

  - Manifest V3
  - Context Menus API
  - Storage API
  - Scripting API

- **Chrome AI APIs** (On-Device)

  - Language Model API
  - Summarizer API
  - Rewriter API
  - Translator API
  - Language Detector API

- **Frontend**
  - Vanilla JavaScript (ES6+)
  - HTML5/CSS3
  - Chrome Extension APIs

## 🧠 How It Works

1. **User Selection** - User selects text or audio and right-clicks
2. **Planner** - LLM-based planner analyzes the instruction and creates an execution plan
3. **Orchestration** - Multiple AI functions can be chained together
4. **Execution** - Functions are executed sequentially, with results passed between steps
5. **Output** - Final result is displayed in the popup

### Planning System

The orchestrator uses an intelligent planner that:

- Understands user intent from natural language
- Creates execution plans with multiple steps when needed
- Chains operations (e.g., summarize → translate)
- Handles errors gracefully

## 🔧 Development

### Project Structure

- `background.js` - Handles context menu clicks and message passing
- `content.js` - Extracts audio blobs from web pages
- `orchestrator/planner.js` - LLM-based execution planner
- `orchestrator/tools.js` - Wrappers for Chrome AI APIs
- `popup/` - Extension popup UI and logic

### Key Components

#### Planner (`orchestrator/planner.js`)

- Analyzes user instructions
- Creates step-by-step execution plans
- Manages multi-step operations

#### Tools (`orchestrator/tools.js`)

- `summarize()` - Text summarization
- `rewrite()` - Text rewriting
- `translate()` - Language translation
- `languageDetector()` - Language detection
- `prompt()` - Audio transcription and general prompts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Chrome's on-device AI APIs
- Inspired by the need for privacy-first AI tools

## 📧 Contact

Your Name - [@yourusername](https://twitter.com/yourusername)

Project Link: [https://github.com/yourusername/lumos](https://github.com/yourusername/lumos)

---

<div align="center">

Made with ✨ by the Lumos team

⭐ Star this repo if you find it helpful!

</div>
