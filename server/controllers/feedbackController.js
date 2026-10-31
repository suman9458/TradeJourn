const Feedback = require('../models/Feedback');

// @desc    Submit user feedback or bug report
// @route   POST /api/feedback
// @access  Public (Optional Auth)
const submitFeedback = async (req, res, next) => {
  try {
    const { type, message, page } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a feedback or bug message (at least 3 characters).'
      });
    }

    const cleanType = (type === 'Bug' || type === 'bug') ? 'Bug' : 'Feedback';
    const cleanMessage = message.trim().slice(0, 2000);
    const cleanPage = (page && typeof page === 'string') ? page.trim().slice(0, 80) : 'Overview';

    const feedbackDoc = {
      type: cleanType,
      message: cleanMessage,
      page: cleanPage,
      status: 'New'
    };

    if (req.user) {
      feedbackDoc.userId = req.user._id;
      feedbackDoc.userName = req.user.name || 'Trader';
      feedbackDoc.userHandle = req.user.userId || '@trader';
      feedbackDoc.userEmail = req.user.email || '';
    }

    const created = await Feedback.create(feedbackDoc);

    res.status(201).json({
      success: true,
      message: cleanType === 'Bug'
        ? 'Thank you! Your bug report has been logged for our team.'
        : 'Thank you! Your feedback has been received.',
      feedbackId: created._id
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all feedback and bug submissions (Admin only)
// @route   GET /api/feedback
// @access  Private / Admin
const getFeedbacks = async (req, res, next) => {
  try {
    const feedbacks = await Feedback.find({})
      .sort({ createdAt: -1 })
      .limit(200);

    const stats = {
      total: feedbacks.length,
      bugs: feedbacks.filter(f => f.type === 'Bug').length,
      feedback: feedbacks.filter(f => f.type === 'Feedback').length,
      newCount: feedbacks.filter(f => f.status === 'New').length
    };

    res.json({
      success: true,
      stats,
      feedbacks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feedback status or admin response notes (Admin only)
// @route   PATCH /api/feedback/:id
// @access  Private / Admin
const updateFeedbackStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback entry not found' });
    }

    if (status && ['New', 'In Review', 'Resolved'].includes(status)) {
      feedback.status = status;
    }

    if (adminNotes !== undefined) {
      feedback.adminNotes = typeof adminNotes === 'string' ? adminNotes.trim().slice(0, 1000) : '';
    }

    await feedback.save();

    res.json({
      success: true,
      message: 'Feedback updated successfully',
      feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete feedback entry (Admin only)
// @route   DELETE /api/feedback/:id
// @access  Private / Admin
const deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findByIdAndDelete(id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback entry not found' });
    }

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitFeedback,
  getFeedbacks,
  updateFeedbackStatus,
  deleteFeedback
};

