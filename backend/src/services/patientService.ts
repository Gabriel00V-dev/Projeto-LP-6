import { supabase } from '../supabaseClient';
import { semSenha, semSenhaLista } from '../utils/sanitize';

export interface PatientData {
  nome: string;
  datan?: string;
  fone?: string;
  ende?: string;
  email: string;
  senha: string;
}

export interface UpdatePatientData {
  nome?: string;
  datan?: string;
  fone?: string;
  ende?: string;
  email?: string;
  senha?: string;
}

export class PatientService {
  async getAllPatients() {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    return semSenhaLista(data);
  }

  async getPatientById(codigo: number) {
    if (Number.isNaN(codigo)) {
      throw new Error('Código inválido');
    }

    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('codigo', codigo)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return semSenha(data);
  }

  async createPatient(patientData: PatientData) {
    const { nome, datan, fone, ende, email, senha } = patientData;

    if (!nome || !email || !senha) {
      throw new Error('Dados incompletos: nome, email e senha são obrigatórios');
    }

    const payload = { nome, datan, fone, ende, email, senha };

    const { data, error } = await supabase
      .from('pacientes')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return semSenha(data);
  }

  async updatePatient(codigo: number, updateData: UpdatePatientData) {
    if (Number.isNaN(codigo)) {
      throw new Error('Código inválido');
    }

    const { nome, datan, fone, ende, email, senha } = updateData;
    const update: any = {};

    if (nome !== undefined) update.nome = nome;
    if (datan !== undefined) update.datan = datan;
    if (fone !== undefined) update.fone = fone;
    if (ende !== undefined) update.ende = ende;
    if (email !== undefined) update.email = email;
    if (senha !== undefined) update.senha = senha;

    const { data, error } = await supabase
      .from('pacientes')
      .update(update)
      .eq('codigo', codigo)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return semSenha(data);
  }

  async deletePatient(codigo: number) {
    if (Number.isNaN(codigo)) {
      throw new Error('Código inválido');
    }

    const { error } = await supabase
      .from('pacientes')
      .delete()
      .eq('codigo', codigo);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }
}

export const patientService = new PatientService();