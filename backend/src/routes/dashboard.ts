import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as dashboardService from '../services/dashboardService';
import { responderErro } from '../utils/httpError';

const router = Router();

// GET /dashboard?de=2026-10-01&ate=2026-10-31 — só a prefeitura.
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    res.json(await dashboardService.indicadores(
      typeof req.query.de === 'string' ? req.query.de : undefined,
      typeof req.query.ate === 'string' ? req.query.ate : undefined
    ));
  } catch (error) {
    responderErro(res, error, 'dashboard');
  }
});

export default router;
