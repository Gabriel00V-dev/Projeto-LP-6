import { Router } from 'express';
import * as professionalController from '../controllers/professionalController';
import { authenticate, authenticateOptional, requireClinica, requirePrestador } from '../middlewares/authMiddleware';

const router = Router();

// Públicas — o cidadão escolhe o profissional antes de fazer login. Com o
// token da clínica, a listagem da equipe dela inclui quem está em análise.
router.get('/',                 authenticateOptional, professionalController.listProfessionals);
router.get('/:id/availability', professionalController.getProfessionalAvailability);
router.get('/:id',              professionalController.getProfessional);

// Privadas — a clínica cadastra profissionais vinculados; o profissional
// independente se cadastra por POST /auth/register com role "profissional".
router.post('/',    authenticate, requireClinica, professionalController.createProfessional);
router.put('/:id',  authenticate, requirePrestador, professionalController.updateProfessional);

export default router;
