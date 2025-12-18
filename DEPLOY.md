# 🚀 ChatNow Room - Deployment Guide

## Backend on Render

### Step 1: Push Backend to GitHub
```bash
cd backend
git init
git add .
git commit -m "Initial backend commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo (backend folder)
4. Configure:
   - **Name**: `chatnow-room-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 3: Add Environment Variables
In Render dashboard → Environment:
```
PORT = 10000
ADMIN_PASSWORD = Azad@4153
SUPABASE_URL = your_supabase_url
SUPABASE_ANON_KEY = your_anon_key
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
FRONTEND_URL = https://your-netlify-app.netlify.app
```

### Step 4: Copy Your Render URL
After deployment, copy your backend URL:
`https://chatnow-room-backend.onrender.com`

---

## Frontend on Netlify

### Step 1: Update config.js
Edit `frontend/config.js`:
```javascript
const CONFIG = {
    BACKEND_URL: 'https://chatnow-room-backend.onrender.com', // Your Render URL
    LOCAL_URL: 'http://localhost:3001'
};
```

### Step 2: Push Frontend to GitHub
```bash
cd frontend
git init
git add .
git commit -m "Initial frontend commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 3: Deploy on Netlify
1. Go to [netlify.com](https://netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect your GitHub repo (frontend folder)
4. Configure:
   - **Branch**: `main`
   - **Publish directory**: `.`
   - **Build command**: (leave empty)
5. Click **"Deploy site"**

### Step 4: Update Backend CORS
After getting Netlify URL (e.g., `https://chatnow-room.netlify.app`):

1. Go to Render dashboard
2. Add/Update environment variable:
   ```
   FRONTEND_URL = https://chatnow-room.netlify.app
   ```
3. Also update `server.js` allowedOrigins array if needed

---

## 🔄 After Deployment

### Update Frontend Config
Edit `frontend/config.js` with your actual Render URL:
```javascript
BACKEND_URL: 'https://YOUR-ACTUAL-RENDER-APP.onrender.com'
```

### Update Backend CORS
Make sure `server.js` includes your Netlify URL in allowedOrigins.

---

## ✅ Test Your Deployment

1. **Frontend**: `https://your-app.netlify.app`
2. **Admin**: `https://your-app.netlify.app/admin.html`
3. **Password**: `Azad@4153`

---

## ⚠️ Important Notes

1. **Render Free Tier**: App sleeps after 15 mins of inactivity. First request takes ~30 seconds.
2. **WebSocket**: Make sure Render uses `wss://` (secure WebSocket)
3. **Supabase**: Create tables before using the app

---

## 🗄️ Supabase Setup

Run this SQL in Supabase SQL Editor:
```sql
-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID,
    reason TEXT,
    reported_by TEXT,
    message_content TEXT,
    message_author TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow all operations
CREATE POLICY "Allow all" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all" ON reports FOR ALL USING (true);
```

---

## 🎉 Done!

Your ChatNow Room is now live!
