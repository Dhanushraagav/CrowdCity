# CrowdCity AI v2.1 - Production Deployment Guide

## Deployment Platforms

### 1. Vercel (Frontend Client)
* **Build Command**: Static files served directly from `client/`.
* **Output Directory**: `client`
* **Configuration**: Configured in `vercel.json`. Auto-deploys on every commit to `main`.

### 2. Render (Node.js API Web Service)
* **Build Command**: `npm install`
* **Start Command**: `node server/server.js`
* **Environment Variables**:
  - `SUPABASE_URL`
  - `SUPABASE_KEY` / `SUPABASE_ANON_KEY`
  - `GROQ_API_KEY`
  - `PORT=5000`

---

## Supabase Database Setup Instructions
Run all SQL scripts in the Supabase SQL Editor in sequence:
1. `v2_government_schemes_schema.sql` & `v2_government_schemes_seed.sql`
2. `v2_user_documents_schema.sql`
3. `v2_user_applications_schema.sql`
4. `v2_user_reminders_schema.sql`
5. `v2_admin_services_schema.sql`

Always click **"Run without RLS"** when executing in Supabase SQL Editor.
