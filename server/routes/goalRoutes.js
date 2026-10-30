const express = require('express');
const router = express.Router();
const { getGoals, updateGoals } = require('../controllers/goalController');
const { protect, preventDemoModification } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { updateGoalSchema } = require('../validators/goalValidators');

router.use(protect);
router.route('/')
  .get(getGoals)
  .put(preventDemoModification, validateBody(updateGoalSchema), updateGoals);

module.exports = router;
