const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  createSemesterSchema,
  updateSemesterSchema,
  idParamSchema,
  listQuerySchema,
} = require('../validations/semesterValidation');
const semesterController = require('../controllers/semesterController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.post('/',      validate(createSemesterSchema),                                    semesterController.create);
router.get('/',       validate(listQuerySchema, 'query'),                                semesterController.getAll);
router.get('/:id',    validate(idParamSchema, 'params'),                                 semesterController.getById);
router.patch('/:id',  validate(idParamSchema, 'params'), validate(updateSemesterSchema), semesterController.update);
router.delete('/:id', validate(idParamSchema, 'params'),                                 semesterController.remove);

module.exports = router;
