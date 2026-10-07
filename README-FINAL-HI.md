# Telegram Quiz Publisher — Final Vercel Fix

## Deploy
1. GitHub/Vercel me repository ka **root** select karein. `api` folder ko Root Directory na banayein.
2. Framework Preset: **Other**. Build Command aur Output Directory blank rakhein.
3. Vercel → Settings → Environment Variables me `SESSION_COOKIE_SECRET` add karein. Random long secret use karein. Isse Production + Preview me enable karein.
4. Save ke baad **Redeploy** karein; Vercel environment-variable changes next deployment par apply hote hain.
5. Browser me `/api/health` kholkar JSON response check karein.

## Important
- Telegram API ID/API Hash ko frontend code me hard-code nahi kiya gaya.
- API Hash ko GitHub me commit na karein. Agar purana hash public ho chuka hai, regenerate karna safer hai.
- `server.js` intentionally removed: Vercel version serverless `api/index.js` use karta hai.
- Node 24 target kiya gaya hai because Vercel has deprecated Node 20 for new deployments from Oct 1, 2026.
