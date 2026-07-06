const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createInstructorSchema, idParamSchema, updateInstructorSchema } = require('../validations/userValidation');
const userController = require('../controllers/userController');

const router = Router();

router.use(authenticate, requireRole('admin'));

// GET /api/users?role=instructor  — list users (filterable by role)
router.get('/', userController.getAll);

// POST /api/users  — register a new instructor account
router.post('/', validate(createInstructorSchema), userController.create);

// PATCH /api/users/:id  — update name / email / password
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateInstructorSchema), userController.update);

// DELETE /api/users/:id
router.delete('/:id', validate(idParamSchema, 'params'), userController.remove);

// PATCH /api/users/:id/activate|deactivate
router.patch('/:id/activate',   validate(idParamSchema, 'params'), userController.activate);
router.patch('/:id/deactivate', validate(idParamSchema, 'params'), userController.deactivate);

module.exports = router;
