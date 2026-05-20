const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createClassSchema, updateClassSchema } = require('../validations/classValidation');
const classController = require('../controllers/classController');

const router = Router();

router.use(authenticate, requireRole('admin','instructor'));

router.post('/', validate(createClassSchema), classController.create);
router.get('/', classController.getAll);
router.get('/:id', classController.getById);
router.patch('/:id', validate(updateClassSchema), classController.update);
router.delete('/:id', classController.remove);

module.exports = router;
