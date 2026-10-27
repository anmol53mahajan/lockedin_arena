const express = require('express');
const {
  createMatch,
  getMatchByCode,
  joinMatch,
  getUserMatchHistory,
  updateReadyState,
  startMatch
} = require('../controllers/match.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', protect, createMatch);
router.post('/join', protect, joinMatch);
router.get('/user/history', protect, getUserMatchHistory);
router.patch('/:roomCode/ready', protect, updateReadyState);
router.post('/:roomCode/start', protect, startMatch);
router.get('/:roomCode', protect, getMatchByCode);

module.exports = router;
