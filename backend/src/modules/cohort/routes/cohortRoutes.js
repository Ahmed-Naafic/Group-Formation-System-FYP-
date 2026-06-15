const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  createCohortSchema,
  updateCohortSchema,
  idParamSchema,
} = require('../validations/cohortValidation');
const cohortController = require('../controllers/cohortController');

const router = Router();

router.use(authenticate);

// List and detail: admin + instructor (read-only for instructor)
router.get('/',    requireRole('admin', 'instructor'), cohortController.getAll);
router.get('/:id', requireRole('admin', 'instructor'), validate(idParamSchema, 'params'), cohortController.getById);

// Mutations: admin only
router.post('/',     requireRole('admin'), validate(createCohortSchema), cohortController.create);
router.patch('/:id', requireRole('admin'), validate(idParamSchema, 'params'), validate(updateCohortSchema), cohortController.update);
router.delete('/:id', requireRole('admin'), validate(idParamSchema, 'params'), cohortController.remove);

module.exports = router;
