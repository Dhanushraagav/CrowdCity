# CrowdCity - AI-Powered Civic Issue Reporting Platform

CrowdCity is a production-ready full-stack web application that allows citizens to report public issues such as potholes, garbage accumulation, water leaks, broken streetlights, road damage, and drainage problems. It features a modern interactive dashboard with map locations and status updates to bridge the gap between citizens and local municipalities.

---

## 🚀 Key Features

* **Interactive Mapping**: Fully responsive Leaflet.js map with OpenStreetMap tiles displaying reported issues and enabling click-to-pin location selection.
* **Modern Design**: Premium dark-accented style, glassmorphism filters, loading skeletons, responsive grid layouts, and custom state status badges.
* **MVC Backend Architecture**: Organized Express.js backend using controllers, routers, and middlewares.
* **Supabase Integration**:
  * **Database**: PostgreSQL tables for issues, comments, upvotes, and profiles.
  * **Authentication**: Session synchronization with Supabase Auth (JWT Bearer verification).
  * **Automation Triggers**: Auto-generates public user profiles on registration and handles upvote increments/decrements in SQL.
* **AI Analysis Placeholder**: Ready-to-go Groq API assistant routes suggesting issue categories and severity ratings based on keyword patterns.
* **Mock Fail-safe Mode**: Automatically switches to frontend-only memory database emulation if Supabase keys are not set up, making it instantly reviewable.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3 (Vanilla Custom Properties & Grid), JavaScript (Vanilla ES6 modules)
* **Map Engine**: Leaflet.js + OpenStreetMap API
* **Backend**: Node.js + Express.js
* **Database & Auth**: Supabase (PostgreSQL & GoTrue Auth)
* **AI Engine**: Groq API (Integration points defined)

---

## 📂 Project Structure

```
CrowdCity/
├── client/                     # Frontend Static Files
│   ├── css/
│   │   ├── style.css           # Core theme variables, layouts, and typography
│   │   └── components.css      # Reusable UI component designs (cards, forms, maps)
│   ├── js/
│   │   ├── api.js              # Server REST API request wrapper
│   │   ├── auth.js             # Authentication controllers (Supabase & Mock switch)
│   │   ├── app.js              # Dashboard feed and main map manager
│   │   ├── report.js           # New report form and coordinate picker logic
│   │   └── details.js          # Detailed overview, upvote toggle, and comments thread
│   ├── index.html              # Main dashboard page
│   ├── auth.html               # Sign In / Sign Up portal
│   ├── report.html             # New issue filing form
│   └── issue-details.html      # Detail view card
├── server/                     # Backend MVC Server
│   ├── config/
│   │   └── supabase.js         # Supabase client setup
│   ├── controllers/
│   │   ├── authController.js   # Synchronize user profile sessions
│   │   ├── issueController.js  # CRUD actions for reported issues
│   │   └── aiController.js     # AI analysis helpers
│   ├── middlewares/
│   │   └── authMiddleware.js   # JWT authentication validation middleware
│   ├── routes/
│   │   ├── authRoutes.js       # Mapping auth endpoints
│   │   ├── issueRoutes.js      # Mapping issues CRUD
│   │   └── aiRoutes.js         # Mapping Groq analysis endpoints
│   ├── app.js                  # App configuration and static file binds
│   └── server.js               # App server entry point
├── supabase/
│   └── schema.sql              # Database creation scripts and RLS settings
├── .env.example                # Template configuration settings
├── .gitignore                  # Git excluded folders
├── package.json                # Project dependencies
└── README.md                   # Setup guide
```

---

## ⚙️ Installation & Setup

Follow these steps to set up and run CrowdCity locally:

### 1. Clone & Install Dependencies
Navigate into your project directory and install the necessary Node.js packages:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to a new file named `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase connection parameters:
* `SUPABASE_URL`: Your project URL (e.g. `https://xxx.supabase.co`).
* `SUPABASE_ANON_KEY`: Your client-side public key.
* `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (required to bypass RLS for admin sync operations).

*(If you skip this step, CrowdCity will automatically launch in **Demo Emulation Mode** using local memory mocks!)*

### 3. Initialize the Database
1. Open your project on the [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** tab from the left sidebar.
3. Click **New Query**, paste the contents of `supabase/schema.sql`, and click **Run**.
4. This script sets up:
   * Tables: `profiles`, `issues`, `votes`, `comments`.
   * Triggers: Automatically duplicates users registering in Supabase Auth into the public `profiles` table.
   * Row Level Security (RLS) policies allowing public viewing but restricting report creation to signed-in users.

---

## 💻 Running the Application

### Development Mode (with hot-reloading)
Runs the server utilizing `nodemon`:
```bash
npm run dev
```

### Production Mode
Runs the server utilizing standard Node.js:
```bash
npm start
```

Once running, browse to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 📡 Backend REST API Specification

All API endpoints are prefixed with `/api`.

| Route | Method | Authentication | Description |
| :--- | :--- | :---: | :--- |
| `/auth/sync` | `POST` | Required | Sync user details into `profiles` table |
| `/auth/profile` | `GET` | Required | Retrieve current user profile |
| `/issues` | `GET` | Public | Fetch list of all reported issues (supports `?category=` and `?status=`) |
| `/issues/:id` | `GET` | Public | Get full details of an issue including comments |
| `/issues` | `POST` | Required | File a new civic issue report |
| `/issues/:id/upvote` | `POST` | Required | Toggle upvote count for an issue |
| `/issues/:id/comments` | `POST` | Required | Post a comment on an issue |
| `/ai/analyze` | `POST` | Required | Simulate smart AI category and severity prediction |
| `/config` | `GET` | Public | Share public credentials with frontend client |
| `/health` | `GET` | Public | Verify server health status |
