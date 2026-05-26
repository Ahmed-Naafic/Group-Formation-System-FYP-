const { Router }         = require('express');
const { authenticate }   = require('../../../middleware/auth');
const { requireRole }    = require('../../../middleware/rbac');
const validate           = require('../../../common/validators/validate');
const feedbackController = require('../controllers/feedbackController');
const feedbackValidation = require('../validations/feedbackValidation');

const router = Router();

// POST /api/feedback  — submit feedback (instructor or student)
router.post(
  '/',
  authenticate, requireRole('instructor', 'student'),
  validate(feedbackValidation.submitFeedback, 'body'),
  feedbackController.submit,
);

// GET /api/feedback?groupId=&taskId=  — list feedback for a group
router.get(
  '/',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(feedbackValidation.listFeedback, 'query'),
  feedbackController.list,
);

module.exports = router;
