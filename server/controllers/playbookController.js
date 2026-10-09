const Playbook = require('../models/Playbook');

// @desc    Get user's trading playbook
// @route   GET /api/playbook
// @access  Private
const getPlaybook = async (req, res, next) => {
  try {
    let playbook = await Playbook.findOne({ userId: req.user._id });
    if (!playbook) {
      playbook = await Playbook.create({ userId: req.user._id });
    }
    res.json({ success: true, playbook });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user's trading playbook
// @route   PUT /api/playbook
// @access  Private
const updatePlaybook = async (req, res, next) => {
  try {
    const { entryRules, riskRules, exitRules, psychologyRules } = req.body;
    let playbook = await Playbook.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { entryRules, riskRules, exitRules, psychologyRules } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, playbook });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlaybook, updatePlaybook };
