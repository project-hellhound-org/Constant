# CONSTANT — Personalized Routine Tracker (Architecture Documentation)

![Habit OS System Banner](assets/Banner.png)

<p align="center">
  <img src="assets/Icon.png" width="96" alt="Habit OS Application Logo" /><br>
  <b>Local-First Personal Productivity & Environmental Habit Operating System</b><br>
  Built with React 18, TypeScript 5, Vite, Dexie IndexedDB, and Electron.
</p>

---

## 1. Project Overview

Habit OS is an enterprise-grade productivity workstation designed for professionals, engineers, and researchers requiring local-first data privacy, structured habit formation, timeline-based task management, and zero-latency AI copilot analytics.

### Core Functionality
- **Habit Formation & Schedule Tracking**: Provides habit categorization, start/end scheduling windows, completion target parameters, and consecutive day streak evaluation.
- **Timeline Task Management**: Supports task duration allocation, start/end date constraints, priority levels, subtask breakdowns, and deadline tracking.
- **Daily Review & Performance Analytics**: Calculates productivity efficiency indices, habit completion ratios, focus scores, and task workload audits.
- **Zero-Latency AI Insight Engine**: Integrates local (Ollama) and generic cloud API models without reasoning/thinking latency delays.

### Environmental Design Philosophy
The system implements the Forest Flow Environment Engine, an architectural framework that separates atmospheric rendering from application UI interactivity. The environment is rendered as a persistent fixed background layer behind the UI shell. This approach delivers atmospheric immersion while maintaining application readability, component stability, and frame-rate performance.

---

## 2. Setup Instructions

### Prerequisites
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Python 3.8 or higher
- Optional: Ollama local service for offline AI inference

### Installation & Initialization

1. **Clone the Repository**:
```bash
git clone https://github.com/project-hellhound-org/Habbit-Tracker.git
cd Habbit-Tracker
```

2. **Automated System Setup**:
Execute the automated shell installer script to inspect system prerequisites, install dependencies, compile production assets, and link terminal launchers:
```bash
chmod +x install.sh
./install.sh
```

3. **Manual Dependency Installation**:
Alternatively, dependencies can be installed manually using npm:
```bash
npm install
```

4. **Launch Development Environment**:
```bash
# Web application development server
npm run dev

# Desktop application (Electron runtime)
npm run electron:dev
```

### AI Model Integration Configuration

Habit OS supports both offline local models via Ollama and vendor-agnostic cloud API endpoints.

- **Local Inference Setup**:
  - Install Ollama (`https://ollama.com`).
  - Start the Ollama daemon: `ollama serve`.
  - Pull desired models: `ollama pull llama3.1`.
  - Set Environment Mode to `Local Model (Ollama)` in Settings. Default endpoint: `http://localhost:11434/v1/chat/completions`.

- **Cloud Model Setup**:
  - Set Environment Mode to `Cloud Model (Generic API)` in Settings.
  - Provide **API Key**, **Base URL** (e.g., `https://api.openai.com/v1`), and **Model Name** (e.g., `gpt-4o-mini`).
  - Use the built-in Connection Test utility to verify endpoint latency and authorization.

---

## 3. Usage Guidelines

### Appearance (Settings > Appearance)

All colours, fonts and backgrounds are chosen from a registry in `src/theme/`; components read CSS variables only.

- **Themes (exactly three):** Sage Minimal (light), Warm Monochrome (a darker espresso / taupe / bronze palette) and Dark Mode (cool near-black).
- **Fonts (five):** Inter, IBM Plex Sans, Manrope, Newsreader + Inter (editorial) and Source Serif 4. Loaded from Google Fonts with system fallbacks.
- **Backgrounds (ten):** the supplied artwork, converted to WebP and grouped Light (01-04) / Dark (05-10) in `src/assets/backgrounds/`.
- **Dynamic contrast (`adaptive.ts`):** for every theme + background pair the engine measures the artwork's darkest / brightest regions and computes (a) a theme-coloured scrim over the image and (b) the minimum panel opacity so panel text keeps at least 4.7:1 contrast. Page titles sit on opaque panel-backed headers. Charts, heatmaps and status colours come from per-theme tokens, so they re-colour with the theme. `theme.test.ts` verifies all 30 theme x background combinations.
- Stored in `settings.themeId / fontId / backgroundId`. Only registered ids can be activated; invalid values fall back to Sage Minimal / Inter / Sage Leaves. Users upgrading from earlier versions (Porcelain & Ink, Rain Forest, Foggy Mist) are migrated to Sage Minimal.

### Accounts and Settings

- First launch (and after a reset) shows a sign-up portal under the **CONSTANT / Personalized Routine Tracker** title; returning users sign in with email and password. Passwords are PBKDF2-SHA256 hashed with a per-user salt (legacy plain-text passwords from older versions are upgraded on first sign-in).
- **Settings** opens on **Profile** (name, gender, email, date of birth, short description, password change) with **Database operations** at the bottom (Extract data, Restore data, Clear all data). **AI Configuration** and **Appearance** are one tab away. Every database operation asks for the password.
- **Clear all data** deletes every table (profile, credentials, AI keys, habits, finance, notes...) and all local preferences, then returns to the sign-up portal.
- Finance keeps one selected currency (USD, INR, RUB, EUR, ...) until you change it; it is applied to every finance figure and stamped on new transactions. Amounts are not converted between currencies.

### Database Administration & Backup Security

Habit OS provides local-first data backup, extraction, and restoration capabilities:

- **Full Data Backup Extraction (JSON)**: Exports complete IndexedDB application state—including habits, habit logs, tasks, subtasks, projects, goals, journal entries, daily reviews, categories, tags, settings, and AI history—into a structured JSON backup file (`HabitOS_Full_Backup_YYYY-MM-DD.json`).
- **Data Backup Restoration (JSON)**: Restores previously exported backup files into new or reset instances of Habit OS. Supports both full database backups and legacy habit/task backups with atomic IndexedDB transactions and schema validation.
- **Master Password Security**: Database extraction, restoration, and total deletion operations are protected by Master Password verification when enabled.

---

## 4. Project Hellhound

Project Hellhound represents an engineering initiative focused on building privacy-preserving, high-density productivity software and local AI copilot tools.

### Architectural Objectives
- **Data Sovereignty**: Eliminating third-party telemetry and cloud lock-in by executing database storage locally within IndexedDB.
- **Zero-Latency Copilot Interface**: Bypassing chain-of-thought latency to deliver rapid analytical responses for user habit and workload queries.
- **Environmental Immersion**: Merging organic aesthetics with software usability to reduce digital fatigue during long technical working sessions.

### Repository License
Distributed under the MIT License. Copyright (c) Project Hellhound.

## Author

<p align="center">
    <img src="https://img.shields.io/badge/Founder-ALPH4_X3-c0392b?style=for-the-badge" alt="ALPH4_X3"/>
  </a>
</p>

---

<p align="center">
  Built by <b>Project Hellhound</b> &nbsp;·&nbsp; Part of the <a href="https://github.com/project-hellhound-org">Project Hellhound</a> toolkit
</p>
