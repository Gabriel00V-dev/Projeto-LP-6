import { supabase } from '../supabaseClient';
import { Appointment, AppointmentWithDetails } from '../types';
import { AuthenticatedUser } from '../middlewares/authMiddleware';
import { prestadorDoProfissional, prestadorTemAddon } from '../middlewares/checkAddon';
import { HttpError } from '../utils/httpError';
import { normalizarDataHora, validarData } from '../utils/horario';
import { encontrarSlot, Modalidade, MODALIDADES } from './availabilityService';
import { obterProfissional } from './professionalService';

const SELECT_DETALHES = `
  *,
  pacientes(nome, email, fone),
  clinicas(nome, endereco, fone),
  especializacoes(nome),
  profissionais(nome, tipo),
  animais(nome, especie)
`;

function formatar(item: any): AppointmentWithDetails {
  const { pacientes, clinicas, especializacoes, profissionais, animais, ...consulta } = item;
  return {
    ...consulta,
    paciente_nome: pacientes?.nome,
    paciente_email: pacientes?.email,
    paciente_fone: pacientes?.fone,
    clinica_nome: clinicas?.nome,
    clinica_endereco: clinicas?.endereco,
    clinica_fone: clinicas?.fone,
    especializacao_nome: especializacoes?.nome,
    profissional_nome: profissionais?.nome,
    profissional_tipo: profissionais?.tipo,
    animal_nome: animais?.nome,
    animal_especie: animais?.especie,
  } as AppointmentWithDetails;
}

// ============================================================
// Quem pode o quê
// ============================================================

type ConsultaBase = Pick<Appointment, 'codigo_paciente' | 'codigo_clinica' | 'codigo_profissional'>;

export function ehPacienteDaConsulta(user: AuthenticatedUser, consulta: ConsultaBase): boolean {
  return user.role === 'paciente' && consulta.codigo_paciente === user.entityId;
}

/** A clínica da consulta, ou o profissional que atende. */
export function ehPrestadorDaConsulta(user: AuthenticatedUser, consulta: ConsultaBase): boolean {
  if (user.role === 'clinica') return Boolean(consulta.codigo_clinica) && consulta.codigo_clinica === user.entityId;
  if (user.role === 'profissional') return Boolean(consulta.codigo_profissional) && consulta.codigo_profissional === user.entityId;
  return false;
}

export function podeVerConsulta(user: AuthenticatedUser, consulta: ConsultaBase): boolean {
  return ehPacienteDaConsulta(user, consulta) || ehPrestadorDaConsulta(user, consulta);
}

async function obterConsultaAutorizada(user: AuthenticatedUser, codigo: number) {
  const consulta = await getAppointmentById(codigo);
  if (!consulta) throw new HttpError(404, 'Consulta não encontrada');
  if (!podeVerConsulta(user, consulta)) throw new HttpError(403, 'Você não tem acesso a esta consulta.');
  return consulta;
}

// ============================================================
// Criação
// ============================================================

const TIPOS_ATENDIMENTO = ['consulta', 'vacinacao', 'castracao', 'retorno', 'orientacao_online', 'emergencia'];
// Exigem exame físico ou procedimento: só presencial (plano, 6.4).
const SOMENTE_PRESENCIAL = ['vacinacao', 'castracao', 'emergencia'];

/**
 * Agendamento pela agenda real (psicologia, veterinária, telemedicina): o
 * horário precisa existir nas disponibilidades e estar livre.
 */
async function criarPelaAgenda(dados: any) {
  const modalidade: Modalidade = dados.modalidade ?? 'presencial';
  if (!MODALIDADES.includes(modalidade)) throw new HttpError(400, 'modalidade deve ser presencial ou telemedicina.');

  const tipoAtendimento: string | null = dados.tipo_atendimento ?? null;
  if (tipoAtendimento && !TIPOS_ATENDIMENTO.includes(tipoAtendimento)) {
    throw new HttpError(400, `tipo_atendimento inválido. Use: ${TIPOS_ATENDIMENTO.join(', ')}`);
  }
  if (tipoAtendimento && SOMENTE_PRESENCIAL.includes(tipoAtendimento) && modalidade === 'telemedicina') {
    throw new HttpError(400, 'Este tipo de atendimento exige consulta presencial.');
  }
  if (tipoAtendimento === 'orientacao_online' && modalidade !== 'telemedicina') {
    throw new HttpError(400, 'Orientação online deve ser agendada como telemedicina.');
  }
  if (!dados.data_hora || !validarData(String(dados.data_hora).slice(0, 10))) {
    throw new HttpError(400, 'data_hora é obrigatória (YYYY-MM-DD HH:MM:SS).');
  }

  let codigoClinica: number | null = dados.codigo_clinica ?? null;
  let codigoEspecializacao: number | null = dados.codigo_especializacao ?? null;
  let tipoProfissional: string | null = null;

  if (dados.codigo_profissional) {
    const profissional = await obterProfissional(Number(dados.codigo_profissional));
    if (!profissional.ativo || profissional.status_cadastro !== 'aprovado') {
      throw new HttpError(400, 'Este profissional não está atendendo.');
    }

    // A consulta de um profissional vinculado pertence à clínica dele.
    codigoClinica = profissional.codigo_clinica ?? null;
    codigoEspecializacao = codigoEspecializacao ?? profissional.codigo_especializacao ?? null;
    tipoProfissional = profissional.tipo;

    if (modalidade === 'telemedicina' && !(await prestadorTemAddon(prestadorDoProfissional(profissional), 'addon_telemedicina'))) {
      throw new HttpError(403, 'Este profissional não oferece telemedicina no momento.', 'ADDON_NOT_ACTIVE');
    }
  } else if (!codigoClinica) {
    throw new HttpError(400, 'Informe codigo_profissional ou codigo_clinica.');
  } else if (modalidade === 'telemedicina' && !(await prestadorTemAddon({ tipo: 'clinica', codigo: codigoClinica }, 'addon_telemedicina'))) {
    throw new HttpError(403, 'Esta clínica não oferece telemedicina no momento.', 'ADDON_NOT_ACTIVE');
  }

  if (tipoProfissional === 'veterinario' && !dados.codigo_animal) {
    throw new HttpError(400, 'Selecione o animal para a consulta veterinária.');
  }

  if (dados.codigo_animal) {
    const { data: animal } = await supabase
      .from('animais')
      .select('codigo, codigo_paciente')
      .eq('codigo', dados.codigo_animal)
      .maybeSingle();

    if (!animal || animal.codigo_paciente !== Number(dados.codigo_paciente)) {
      throw new HttpError(400, 'Animal não encontrado no cadastro deste paciente.');
    }
  }

  const slot = await encontrarSlot(
    dados.codigo_profissional
      ? { codigo_profissional: Number(dados.codigo_profissional) }
      : { codigo_clinica: codigoClinica! },
    dados.data_hora,
    modalidade
  );

  if (!slot) {
    throw new HttpError(409, 'Este horário não está disponível. Escolha outro horário.', 'SLOT_UNAVAILABLE');
  }

  const { data, error } = await supabase
    .from('consultas')
    .insert({
      codigo_paciente: dados.codigo_paciente,
      codigo_clinica: codigoClinica,
      codigo_profissional: dados.codigo_profissional ?? null,
      codigo_especializacao: codigoEspecializacao,
      codigo_animal: dados.codigo_animal ?? null,
      data_hora: slot.data_hora,
      duracao_minutos: slot.duracao_minutos,
      modalidade,
      tipo_atendimento: tipoAtendimento,
      status: 'agendada',
      observacoes: dados.observacoes ?? null,
    })
    .select(SELECT_DETALHES)
    .single();

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Este horário acabou de ser ocupado. Escolha outro.', 'SLOT_UNAVAILABLE');
    throw new Error(error.message);
  }

  return formatar(data);
}

export async function createAppointment(user: AuthenticatedUser, appointmentData: any) {
  const dados = { ...appointmentData };

  // Paciente sempre agenda para si mesmo, independente do que veio no corpo.
  if (user.role === 'paciente') {
    dados.codigo_paciente = user.entityId;
  } else {
    // Prestador marcando para um paciente: só na própria agenda.
    if (!dados.codigo_paciente) throw new HttpError(400, 'codigo_paciente é obrigatório.');
    if (user.role === 'clinica') dados.codigo_clinica = user.entityId;
    if (user.role === 'profissional') dados.codigo_profissional = user.entityId;
  }

  // Clínica sem aprovação da prefeitura não recebe agendamento.
  if (dados.codigo_clinica) {
    const { data: clinica } = await supabase.from('clinicas').select('*').eq('codigo', dados.codigo_clinica).maybeSingle();
    if (!clinica || (clinica.status_cadastro ?? 'aprovado') !== 'aprovado') {
      throw new HttpError(400, 'Esta clínica não está disponível para agendamento.');
    }
  }

  const usaAgenda = Boolean(dados.codigo_profissional) || dados.modalidade === 'telemedicina' || dados.usar_agenda === true;
  if (usaAgenda) return criarPelaAgenda(dados);

  // Fluxo original (clínica + especialização, horários fixos de /slots/available).
  const { data, error } = await supabase
    .from('consultas')
    .insert({
      codigo_paciente: dados.codigo_paciente,
      codigo_clinica: dados.codigo_clinica,
      codigo_especializacao: dados.codigo_especializacao,
      data_hora: dados.data_hora,
      status: 'agendada',
      observacoes: dados.observacoes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Leitura
// ============================================================

export async function getAppointmentById(codigo: number): Promise<AppointmentWithDetails | null> {
  const { data, error } = await supabase
    .from('consultas')
    .select(SELECT_DETALHES)
    .eq('codigo', codigo)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return formatar(data);
}

export async function getAppointmentForUser(user: AuthenticatedUser, codigo: number) {
  return obterConsultaAutorizada(user, codigo);
}

export async function getAppointmentsByPatient(codigo_paciente: number): Promise<AppointmentWithDetails[]> {
  const { data, error } = await supabase
    .from('consultas')
    .select(SELECT_DETALHES)
    .eq('codigo_paciente', codigo_paciente)
    .order('data_hora', { ascending: true });

  if (error) throw error;
  return (data || []).map(formatar);
}

export async function getAppointmentsByClinic(codigo_clinica: number): Promise<AppointmentWithDetails[]> {
  const { data, error } = await supabase
    .from('consultas')
    .select(SELECT_DETALHES)
    .eq('codigo_clinica', codigo_clinica)
    .order('data_hora', { ascending: true });

  if (error) throw error;
  return (data || []).map(formatar);
}

export async function getAppointmentsByProfessional(codigo_profissional: number, dia?: string): Promise<AppointmentWithDetails[]> {
  let query = supabase
    .from('consultas')
    .select(SELECT_DETALHES)
    .eq('codigo_profissional', codigo_profissional)
    .order('data_hora', { ascending: true });

  if (dia) {
    if (!validarData(dia)) throw new HttpError(400, 'data deve estar no formato YYYY-MM-DD.');
    query = query.gte('data_hora', `${dia} 00:00:00`).lte('data_hora', `${dia} 23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(formatar);
}

// ============================================================
// Ciclo de vida da consulta
// ============================================================

type Acao = 'confirmar' | 'iniciar' | 'finalizar' | 'faltou' | 'cancelar';

const TRANSICOES: Record<Acao, {
  de: Appointment['status'][];
  para: Appointment['status'];
  carimbo?: 'confirmado_em' | 'iniciado_em' | 'finalizado_em';
  quem: 'prestador' | 'ambos';
}> = {
  confirmar: { de: ['agendada'], para: 'confirmada', carimbo: 'confirmado_em', quem: 'prestador' },
  iniciar:   { de: ['agendada', 'confirmada'], para: 'em_atendimento', carimbo: 'iniciado_em', quem: 'prestador' },
  finalizar: { de: ['agendada', 'confirmada', 'em_atendimento'], para: 'concluida', carimbo: 'finalizado_em', quem: 'prestador' },
  faltou:    { de: ['agendada', 'confirmada'], para: 'faltou', quem: 'prestador' },
  cancelar:  { de: ['agendada', 'confirmada'], para: 'cancelada', quem: 'ambos' },
};

const ROTULO_STATUS: Record<string, string> = {
  agendada: 'agendada',
  confirmada: 'confirmada',
  em_atendimento: 'em atendimento',
  cancelada: 'cancelada',
  concluida: 'concluída',
  faltou: 'marcada como ausência',
};

export async function transicionar(user: AuthenticatedUser, codigo: number, acao: Acao, motivo?: string) {
  const consulta = await obterConsultaAutorizada(user, codigo);
  const regra = TRANSICOES[acao];

  if (regra.quem === 'prestador' && !ehPrestadorDaConsulta(user, consulta)) {
    throw new HttpError(403, 'Apenas o prestador da consulta pode fazer isso.');
  }
  if (!regra.de.includes(consulta.status)) {
    throw new HttpError(409, `Não é possível ${acao} uma consulta ${ROTULO_STATUS[consulta.status] ?? consulta.status}.`);
  }

  const agora = new Date().toISOString();
  const update: Record<string, unknown> = { status: regra.para, atualizado_em: agora };
  if (regra.carimbo) update[regra.carimbo] = agora;
  if (acao === 'cancelar') update.motivo_cancelamento = motivo || (user.role === 'paciente' ? 'Cancelada pelo paciente' : 'Cancelada pelo prestador');

  const { data, error } = await supabase
    .from('consultas')
    .update(update)
    .eq('codigo', codigo)
    .select(SELECT_DETALHES)
    .single();

  if (error) throw new Error(error.message);

  // Consulta encerrada ou cancelada fecha a sala online, se houver.
  if (['finalizar', 'cancelar', 'faltou'].includes(acao)) {
    await supabase
      .from('salas_telemedicina')
      .update({ encerrada_em: agora })
      .eq('codigo_consulta', codigo)
      .is('encerrada_em', null);
  }

  return formatar(data);
}

const ACAO_POR_STATUS: Partial<Record<Appointment['status'], Acao>> = {
  confirmada: 'confirmar',
  em_atendimento: 'iniciar',
  concluida: 'finalizar',
  faltou: 'faltou',
  cancelada: 'cancelar',
};

/** PATCH /:codigo/status (rota antiga): traduz o status pedido para a transição equivalente. */
export async function updateAppointmentStatus(user: AuthenticatedUser, codigo: number, status: Appointment['status']) {
  const acao = ACAO_POR_STATUS[status];
  if (!acao) throw new HttpError(400, 'Status inválido');
  return transicionar(user, codigo, acao);
}

export async function updateAppointment(user: AuthenticatedUser, codigo: number, updates: Partial<Appointment>) {
  await obterConsultaAutorizada(user, codigo);

  // Horário e status têm validação própria (agenda e transições); por aqui
  // só passam as observações.
  const { data, error } = await supabase
    .from('consultas')
    .update({ observacoes: updates.observacoes ?? null, atualizado_em: new Date().toISOString() })
    .eq('codigo', codigo)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAppointment(user: AuthenticatedUser, codigo: number) {
  const consulta = await obterConsultaAutorizada(user, codigo);
  if (!ehPrestadorDaConsulta(user, consulta)) {
    throw new HttpError(403, 'Paciente não exclui consultas; use o cancelamento.');
  }

  const { error } = await supabase
    .from('consultas')
    .delete()
    .eq('codigo', codigo);

  if (error) throw error;
  return { message: 'Consulta excluída com sucesso' };
}

// ============================================================
// Evoluções (prontuário)
// ============================================================

export async function listarEvolucoes(user: AuthenticatedUser, codigoConsulta: number) {
  await obterConsultaAutorizada(user, codigoConsulta);

  const { data, error } = await supabase
    .from('evolucoes')
    .select('codigo, codigo_consulta, autor_papel, texto, criado_em')
    .eq('codigo_consulta', codigoConsulta)
    .order('criado_em', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function registrarEvolucao(user: AuthenticatedUser, codigoConsulta: number, texto: string) {
  const consulta = await obterConsultaAutorizada(user, codigoConsulta);

  if (!ehPrestadorDaConsulta(user, consulta)) {
    throw new HttpError(403, 'Apenas o prestador da consulta registra evolução.');
  }
  if (!texto || !texto.trim()) throw new HttpError(400, 'O texto da evolução é obrigatório.');
  if (consulta.status === 'cancelada') throw new HttpError(409, 'Consulta cancelada não recebe evolução.');

  const { data, error } = await supabase
    .from('evolucoes')
    .insert({
      codigo_consulta: codigoConsulta,
      autor_papel: user.role,
      autor_codigo: user.entityId,
      texto: texto.trim(),
    })
    .select('codigo, codigo_consulta, autor_papel, texto, criado_em')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================================
// Horários fixos do fluxo original de clínicas
// ============================================================

export async function getAvailableSlots(codigo_clinica: number, data: string) {
  // Busca todas as consultas da clínica para aquela data
  const { data: appointments, error } = await supabase
    .from('consultas')
    .select('data_hora')
    .eq('codigo_clinica', codigo_clinica)
    .gte('data_hora', `${data} 00:00:00`)
    .lte('data_hora', `${data} 23:59:59`)
    .neq('status', 'cancelada');

  if (error) throw error;

  // Gera horários disponíveis (08:00 - 18:00, de hora em hora)
  const allSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    allSlots.push(`${data} ${hour.toString().padStart(2, '0')}:00:00`);
  }

  // Remove horários já agendados. O Postgres devolve "YYYY-MM-DDTHH:MM:SS",
  // então normaliza antes de comparar com os slots gerados acima.
  const bookedSlots = (appointments || []).map((apt: any) => normalizarDataHora(apt.data_hora));
  const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

  return availableSlots;
}
