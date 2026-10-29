const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const matchRoutes = require('./routes/match.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const configureDuelSockets = require('./sockets/duel.socket');
const { startPoller, stopPoller } = require('./services/poller.service');

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
];
const corsOptions = {
  origin: [...new Set(allowedOrigins)],
  methods: ['GET', 'POST', 'PATCH'],
  credentials: true
};

// Socket.io Setup
const io = new Server(server, {
  cors: corsOptions
});

configureDuelSockets(io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Lockout Arena API', timestamp: new Date() });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
    ? err.status
    : err.type === 'entity.parse.failed'
      ? 400
      : err.type === 'entity.too.large'
        ? 413
        : 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error('[HTTP] Unhandled request error:', err);
  }

  return res.status(status).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;

server.once('close', stopPoller);

connectDB()
  .then(() => {
    startPoller(io);
    server.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('[Server] Startup failed:', error.message);
    process.exitCode = 1;
  });