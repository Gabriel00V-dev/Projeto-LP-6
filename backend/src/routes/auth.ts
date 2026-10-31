import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateIncluindoPendentes } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));

// Inclui cadastros em análise: o app precisa saber o status para mostrar a
// tela de "aguardando aprovação" ao reabrir.
router.get('/me', authenticateIncluindoPendentes, authController.me.bind(authController));

export default router;
