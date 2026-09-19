import { Request, Response } from 'express';
import { clinicService, ClinicData, UpdateClinicData } from '../services/clinicService';

export class ClinicController {
  async getAllClinics(req: Request, res: Response) {
    try {
      const { specialization, atende_unimed } = req.query;
      let atendeUnimedFilter: boolean | undefined;

      if (typeof atende_unimed === 'string') {
        if (atende_unimed === 'true') atendeUnimedFilter = true;
        else if (atende_unimed === 'false') atendeUnimedFilter = false;
        else {
          res.status(400).json({ error: 'Parâmetro atende_unimed deve ser true ou false' });
          return;
        }
      }

      const filters = {
        ...(specialization ? { specialization: specialization as string } : {}),
        ...(atendeUnimedFilter !== undefined ? { atende_unimed: atendeUnimedFilter } : {}),
      };

      const clinics = await clinicService.getAllClinics(filters);
      res.json(clinics);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getClinicById(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const clinic = await clinicService.getClinicById(codigo);
      res.json(clinic);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 404;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async createClinic(req: Request, res: Response) {
    try {
      const clinicData: ClinicData = req.body;
      const clinic = await clinicService.createClinic(clinicData);
      res.status(201).json(clinic);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateClinic(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const updateData: UpdateClinicData = req.body;
      // req.user vem do authenticate; é o id da conta no Supabase Auth, usado
      // quando a atualização mexe em senha ou e-mail de login.
      const clinic = await clinicService.updateClinic(codigo, updateData, req.user?.id);
      res.json(clinic);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async deleteClinic(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const result = await clinicService.deleteClinic(codigo);
      res.json(result);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async getClinicSpecializations(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const specializations = await clinicService.getClinicSpecializations(codigo);
      res.json(specializations);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 404;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async addSpecializationToClinic(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const { codigo_especializacao } = req.body;
      const result = await clinicService.addSpecializationToClinic(codigo, codigo_especializacao);
      res.json(result);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async removeSpecializationFromClinic(req: Request, res: Response) {
    try {
      const codigo = Number(req.params.codigo);
      const especializacao = Number(req.params.especializacao);
      const result = await clinicService.removeSpecializationFromClinic(codigo, especializacao);
      res.json(result);
    } catch (error: any) {
      const statusCode = error.message.includes('Código inválido') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  }
}

export const clinicController = new ClinicController();