import { Request, Response } from 'express';
import * as approvalService from '../services/approvalService';
import { responderErro } from '../utils/httpError';

export async function list(req: Request, res: Response) {
  try {
    res.json(await approvalService.listar({
      status: req.query.status as string | undefined,
      tipo: req.query.tipo as string | undefined,
    }));
  } catch (error) {
    responderErro(res, error, 'approvals:list');
  }
}

export async function decide(req: Request, res: Response) {
  try {
    res.json(await approvalService.decidir(
      req.user!,
      String(req.params.tipo),
      Number(req.params.codigo),
      req.body?.decisao,
      req.body?.motivo
    ));
  } catch (error) {
    responderErro(res, error, 'approvals:decide');
  }
}

export async function mine(req: Request, res: Response) {
  try {
    res.json(await approvalService.meuCadastro(req.user!));
  } catch (error) {
    responderErro(res, error, 'approvals:mine');
  }
}

export async function resubmit(req: Request, res: Response) {
  try {
    res.json(await approvalService.reenviar(req.user!, req.body));
  } catch (error) {
    responderErro(res, error, 'approvals:resubmit');
  }
}
