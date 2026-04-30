# IntelliClip — AI-Powered Smart Clipboard Assistant

[![Electron](https://img.shields.io/badge/Electron-36.5.0-blue.svg?style=flat-square&logo=electron)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-green.svg?style=flat-square&logo=sqlite)](https://sqlite.org)
[![node-llama-cpp](https://img.shields.io/badge/node--llama--cpp-3.18.1-orange.svg?style=flat-square)](https://node-llama-cpp.withcat.ai)
[![Groq](https://img.shields.io/badge/Groq-llama--3.1--8b--instant-red.svg?style=flat-square)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

IntelliClip is a lightweight, local-first desktop application that intelligently captures your clipboard history, classifies content for easy retrieval, and provides sub-120ms hybrid search powered by local AI.

<!-- Add screenshot here -->

## Features

### 📋 Automatic Clipboard Capture
IntelliClip silently monitors your system clipboard using a high-frequency polling monitor (500ms interval). It automatically identifies and saves text, code snippets, URLs, and terminal commands as you work. The application lives in your system tray, providing a "set and forget" experience that builds a searchable memory of your daily productivity without manual intervention.

### 🔍 Hybrid Search Engine
Find any snippet instantly with a sophisticated hybrid search architecture. IntelliClip combines traditional **BM25 (FTS5)** keyword matching for exact hits with **sqlite-vec** for semantic vector similarity. Results are ranked using a weighted scoring system (40% BM25 + 60% Vector) to ensure that whether you remember the exact words or just the general concept, you'll find what you need in under 120ms.

### 🛡️ Privacy-First Filtering
Your security is our priority. IntelliClip features a production-grade safety engine that uses **Shannon entropy analysis** to detect and block passwords, API keys, and sensitive tokens (JWT, AWS, Stripe, etc.) before they are saved to disk. Additionally, the app automatically detects and ignores content copied from password managers like 1Password or Bitwarden. Filtered events are recorded in an audit log without storing the sensitive content itself.

### 🤖 AI-Powered Q&A
Leverage the power of modern LLMs to interact with your clipboard history. By integrating the **Groq API** (running `llama-3.1-8b-instant`), IntelliClip allows you to select any snippet and ask questions or request summaries. The "Ask AI" feature is optimized for speed with a 10-second timeout and graceful error handling, ensuring a responsive experience that understands the context of your saved data.

### 🏷️ Content Classification
No more unorganized lists of text. A robust regex-based classification engine automatically identifies programming languages (Javascript, Python, Go, etc.) and categorizes items into content types like "Code," "URL," "Command," or "Text." This classification drives the iconography and grouping in the Command Palette UI, making it easy to scan your history at a glance.

### 🏠 Local-First Architecture
IntelliClip is built with a privacy-centric, local-first mindset. Your SQLite database, `node-llama-cpp` embeddings, and vector search engine all run natively on your machine with **zero telemetry** and no external cloud requirements. The only optional network connection is to the Groq API for AI Q&A features, keeping your data history completely under your control.

---

## How It Works

IntelliClip follows a deterministic pipeline to transform transient clipboard data into a persistent, searchable knowledge base:

**Flow:** `Clipboard` → `Safety Filter` → `Classifier` → `SQLite Storage` → `Local Embedding` → `Hybrid Search`.

```text
┌─────────────────────────────────────────────────────────┐
│                    IntelliClip                          │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐   │
│  │ Clipboard│──→│ Safety   │──→│ Classifier        │   │
│  │ Monitor  │   │ Filter   │   │ (code/URL/text)   │   │
│  └──────────┘   └────┬─────┘   └────────┬─────────┘   │
│                      │                  │              │
│                      ▼                  ▼              │
│                 ┌──────────┐   ┌──────────────────┐   │
│                 │ Filter   │   │ clips table      │   │
│                 │ Log      │   │ (SQLite)         │   │
│                 └──────────┘   └────────┬─────────┘   │
│                                         │              │
│                          ┌──────────────▼──────────┐  │
│                          │ Embedding Worker        │  │
│                          │ (node-llama-cpp)        │  │
│                          │ 768-dim vectors         │  │
│                          └──────────────┬──────────┘  │
│                                         │              │
│                    ┌────────────────────▼─────────┐   │
│                    │ Hybrid Search Engine          │   │
│                    │ BM25 (FTS5) + Vector (vec0)   │   │
│                    └────────────────────┬─────────┘   │
│                                         │              │
│                    ┌────────────────────▼─────────┐   │
│                    │ Command Palette UI            │   │
│                    │ (React + TypeScript)          │   │
│                    └──────────────────────────────┘   │
│                                                         │
│  External (optional):                                   │
│  ┌──────────┐                                           │
│  │ Groq API │──→ "Ask AI" feature                      │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Technology | Purpose | Why |
| :--- | :--- | :--- |
| **Electron** | Desktop Shell | Provides cross-platform compatibility, system tray integration, and native global shortcuts. |
| **React + TypeScript** | UI Development | Ensures type safety across the IPC boundary and provides a responsive, component-based interface. |
| **better-sqlite3** | Core Database | Offers a high-performance synchronous API with no connection overhead, ideal for local-first apps. |
| **sqlite-vec** | Vector Search | A lightweight SQLite extension that enables 768-dimensional vector search without an external process. |
| **node-llama-cpp** | Embedding Engine | Allows in-process loading of GGUF models, eliminating the need for a separate Ollama or HTTP server. |
| **nomic-embed-text** | Embedding Model | A compact (~80MB), 768-dimension model optimized for high-performance semantic search. |
| **Groq API** | AI Q&A | Provides ultra-fast inference (~500ms) for the "Ask AI" feature using the Llama 3.1 8B model. |

---

## Project Structure

```text
IntelliClip/
├── src/
│   ├── electron/           ← Main process (Node.js)
│   │   ├── main.ts         ← App entry, tray, IPC handlers
│   │   ├── db.ts           ← SQLite schema + migrations
│   │   ├── embedder.ts     ← node-llama-cpp embedding engine
│   │   ├── groq.ts         ← Groq API client
│   │   ├── search.ts       ← Hybrid BM25 + vector search
│   │   ├── clipboard.ts    ← Clipboard polling monitor
│   │   ├── classifier.ts   ← Content type + language detection
│   │   ├── safety.ts       ← Secret/password detection
│   │   ├── preload.ts      ← Context bridge (main ↔ renderer)
│   │   ├── core/
│   │   │   └── storage.ts  ← CRUD operations on clips table
│   │   └── utils.ts
│   └── ui/                 ← Renderer process (React)
│       ├── App.tsx          ← Command palette UI
│       ├── App.css          ← Styles
│       ├── main.tsx         ← React entry point
│       ├── types.ts         ← Shared TypeScript types
│       └── components/
│           ├── SearchBar.tsx
│           ├── ResultRow.tsx
│           └── ErrorBoundary.tsx
├── resources/
│   └── models/
│       └── nomic-embed-text-v1.5.Q4_K_M.gguf  ← Bundled embedding model
├── electron-builder.json    ← Build/packaging config
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Installation

### Prerequisites
- **Node.js** v18 or higher.
- **Git** for cloning the repository.
- **Groq API Key**: Obtain one from the [Groq Console](https://console.groq.com/).

### Setup Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/IntelliClip.git
   cd IntelliClip
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your `GROQ_API_KEY`.

4. **Launch development mode**:
   ```bash
   npm run dev
   ```

To verify the installation, check the system tray for the IntelliClip icon and copy some text to see it appear in the history (via `Shift+Cmd+V`).

---

## Usage Guide

### Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| `Shift + Cmd + V` | Open/Toggle the IntelliClip command palette. |
| `Enter` | Paste the selected snippet directly into your active application. |
| `Esc` | Close the command palette. |
| `Arrow Keys` | Navigate through search results. |

### Searching
The search bar accepts natural language queries. Results are ranked by a combination of keyword relevance and semantic meaning. Each result displays a **Type Badge** (Code, URL, etc.), the **Source App** (e.g., VS Code, Chrome), and a **Relative Timestamp**.

### Ask AI
Select a snippet in the results and type your question in the AI section. This feature uses the context of the snippet to provide intelligent answers, code explanations, or refactoring suggestions via Groq.

### Filter Log
IntelliClip automatically ignores sensitive data. If you copy a secret that is blocked, an entry is created in the `filter_log`. You can review these events to see which patterns (e.g., `github_token`, `aws_secret`) were triggered.

---

## Database Schema

### `clips` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key (autoincrement). |
| `content` | TEXT | The raw captured text/code. |
| `content_type` | TEXT | Classification: `code`, `url`, `command`, or `text`. |
| `language` | TEXT | Programming language identifier (if code). |
| `source_app` | TEXT | The application from which the content was copied. |
| `captured_at` | INTEGER | Unix timestamp of capture. |
| `is_embedded` | INTEGER | Flag indicating if semantic vector has been generated (0/1). |
| `summary` | TEXT | Optional AI-generated summary of the content. |

**Virtual Tables:**
- `clips_fts`: FTS5 virtual table for high-speed full-text keyword search.
- `clips_vec`: `vec0` virtual table for storing 768-dimensional float embeddings.

---

## Configuration
- **.env**: Used exclusively for your `GROQ_API_KEY`. This file is never bundled with production builds.
- **Storage Location**:
  - **macOS**: `~/Library/Application Support/intelliclip/intelliclip.db`
  - **Windows**: `%AppData%\intelliclip\intelliclip.db`
- **Embedding Model**: Bundled as an internal resource in `resources/models/`.

---

## Building for Production
To package IntelliClip for your OS, use the following commands:

```bash
# General build (detects current OS)
npm run build

# OS Specific distributions
npm run dist:mac    # Build .dmg for Apple Silicon
npm run dist:win    # Build portable/MSI for Windows
npm run dist:linux  # Build AppImage for Linux
```
Artifacts will be generated in the `dist/` directory.

---

## Known Limitations
- **Model Load Time**: The local embedding model takes ~2-3 seconds to load into VRAM on the first cold start.
- **Internet Requirement**: The "Ask AI" feature requires an active internet connection to communicate with the Groq API.
- **Truncation**: Snippets longer than 2000 characters are truncated before being passed to the embedding engine to maintain performance.

---

## License
Distributed under the **MIT License**. See `LICENSE` for more information.