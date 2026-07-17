const { Router }       = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const reportController = require('../controllers/reportController');

const router = Router();

// Admin and instructor (own assignments, enforced in service)
router.get(
  '/groups/formatted',
  authenticate, requireRole('admin', 'instructor'),
  reportController.formattedGroupReport,
);

router.get(
  '/groups',
  authenticate, requireRole('admin', 'instructor'),
  reportController.groupReport,
);

router.get(
  '/tasks/:taskId/grades',
  authenticate, requireRole('admin', 'instructor'),
  reportController.taskGrades,
);

module.exports = router;
