import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin, requirePrestador } from '../middlewares/authMiddleware';
import {
  checkAddon,
  addonService,
  prestadorDoUsuario,
  prestadorProprio,
  AddonKey,
  Plano,
  Prestador,
  TipoPrestador,
} from '../middlewares/checkAddon';
import * as telemedicineService from '../services/telemedicineService';
import { responderErro } from '../utils/httpError';

const router = Router();

const ADDON_KEYS: AddonKey[] = ['addon_telemedicina', 'addon_pdf', 'addon_relatorios', 'addon_api_externa'];
const PLANOS: Plano[] = ['basico', 'profissional', 'enterprise'];

// ============================================================
// GET /addons/subscription
// Retorna a assinatura e add-ons do prestador autenticado (clínica ou
// profissional). Profissional vinculado recebe a assinatura da clínica.
// Usado pelo frontend logo após login para cachear no contexto
// ============================================================
router.get(
  '/subscription',
  authenticate,
  requirePrestador,
  async (req: Request, res: Response) => {
    try {
      const prestador = prestadorDoUsuario(req.user)!;
      const assinatura = await addonService.getSubscription(prestador);

      if (!assinatura) {
        // Sem linha em `assinaturas` = plano básico, sem add-ons.
        return res.json({
          tipo_prestador: prestador.tipo,
          codigo_prestador: prestador.codigo,
          plano: 'basico',
          addon_telemedicina: false,
          addon_pdf: false,
          addon_relatorios: false,
          addon_api_externa: false,
          trial_ativo: false,
          trial_expira_em: null,
          gerenciavel: Boolean(prestadorProprio(req.user)),
        });
      }

      // Verifica trial expirado e desativa automaticamente
      if (assinatura.trial_ativo && assinatura.trial_expira_em) {
        const trialExpired = new Date(assinatura.trial_expira_em) < new Date();
        if (trialExpired) {
          await addonService.endTrial(prestador);

          return res.json({
            ...assinatura,
            trial_ativo: false,
            addon_telemedicina: false,
            addon_pdf: false,
            trial_expired: true,
            gerenciavel: Boolean(prestadorProprio(req.user)),
          });
        }
      }

      res.json({ ...assinatura, gerenciavel: Boolean(prestadorProprio(req.user)) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================================
// POST /addons/trial
// Inicia trial de 14 dias (self-service). Só quem é dono da assinatura —
// a clínica ou o profissional independente.
// ============================================================
router.post(
  '/trial',
  authenticate,
  requirePrestador,
  async (req: Request, res: Response) => {
    try {
      const prestador = prestadorProprio(req.user);
      if (!prestador) {
        return res.status(403).json({
          error: 'A assinatura é gerenciada pela clínica à qual você está vinculado.',
          code: 'FORBIDDEN_ROLE',
        });
      }

      const assinatura = await addonService.getSubscription(prestador);

      // Não permite trial duplo: trial_expira_em fica preenchido mesmo depois
      // que o trial acaba e trial_ativo volta a false.
      if (assinatura?.trial_ativo || assinatura?.trial_expira_em) {
        return res.status(409).json({
          error: 'Este cadastro já utilizou o período de trial.',
          code: 'TRIAL_ALREADY_USED',
        });
      }

      const updated = await addonService.startTrial(prestador);
      res.status(201).json({
        message: 'Trial de 14 dias ativado com sucesso!',
        assinatura: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================================
// ROTAS DE EXEMPLO — Funcionalidades premium protegidas
// ============================================================

// POST /addons/telemedicina/gerar-link
// Antes de criar a sala, valida a consulta, o vínculo do prestador com ela, a
// modalidade e a assinatura (ver telemedicineService.criarSala).
router.post(
  '/telemedicina/gerar-link',
  authenticate,
  requirePrestador,
  checkAddon('telemedicina'),
  async (req: Request, res: Response) => {
    const { codigo_consulta } = req.body;

    if (!codigo_consulta) {
      return res.status(400).json({ error: 'codigo_consulta é obrigatório.' });
    }

    try {
      const sala = await telemedicineService.criarSala(req.user!, Number(codigo_consulta));
      res.json({
        meetingUrl: sala.meeting_url,
        roomId: sala.room_id,
        instrucoes: 'O paciente entra pelo app, em "Minhas consultas", no horário liberado.',
      });
    } catch (error) {
      responderErro(res, error, 'gerar-link');
    }
  }
);

// POST /addons/pdf/gerar-laudo
router.post(
  '/pdf/gerar-laudo',
  authenticate,
  requirePrestador,
  checkAddon('pdf'),
  async (req: Request, res: Response) => {
    const { codigo_consulta, conteudo } = req.body;

    if (!codigo_consulta || !conteudo) {
      return res.status(400).json({ error: 'codigo_consulta e conteudo são obrigatórios.' });
    }

    // Aqui você integraria com puppeteer, pdfkit, etc.
    // Exemplo de resposta simulada:
    res.json({
      pdfUrl: `https://storage.supabase.co/v1/object/public/uploads/laudos/laudo-${codigo_consulta}.pdf`,
      geradoEm: new Date().toISOString(),
      message: 'PDF gerado com sucesso.',
    });
  }
);

// ============================================================
// ROTAS ADMIN — Gerenciar add-ons de prestadores
// É aqui que o add-on é liberado depois da confirmação do pagamento.
// Administradores: e-mails listados em ADMIN_EMAILS.
// ============================================================

function prestadorDaRota(req: Request): Prestador | null {
  // /admin/:clinicaId/... é o formato antigo, só para clínicas.
  const tipo = (req.params.tipo ?? 'clinica') as TipoPrestador;
  const codigo = Number(req.params.codigo ?? req.params.clinicaId);
  if (!['clinica', 'profissional'].includes(tipo) || !Number.isInteger(codigo)) return null;
  return { tipo, codigo };
}

// PUT /addons/admin/:tipo/:codigo/addon  (ou /addons/admin/:clinicaId/addon)
// Body: { addon: 'addon_telemedicina', value: true }
async function alterarAddon(req: Request, res: Response) {
  const prestador = prestadorDaRota(req);
  const { addon, value } = req.body;

  if (!prestador) {
    return res.status(400).json({ error: 'Prestador inválido. Use /admin/clinica/:codigo ou /admin/profissional/:codigo.' });
  }
  if (typeof value !== 'boolean' || !ADDON_KEYS.includes(addon)) {
    return res.status(400).json({ error: `addon (${ADDON_KEYS.join(', ')}) e value (boolean) são obrigatórios.` });
  }

  try {
    const updated = await addonService.setAddon(prestador, addon, value);
    res.json({ message: `Add-on '${addon}' atualizado.`, assinatura: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /addons/admin/:tipo/:codigo/plano  (ou /addons/admin/:clinicaId/plano)
// Body: { plano: 'profissional' }
async function alterarPlano(req: Request, res: Response) {
  const prestador = prestadorDaRota(req);
  const { plano } = req.body;

  if (!prestador) {
    return res.status(400).json({ error: 'Prestador inválido. Use /admin/clinica/:codigo ou /admin/profissional/:codigo.' });
  }
  if (!PLANOS.includes(plano)) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }

  try {
    const updated = await addonService.upgradePlan(prestador, plano);
    res.json({ message: `Plano atualizado para '${plano}'.`, assinatura: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

router.put('/admin/:tipo/:codigo/addon', authenticate, requireAdmin, alterarAddon);
router.put('/admin/:tipo/:codigo/plano', authenticate, requireAdmin, alterarPlano);
router.put('/admin/:clinicaId/addon',    authenticate, requireAdmin, alterarAddon);
router.put('/admin/:clinicaId/plano',    authenticate, requireAdmin, alterarPlano);

export default router;
