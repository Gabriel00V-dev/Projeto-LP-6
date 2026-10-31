import { Request, Response } from 'express';
import * as professionalService from '../services/professionalService';
import * as availabilityService from '../services/availabilityService';
import { responderErro } from '../utils/httpError';

function numeroOpcional(valor: unknown): number | undefined {
  return valor === undefined || valor === '' ? undefined : Number(valor);
}

export async function listProfessionals(req: Request, res: Response) {
  try {
    // ?type= segue o plano (GET /professionals?type=psicologo); ?tipo= também vale.
    const tipo = (req.query.type ?? req.query.tipo) as string | undefined;
    const codigo_clinica = numeroOpcional(req.query.clinic ?? req.query.codigo_clinica);
    const profissionais = await professionalService.listarProfissionais({
      tipo,
      codigo_clinica,
      codigo_especializacao: numeroOpcional(req.query.especializacao),
      // Para o público, só aprovados; a clínica dona vê a equipe toda.
      incluir_nao_aprovados: req.user?.role === 'clinica' && codigo_clinica === req.user.entityId,
    });
    res.json(profissionais);
  } catch (error) {
    responderErro(res, error, 'listProfessionals');
  }
}

export async function getProfessional(req: Request, res: Response) {
  try {
    res.json(await professionalService.obterProfissional(Number(req.params.id)));
  } catch (error) {
    responderErro(res, error, 'getProfessional');
  }
}

export async function createProfessional(req: Request, res: Response) {
  try {
    res.status(201).json(await professionalService.criarProfissional(req.user!, req.body));
  } catch (error) {
    responderErro(res, error, 'createProfessional');
  }
}

export async function updateProfessional(req: Request, res: Response) {
  try {
    res.json(await professionalService.atualizarProfissional(req.user!, Number(req.params.id), req.body));
  } catch (error) {
    responderErro(res, error, 'updateProfessional');
  }
}

/**
 * Sem ?data: a agenda semanal do profissional.
 * Com ?data=YYYY-MM-DD (e ?modalidade opcional): os horários livres do dia.
 */
export async function getProfessionalAvailability(req: Request, res: Response) {
  try {
    const codigo_profissional = Number(req.params.id);
    const { data, modalidade } = req.query;

    if (typeof data === 'string') {
      res.json(await availabilityService.listarSlotsLivres({
        codigo_profissional,
        data,
        modalidade: modalidade as availabilityService.Modalidade | undefined,
      }));
      return;
    }

    res.json(await availabilityService.listarDisponibilidades({ codigo_profissional }));
  } catch (error) {
    responderErro(res, error, 'getProfessionalAvailability');
  }
}
