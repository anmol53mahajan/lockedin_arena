# Lockout Arena ⚔️

A real-time, 1v1 Competitive Programming Lockout Duel platform.

## Features
- **Proof-of-Control Handle Verification:** Verifies Codeforces accounts by inspecting compilation errors on test problems.
- **In-House Elo Progression:** Live rating updates based on head-to-head match results.
- **Custom Duel Settings:** Host-configured duration, problem rating brackets, and custom point values.
- **Real-Time Lockout Engine:** Server-authoritative countdown and live submission polling over WebSockets.
- **Persistent Match Recaps:** Complete match timeline and historical audit trail saved in MongoDB.

## Architecture
- **Frontend:** React (Vite), Tailwind CSS, Socket.io-client, Lucide React
- **Backend:** Node.js, Express, Socket.io, MongoDB / Mongoose, Axios

## Setup & Local Run
1. **Server:**
   ```bash
   cd server
   npm install
   npm run dev