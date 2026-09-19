import { supabase } from '../supabaseClient';
import { semSenha } from '../utils/sanitize';

function isMissingAtendeUnimedColumnError(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return text.includes('atende_unimed') && (text.includes('column') || text.includes('schema cache'));
}

function isMissingUnimedColumnError(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return text.includes('unimed') && (text.includes('column') || text.includes('schema cache'));
}

function normalizeClinic(row: any) {
  if (!row) return row;
  const atendeUnimed =
    typeof row.atende_unimed === 'boolean'
      ? row.atende_unimed
      : typeof row.unimed === 'boolean'
        ? row.unimed
        : typeof row.trabalha_com_horario === 'boolean'
          ? row.trabalha_com_horario
        : false;

  // Todo caminho de leitura e escrita de clínica passa por aqui, então é o
  // lugar certo para garantir que a senha nunca saia na resposta.
  return semSenha({
    ...row,
    atende_unimed: atendeUnimed,
  });
}

export interface ClinicData {
  nome: string;
  endereco?: string;
  fone?: string;
  email: string;
  senha?: string;
  imagem?: string;
  atende_unimed?: boolean;
}

export interface UpdateClinicData {
  nome?: string;
  endereco?: string;
  fone?: string;
  email?: string;
  senha?: string;
  imagem?: string;
  atende_unimed?: boolean;
}

export class ClinicService {
  async getAllClinics(filters?: { specialization?: string; atende_unimed?: boolean }) {
    try {
      if (filters?.specialization) {
        // Query clinics with specific specialization
        let query = supabase
          .from('clinicas')
          .select(`
            *,
            clinicas_especializacoes!inner(
              especializacao:especializacoes!inner(
                nome
              )
            )
          `)
          .eq('clinicas_especializacoes.especializacao.nome', filters.specialization);

        if (filters.atende_unimed !== undefined) {
          query = query.eq('atende_unimed', filters.atende_unimed);
        }

        let { data, error } = await query;

        if (error && filters.atende_unimed !== undefined && isMissingAtendeUnimedColumnError(error.message)) {
          const fallbackQuery = supabase
            .from('clinicas')
            .select(`
              *,
              clinicas_especializacoes!inner(
                especializacao:especializacoes!inner(
                  nome
                )
              )
            `)
            .eq('clinicas_especializacoes.especializacao.nome', filters.specialization)
            .eq('unimed', filters.atende_unimed);

          const fallbackResult = await fallbackQuery;
          data = fallbackResult.data;
          error = fallbackResult.error;

          if (error && isMissingUnimedColumnError(error.message)) {
            const secondFallbackQuery = supabase
              .from('clinicas')
              .select(`
                *,
                clinicas_especializacoes!inner(
                  especializacao:especializacoes!inner(
                    nome
                  )
                )
              `)
              .eq('clinicas_especializacoes.especializacao.nome', filters.specialization)
              .eq('trabalha_com_horario', filters.atende_unimed);

            const secondFallbackResult = await secondFallbackQuery;
            data = secondFallbackResult.data;
            error = secondFallbackResult.error;
          }
        }

        if (error) {
          throw new Error(error.message);
        }

        // Transform data to include specializations array
        const transformedData = data?.map(clinic => ({
          ...normalizeClinic(clinic),
          especializacoes: clinic.clinicas_especializacoes?.map((ce: any) => ce.especializacao?.nome).filter(Boolean) || []
        }));

        return transformedData || [];
      } else {
        // Query all clinics with their specializations
        let query = supabase
          .from('clinicas')
          .select(`
            *,
            clinicas_especializacoes(
              especializacao:especializacoes(
                nome
              )
            )
          `);

        if (filters?.atende_unimed !== undefined) {
          query = query.eq('atende_unimed', filters.atende_unimed);
        }

        let { data, error } = await query;

        if (error && filters?.atende_unimed !== undefined && isMissingAtendeUnimedColumnError(error.message)) {
          const fallbackQuery = supabase
            .from('clinicas')
            .select(`
              *,
              clinicas_especializacoes(
                especializacao:especializacoes(
                  nome
                )
              )
            `)
            .eq('unimed', filters.atende_unimed);

          const fallbackResult = await fallbackQuery;
          data = fallbackResult.data;
          error = fallbackResult.error;

          if (error && isMissingUnimedColumnError(error.message)) {
            const secondFallbackQuery = supabase
              .from('clinicas')
              .select(`
                *,
                clinicas_especializacoes(
                  especializacao:especializacoes(
                    nome
                  )
                )
              `)
              .eq('trabalha_com_horario', filters.atende_unimed);

            const secondFallbackResult = await secondFallbackQuery;
            data = secondFallbackResult.data;
            error = secondFallbackResult.error;
          }
        }

        if (error) {
          throw new Error(error.message);
        }

        // Transform data to include specializations array
        const transformedData = data?.map(clinic => ({
          ...normalizeClinic(clinic),
          especializacoes: clinic.clinicas_especializacoes?.map((ce: any) => ce.especializacao?.nome).filter(Boolean) || []
        }));

        return transformedData || [];
      }
    } catch (error) {
      console.error('Error fetching clinics:', error);
      throw error;
    }
  }

  async getClinicById(codigo: number) {
    if (Number.isNaN(codigo)) {
      throw new Error('Código inválido');
    }

    try {
      const { data, error } = await supabase
        .from('clinicas')
        .select(`
          *,
          clinicas_especializacoes(
            especializacao:especializacoes(
              nome
            )
          )
        `)
        .eq('codigo', codigo)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error('Clinic not found');
      }

      // Transform data to include specializations array
      const transformedData = {
        ...normalizeClinic(data),
        especializacoes: data.clinicas_especializacoes?.map((ce: any) => ce.especializacao?.nome).filter(Boolean) || []
      };

      return transformedData;
    } catch (error) {
      console.error('Error fetching clinic by id:', error);
      throw error;
    }
  }

  async createClinic(clinicData: ClinicData) {
    const { nome, endereco, fone, email, senha, imagem, atende_unimed } = clinicData;

    if (!nome || !email || !senha) {
      throw new Error('Dados incompletos: nome, email e senha são obrigatórios');
    }

    const payload = {
      nome,
      endereco,
      fone,
      email,
      senha,
      imagem,
      atende_unimed: atende_unimed ?? false,
    };

    let { data, error } = await supabase
      .from('clinicas')
      .insert(payload)
      .select()
      .single();

    if (error && isMissingAtendeUnimedColumnError(error.message)) {
      const { atende_unimed, ...legacyPayload } = payload;
      const fallbackPayload = {
        ...legacyPayload,
        unimed: atende_unimed,
      };

      const fallbackResult = await supabase
        .from('clinicas')
        .insert(fallbackPayload)
        .select()
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;

      if (error && isMissingUnimedColumnError(error.message)) {
        const secondFallbackPayload = {
          ...legacyPayload,
          trabalha_com_horario: atende_unimed,
        };

        const secondFallbackResult = await supabase
          .from('clinicas')
          .insert(secondFallbackPayload)
          .select()
          .single();

        data = secondFallbackResult.data;
        error = secondFallbackResult.error;
      }
    }

    if (error) {
      throw new Error(error.message);
    }

    return normalizeClinic(data);
  }

  async updateClinic(codigo: number, updateData: UpdateClinicData) {
    if (Number.isNaN(codigo)) {
      throw new Error('Código inválido');
    }

    const { nome, endereco, fone, email, senha, imagem, atende_unimed } = updateData;
    const update: any = {};

    if (nome !== undefined) update.nome = nome;
    if (endereco !== undefined) update.endereco = endereco;
    if (fone !== undefined) update.fone = fone;
    if (email !== undefined) update.email = email;
    if (senha !== undefined) update.senha = senha;
    if (imagem !== undefined) update.imagem = imagem;
    if (atende_unimed !== undefined) update.atende_unimed = atende_unimed;

    let { data, error } = await supabase
      .from('clinicas')
      .update(update)
      .eq('codigo', codigo)
      .select()
      .single();

    if (error && update.atende_unimed !== undefined && isMissingAtendeUnimedColumnError(error.message)) {
      const { atende_unimed: atendeUnimed, ...legacyUpdate } = update;
      const fallbackUpdate = {
        ...legacyUpdate,
        unimed: atendeUnimed,
      };

      const fallbackResult = await supabase
        .from('clinicas')
        .update(fallbackUpdate)
        .eq('codigo', codigo)
        .select()
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;

      if (error && isMissingUnimedColumnError(error.message)) {
        const secondFallbackUpdate = {
          ...legacyUpdate,
          trabalha_com_horario: atendeUnimed,
        };

        const secondFallbackResult = await supabase
          .from('clinicas')
          .update(secondFallbackUpdate)
          .eq('codigo', codigo)
          .select()
          .single();

        data = secondFallbackResult.data;
        error = secondFallbackResult.error;
      }
    }

    if (error) {
      throw new Error(error.message);
    }

    return normalizeClinic(data);
  }

  async deleteClinic(codigo: number) {
    if (Number.isNaN(codigo)) {
      throw new Error('Código inválido');
    }

    const { error } = await supabase
      .from('clinicas')
      .delete()
      .eq('codigo', codigo);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  async getClinicSpecializations(clinicId: number) {
    try {
      const { data, error } = await supabase
        .from('clinicas_especializacoes')
        .select(`
          codigo_especializacao,
          especializacoes!inner (
            codigo,
            nome
          )
        `)
        .eq('codigo_clinica', clinicId);

      if (error) {
        throw new Error(error.message);
      }

      console.log('Raw data from Supabase:', JSON.stringify(data, null, 2));

      // Retornar as especializações com código e nome
      const result = data?.map((item: any) => {
        // especializacoes pode ser um objeto ou array dependendo do Supabase
        const espec = Array.isArray(item.especializacoes) ? item.especializacoes[0] : item.especializacoes;
        
        return {
          codigo: espec?.codigo || item.codigo_especializacao,
          nome: espec?.nome || 'Especialização sem nome'
        };
      }).filter(spec => spec.codigo) || [];
      
      console.log('Processed specializations:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Error fetching clinic specializations:', error);
      throw error;
    }
  }

  async addSpecializationToClinic(clinicId: number, specializationId: number) {
    try {
      const { error } = await supabase
        .from('clinicas_especializacoes')
        .insert({
          codigo_clinica: clinicId,
          codigo_especializacao: specializationId
        });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding specialization to clinic:', error);
      throw error;
    }
  }

  async removeSpecializationFromClinic(clinicId: number, specializationId: number) {
    try {
      const { error } = await supabase
        .from('clinicas_especializacoes')
        .delete()
        .eq('codigo_clinica', clinicId)
        .eq('codigo_especializacao', specializationId);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing specialization from clinic:', error);
      throw error;
    }
  }
}

export const clinicService = new ClinicService();