const { Router }          = require('express');
const { authenticate }    = require('../../../middleware/auth');
const { requireRole }     = require('../../../middleware/rbac');
const dashboardController = require('../controllers/dashboardController');

const router = Router();

router.get('/',           authenticate, requireRole('admin'),      dashboardController.getStats);
router.get('/instructor', authenticate, requireRole('instructor'), dashboardController.getInstructorStats);

module.exports = router;
