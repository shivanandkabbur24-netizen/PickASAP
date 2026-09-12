# Deployment Guide: Firebase & Cloudflare

This application is ready to deploy on both **Firebase Hosting** and **Cloudflare Pages / Workers**.

---

## 1. Deploying to Cloudflare Pages

### Option A: Via Cloudflare Dashboard (Recommended for Git / GitHub)
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select your repository.
3. Configure the build settings:
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
4. **Environment Variables**:
   Under **Settings > Environment variables**, add:
   - `NODE_VERSION`: `20`
   *(Note: We have also committed `.nvmrc` and `.node-version` so Cloudflare automatically selects Node 20).*
5. Click **Save and Deploy**.

### Option B: Via Cloudflare CLI (`wrangler`)
From your local terminal in the project root:
```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Build and deploy
npm run deploy:cloudflare
```
Cloudflare will prompt you to create or link the project `pickasap` and deploy the `dist/` directory directly.

### Crucial Cloudflare Configuration Files Included:
- `wrangler.jsonc`: Pre-configured with `"pages_build_output_dir": "dist"` and `"assets": { "directory": "./dist", "not_found_handling": "single-page-application" }`. This handles SPA client-side routing natively without triggering infinite redirect loop errors during `wrangler deploy`.
- `public/_headers`: Enforces browser caching on hashed bundles in `/assets/` and prevents stale caching on `index.html`.
- `.nvmrc` & `.node-version`: Pin Node 20 (20.19.0) to satisfy `@vitejs/plugin-react` and `undici` engine requirements.

---

## 2. Deploying to Firebase Hosting

Your Firebase project is pre-configured to `pickasap-c43b0`.

### Deploying via Firebase CLI:
1. Ensure the Firebase CLI is installed and logged in:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Deploy hosting and firestore security rules:
   ```bash
   npm run deploy:firebase
   ```
   Or run:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### Firebase Configuration Files Included:
- `firebase.json`: Points hosting to `dist`, configures SPA rewrite (`** -> /index.html`), and deploys `firestore.rules`.
- `.firebaserc`: Links directly to project `pickasap-c43b0`.
- `firestore.rules`: Production security rules.

---

## 3. Important: Enabling Google Sign-In on Your Deployed Domain

If you use Google Authentication in production:
1. Open the [Firebase Console](https://console.firebase.google.com/project/pickasap-c43b0/authentication/settings).
2. Click **Authentication** > **Settings** > **Authorized domains**.
3. Click **Add domain** and enter:
   - Your Cloudflare domain (e.g., `<your-project>.pages.dev`).
   - Any custom domain (e.g., `pickasap.com`).
*(Firebase Hosting domains like `pickasap-c43b0.web.app` and `pickasap-c43b0.firebaseapp.com` are authorized automatically).*
