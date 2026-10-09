const express = require('express');
const router = express.Router();
const { getPlaybook, updatePlaybook } = require('../controllers/playbookController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/')
  .get(getPlaybook)
  .put(updatePlaybook);

module.exports = router;
