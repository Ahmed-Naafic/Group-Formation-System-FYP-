const { Router }       = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const auditLogController = require('../controllers/auditLogController');

const router = Router();

// Audit logs are admin-only
router.get('/', authenticate, requireRole('admin'), auditLogController.list);

module.exports = router;
