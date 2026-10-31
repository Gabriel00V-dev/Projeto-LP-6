import { Request, Response } from 'express';
import * as telemedicineService from '../services/telemedicineService';
import { responderErro } from '../utils/httpError';

export async function listProviders(_req: Request, res: Response) {
  try {
    res.json(await telemedicineService.listarPrestadores());
  } catch (error) {
    responderErro(res, error, 'listProviders');
  }
}

// GET /telemedicine/providers/:id/availability?tipo=clinica|profissional&data=YYYY-MM-DD&especializacao=
export async function providerAvailability(req: Request, res: Response) {
  try {
    const { tipo, data, especializacao } = req.query;
    res.json(await telemedicineService.horariosDoPrestador(
      String(tipo ?? ''),
      Number(req.params.id),
      String(data ?? ''),
      especializacao ? Number(especializacao) : undefined
    ));
  } catch (error) {
    responderErro(res, error, 'providerAvailability');
  }
}

export async function createRoom(req: Request, res: Response) {
  try {
    const sala = await telemedicineService.criarSala(req.user!, Number(req.body?.codigo_consulta));
    // O link não volta aqui: cada participante recebe o seu ao entrar (/join).
    res.status(201).json({ codigo: sala.codigo, codigo_consulta: sala.codigo_consulta, criada_em: sala.criada_em });
  } catch (error) {
    responderErro(res, error, 'createRoom');
  }
}

export async function getRoom(req: Request, res: Response) {
  try {
    res.json(await telemedicineService.statusDaSala(req.user!, Number(req.params.appointmentId)));
  } catch (error) {
    responderErro(res, error, 'getRoom');
  }
}

export async function joinRoom(req: Request, res: Response) {
  try {
    res.json(await telemedicineService.entrarNaSala(req.user!, Number(req.params.appointmentId)));
  } catch (error) {
    responderErro(res, error, 'joinRoom');
  }
}

export async function finishRoom(req: Request, res: Response) {
  try {
    res.json(await telemedicineService.encerrarSala(req.user!, Number(req.params.appointmentId)));
  } catch (error) {
    responderErro(res, error, 'finishRoom');
  }
}
