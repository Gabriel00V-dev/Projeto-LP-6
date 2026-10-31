import { Router } from 'express';
import * as upaController from '../controllers/upaController';
import { authenticate, authenticateOptional } from '../middlewares/authMiddleware';

const router = Router();

// IMPORTANTE: rotas fixas (/units, /queue/...) antes de /:unitId

// Públicas — lotação e tempo estimado. Com token da equipe, a fila completa.
router.get('/units',                  upaController.listUnits);
router.get('/queue/mine',             authenticate, upaController.myQueue);
router.get('/queue/:protocol',        authenticate, upaController.getByProtocol);
router.patch('/queue/:id/status',     authenticate, upaController.updateStatus);
router.patch('/queue/:id/risk',       authenticate, upaController.updateRisk);
router.get('/:unitId/queue',          authenticateOptional, upaController.getQueue);
router.post('/:unitId/queue',         authenticate, upaController.joinQueue);
router.post('/:unitId/queue/call-next', authenticate, upaController.callNext);

export default router;
