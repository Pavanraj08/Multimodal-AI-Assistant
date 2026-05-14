# ✦ Multimodal AI Assistant

A production-quality, Claude-inspired **Multimodal AI Assistant** that understands **Text**, **Images**, and **Voice** — with document Q&A powered by OCR and a RAG pipeline.

![Multimodal AI Assistant](https://img.shields.io/badge/AI-Multimodal-d4a574?style=for-the-badge&logo=openai&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-4ade80?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-8b5cf6?style=for-the-badge)

---

## 🎯 Overview

A fully client-side, browser-based AI assistant that brings together multiple AI capabilities into one sleek interface. No complex server setup — just Ollama running locally and you're ready to go.

> **Why it's excellent:** This is close to real GenAI products like ChatGPT, Claude, and Gemini — demonstrating practical knowledge of LLMs, Vision AI, Speech Recognition, and Retrieval-Augmented Generation.

---

## ✨ Features

### 💬 Text Chat
- Conversational AI with full message history
- Streaming responses with real-time token display
- Markdown rendering (bold, code blocks, lists, headings)
- Copy-to-clipboard on code blocks
- Multiple conversation management with auto-titling

### 🖼️ Image Analysis (Vision)
- Upload images via button click or drag-and-drop
- Visual understanding using Vision Transformer models (LLaVA)
- Image thumbnails displayed inline in chat
- Ask questions about any uploaded image

### 🎙️ Voice Input
- Push-to-talk voice recording via Web Speech API
- Real-time interim transcription while speaking
- Visual pulse animation during recording
- Multi-language support (English, Hindi, Spanish, French, etc.)

### 📑 Document Q&A (RAG Pipeline)
- Upload document images to the Document Panel
- Automatic text extraction via **Tesseract.js OCR** with progress tracking
- Extracted text stored in a client-side RAG pipeline
- Ask questions — AI uses document context for accurate answers
- Keyword-based chunk retrieval with relevance scoring

---

## 🏗️ Tech Stack

| Technology | Purpose |
|---|---|
| **Ollama** | Local LLM inference (llama3.2, llava, etc.) |
| **Google Gemini API** | Cloud LLM alternative (free tier) |
| **Tesseract.js** | Browser-side OCR (Optical Character Recognition) |
| **Web Speech API** | Voice-to-text speech recognition |
| **Vision Transformers** | Image understanding via LLaVA/multimodal models |
| **RAG Pipeline** | Retrieval-Augmented Generation for document Q&A |
| **Marked.js** | Markdown rendering for AI responses |
| **DOMPurify** | HTML sanitization for security |

---

## 🚀 Getting Started

### Prerequisites

- [Ollama](https://ollama.com/download) installed and running
- A modern browser (Chrome/Edge recommended for voice)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Pavanraj08/Multimodal-AI-Assistant.git
cd Multimodal-AI-Assistant

# 2. Pull an AI model
ollama pull llama3.2

# 3. (Optional) Pull a vision model for image analysis
ollama pull llava

# 4. Start a local server
python -m http.server 8080

# 5. Open in browser
# Navigate to http://localhost:8080
```

### Using Gemini API (Cloud Alternative)

If you don't have Ollama, you can use Google's free Gemini API:

1. Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open the app → Click ⚙️ Settings
3. Switch backend to **Google Gemini**
4. Paste your API key → Save

---

## 📁 Project Structure

```
Multimodal-AI-Assistant/
├── index.html          # Main HTML structure (sidebar, chat, panels)
├── index.css           # Claude-inspired dark theme with animations
├── app.js              # Main application controller
├── ai-service.js       # Dual backend: Ollama + Gemini API
├── ocr-engine.js       # Tesseract.js OCR wrapper
├── voice-handler.js    # Web Speech API handler
├── rag-pipeline.js     # Document store, chunking, context builder
└── utils.js            # Markdown rendering, file utilities
```

---

## 🎨 UI Design

Inspired by **Claude's** clean, professional interface:

- **Dark theme** with warm amber accents
- **Sidebar** with conversation history management
- **Welcome screen** with interactive feature cards
- **Streaming responses** with typing indicators
- **Responsive layout** — works on desktop, tablet, and mobile
- **Glassmorphism** effects and smooth micro-animations

---

## 🔧 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Client-Side)               │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Voice   │  │  Image   │  │  Document Upload  │   │
│  │  Input   │  │  Upload  │  │  (OCR Pipeline)   │   │
│  │ (Web     │  │          │  │                    │   │
│  │  Speech) │  │          │  │                    │   │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘   │
│       │              │                 │              │
│       ▼              │                 ▼              │
│  ┌──────────┐        │         ┌──────────────┐      │
│  │ Speech   │        │         │  Tesseract.js │      │
│  │ to Text  │        │         │  OCR Engine   │      │
│  └────┬─────┘        │         └──────┬───────┘      │
│       │              │                │              │
│       ▼              ▼                ▼              │
│  ┌──────────────────────────────────────────────┐    │
│  │           RAG Context Builder                 │    │
│  │  (Text + OCR chunks + Image base64)           │    │
│  └────────────────────┬─────────────────────────┘    │
│                       │                              │
│                       ▼                              │
│  ┌──────────────────────────────────────────────┐    │
│  │      Ollama API / Gemini API (Streaming)      │    │
│  └────────────────────┬─────────────────────────┘    │
│                       │                              │
│                       ▼                              │
│  ┌──────────────────────────────────────────────┐    │
│  │         Chat UI (Markdown Rendered)            │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Supported Models

### Text Models (Ollama)
- `llama3.2` — Fast, general-purpose
- `mistral` — Strong reasoning
- `gemma3` — Google's open model
- Any model available via `ollama list`

### Vision Models (Ollama)
- `llava` — Image + text understanding
- `llava-llama3` — Enhanced vision
- `moondream` — Lightweight vision
- `bakllava` — BakLLaVA model

### Cloud Models
- `gemini-2.0-flash` — Google Gemini (fast, multimodal)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author

**Pavan Raj**

- GitHub: [@Pavanraj08](https://github.com/Pavanraj08)

---

<p align="center">
  <b>Built with ❤️ using LLMs, OCR, Vision Transformers & RAG</b>
</p>
