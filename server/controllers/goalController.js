const Goal = require('../models/Goal');

// @desc    Get user's trading goals
// @route   GET /api/goals
// @access  Private
const getGoals = async (req, res, next) => {
  try {
    let goal = await Goal.findOne({ userId: req.user._id });
    if (!goal) {
      goal = await Goal.create({ userId: req.user._id });
    }
    res.json({ success: true, goal });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user's trading goals
// @route   PUT /api/goals
// @access  Private
const updateGoals = async (req, res, next) => {
  try {
    let goal = await Goal.findOneAndUpdate(
      { userId: req.user._id },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, goal });
  } catch (error) {
    next(error);
  }
};

module.exports = { getGoals, updateGoals };
