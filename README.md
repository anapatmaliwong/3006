# 3006 — AC Library Classroom Portal

## Architecture

```
3006/
├── backend/                 ← Node.js Express server
│   ├── server.js            ← Main server (entry point)
│   ├── package.json
│   ├── .env.example         ← Copy to .env and fill in secrets
│   ├── config/
│   │   ├── firebase.js      ← Firebase Admin SDK (server-side only)
│   │   └── students.js      ← Student credentials (NEVER sent to browser)
│   ├── middleware/
│   │   └── auth.js          ← JWT verification middleware
│   └── routes/
│       ├── auth.js          ← POST /api/auth/login, GET /api/auth/me
│       ├── api.js           ← All Firebase data (server proxy)
│       └── ai.js            ← Gemini AI proxy (API key server-side only)
│
└── public/                  ← Frontend (static files served by Express)
    ├── index.html           ← Welcome screen + Login
    ├── lobby.html           ← Main lobby
    ├── library.html         ← Zone library (episodes, quests, XP)
    ├── community.html       ← Community posts + replies
    ├── settings.html        ← User settings
    ├── admin.html           ← Admin panel (server-protected: admin JWT required)
    ├── css/
    │   └── styles.css       ← All styles
    ├── js/
    │   ├── api.js           ← Frontend API client (fetch → /api/...)
    │   ├── shared.js        ← Shared state, utils, navigation
    │   ├── navbar.js        ← Shared navbar
    │   ├── lobby.js         ← Lobby page logic
    │   ├── library.js       ← Library/zone/quiz logic
    │   ├── community.js     ← Community page logic
    │   ├── settings.js      ← Settings page logic
    │   └── admin.js         ← Admin panel logic
    └── assets/
        └── welcome.mp4      ← Welcome screen video
```

## Security Improvements

| Secret | Old (single HTML) | New (backend) |
|---|---|---|
| Firebase API key | ❌ Visible in browser | ✅ Server-side only |
| Student IDs (passwords) | ❌ Visible in browser | ✅ Server-side only |
| Admin credentials | ❌ Visible in browser | ✅ .env file only |
| Gemini API key | ❌ Visible in browser | ✅ Server-side only |
| `/admin.html` | ❌ Anyone can open | ✅ Server checks JWT before serving |

## Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
- Generate `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- Set `FIREBASE_*` variables (from Firebase Console → Service Accounts → Generate key)

### 3. Firebase Service Account

Option A (recommended): Download JSON from Firebase Console:
> Firebase Console → Project Settings → Service Accounts → Generate new private key

Save as `backend/config/service-account.json`

Option B: Set individual env vars in `.env`

### 4. Run

Development:
```bash
cd backend
npm run dev
```

Production:
```bash
cd backend
npm start
```

Open: http://localhost:3000

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `JWT_SECRET` | Random 64-byte hex string for signing tokens |
| `ADMIN_STUDENT_NO` | Admin's student number (27) |
| `ADMIN_PASSWORD` | Admin's login password |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_DATABASE_URL` | Firebase Realtime DB URL |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `GEMINI_API_KEY` | Google Gemini API key |

## API Endpoints

### Auth
- `POST /api/auth/login` — Login, returns JWT
- `GET  /api/auth/me` — Get current user (requires JWT)
- `GET  /api/auth/students` — All students without passwords (requires JWT)

### Data (all require JWT)
- `GET/POST /api/data/subjects/:subject` — Zone content
- `GET/POST/DELETE /api/data/briefs` — Announcements
- `GET/POST/DELETE /api/data/community` — Posts + replies
- `GET/POST /api/data/xp` — XP leaderboard
- `GET/POST/DELETE /api/data/lobby-cards` — Custom lobby cards
- `GET/POST /api/data/banners` — Banner slideshow

### AI (requires JWT + admin for quiz parsing)
- `POST /api/ai/parse-quiz` — Parse quiz text with Gemini
- `POST /api/ai/check-post` — Check if community post is educational

## Production Deployment

1. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name 3006
   ```

2. Put Nginx in front for SSL:
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       location / {
           proxy_pass http://localhost:3000;
       }
   }
   ```

3. Set `NODE_ENV=production` and `ALLOWED_ORIGIN=https://yourdomain.com` in `.env`
