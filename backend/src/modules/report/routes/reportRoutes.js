const { Router }       = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate          = require('../../../common/validators/validate');
const { analyticsQuerySchema } = require('../validations/reportValidation');
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

// Analytics report — students never reach these (route-level role gate),
// and admin/instructor scope is further enforced inside the service itself
// (reportAuthScope) so a filter can't be used to reach another instructor's
// data even though both roles pass this same gate.
router.get(
  '/analytics',
  authenticate, requireRole('admin', 'instructor'),
  validate(analyticsQuerySchema, 'query'),
  reportController.getAnalytics,
);

router.get(
  '/analytics/excel',
  authenticate, requireRole('admin', 'instructor'),
  validate(analyticsQuerySchema, 'query'),
  reportController.exportAnalyticsExcel,
);

router.get(
  '/analytics/pdf',
  authenticate, requireRole('admin', 'instructor'),
  validate(analyticsQuerySchema, 'query'),
  reportController.exportAnalyticsPdf,
);

module.exports = router;
