import { Request, Response } from 'express';
import * as upaService from '../services/upaService';
import { responderErro } from '../utils/httpError';

export async function listUnits(_req: Request, res: Response) {
  try {
    res.json(await upaService.listarUnidades());
  } catch (error) {
    responderErro(res, error, 'listUnits');
  }
}

export async function getQueue(req: Request, res: Response) {
  try {
    res.json(await upaService.obterFila(req.user, Number(req.params.unitId)));
  } catch (error) {
    responderErro(res, error, 'getQueue');
  }
}

export async function joinQueue(req: Request, res: Response) {
  try {
    res.status(201).json(await upaService.entrarNaFila(req.user!, Number(req.params.unitId), req.body?.sintomas));
  } catch (error) {
    responderErro(res, error, 'joinQueue');
  }
}

export async function callNext(req: Request, res: Response) {
  try {
    res.json(await upaService.chamarProximo(req.user!, Number(req.params.unitId), req.body?.etapa));
  } catch (error) {
    responderErro(res, error, 'callNext');
  }
}

export async function myQueue(req: Request, res: Response) {
  try {
    res.json(await upaService.minhasEntradas(req.user!));
  } catch (error) {
    responderErro(res, error, 'myQueue');
  }
}

export async function getByProtocol(req: Request, res: Response) {
  try {
    res.json(await upaService.consultarProtocolo(req.user!, String(req.params.protocol)));
  } catch (error) {
    responderErro(res, error, 'getByProtocol');
  }
}

export async function updateStatus(req: Request, res: Response) {
  try {
    res.json(await upaService.atualizarStatus(req.user!, Number(req.params.id), {
      status: req.body?.status,
      setor: req.body?.setor,
    }));
  } catch (error) {
    responderErro(res, error, 'updateStatus');
  }
}

export async function updateRisk(req: Request, res: Response) {
  try {
    res.json(await upaService.classificarRisco(req.user!, Number(req.params.id), req.body?.classificacao_risco));
  } catch (error) {
    responderErro(res, error, 'updateRisk');
  }
}
