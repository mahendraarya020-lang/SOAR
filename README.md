# 🛡️ AI-Powered SOAR Dashboard & Threat Containment System

[![React](https://img.shields.io/badge/Frontend-React%2018%2B-blue?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%26%20Express-green?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ%20%26%20Redis-red?style=for-the-badge&logo=redis&logoColor=white)](https://bullmq.io)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-black?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io)
[![Ollama](https://img.shields.io/badge/Edge%20AI-Ollama%20%28Llama%203.2%29-orange?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)

An academic-grade, enterprise-ready **Security Orchestration, Automation, and Response (SOAR)** platform. This system delivers high-speed log parsing, asynchronous threat analysis powered by local Edge AI (**Llama 3.2**), real-time WebSocket alerts, and automatic network endpoint containment—all built with absolute fault-tolerance and zero external cloud API dependencies.

---

## 🗺️ Architectural Data Flow

The following sequence diagram outlines the asynchronous event-driven lifecycle of a log ingested into the SOAR Engine, processed by Edge AI, and synchronized in real-time with the React SOC Dashboard.

```mermaid
graph TD
    A[Client Traffic / Raw Access Logs] -->|POST /api/v1/logs/ingest| B(SOAR Core Engine)
    B -->|Push Log to Queue| C[(Redis Queue - BullMQ)]
    C -->|Pull Job| D[Asynchronous Worker]
    D -->|Query Edge LLM| E[Local Ollama - Llama 3.2:latest]
    E -->|JSON Threat Evaluation| D
    D -->|Threat Validated?| F{Yes/No}
    F -->|Yes| G[Update Postgres & Quarantine Endpoint]
    F -->|No| H[Update Postgres & Mark Asset Active]
    G -->|Real-Time threat_alert Event| I[WebSocket Server - Socket.io]
    I -->|Immediate State Broadcast| J[React SOC Dashboard]
    G -->|Local Fallback Mode| K[(In-Memory Mock Fallback Database)]
```

---

## 🌟 Key Features

* **⚡ Asynchronous Ingestion & Processing**: Utilizes `BullMQ` and `Redis` to queue ingested access logs, decoupling raw network performance from computationally heavy security analysis.
* **🧠 Local Edge AI Inference**: Powered by local `Llama 3.2` running on Ollama, avoiding costly cloud billing, latency issues, and compliance/privacy risks.
* **🔒 Automated Containment Protocol**: Automatically isolates target assets in PostgreSQL when a critical security event is validated by the AI engine.
* **🌐 Real-Time Dashboard Synchronization**: Full-duplex `Socket.io` channels broadcast live containment actions, network metrics, and alert logs to the user interface in milliseconds.
* **🛡️ Bulletproof Fault-Tolerance**: Equipped with a robust `In-Memory Mock Fallback` engine that takes over transparently when PostgreSQL or Redis experiences downtime.

---

## 📸 SOC Dashboard Previews

Below are actual visual captures of the running SOAR dashboard interfaces demonstrating the ingestion panels, active server metrics, live threat feeds, and automatic isolation status:

### 1. Ingestion Control Panel & Endpoint Status Monitors
This view presents the controls used to simulate cyber attacks, raw log input fields, and the active network map tracking isolated vs active servers:
![SOC Dashboard Ingest & Metrics](assets/click_feedback_1779191172402.png)

### 2. Real-Time Threat Alerts & Automated Isolation Log
This view highlights critical intrusion detection, AI analysis output, and the exact timestamped quarantine logs of compromised machines:
![SOC Threat Feeds and Containment](assets/click_feedback_1779191206815.png)

---

## 🛠️ Technology Stack & Dependencies

### Backend Core:
* **Runtime**: Node.js & TypeScript
* **Server**: Express & Native HTTP Wrappers
* **Queuing**: BullMQ & Redis Server
* **Database**: PostgreSQL (pg client)
* **Realtime**: Socket.io Server
* **AI engine**: Ollama API Client (Llama 3.2:latest)

### Frontend Core:
* **Framework**: React 18 & TypeScript (Vite boilerplate)
* **Realtime client**: Socket.io Client
* **Styling**: Modern, responsive Dark Theme CSS with vibrant alert glassmorphism.

---

## 🚀 Quick Start Guide

### 🚦 Prerequisites
Ensure the following software components are running in the background:
1. **Redis Server** (Port `6379`)
2. **PostgreSQL Database** (Port `5432` with credentials defined in `.env`)
3. **Ollama** with Llama 3.2 downloaded (`ollama run llama3.2`)

---

### ⚙️ Step 1: Environment Setup
Create a `.env` file in the root directory:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/api_soar
REDIS_URL=redis://localhost:6379
OLLAMA_URL=http://localhost:11434
```

---

### 📦 Step 2: Install Dependencies
Run the install script from the project root:
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd soar-frontend
npm install
cd ..
```

---

### 🗄️ Step 3: Initialize Database Schema
Run the database migrations and seed script to setup standard monitoring assets:
```bash
npm run db:init
```

---

### 🚀 Step 4: Run Development Servers
Open two terminal windows:

#### Terminal 1 (Backend Core & Worker):
```bash
npm run dev
# Expected output: 🚀 SOAR Engine Core listening on http://localhost:3000
```

#### Terminal 2 (Frontend React App):
```bash
cd soar-frontend
npm run dev
# Expected output:  VITE v5.x.x  ready in X ms
#                   ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173/` in your browser and experience the future of autonomous, AI-driven cyber defense!

---

## 🎓 Academic Publication & LaTeX Report
The complete academic-grade project report (complete with Table of Contents, Figures List, and tables wrapped in `tabularx`) is written and fully compiled under:
* 📁 Directory: `/API SOAR LATEX`
* 🇮🇩 Indonesian version: `soar_project_report.pdf`
* 🇬🇧 English version: `soar_project_report_en.pdf`

Authored by **Mahendra Aryaputra Fitrianto** — *Telecommunication Engineering, Telkom University*.
