const express = require('express');
const { getGlobalLeaderboard } = require('../controllers/leaderboard.controller');

const router = express.Router();

router.get('/', getGlobalLeaderboard);

module.exports = router;
