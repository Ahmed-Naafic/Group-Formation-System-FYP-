const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createFacultySchema, updateFacultySchema } = require('../validations/facultyValidation');
const facultyController = require('../controllers/facultyController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/', validate(createFacultySchema), facultyController.create);
router.get('/', facultyController.getAll);
router.get('/:id', facultyController.getById);
router.patch('/:id', validate(updateFacultySchema), facultyController.update);
router.delete('/:id', facultyController.remove);

module.exports = router;
