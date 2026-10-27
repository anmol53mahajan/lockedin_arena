# LockedIn Arena ⚔️

LockedIn Arena is a real-time, head-to-head competitive programming lockout platform. It turns Codeforces practice into a synchronized duel over mutually unsolved problems, with first-to-solve scoring and an in-house Elo ladder.

## Problem statement

Practicing data structures and algorithms alone can lack urgency and real-time feedback. Standard Codeforces contests are infrequent and long, while many practice platforms do not offer head-to-head point-locking dynamics or proof-of-control handle verification.

## Target users

- Competitive programmers looking for focused, repeatable practice
- Coding club members organizing short competitive sessions
- University students preparing for technical interviews and programming rounds

## Solution

LockedIn Arena pairs two verified players in a synchronized 1v1 lockout arena. The host chooses the match length, problem rating bands, and custom point values. The matchmaker finds problems neither player has solved. During the duel, the first accepted solution permanently claims the problem's points, while a server-authoritative clock and early-clinch rule keep the match moving. Results update both players' Elo ratings and are saved in a shareable match recap.

## Key workflows

1. **Proof-of-control Codeforces verification** — The player submits a challenge containing a temporary token that is confirmed through a Codeforces compilation-error submission.
2. **Custom duel configuration** — The host selects duration, number of problems, rating bands, and per-problem points.
3. **Algorithmic matchmaker** — Codeforces problem data is compared with both players' solved-problem histories; previously solved, interactive, and unsupported contest problems are excluded.
4. **Real-time lockout engine** — Socket.IO synchronizes the match clock and presence. A server poller checks submissions approximately every 13 seconds, locks the first accepted solve, updates scores, and detects early-clinch wins.
5. **Elo settlement and recap** — Finished matches update player ratings and career statistics. A permanent audit view is available at `/match/:roomCode`.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Socket.IO Client, Lucide React, Canvas Confetti |
| Backend | Node.js, Express, Socket.IO, Mongoose, Axios, JSON Web Tokens |
| Database | MongoDB Atlas |
| External data | Codeforces API |

## System architecture

```text
+-------------------+        HTTP / REST         +------------------------+
|                   | -------------------------> |                        |
|   React + Vite    |                            |  Express API           |
|   Browser Client  | <========================> |  Socket.IO Arena       |
|                   |   Socket.IO events        |                        |
+-------------------+                            +-----------+------------+
        ^                                                     |
        |                                                     | Mongoose
        | React Router SPA                                    v
        |                                           +----------------------+
        |                                           |    MongoDB Atlas     |
        |                                           | users, matches, Elo  |
        |                                           +----------------------+
        |                                                     ^
        |                                                     |
        |                                           +---------+------------+
        +-------------------------------------------|  Codeforces API      |
               Problems and submission status       | problemset, status   |
                                                    +----------------------+
```

The Express API handles authentication, user verification, lobby configuration, match lookup, and combat history. Socket.IO handles authorized arena membership and live events. The backend poller and Elo settlement service run server-side; the browser is never authoritative for scores, accepted submissions, or match outcomes.

## Local setup

### Requirements

- Node.js (use a current LTS release) and npm
- A MongoDB Atlas connection string or local MongoDB instance
- Network access to `https://codeforces.com/api`

### 1. Clone the repository

```bash
git clone https://github.com/anmol53mahajan/lockedin_arena.git
cd lockedin_arena
```

### 2. Configure and run the backend

Copy `server/.env.example` to `server/.env` and set the private MongoDB URI and a long, random JWT secret:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
JWT_SECRET=<long-random-secret>
CLIENT_URL=http://localhost:5173
```

Install dependencies and start the API:

```bash
cd server
npm install
npm run dev
```

The API health endpoint is `http://localhost:5000/api/health`.

### 3. Configure and run the frontend

Copy `client/.env.example` to `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

In another terminal:

```bash
cd client
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173` by default. Both environment files are ignored by Git; do not commit real credentials. Variables prefixed with `VITE_` are bundled into public browser code and must contain only public service URLs, never secrets.

## Production deployment

### Backend (for example, Render)

Deploy `server/` as a Node.js web service. Use `npm install` as the build/install command and `npm start` as the start command. Configure these environment variables in the hosting dashboard:

- `PORT` — supplied by the platform (the application falls back to `5000` locally)
- `MONGO_URI` — private MongoDB Atlas connection string
- `JWT_SECRET` — strong, unique production secret
- `CLIENT_URL` — deployed frontend origin, such as `https://your-app.vercel.app`

The server allows the local development origin and the configured `CLIENT_URL` for both Express CORS and Socket.IO. `CLIENT_URL` can contain a comma-separated list of trusted frontend origins if needed.

### Frontend (for example, Vercel)

Deploy `client/` as a Vite application. Set:

- `VITE_API_URL=https://your-backend.example.com/api`
- `VITE_SOCKET_URL=https://your-backend.example.com`

`client/vercel.json` rewrites application routes to the Vite entry point so reloading routes such as `/lobby/:roomCode`, `/arena/:roomCode`, and `/match/:roomCode` serves the SPA. Add the deployed frontend origin to the backend's `CLIENT_URL`.

### Deployment links

- **Deployed app:** _Add deployment URL_
- **Backend API:** _Add backend URL_
- **Demo video:** _Add demo video URL_

## Production build check

From the repository root, run:

```bash
npm --prefix client run build
```

The server starts with `npm --prefix server start`. Keep `.env` files, database credentials, and signing secrets out of source control and deployment logs.
