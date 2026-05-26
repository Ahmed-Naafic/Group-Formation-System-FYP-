const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createInstructorSchema } = require('../validations/userValidation');
const userController = require('../controllers/userController');

const router = Router();

router.use(authenticate, requireRole('admin'));

// GET /api/users?role=instructor  — list users (filterable by role)
router.get('/', userController.getAll);

// POST /api/users  — register a new instructor account
router.post('/', validate(createInstructorSchema), userController.create);

module.exports = router;
