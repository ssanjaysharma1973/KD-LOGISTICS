# 🚀 Railway + Vercel Deployment (5 Minutes)

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
- Go to https://railway.app
- Sign up with GitHub (recommended) or email
- Click "New Project"

### 1.2 Deploy from GitHub
```
1. Click "Deploy from GitHub"
2. Select your repository (atul-logistics)
3. Railway auto-detects it's a Python project
4. Click "Deploy"
```

**OR** Deploy from local folder:
```
1. Click "Get Started"
2. Click "Deploy from Git"
3. Choose "Deploy from a Git Repo"
4. Click "...or deploy from a folder"
5. Upload the entire atul-logistics folder as ZIP
```

### 1.3 Configure Environment Variables
Once deployed:
1. Go to Railway dashboard
2. Select your service
3. Click "Variables"
4. Add these environment variables:

```
CLIENT1_PROVIDER=https://api.wheelseye.com/currentLoc?accessToken=1851c6a3-ef52-4ec3-b470-759908fa0408
CLIENT1_SYNC_INTERVAL=10
AUTO_SYNC_ENABLED=true
DEFAULT_SYNC_INTERVAL=10
SYSTEM_NAME=Fleet Tracker System
DATABASE_PATH=fleet_erp_backend_sqlite.db
```

### 1.4 Get Your Backend URL
1. In Railway dashboard, go to "Settings"
2. Find "Service Domain" or "Environment URL"
3. Copy the backend URL (e.g., `https://atul-logistics-backend.railway.app`)
4. **Save this URL - you'll need it in 30 seconds**

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Update Frontend Config
Before deploying, update `.env` with your Railway backend URL:

```
REACT_APP_API_URL=https://YOUR-RAILWAY-URL/api
REACT_APP_SOCKET_URL=https://YOUR-RAILWAY-URL
```

Replace `YOUR-RAILWAY-URL` with your actual Railway URL from Step 1.4

### 2.2 Deploy to Vercel
```powershell
# If not already installed
npm install -g vercel

# Deploy
vercel --prod

# Follow the prompts:
# - Project name: atul-logistics
# - Framework: Create React App
# - Build: npm run build
# - Public: build
```

### 2.3 Get Your Frontend URL
Once deployed, Vercel shows:
```
✓ Production: https://atul-logistics-xxx.vercel.app
```

**Save this URL**

---

## Step 3: Test It Works

### On Desktop:
Open: `https://atul-logistics-xxx.vercel.app` (your Vercel URL)

### On Mobile:
Open same URL in browser → Add to home screen as app

### Verify Backend:
Check that vehicles load and data syncs (should see GPS positions updating)

---

## Final URLs for Your Clients

**Frontend (React Dashboard):**
```
https://atul-logistics-xxx.vercel.app
```

**Backend API:**
```
https://your-railway-url/api
```

---

## If You Have GitHub (Easier Setup)

```powershell
# 1. Initialize git repo (if not already)
git init
git add .
git commit -m "Initial commit"

# 2. Create GitHub repo at github.com/new

# 3. Push code
git remote add origin https://github.com/yourusername/atul-logistics.git
git branch -M main
git push -u origin main

# 4. Connect to Railway
# Go to https://railway.app
# Click "New Project" -> "Deploy from Git" -> Select repository
# Railway auto-detects Python and deploys automatically
```

---

## Troubleshooting

**"Cannot connect to backend"**
- ✅ Verify Railway URL in .env is correct
- ✅ Check Railway service is running (green status)
- ✅ Redeploy Vercel: `vercel --prod`

**"Database not found"**
- ✅ Copy `fleet_erp_backend_sqlite.db` to Railway (or it creates a new one)
- ✅ Or use PostgreSQL instead (add Postgres plugin in Railway)

**"Vercel deployment failed"**
- ✅ Run `npm run build` locally first to check for errors
- ✅ Check build logs in Vercel dashboard

---

## Success Checklist

- ✅ Railway backend deployed (green status)
- ✅ Backend URL saved
- ✅ Frontend .env updated with backend URL
- ✅ Vercel frontend deployed
- ✅ Frontend URL works at https://...
- ✅ Mobile can access frontend URL
- ✅ Data shows on dashboard (vehicles loaded)
- ✅ Added to home screen on mobile

---

## Next: Share With Clients

Once both are deployed, give your clients:

```
📱 Mobile App URL:
https://atul-logistics-xxx.vercel.app

📖 Instructions:
1. Open link in any browser
2. Tap menu → "Add to Home Screen"
3. App appears like native app
4. Works anywhere with internet
```

---

## Costs

- **Railway**: $5/month (first month free)
- **Vercel**: Free
- **Total**: ~$5/month

That's it! Both frontend and backend globally accessible.

