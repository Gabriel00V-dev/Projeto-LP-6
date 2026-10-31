import { Request, Response } from 'express';
import * as appointmentService from '../services/appointmentService';
import { obterProfissional } from '../services/professionalService';
import { responderErro } from '../utils/httpError';

export async function createAppointment(req: Request, res: Response) {
  try {
    const newAppointment = await appointmentService.createAppointment(req.user!, req.body);
    res.status(201).json(newAppointment);
  } catch (error: any) {
    responderErro(res, error, 'createAppointment');
  }
}

export async function getAppointmentById(req: Request, res: Response) {
  try {
    const appointment = await appointmentService.getAppointmentForUser(req.user!, Number(req.params.codigo));
    res.json(appointment);
  } catch (error: any) {
    responderErro(res, error, 'getAppointmentById');
  }
}

export async function getAppointmentsByPatient(req: Request, res: Response) {
  try {
    const codigo_paciente = Number(req.params.codigo_paciente);

    // Histórico de saúde: só o próprio paciente.
    if (req.user!.role !== 'paciente' || req.user!.entityId !== codigo_paciente) {
      return res.status(403).json({ error: 'Você só pode ver as suas consultas.' });
    }

    const appointments = await appointmentService.getAppointmentsByPatient(codigo_paciente);
    res.json(appointments);
  } catch (error: any) {
    responderErro(res, error, 'getAppointmentsByPatient');
  }
}

export async function getAppointmentsByClinic(req: Request, res: Response) {
  try {
    const codigo_clinica = Number(req.params.codigo_clinica);

    if (req.user!.role !== 'clinica' || req.user!.entityId !== codigo_clinica) {
      return res.status(403).json({ error: 'Você só pode ver as consultas da sua clínica.' });
    }

    const appointments = await appointmentService.getAppointmentsByClinic(codigo_clinica);
    res.json(appointments);
  } catch (error: any) {
    responderErro(res, error, 'getAppointmentsByClinic');
  }
}

export async function getAppointmentsByProfessional(req: Request, res: Response) {
  try {
    const codigo_profissional = Number(req.params.codigo_profissional);
    const user = req.user!;

    let autorizado = user.role === 'profissional' && user.entityId === codigo_profissional;

    if (!autorizado && user.role === 'clinica') {
      const profissional = await obterProfissional(codigo_profissional);
      autorizado = profissional.codigo_clinica === user.entityId;
    }

    if (!autorizado) {
      return res.status(403).json({ error: 'Você não tem acesso à agenda deste profissional.' });
    }

    const dia = typeof req.query.data === 'string' ? req.query.data : undefined;
    const appointments = await appointmentService.getAppointmentsByProfessional(codigo_profissional, dia);
    res.json(appointments);
  } catch (error: any) {
    responderErro(res, error, 'getAppointmentsByProfessional');
  }
}

export async function updateAppointmentStatus(req: Request, res: Response) {
  try {
    const { codigo } = req.params;
    const { status } = req.body;

    if (!status || !['confirmada', 'em_atendimento', 'cancelada', 'concluida', 'faltou'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const updatedAppointment = await appointmentService.updateAppointmentStatus(req.user!, Number(codigo), status);
    res.json(updatedAppointment);
  } catch (error: any) {
    responderErro(res, error, 'updateAppointmentStatus');
  }
}

/** PATCH /:codigo/confirm | start | finish | no-show | cancel */
export function transition(acao: 'confirmar' | 'iniciar' | 'finalizar' | 'faltou' | 'cancelar') {
  return async (req: Request, res: Response) => {
    try {
      const consulta = await appointmentService.transicionar(
        req.user!,
        Number(req.params.codigo),
        acao,
        typeof req.body?.motivo === 'string' ? req.body.motivo : undefined
      );
      res.json(consulta);
    } catch (error: any) {
      responderErro(res, error, `appointment:${acao}`);
    }
  };
}

export async function updateAppointment(req: Request, res: Response) {
  try {
    const updatedAppointment = await appointmentService.updateAppointment(req.user!, Number(req.params.codigo), req.body);
    res.json(updatedAppointment);
  } catch (error: any) {
    responderErro(res, error, 'updateAppointment');
  }
}

export async function deleteAppointment(req: Request, res: Response) {
  try {
    const result = await appointmentService.deleteAppointment(req.user!, Number(req.params.codigo));
    res.json(result);
  } catch (error: any) {
    responderErro(res, error, 'deleteAppointment');
  }
}

export async function getNotes(req: Request, res: Response) {
  try {
    const notas = await appointmentService.listarEvolucoes(req.user!, Number(req.params.codigo));
    res.json(notas);
  } catch (error: any) {
    responderErro(res, error, 'getNotes');
  }
}

export async function addNote(req: Request, res: Response) {
  try {
    const nota = await appointmentService.registrarEvolucao(req.user!, Number(req.params.codigo), req.body?.texto);
    res.status(201).json(nota);
  } catch (error: any) {
    responderErro(res, error, 'addNote');
  }
}

export async function getAvailableSlots(req: Request, res: Response) {
  try {
    const { codigo_clinica, data } = req.query;

    if (!codigo_clinica || !data) {
      return res.status(400).json({ error: 'codigo_clinica e data são obrigatórios' });
    }

    const slots = await appointmentService.getAvailableSlots(Number(codigo_clinica), data as string);
    res.json(slots);
  } catch (error: any) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: error.message });
  }
}
