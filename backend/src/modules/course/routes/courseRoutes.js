const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createCourseSchema, updateCourseSchema } = require('../validations/courseValidation');
const courseController = require('../controllers/courseController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/', validate(createCourseSchema), courseController.create);
router.get('/', courseController.getAll);
router.get('/:id', courseController.getById);
router.patch('/:id', validate(updateCourseSchema), courseController.update);
router.delete('/:id', courseController.remove);

module.exports = router;
