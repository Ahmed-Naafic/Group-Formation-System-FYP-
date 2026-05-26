const { Router }       = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const reportController = require('../controllers/reportController');

const router = Router();

// Admin and instructor (own assignments, enforced in service)
router.get(
  '/groups',
  authenticate, requireRole('admin', 'instructor'),
  reportController.groupReport,
);

module.exports = router;
