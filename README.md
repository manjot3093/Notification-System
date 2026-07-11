# Nova CRM — Tenant-Aware Notification System

A full-stack CRM notification system that demonstrates **tenant-aware notification delivery**, **real-time updates**, and **secure notification visibility** across organizations. The project was developed as part of a Full-Stack Placement Challenge and showcases end-to-end integration between the frontend, backend, database, and event triggers.

### 👨‍💻 Team

* **Manjot Singh**
* **Ankit Raj**

**Amity University Jharkhand**

---

# ✨ Project Overview

This project implements a complete notification pipeline where CRM events automatically generate notifications that are delivered only to the intended users within the correct tenant.

### Key Highlights

* 🔔 Notification Bell with unread badge
* 🏢 Tenant-aware notification isolation
* 👤 User-specific notifications
* 👥 Tenant-wide notifications
* ⚡ Real-time updates using Server-Sent Events (SSE)
* 🔄 Polling fallback mechanism
* 💾 SQLite database
* 🧪 Automated backend tests
* 🎯 Event-driven notification triggers

---

# 🚀 Quick Start

## Option 1 — One Click Setup (Recommended)

A setup script is included to simplify project installation.

Simply double-click or Run file by just right click and run the file :

```text
Launch.bat
```

The script will automatically:

* Install Backend dependencies
* Install Frontend dependencies
* Create required environment configuration
* Start the Backend server
* Start the Frontend server
* Open the project in separate terminals

After setup completes, open:

```text
Frontend
http://localhost:5173

Backend
http://localhost:4000
```

This is the fastest way to run the project.

---

## Option 2 — Manual Installation

### Step 1 — Install Requirements

Install:

* Node.js 22.5 or later
* Git
* Visual Studio Code (Recommended)

Verify installation:

```bash
node -v
git --version
```

---

### Step 2 — Clone Repository

```bash
git clone https://github.com/manjot3093/Notification-System.git
cd Notification-System
```

---

### Step 3 — Open Project

```bash
code .
```

If the command is unavailable:

```text
File → Open Folder → Notification-System
```

---

### Step 4 — Start Backend

Open Terminal 1

```bash
cd Backend
npm install
npm start
```

Backend runs on

```text
http://localhost:4000
```

The SQLite database is automatically created inside:

```text
Backend/data/notifications.db
```

---

### Step 5 — Start Frontend

Open Terminal 2

```bash
cd Frontend/Notification_System_Frontend

npm install

copy .env.example .env

npm run dev
```

For Linux/macOS:

```bash
cp .env.example .env
```

Frontend runs on

```text
http://localhost:5173
```

---

### Step 6 — Run Backend Tests

Open another terminal.

```bash
cd Backend
npm test
```

The automated tests verify:

* Tenant isolation
* Notification visibility
* Unread count
* Mark Read APIs
* Mark All Read API
* Trigger pipeline
* SSE notification delivery

---

# 📌 Project Features

* Notification Bell with unread badge
* Notification dropdown panel
* Mark individual notification as read
* Mark all notifications as read
* Tenant-wide notifications
* User-specific notifications
* Server-Sent Events (Real-time updates)
* Automatic polling fallback
* Event-driven notification creation
* Secure tenant isolation
* SQLite persistent storage
* Seed data for demonstration
* Automated backend testing

---

# 🛠 Technology Stack

### Frontend

* React.js
* Vite
* CSS3

### Backend

* Node.js
* Express.js

### Database

* SQLite

### Real-Time Communication

* Server-Sent Events (SSE)

### Testing

* Node.js Test Runner

---

# 🏗 System Architecture

```text
                    CRM Event
                        │
                        ▼
             Trigger / Webhook Endpoint
                        │
                        ▼
             Notification Service Layer
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
 SQLite Database               SSE Event Stream
        │                               │
        └───────────────┬───────────────┘
                        ▼
              React Notification Bell
                        │
                        ▼
         Correct Tenant & User Receives Notification
```

---

# 🌐 API Endpoints

All notification endpoints use:

```text
X-Tenant-Id
X-User-Id
```

| Method | Endpoint                      | Description                      |
| ------ | ----------------------------- | -------------------------------- |
| POST   | `/notifications`              | Create notification              |
| GET    | `/notifications`              | Fetch visible notifications      |
| GET    | `/notifications/unread-count` | Get unread notification count    |
| GET    | `/notifications/stream`       | Real-time notification stream    |
| PATCH  | `/notifications/:id/read`     | Mark notification as read        |
| PATCH  | `/notifications/read-all`     | Mark all notifications as read   |
| POST   | `/webhooks/member-invited`    | Trigger tenant-wide notification |
| POST   | `/webhooks/creator-replied`   | Trigger user notification        |
| POST   | `/webhooks/report-ready`      | Trigger report notification      |

---

# 🌿 Git Workflow

### 1. Get Latest Code

```bash
git checkout main
git pull origin main
```

### 2. Create a Feature Branch

```bash
git checkout -b your-feature-name
```

Example

```bash
git checkout -b frontend-ui-update
```

### 3. Develop Your Feature

Make changes and test the project.

### 4. Check Changes

```bash
git status
```

### 5. Commit Changes

```bash
git add .
git commit -m "Describe your changes"
```

### 6. Push Branch

```bash
git push -u origin your-feature-name
```

### 7. Create Pull Request

```text
your-feature-name → main
```

> **Important:** Never commit directly to the `main` branch. Always create a feature branch, push it, and open a Pull Request after testing.
