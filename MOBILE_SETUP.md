# 📱 Mobile Deployment Guide

## Quick Start (5 Minutes)

### 1. Start the Mobile Server
Double-click or run:
```powershell
.\start-mobile.bat
```

This script will:
- Get your machine's IP address
- Update .env with the correct API URL
- Build the React app
- Start a mobile-friendly server

### 2. Access on Mobile Device
Once the server starts, you'll see:
```
========================================
Your Machine IP: 192.168.x.x
========================================

On your mobile device, open:
http://192.168.x.x:3005
```

Open this URL on any device connected to your WiFi.

---

## Install as App (iOS & Android)

Once you access the app on mobile, you can install it:

### **iOS (iPhone/iPad)**
1. Open in Safari
2. Tap the Share button (bottom)
3. Select "Add to Home Screen"
4. Name it "Fleet Tracker"
5. Tap "Add"

### **Android (Chrome)**
1. Open in Chrome
2. Tap the menu (⋮)
3. Select "Install app"
4. Confirm
5. App now appears on home screen

---

## Network Requirements

- Your PC and mobile device **must be on the same WiFi**
- Backend API must be running on port 5001
- Frontend serves on port 3005

### Test Backend is Running
```powershell
python sync_worker.py
# Should show: "Server listening on port 5001"
```

---

## Manual Setup (Advanced)

If `start-mobile.bat` doesn't work:

### 1. Build the app
```powershell
npm run build
```

### 2. Find your IP
```powershell
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.100)
```

### 3. Update .env
```
REACT_APP_API_URL=http://192.168.1.100:5001/api
REACT_APP_SOCKET_URL=http://192.168.1.100:5001
```

### 4. Start server
```powershell
serve -s build -l 3005
```

### 5. On mobile, open:
```
http://192.168.1.100:3005
```

---

## Troubleshooting

### "Cannot access http://192.168.x.x:3005 from mobile"
- ✅ Check both devices are on same WiFi
- ✅ Check Windows Firewall allows port 3005
- ✅ Try `ipconfig` - use the actual IP address

### "Map doesn't load or is blank"
- ✅ Check backend is running: `python sync_worker.py`
- ✅ Check REACT_APP_API_URL is correct in .env
- ✅ Rebuild: `npm run build`

### "App is slow on mobile"
- ✅ This is normal with 40K+ GPS points
- ✅ Use track history query limit (default: 1000 points)
- ✅ Consider filtering by date range on mobile

---

## Full Cloud Deployment (Production)

For permanent remote access without WiFi:

### Deploy Frontend to Vercel
```powershell
npm install -g vercel
npm run build
vercel --name atul-logistics
```

### Deploy Backend to Cloud
Use: Render, Railway, or AWS Lightsail
Update REACT_APP_API_URL to cloud endpoint

---

## What's Different on Mobile?

✅ Map interface is full-screen optimized
✅ Touch-friendly buttons and controls
✅ Responsive layout adapts to screen size
✅ Works offline with cached map tiles
✅ Can be added to home screen as app

---

## Next Steps

1. **Test Now**: Run `start-mobile.bat`
2. **Install**: Add to home screen on mobile
3. **Test Features**: Load track history, play animation
4. **Deploy to Cloud** (when ready): Follow Vercel instructions above

