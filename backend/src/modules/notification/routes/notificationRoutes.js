const { Router }       = require('express');
const Joi              = require('joi');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const notificationController = require('../controllers/notificationController');

const router  = Router();
const idParam = Joi.object({ id: Joi.string().hex().length(24).required() });

router.use(authenticate, requireRole('admin', 'instructor', 'student'));

router.get('/',           notificationController.list);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate(idParam, 'params'), notificationController.markRead);

module.exports = router;
