import { Router } from 'express';
import * as availabilityController from '../controllers/availabilityController';
import { authenticate, requirePrestador } from '../middlewares/authMiddleware';

const router = Router();

// Públicas — agenda semanal e horários livres
// GET /availability?codigo_profissional=1  ou  ?codigo_clinica=2
// GET /availability/slots?codigo_profissional=1&data=2026-11-03&modalidade=telemedicina
router.get('/',                availabilityController.listAvailability);
router.get('/slots',           availabilityController.listSlots);
router.get('/:professionalId', availabilityController.listByProfessional);

// Privadas — o prestador configura os próprios horários
router.post('/',      authenticate, requirePrestador, availabilityController.createAvailability);
router.put('/:id',    authenticate, requirePrestador, availabilityController.updateAvailability);
router.delete('/:id', authenticate, requirePrestador, availabilityController.deleteAvailability);

export default router;
