# LockedIn Arena ⚔️

LockedIn Arena is a real-time, head-to-head competitive programming lockout platform. It turns Codeforces practice into a synchronized duel over mutually unsolved problems, with first-to-solve scoring and an in-house Elo ladder.

## Demo

Watch the complete project demo and walkthrough: [LockedIn Arena demo video](https://drive.google.com/file/d/1hlGqIpc4o2eVtWScUvnsPKPi7VQp7TYB/view?usp=sharing).

## Problem statement

Practicing data structures and algorithms alone can lack urgency and real-time feedback. Standard Codeforces contests are infrequent and long, while many practice platforms do not offer head-to-head point-locking dynamics or proof-of-control handle verification.

## Target users

- Competitive programmers looking for focused, repeatable practice
- Coding club members organizing short competitive sessions
- University students preparing for technical interviews and programming rounds

## Solution

LockedIn Arena pairs two verified players in a synchronized 1v1 lockout arena. The host chooses the match length, problem rating bands, and custom point values. The matchmaker finds problems neither player has solved. During the duel, the first accepted solution permanently claims the problem's points, while a server-authoritative clock and early-clinch rule keep the match moving. Results update both players' Elo ratings and are saved in a shareable match recap.

## Key features and complete flow

1. **Create an account and verify a Codeforces handle.** Register with a username and password, then start handle verification from the dashboard. The server generates a one-time `LOCK_...` challenge token that expires after five minutes. The app instructs you to submit code for Codeforces Problem 4A that causes a compilation error and includes the token in its compiler error output. Then ask the app to check your recent submissions. The Codeforces API does not expose compiler output to this app, so the server validates a recent `COMPILATION_ERROR` verdict on 4A within the challenge window; it does not compare the token text itself. Successful verification locks the handle to the account. Both players need verified handles to play.
2. **Create or join a duel.** A verified host chooses a duration (15, 30, 45, or 60 minutes), a problem count (3, 4, or 5), and a rating range and point value for each problem slot. Creating the duel reserves a six-character room code beginning with `LK`. Share the code with the opponent, who enters it on their dashboard to join the lobby.
3. **Ready up and start.** Each player marks themselves ready in the lobby. The host can start once both players have joined and are ready. The server chooses problems, stores them with the match, and sets the authoritative start and end times.
4. **Compete on Codeforces.** Both players receive the same problem set, with direct Codeforces links. A correct submission claims that problem's points for its solver and locks the problem so it cannot score again. The first accepted solve wins that problem; if both players solve between checks, the earlier Codeforces submission timestamp wins. The match can finish early when a player scores strictly more than half of all available problem points; otherwise it ends when time expires.
5. **Review the result.** The server finalizes the outcome, updates both Elo ratings and career records, and stores the result. The match recap shows scores, rating changes, winner or tie, each problem's solve status and solver, and a shareable recap URL. The dashboard shows recent match history and current platform rating.

## Codeforces API and problem chooser

Codeforces data is fetched by the backend, not directly by the browser:

- **Handle verification:** `user.status` is queried for the selected handle's latest five submissions. Verification requires a recent compilation-error verdict on Problem 4A within the challenge window. The challenge token is displayed to the player to include in the compiler error output; verification is based on the matching problem, verdict, and time window.
- **Finding mutually unsolved problems:** `problemset.problems` supplies the problem catalog (contest ID, index, name, rating, and tags). The server also calls `user.status` for each player's latest 10 submissions and builds a set of problems with an `OK` verdict. It excludes any problem solved by either player, any problem tagged `interactive`, and problem entries outside the supported contest-ID range.
- **Filling configured slots:** For each slot, candidates are filtered to its configured inclusive rating band. If that band has no remaining candidates, the chooser widens the band by up to 100 rating points on either side. It selects a random candidate, assigns that slot's configured points, and removes the problem from the candidate pool so the same problem cannot appear twice in a match. If it still cannot fill a slot, match creation reports an error instead of silently substituting a problem.
- **Caching and resilience:** The problem catalog is cached in server memory for one hour, and concurrent requests share the same catalog fetch. Codeforces requests have a timeout and are retried once; API and rate-limit failures are surfaced to the caller.
- **Checking match submissions:** While a match is active, the server poller checks both players' latest 10 submissions about every 13 seconds. Only an `OK` submission for a selected problem with a submission timestamp at or after the match start can claim it. A manual sync is available in the arena and is limited to once every 10 seconds per socket connection. The app retries automatic polling after transient API errors.

The Codeforces API provides problem and submission data; it does not judge code submitted through LockedIn Arena. Players submit and receive verdicts on Codeforces itself.

## Scoring and Elo

- Each problem is worth the point value assigned to its slot by the host. A successful first solve adds those points to the solver's match score and locks the problem.
- The server determines the match result from total points: higher score wins, equal score ties. A player immediately clinches if their score becomes **strictly greater than half** of the match's total available points. If nobody clinches, the server finalizes at the configured end time.
- Each player starts at 1200 platform Elo. After a match, the server uses the standard Elo expected-score formula:

  ```text
  expected = 1 / (1 + 10 ^ ((opponentRating - playerRating) / 400))
  ratingChange = round(32 * (actualScore - expected))
  ```

  Actual score is `1` for a win, `0.5` for a tie, and `0` for a loss. The K-factor is 32 and a player's resulting rating cannot fall below 100. A tie is settled for both players as a draw. The server records before/after ratings, deltas, match result, and rating history; repeated finalization does not apply the same match twice.

## Application routes and API

The React single-page application exposes these routes (all except login and registration require authentication):

| Route | Purpose |
| --- | --- |
| `/login`, `/register` | Account access |
| `/dashboard` | Player profile, Elo/record, create/join duel, recent match history |
| `/lobby/:roomCode` | Join/readiness and host start flow |
| `/arena/:roomCode` | Live match, timer, problems, score, and submission sync |
| `/match/:roomCode` | Match recap and problem-by-problem audit |

Backend routes are mounted under `/api`:

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Service health check |
| `POST /api/auth/register`, `POST /api/auth/login` | Register or authenticate; return a JWT |
| `GET /api/auth/me` | Load the authenticated player profile |
| `POST /api/auth/cf/initiate`, `POST /api/auth/cf/confirm` | Start and confirm Codeforces handle verification |
| `POST /api/matches` | Create a lobby with duration and problem tiers |
| `POST /api/matches/join` | Join a lobby using its room code |
| `PATCH /api/matches/:roomCode/ready` | Update the current participant's ready state |
| `POST /api/matches/:roomCode/start` | Start the match (host only; both players must be ready) |
| `GET /api/matches/:roomCode` | Load match details and recap |
| `GET /api/matches/user/history` | Load the authenticated player's finished matches |

The arena also uses authenticated Socket.IO connections for room membership, player presence, timer ticks, problem locks, match completion, and manual submission sync. API and socket actions that change a match are validated and processed on the server.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Socket.IO Client, Lucide React, Canvas Confetti |
| Backend | Node.js, Express, Socket.IO, Mongoose, Axios, JSON Web Tokens |
| Database | MongoDB Atlas |
| External data | Codeforces API |

## Architecture

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

The Express API handles authentication, user verification, lobby configuration, match lookup, and combat history. Socket.IO handles authorized arena membership and live events. The backend matchmaker, submission poller, and Elo settlement service run server-side; the browser is never authoritative for scores, accepted submissions, or match outcomes. Mongoose stores users, match configuration and state, problem locks, results, stats, and rating history in MongoDB.

## Local setup

### Requirements

- Node.js (use a current LTS release) and npm
- A MongoDB Atlas connection string or local MongoDB instance
- Outbound network access from the backend to `https://codeforces.com/api`

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

## Environment variables

### Backend: `server/.env`

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `5000` |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long, random secret used to sign authentication tokens |
| `CLIENT_URL` | For deployment | Allowed frontend origin(s) for Express and Socket.IO CORS. Multiple origins may be comma-separated. |

### Frontend: `client/.env`

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | No | Backend API base URL; defaults to `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | No | Backend origin for Socket.IO; defaults to the API URL's origin |

The example files are [`server/.env.example`](./server/.env.example) and [`client/.env.example`](./client/.env.example). Keep backend secrets private. `VITE_` variables are embedded into the public frontend bundle and must never contain secrets.

## Deployment

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

- **Deployed app:** Not provided in the repository yet.
- **Backend API:** Not provided in the repository yet. Once deployed, verify it at `<backend-url>/api/health`.
- **Demo video:** [Complete demo and walkthrough](https://drive.google.com/file/d/1hlGqIpc4o2eVtWScUvnsPKPi7VQp7TYB/view?usp=sharing)

## Production build check

From the repository root, run:

```bash
npm --prefix client run build
npm --prefix client run lint
```

The server starts with `npm --prefix server start`. Keep `.env` files, database credentials, and signing secrets out of source control and deployment logs.
