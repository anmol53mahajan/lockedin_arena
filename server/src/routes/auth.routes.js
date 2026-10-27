const express = require('express');
const {
  register,
  login,
  getMe,
  initiateCfVerification,
  confirmCfVerification
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/cf/initiate', protect, initiateCfVerification);
router.post('/cf/confirm', protect, confirmCfVerification);

module.exports = router;
