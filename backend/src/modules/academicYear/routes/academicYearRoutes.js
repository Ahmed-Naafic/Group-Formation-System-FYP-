const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  idParamSchema,
} = require('../validations/academicYearValidation');
const academicYearController = require('../controllers/academicYearController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/',    validate(createAcademicYearSchema), academicYearController.create);
router.get('/',     academicYearController.getAll);
router.get('/:id',  validate(idParamSchema, 'params'), academicYearController.getById);
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateAcademicYearSchema), academicYearController.update);
router.delete('/:id', validate(idParamSchema, 'params'), academicYearController.remove);

module.exports = router;
