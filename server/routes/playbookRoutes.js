const express = require('express');
const router = express.Router();
const { getPlaybook, updatePlaybook } = require('../controllers/playbookController');
const { protect, preventDemoModification } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { updatePlaybookSchema } = require('../validators/playbookValidators');

router.use(protect);
router.route('/')
  .get(getPlaybook)
  .put(preventDemoModification, validateBody(updatePlaybookSchema), updatePlaybook);

module.exports = router;
