const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  updateSettings,
  demoLogin
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/demo', demoLogin);
router.get('/me', protect, getMe);
router.put('/settings', protect, updateSettings);

module.exports = router;
