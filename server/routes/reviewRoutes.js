const express = require('express');
const router = express.Router();
const { getReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getReviews);

module.exports = router;
