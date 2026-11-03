<div align="center">

# QNotes

**A blazing-fast, keyboard-first note-taking app for Windows & macOS.**

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.77+-orange?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: PolyForm Perimeter 1.0.1](https://img.shields.io/badge/License-PolyForm%20Perimeter%201.0.1-7952B3?style=for-the-badge)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/imardagokce/quicknote?style=for-the-badge&color=10B981&label=Release)](https://github.com/imardagokce/quicknote/releases)

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-download--installation">Download</a> •
  <a href="#-development-setup">Development</a> •
  <a href="#-roadmap">Roadmap</a> •
  <a href="#-license--terms">License</a>
</p>

</div>

---

## 📸 Showcase

<div align="center">
  <br />
  <img src="https://via.placeholder.com/1200x680/121217/6366f1?text=QNotes+Spotlight+Overlay+Preview+(Coming+Soon)" alt="QNotes Spotlight Overlay Demo" width="800" style="border-radius: 16px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.85);" />
  <br />
  <p align="center"><em>Raycast-inspired minimalist Spotlight overlay with real-time search, instant capture, and inline editor.</em></p>
  <br />
</div>

---

## ✨ Key Features

- **⚡ Global Hotkey (`Alt+Space` / `Ctrl+Space`)**  
  Summon or dismiss your scratchpad instantly from anywhere in your operating system without switching apps.

- **🔒 Local-First & 0ms Latency**  
  Powered by an embedded SQLite database (`qnotes.db`). All your notes live securely on your device with sub-millisecond search and auto-save.

- **🎨 Onboarding & Custom Themes**  
  A modern first-run personalization wizard to select your preferred hotkey, autostart behavior, and visual appearance (**Midnight**, **Obsidian**, or **Slate**).

- **🏷️ Intelligent Auto-Tagging**  
  Hashtags like `#work`, `#ideas`, or `#todo` typed in your notes are automatically indexed and filterable in the command palette.

- **🚀 Ultra-Low Resource Footprint (~30MB RAM)**  
  Built with **Tauri v2** and **Rust** instead of heavy browser runtimes. Runs quietly in the background without draining battery or memory.

- **📌 Pin & Quick Actions**  
  Keep essential notes pinned to the top, copy content to clipboard with a single keypress, or navigate notes using pure keyboard shortcuts (`↑` / `↓` / `↵` / `Esc`).

---

## 📥 Download & Installation

### For End Users

Download the latest prebuilt installer for your operating system from the **[GitHub Releases](https://github.com/imardagokce/quicknote/releases)** page:

| Platform | Format | Description |
| :--- | :--- | :--- |
| **Windows** | `.exe` | NSIS Installer with desktop shortcut & autostart options |
| **macOS** | `.dmg` | Universal Apple Silicon & Intel disk image |

---

## 🛠️ Development Setup

If you want to inspect, audit, or build QNotes locally from source:

### Prerequisites

1. **Node.js** (v18+) & **pnpm** (or `npm`)
2. **Rust Toolchain**: Install via [rustup.rs](https://rustup.rs/)
3. **C++ Build Tools**: Visual Studio Build Tools (Windows) or Xcode Command Line Tools (macOS)

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/imardagokce/quicknote.git
cd quicknote

# 2. Install frontend dependencies
pnpm install
# or: npm install

# 3. Launch in development mode
pnpm tauri dev
# or: npm run tauri dev

# 4. Build production installer
pnpm tauri build
# or: npm run tauri build
```

---

## 🗺️ Roadmap

- [x] Frameless Transparent Overlay Window & DWM shadow optimizations
- [x] Global Hotkey Toggle (`Alt+Space` & `Ctrl+Space`)
- [x] Embedded SQLite Engine with CRUD & debounced auto-save
- [x] First-run Onboarding Wizard & Autostart preferences
- [x] NSIS Windows Installer hooks & desktop shortcuts
- [x] Multi-platform CI/CD release workflow (`.exe` & `.dmg`)
- [ ] 🤖 Local & Cloud AI Integration (Ollama, OpenAI, Claude for summaries & action items)
- [ ] ☁️ Optional End-to-End Encrypted Cloud Sync
- [ ] 🔌 Plugin & Extension System for Custom Workflows

---

## 📜 License & Terms

This project is licensed under the **[PolyForm Perimeter License 1.0.1](LICENSE)**.

### Source-Available Summary

QNotes follows a **Source-Available** model. The source code is publicly accessible for learning, testing, auditing, and personal non-competing use.

- **Permitted Use:**  
  You are free to inspect, study, test, audit, and run the software for your own personal or internal use. You may contribute non-competing improvements and fork the codebase for non-competing purposes, provided the original license and copyright notices are preserved.

- **Restrictions (Noncompete & Rebranding):**  
  You **may not** distribute, repackage, or rebrand this software (with or without minor modifications) as a competing product or substitute for QNotes—whether distributed for a fee or free of charge, as a standalone application, library, service, or plugin.

For the full legal terms, please review the complete **[LICENSE](LICENSE)** file.

---

<div align="center">
  <sub>Crafted with precision by <strong>Arda Gökçe Alkan</strong></sub>
</div>
