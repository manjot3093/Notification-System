# Nova CRM — Tenant-Aware Notification System

A full-stack CRM notification system with tenant isolation, user-specific notifications, tenant-wide notifications, real-time updates, and a React notification bell.

# Step-by-Step Project Setup

## Step 1: Install Required Software

Install:

* Node.js version 22.5 or above
* Git
* Visual Studio Code recommended

Check if Node.js and Git are installed:

```bash
node -v
git --version
```

## Step 2: Clone the Project

Open PowerShell or Terminal and run:

```bash
git clone https://github.com/manjot3093/Notification-System.git
cd Notification-System
```

## Step 3: Open the Project in VS Code

Run:

```bash
code .
```

If `code .` does not work, open VS Code manually and select:

```text
File → Open Folder → Notification-System
```

## Step 4: Start the Backend

Open the first terminal in VS Code.

Run:

```bash
cd Backend
npm install
npm start
```

Backend runs on:

```text
http://localhost:4000
```

The backend creates the SQLite database automatically at:

```text
Backend/data/notifications.db
```

## Step 5: Start the Frontend

Open a second terminal in VS Code.

Go to the project root first:

```bash
cd "path-to-your-project/Notification-System"
```

Then run:

```bash
cd Frontend/Notification_System_Frontend
npm install
copy .env.example .env
npm run dev
```

For Mac/Linux, use:

```bash
cp .env.example .env
```

Frontend runs on:

```text
http://localhost:5173
```

Open this URL in the browser.

## Step 6: Test the Notification Bell

1. Open `http://localhost:5173`.
2. Select a user from the **Viewing as** dropdown.
3. Click the notification bell.
4. Check the unread notification count.
5. Click a notification to mark it as read.
6. Click **Mark all as read** to mark all visible notifications as read.
7. Click **Invite Team Member** to create a tenant-wide notification.
8. Click **Simulate Creator Reply** to create a personal notification.
9. Switch users and tenants to check who can see each notification.

## Step 7: Run Backend Tests

Open a third terminal.

Run:

```bash
cd Backend
npm test
```

The tests verify:

* Tenant isolation
* Unread count isolation
* Mark one notification as read
* Mark all notifications as read
* Protection from notification ID guessing
* Trigger pipeline
* SSE real-time notification visibility

# Project Features

* Notification bell with unread badge
* Notification dropdown panel
* Mark one notification as read
* Mark all notifications as read
* Tenant-wide notifications
* User-specific notifications
* Real-time updates using Server-Sent Events
* Polling fallback every 20 seconds
* SQLite database
* Seed data
* Demo event triggers
* Tenant isolation tests

# Technology Used

* Node.js
* Express.js
* SQLite
* React.js
* Vite
* Server-Sent Events
* Node.js test runner

# Project Architecture

```text
React Frontend
      |
      | Sends API request with tenant ID and user ID
      v
Express Backend
      |
      | Reads tenant and user identity
      v
Notification Service
      |
      | Creates, lists, counts, and updates notifications
      v
SQLite Database
      |
      | Saves notification data
      v
SSE Stream and Polling
      |
      v
Notification Bell Updates Automatically
```

# Notification Flow

```text
Step 1: A CRM event happens.
Example: A creator replies to an outreach message.

Step 2: Trigger endpoint receives the event.

Step 3: Trigger calls Notification Service.

Step 4: Notification Service saves notification in SQLite database.

Step 5: Backend sends real-time SSE event.

Step 6: Allowed frontend user receives the event.

Step 7: Notification bell badge and list update automatically.
```

# Notification Visibility Rules

| Notification Type                | Who Can See It?                           |
| -------------------------------- | ----------------------------------------- |
| Tenant-wide notification         | Every user in the same tenant             |
| User-specific notification       | Only the selected user in the same tenant |
| Notification from another tenant | Cannot be seen                            |

Example:

```text
Tenant t1: Nova Talent
Users: u1 and u2

Tenant t2: Bright Star Agency
User: u3
```

Tenant-wide notification:

```text
tenantId: t1
userId: null
message: Sarah joined Nova Talent

Visible to:
✓ u1 from t1
✓ u2 from t1
✗ u3 from t2
```

Personal notification:

```text
tenantId: t1
userId: u1
message: Priya replied to your outreach

Visible to:
✓ u1 from t1
✗ u2 from t1
✗ u3 from t2
```

# API Endpoints

All notification APIs use:

```text
X-Tenant-Id: t1
X-User-Id: u1
```

| Method | Endpoint                      | Purpose                                |
| ------ | ----------------------------- | -------------------------------------- |
| POST   | `/notifications`              | Create notification                    |
| GET    | `/notifications`              | Get visible notifications              |
| GET    | `/notifications/unread-count` | Get unread count                       |
| GET    | `/notifications/stream`       | Get real-time updates                  |
| PATCH  | `/notifications/:id/read`     | Mark one notification as read          |
| PATCH  | `/notifications/read-all`     | Mark all visible notifications as read |
| POST   | `/webhooks/member-invited`    | Create tenant-wide notification        |
| POST   | `/webhooks/creator-replied`   | Create personal notification           |
| POST   | `/webhooks/report-ready`      | Create report-ready notification       |

# Team Git Workflow

## Step 1: Get Latest Code

Before starting work:

```bash
git checkout main
git pull origin main
```

## Step 2: Create Your Own Branch

```bash
git checkout -b your-feature-name
```

Example:

```bash
git checkout -b docs-readme
```

## Step 3: Make Changes

Edit your assigned files and test your work.

## Step 4: Check Changes

```bash
git status
```

## Step 5: Add and Commit Changes

```bash
git add .
git commit -m "Update README documentation"
```

## Step 6: Push Your Branch

```bash
git push -u origin docs-readme
```

## Step 7: Create Pull Request

Open GitHub and create a Pull Request:

```text
docs-readme → main
```

## Important Rule

Do not commit directly to `main`.

```text
main = final stable project
your branch = your work area
```

Only merge tested Pull Requests into `main`.

# Future Improvements

* Email notifications
* Browser push notifications
* Notification preferences
* PostgreSQL production database
* Docker deployment
* Better SSE reconnect support
* Playwright frontend tests
* Cursor-based pagination
