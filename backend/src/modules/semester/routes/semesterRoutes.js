const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { idParamSchema, listQuerySchema } = require('../validations/semesterValidation');
const semesterController = require('../controllers/semesterController');

const router = Router();

// Read-only for both roles — semesters are system-managed (auto-created
// alongside their academic year), so there is no create/update/delete route
// at all. Instructors need read access too: the Course Offering page (which
// they can view) displays each offering's semester.
router.use(authenticate, requireRole('admin', 'instructor'));

router.get('/',     validate(listQuerySchema, 'query'), semesterController.getAll);
router.get('/:id',  validate(idParamSchema, 'params'),  semesterController.getById);

module.exports = router;
