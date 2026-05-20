const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createSemesterSchema, updateSemesterSchema } = require('../validations/semesterValidation');
const semesterController = require('../controllers/semesterController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/', validate(createSemesterSchema), semesterController.create);
router.get('/', semesterController.getAll);
router.get('/:id', semesterController.getById);
router.patch('/:id', validate(updateSemesterSchema), semesterController.update);
router.delete('/:id', semesterController.remove);

module.exports = router;
