# ✅ Frontend Updated for Vercel Deployment

All frontend code has been updated to use your ngrok URL and environment variables!

## 📝 What Was Changed

### 1. Created Centralized Configuration
**File**: `src/lib/api-config.ts`
- Centralized all API endpoints
- Added Host headers for Kourier routing
- Environment variable support

### 2. Updated All Service Files
✅ **auth.service.ts** - All 14 endpoints updated with Host headers
✅ **surveyService.ts** - All survey endpoints updated
✅ **participantService.ts** - All participant endpoints updated  
✅ **surveyTaking.service.ts** - All survey-taking endpoints updated

### 3. Added Host Headers
Every API request now includes the required `Host` header for Kubernetes Kourier routing:
- Auth requests → `Host: auth-service.default.127.0.0.1.nip.io`
- Survey requests → `Host: survey-management-service.default.127.0.0.1.nip.io`
- Participant requests → `Host: participants-management-service.default.127.0.0.1.nip.io`

## 🚀 Deploy to Vercel

### Step 1: Add Environment Variables to Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add these **4 variables**:

```env
NEXT_PUBLIC_API_BASE_URL=https://trypanosomic-tamisha-imbricately.ngrok-free.dev
NEXT_PUBLIC_AUTH_SERVICE_URL=https://trypanosomic-tamisha-imbricately.ngrok-free.dev
NEXT_PUBLIC_SURVEY_SERVICE_URL=https://trypanosomic-tamisha-imbricately.ngrok-free.dev
NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL=https://trypanosomic-tamisha-imbricately.ngrok-free.dev
```

5. Click **Save**

### Step 2: Redeploy

After adding environment variables:

**Option A: Automatic Redeploy (Recommended)**
```bash
# In your frontend directory
git add .
git commit -m "feat: configure API endpoints for ngrok tunnel"
git push origin main
```

Vercel will automatically redeploy!

**Option B: Manual Redeploy**
- Go to Vercel dashboard → Deployments
- Click "Redeploy" on the latest deployment
- Check "Use existing Build Cache" or not (your choice)

### Step 3: Test Your Deployment

Once deployed, visit your Vercel app and try:
1. **Register** a new user
2. **Login** with credentials
3. **Navigate** around the app

You should see API requests going to your ngrok URL in the browser console!

## 🔍 How to Verify It's Working

### Check Browser Console
Open DevTools (F12) and look for:
```
API Request: POST https://trypanosomic-tamisha-imbricately.ngrok-free.dev/api/auth/login
Host Header: auth-service.default.127.0.0.1.nip.io
```

### Check Network Tab
1. Open DevTools → Network
2. Try logging in
3. Click on the login request
4. Check **Request Headers** - you should see:
   - `Host: auth-service.default.127.0.0.1.nip.io`
   - `Content-Type: application/json`

### Check ngrok Dashboard
1. Open http://localhost:4040 (on your MacBook)
2. You'll see requests coming from Vercel!

## 🎯 What's Happening Under the Hood

```
Vercel Frontend (vercel.app)
        │
        │ HTTPS Request
        │ URL: https://trypanosomic-tamisha...ngrok-free.dev/api/auth/login
        │ Header: Host: auth-service.default.127.0.0.1.nip.io
        ▼
ngrok Tunnel (on your MacBook)
        │
        │ Forwards to localhost:8080
        ▼
Port Forward (kubectl port-forward)
        │
        │ Forwards to Kourier
        ▼
Kourier Gateway (Kubernetes)
        │
        │ Reads Host header
        │ Routes to: auth-service
        ▼
AuthService Pod (Knative)
        │
        │ Processes request
        │ Connects to PostgreSQL
        ▼
Response flows back through the chain
        ▼
Vercel Frontend receives response!
```

## 📊 Environment Variables Explained

| Variable | Purpose | Value |
|----------|---------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | Main API URL | ngrok tunnel URL |
| `NEXT_PUBLIC_AUTH_SERVICE_URL` | Auth service URL | Same ngrok URL |
| `NEXT_PUBLIC_SURVEY_SERVICE_URL` | Survey service URL | Same ngrok URL |
| `NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL` | Participants service URL | Same ngrok URL |

**Why all the same?** 
- All services are behind the same ngrok tunnel
- Routing is handled by Kourier using the `Host` header
- This is the magic of Kubernetes service mesh!

## 🔧 Troubleshooting

### Issue: "CORS Error"
**Solution**: Make sure ngrok tunnel is running on your Mac:
```bash
cd /Users/apple/Downloads/Survey-Platform-main-5
./setup-vercel-tunnel.sh
```

### Issue: "Network Error" or "Failed to Fetch"
**Check**:
1. ngrok tunnel is running: `ps aux | grep ngrok`
2. Port forwarding is active: `ps aux | grep port-forward`  
3. Services are ready: `kubectl get ksvc`

**Restart Everything**:
```bash
# Kill processes
pkill ngrok
pkill -f port-forward

# Restart
kubectl port-forward -n kourier-system service/kourier 8080:80 &
./setup-vercel-tunnel.sh
```

### Issue: "ngrok URL changed"
ngrok free tier generates a new URL every restart.

**Solution**:
1. Get new URL from terminal or http://localhost:4040
2. Update Vercel environment variables with new URL
3. Redeploy on Vercel

**Better Solution**: Upgrade to ngrok Pro ($8/month) for a permanent URL!

### Issue: "404 Not Found"
This means the Host header isn't being sent properly.

**Check**: Open DevTools → Network → Click failed request → Check "Request Headers"
- Should have: `Host: auth-service.default.127.0.0.1.nip.io`
- If missing: Clear browser cache and try again

## ✅ Test Checklist

Before considering deployment successful, test:

- [ ] Can access Vercel app
- [ ] Can see login page
- [ ] Can register new user
- [ ] Can login with user
- [ ] Can logout
- [ ] Can navigate to dashboard
- [ ] Can see surveys (if applicable)
- [ ] Browser console shows API requests to ngrok URL
- [ ] No CORS errors in console
- [ ] ngrok dashboard shows requests from Vercel

## 🎉 Success!

If all tests pass, your Vercel frontend is successfully connected to your local Kubernetes cluster!

**Next Steps**:
1. Keep ngrok tunnel running while developing
2. Monitor ngrok dashboard: http://localhost:4040
3. When ready for production, deploy backend to cloud (AWS/GCP/Azure)
4. Replace ngrok URL with permanent backend URL

## 📚 Files Modified

```
frontend/
├── src/
│   ├── lib/
│   │   └── api-config.ts .................... NEW - Centralized config
│   └── services/
│       ├── auth.service.ts .................. UPDATED - 14 endpoints
│       ├── surveyService.ts ................. UPDATED - 3 endpoints
│       ├── participantService.ts ............ UPDATED - 5 endpoints
│       └── surveyTaking.service.ts .......... UPDATED - 3 endpoints
```

## 💡 Tips

1. **Keep terminal open** - Don't close the terminal running ngrok!
2. **Monitor logs** - Watch `tail -f ngrok.log` for requests
3. **Check ngrok dashboard** - http://localhost:4040 shows real-time traffic
4. **Browser DevTools** - F12 to see network requests and console logs

## 🆘 Need Help?

If something isn't working:
1. Check this guide first
2. Look at browser console (F12)
3. Check ngrok dashboard (localhost:4040)
4. Verify environment variables in Vercel
5. Ensure ngrok tunnel is running

---

**You're all set! Deploy to Vercel and test it out!** 🚀

