# Vercel setup

1. Upload this project to GitHub.
2. Import the repository into Vercel.
3. Do NOT put API ID/API Hash in HTML/JS.
4. Vercel Environment Variables: `SESSION_COOKIE_SECRET` = long random secret.
5. Deploy. `/` serves index.html and `/api/*` uses api/index.js.

This version does not use `data/session.txt` for Vercel. The login/session state is encrypted in an HttpOnly cookie so serverless requests can reconstruct the Telegram client.

For local persistent hosting, `server.js` remains available.
