import { Router } from 'express';
import * as telemedicineController from '../controllers/telemedicineController';
import { authenticate, requirePrestador } from '../middlewares/authMiddleware';
import { checkAddon } from '../middlewares/checkAddon';

const router = Router();

// Públicas — o cidadão vê só prestadores com o add-on ativo
router.get('/providers',                  telemedicineController.listProviders);
router.get('/providers/:id/availability', telemedicineController.providerAvailability);

// Salas — identificadas pela consulta. Nunca pelo room_id: conhecer o
// room_id não dá acesso a nada (plano, 13).
router.post('/rooms', authenticate, requirePrestador, checkAddon('telemedicina'), telemedicineController.createRoom);
router.get('/rooms/:appointmentId',          authenticate, telemedicineController.getRoom);
router.post('/rooms/:appointmentId/join',    authenticate, telemedicineController.joinRoom);
router.post('/rooms/:appointmentId/finish',  authenticate, requirePrestador, telemedicineController.finishRoom);

export default router;
