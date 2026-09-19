import { Request, Response } from 'express';
import { patientService, PatientData, UpdatePatientData } from '../services/patientService';

export class PatientController {
  async getAllPatients(req: Request, res: Response) {
    try {
      const patients = await patientService.getAllPatients();
      res.json(patients);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getPatientById(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const patient = await patientService.getPatientById(codigo);
      res.json(patient);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 404;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async createPatient(req: Request, res: Response) {
    try {
      const patientData: PatientData = req.body;
      const patient = await patientService.createPatient(patientData);
      res.status(201).json(patient);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updatePatient(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const updateData: UpdatePatientData = req.body;
      // req.user vem do authenticate; é o id da conta no Supabase Auth, usado
      // quando a atualização mexe em senha ou e-mail de login.
      const patient = await patientService.updatePatient(codigo, updateData, req.user?.id);
      res.json(patient);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async deletePatient(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const result = await patientService.deletePatient(codigo);
      res.json(result);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  }
}

export const patientController = new PatientController();