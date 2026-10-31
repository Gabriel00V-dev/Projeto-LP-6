import { Router } from 'express';
import * as approvalController from '../controllers/approvalController';
import { authenticate, authenticateIncluindoPendentes, requireAdmin, requirePrestador } from '../middlewares/authMiddleware';

const router = Router();

// Prestador acompanhando o próprio cadastro (aceita pendente/reprovado)
router.get('/me',           authenticateIncluindoPendentes, requirePrestador, approvalController.mine);
router.post('/me/resubmit', authenticateIncluindoPendentes, requirePrestador, approvalController.resubmit);

// Prefeitura
// GET   /approvals?status=pendente|aprovado|reprovado&tipo=clinica|profissional
// PATCH /approvals/clinica/12  { decisao: 'aprovado' | 'reprovado', motivo }
router.get('/',                authenticate, requireAdmin, approvalController.list);
router.patch('/:tipo/:codigo', authenticate, requireAdmin, approvalController.decide);

export default router;
