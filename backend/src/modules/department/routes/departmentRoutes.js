const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createDepartmentSchema, updateDepartmentSchema } = require('../validations/departmentValidation');
const departmentController = require('../controllers/departmentController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/', validate(createDepartmentSchema), departmentController.create);
router.get('/', departmentController.getAll);
router.get('/:id', departmentController.getById);
router.patch('/:id', validate(updateDepartmentSchema), departmentController.update);
router.delete('/:id', departmentController.remove);

module.exports = router;
