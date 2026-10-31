import { Request, Response } from 'express';
import * as availabilityService from '../services/availabilityService';
import { responderErro } from '../utils/httpError';

function filtroDaQuery(req: Request): availabilityService.FiltroAgenda {
  const { codigo_profissional, codigo_clinica } = req.query;
  return {
    ...(codigo_profissional ? { codigo_profissional: Number(codigo_profissional) } : {}),
    ...(codigo_clinica ? { codigo_clinica: Number(codigo_clinica) } : {}),
  };
}

export async function listAvailability(req: Request, res: Response) {
  try {
    res.json(await availabilityService.listarDisponibilidades(filtroDaQuery(req)));
  } catch (error) {
    responderErro(res, error, 'listAvailability');
  }
}

export async function listByProfessional(req: Request, res: Response) {
  try {
    res.json(await availabilityService.listarDisponibilidades({ codigo_profissional: Number(req.params.professionalId) }));
  } catch (error) {
    responderErro(res, error, 'listByProfessional');
  }
}

export async function listSlots(req: Request, res: Response) {
  try {
    const { data, modalidade } = req.query;
    res.json(await availabilityService.listarSlotsLivres({
      ...filtroDaQuery(req),
      data: String(data ?? ''),
      modalidade: modalidade as availabilityService.Modalidade | undefined,
    }));
  } catch (error) {
    responderErro(res, error, 'listSlots');
  }
}

export async function createAvailability(req: Request, res: Response) {
  try {
    res.status(201).json(await availabilityService.criarDisponibilidade(req.user!, req.body));
  } catch (error) {
    responderErro(res, error, 'createAvailability');
  }
}

export async function updateAvailability(req: Request, res: Response) {
  try {
    res.json(await availabilityService.atualizarDisponibilidade(req.user!, Number(req.params.id), req.body));
  } catch (error) {
    responderErro(res, error, 'updateAvailability');
  }
}

export async function deleteAvailability(req: Request, res: Response) {
  try {
    res.json(await availabilityService.removerDisponibilidade(req.user!, Number(req.params.id)));
  } catch (error) {
    responderErro(res, error, 'deleteAvailability');
  }
}
