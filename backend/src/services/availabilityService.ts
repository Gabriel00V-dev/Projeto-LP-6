import { supabase } from '../supabaseClient';
import { AuthenticatedUser } from '../middlewares/authMiddleware';
import { Prestador, prestadorDoProfissional, prestadorTemAddon } from '../middlewares/checkAddon';
import { HttpError } from '../utils/httpError';
import {
  agoraLocal,
  diaDaSemana,
  hojeLocal,
  horaParaMinutos,
  minutosParaHora,
  normalizarDataHora,
  paraMs,
  validarData,
} from '../utils/horario';

export type Modalidade = 'presencial' | 'telemedicina';
export const MODALIDADES: Modalidade[] = ['presencial', 'telemedicina'];

export interface Slot {
  data_hora: string; // "YYYY-MM-DD HH:MM:00", mesmo formato de consultas.data_hora
  hora: string;      // "HH:MM"
  modalidade: Modalidade;
  duracao_minutos: number;
  codigo_disponibilidade: number;
  codigo_profissional: number | null;
  codigo_clinica: number | null;
  profissional_nome: string | null;
}

const SELECT_DISPONIBILIDADE = `
  codigo, codigo_profissional, codigo_clinica, dia_semana, hora_inicio, hora_fim,
  duracao_minutos, modalidade, ativo,
  profissionais(nome, ativo, codigo_clinica, status_cadastro),
  clinicas!codigo_clinica(status_cadastro)
`;

function formatar(row: any) {
  const { profissionais, clinicas, ...disponibilidade } = row;
  return {
    ...disponibilidade,
    hora_inicio: String(row.hora_inicio).slice(0, 5),
    hora_fim: String(row.hora_fim).slice(0, 5),
    profissional_nome: profissionais?.nome ?? null,
  };
}

function prestadorDaDisponibilidade(row: any): Prestador {
  if (row.codigo_profissional) {
    return prestadorDoProfissional({
      codigo: row.codigo_profissional,
      codigo_clinica: row.profissionais?.codigo_clinica ?? row.codigo_clinica,
    });
  }
  return { tipo: 'clinica', codigo: row.codigo_clinica };
}

// ============================================================
// Leitura da agenda semanal
// ============================================================

export interface FiltroAgenda {
  codigo_profissional?: number;
  codigo_clinica?: number;
}

export async function listarDisponibilidades(filtro: FiltroAgenda) {
  if (!filtro.codigo_profissional && !filtro.codigo_clinica) {
    throw new HttpError(400, 'Informe codigo_profissional ou codigo_clinica.');
  }

  let query = supabase
    .from('disponibilidades')
    .select(SELECT_DISPONIBILIDADE)
    .eq('ativo', true)
    .order('dia_semana')
    .order('hora_inicio');

  if (filtro.codigo_profissional) query = query.eq('codigo_profissional', filtro.codigo_profissional);
  else if (filtro.codigo_clinica) query = query.eq('codigo_clinica', filtro.codigo_clinica);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(formatar);
}

// ============================================================
// Escrita (prestador configura os próprios horários)
// ============================================================

async function obterDisponibilidade(codigo: number) {
  const { data, error } = await supabase
    .from('disponibilidades')
    .select(SELECT_DISPONIBILIDADE)
    .eq('codigo', codigo)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, 'Horário não encontrado.');
  return data as any;
}

/**
 * Decide de quem é a agenda a partir de quem está logado:
 * - profissional: sempre a própria (e herda a clínica, se vinculado);
 * - clínica: a de um profissional dela, ou a agenda geral da clínica.
 */
async function resolverDono(user: AuthenticatedUser, codigoProfissionalInformado?: number | null) {
  if (user.role === 'profissional') {
    return { codigo_profissional: user.entityId, codigo_clinica: user.codigoClinica ?? null };
  }

  if (user.role === 'clinica') {
    if (!codigoProfissionalInformado) {
      return { codigo_profissional: null, codigo_clinica: user.entityId };
    }

    const { data: profissional } = await supabase
      .from('profissionais')
      .select('codigo, codigo_clinica, status_cadastro')
      .eq('codigo', codigoProfissionalInformado)
      .maybeSingle();

    if (!profissional || profissional.codigo_clinica !== user.entityId) {
      throw new HttpError(403, 'Este profissional não pertence à sua clínica.');
    }
    if (profissional.status_cadastro !== 'aprovado') {
      throw new HttpError(409, 'Este profissional ainda não foi aprovado pela prefeitura.', 'CADASTRO_PENDENTE');
    }
    return { codigo_profissional: profissional.codigo, codigo_clinica: user.entityId };
  }

  throw new HttpError(403, 'Apenas clínicas e profissionais configuram horários.');
}

function podeGerenciar(user: AuthenticatedUser, row: any): boolean {
  if (user.role === 'profissional') return row.codigo_profissional === user.entityId;
  if (user.role === 'clinica') return row.codigo_clinica === user.entityId;
  return false;
}

function validarCampos(dados: any) {
  const { dia_semana, hora_inicio, hora_fim, modalidade } = dados;
  const duracao = Number(dados.duracao_minutos ?? 60);

  if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    throw new HttpError(400, 'dia_semana deve ser um inteiro de 0 (domingo) a 6 (sábado).');
  }
  if (!/^\d{2}:\d{2}$/.test(hora_inicio ?? '') || !/^\d{2}:\d{2}$/.test(hora_fim ?? '')) {
    throw new HttpError(400, 'hora_inicio e hora_fim devem estar no formato HH:MM.');
  }
  if (horaParaMinutos(hora_fim) <= horaParaMinutos(hora_inicio)) {
    throw new HttpError(400, 'hora_fim deve ser depois de hora_inicio.');
  }
  if (!MODALIDADES.includes(modalidade)) {
    throw new HttpError(400, 'modalidade deve ser presencial ou telemedicina.');
  }
  if (!Number.isInteger(duracao) || duracao < 10 || duracao > 240) {
    throw new HttpError(400, 'duracao_minutos deve estar entre 10 e 240.');
  }
  if (horaParaMinutos(hora_fim) - horaParaMinutos(hora_inicio) < duracao) {
    throw new HttpError(400, 'O intervalo é menor que a duração de uma consulta.');
  }

  return { dia_semana, hora_inicio, hora_fim, modalidade: modalidade as Modalidade, duracao_minutos: duracao };
}

async function garantirSemSobreposicao(
  dono: { codigo_profissional: number | null; codigo_clinica: number | null },
  campos: { dia_semana: number; hora_inicio: string; hora_fim: string },
  ignorarCodigo?: number
) {
  let query = supabase
    .from('disponibilidades')
    .select('codigo, hora_inicio, hora_fim, modalidade')
    .eq('ativo', true)
    .eq('dia_semana', campos.dia_semana);

  query = dono.codigo_profissional
    ? query.eq('codigo_profissional', dono.codigo_profissional)
    : query.eq('codigo_clinica', dono.codigo_clinica!).is('codigo_profissional', null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const inicio = horaParaMinutos(campos.hora_inicio);
  const fim = horaParaMinutos(campos.hora_fim);

  // Presencial e online também não podem se sobrepor: é a mesma pessoa atendendo.
  const conflito = (data ?? []).find((row: any) =>
    row.codigo !== ignorarCodigo &&
    inicio < horaParaMinutos(row.hora_fim) &&
    horaParaMinutos(row.hora_inicio) < fim
  );

  if (conflito) {
    throw new HttpError(
      409,
      `Conflita com o horário ${String(conflito.hora_inicio).slice(0, 5)}–${String(conflito.hora_fim).slice(0, 5)} (${conflito.modalidade}).`
    );
  }
}

async function exigirTelemedicinaSeOnline(dono: { codigo_profissional: number | null; codigo_clinica: number | null }, modalidade: Modalidade) {
  if (modalidade !== 'telemedicina') return;

  const prestador: Prestador = dono.codigo_profissional
    ? prestadorDoProfissional({ codigo: dono.codigo_profissional, codigo_clinica: dono.codigo_clinica })
    : { tipo: 'clinica', codigo: dono.codigo_clinica! };

  if (!(await prestadorTemAddon(prestador, 'addon_telemedicina'))) {
    throw new HttpError(403, 'Horários online exigem o add-on de telemedicina ativo.', 'ADDON_NOT_ACTIVE');
  }
}

export async function criarDisponibilidade(user: AuthenticatedUser, dados: any) {
  const campos = validarCampos(dados ?? {});
  const dono = await resolverDono(user, dados?.codigo_profissional);

  await exigirTelemedicinaSeOnline(dono, campos.modalidade);
  await garantirSemSobreposicao(dono, campos);

  const { data, error } = await supabase
    .from('disponibilidades')
    .insert({ ...dono, ...campos, ativo: true })
    .select(SELECT_DISPONIBILIDADE)
    .single();

  if (error) throw new Error(error.message);
  return formatar(data);
}

export async function atualizarDisponibilidade(user: AuthenticatedUser, codigo: number, dados: any) {
  const atual = await obterDisponibilidade(codigo);
  if (!podeGerenciar(user, atual)) throw new HttpError(403, 'Você não pode alterar este horário.');

  const campos = validarCampos({
    dia_semana: dados?.dia_semana ?? atual.dia_semana,
    hora_inicio: dados?.hora_inicio ?? String(atual.hora_inicio).slice(0, 5),
    hora_fim: dados?.hora_fim ?? String(atual.hora_fim).slice(0, 5),
    modalidade: dados?.modalidade ?? atual.modalidade,
    duracao_minutos: dados?.duracao_minutos ?? atual.duracao_minutos,
  });
  const dono = { codigo_profissional: atual.codigo_profissional, codigo_clinica: atual.codigo_clinica };

  await exigirTelemedicinaSeOnline(dono, campos.modalidade);
  await garantirSemSobreposicao(dono, campos, codigo);

  const { data, error } = await supabase
    .from('disponibilidades')
    .update({ ...campos, ...(typeof dados?.ativo === 'boolean' ? { ativo: dados.ativo } : {}) })
    .eq('codigo', codigo)
    .select(SELECT_DISPONIBILIDADE)
    .single();

  if (error) throw new Error(error.message);
  return formatar(data);
}

export async function removerDisponibilidade(user: AuthenticatedUser, codigo: number) {
  const atual = await obterDisponibilidade(codigo);
  if (!podeGerenciar(user, atual)) throw new HttpError(403, 'Você não pode remover este horário.');

  // Desativa em vez de apagar: consultas já marcadas continuam válidas.
  const { error } = await supabase.from('disponibilidades').update({ ativo: false }).eq('codigo', codigo);
  if (error) throw new Error(error.message);
  return { message: 'Horário removido.' };
}

// ============================================================
// Horários livres de um dia
// ============================================================

export interface FiltroSlots extends FiltroAgenda {
  data: string;
  modalidade?: Modalidade;
}

/**
 * Gera os horários livres de um dia a partir da agenda semanal, tirando os
 * que já têm consulta e os que já passaram. Com codigo_clinica (sem
 * profissional), traz a agenda geral da clínica e a de todos os profissionais
 * vinculados, cada slot com o profissional correspondente.
 */
export async function listarSlotsLivres(filtro: FiltroSlots): Promise<Slot[]> {
  if (!validarData(filtro.data)) throw new HttpError(400, 'data deve estar no formato YYYY-MM-DD.');
  if (filtro.modalidade && !MODALIDADES.includes(filtro.modalidade)) {
    throw new HttpError(400, 'modalidade deve ser presencial ou telemedicina.');
  }
  if (!filtro.codigo_profissional && !filtro.codigo_clinica) {
    throw new HttpError(400, 'Informe codigo_profissional ou codigo_clinica.');
  }
  if (filtro.data < hojeLocal()) return [];

  let query = supabase
    .from('disponibilidades')
    .select(SELECT_DISPONIBILIDADE)
    .eq('ativo', true)
    .eq('dia_semana', diaDaSemana(filtro.data));

  if (filtro.codigo_profissional) query = query.eq('codigo_profissional', filtro.codigo_profissional);
  else query = query.eq('codigo_clinica', filtro.codigo_clinica!);
  if (filtro.modalidade) query = query.eq('modalidade', filtro.modalidade);

  const { data: linhas, error } = await query;
  if (error) throw new Error(error.message);

  // Profissional desativado, ou clínica/profissional sem aprovação da
  // prefeitura (ex.: reprovado depois de aprovado), não recebe agendamento.
  const disponibilidades = (linhas ?? []).filter((row: any) =>
    (!row.codigo_profissional || (row.profissionais?.ativo !== false && row.profissionais?.status_cadastro === 'aprovado')) &&
    (!row.codigo_clinica || row.clinicas?.status_cadastro === 'aprovado')
  );
  if (disponibilidades.length === 0) return [];

  // Horário online só aparece enquanto o prestador mantém o add-on.
  const semAddon = new Set<string>();
  for (const row of disponibilidades.filter((r: any) => r.modalidade === 'telemedicina')) {
    const prestador = prestadorDaDisponibilidade(row);
    if (!(await prestadorTemAddon(prestador, 'addon_telemedicina'))) {
      semAddon.add(`${prestador.tipo}:${prestador.codigo}`);
    }
  }

  let consultasQuery = supabase
    .from('consultas')
    .select('data_hora, duracao_minutos, codigo_profissional, codigo_clinica')
    .gte('data_hora', `${filtro.data} 00:00:00`)
    .lte('data_hora', `${filtro.data} 23:59:59`)
    .neq('status', 'cancelada');

  consultasQuery = filtro.codigo_profissional
    ? consultasQuery.eq('codigo_profissional', filtro.codigo_profissional)
    : consultasQuery.eq('codigo_clinica', filtro.codigo_clinica!);

  const { data: consultas, error: consultasError } = await consultasQuery;
  if (consultasError) throw new Error(consultasError.message);

  const agora = paraMs(agoraLocal());
  const slots: Slot[] = [];

  for (const row of disponibilidades as any[]) {
    const prestador = prestadorDaDisponibilidade(row);
    if (row.modalidade === 'telemedicina' && semAddon.has(`${prestador.tipo}:${prestador.codigo}`)) continue;

    // Consultas da mesma agenda: do mesmo profissional, ou da clínica sem profissional.
    const ocupados = (consultas ?? [])
      .filter((c: any) => row.codigo_profissional
        ? c.codigo_profissional === row.codigo_profissional
        : !c.codigo_profissional)
      .map((c: any) => {
        const inicio = paraMs(normalizarDataHora(c.data_hora));
        return { inicio, fim: inicio + (c.duracao_minutos ?? 60) * 60_000 };
      });

    const inicioDia = horaParaMinutos(String(row.hora_inicio));
    const fimDia = horaParaMinutos(String(row.hora_fim));

    for (let minuto = inicioDia; minuto + row.duracao_minutos <= fimDia; minuto += row.duracao_minutos) {
      const hora = minutosParaHora(minuto);
      const dataHora = `${filtro.data} ${hora}:00`;
      const inicio = paraMs(dataHora);
      const fim = inicio + row.duracao_minutos * 60_000;

      if (inicio <= agora) continue;
      if (ocupados.some((o) => inicio < o.fim && o.inicio < fim)) continue;

      slots.push({
        data_hora: dataHora,
        hora,
        modalidade: row.modalidade,
        duracao_minutos: row.duracao_minutos,
        codigo_disponibilidade: row.codigo,
        codigo_profissional: row.codigo_profissional ?? null,
        codigo_clinica: row.codigo_clinica ?? null,
        profissional_nome: row.profissionais?.nome ?? null,
      });
    }
  }

  return slots.sort((a, b) => a.data_hora.localeCompare(b.data_hora) || (a.profissional_nome ?? '').localeCompare(b.profissional_nome ?? ''));
}

/** O horário pedido existe na agenda e ainda está livre? Usado ao criar a consulta. */
export async function encontrarSlot(filtro: FiltroAgenda, dataHora: string, modalidade: Modalidade): Promise<Slot | null> {
  const alvo = normalizarDataHora(dataHora);
  const slots = await listarSlotsLivres({ ...filtro, data: alvo.slice(0, 10), modalidade });
  return slots.find((slot) =>
    slot.data_hora === alvo &&
    (filtro.codigo_profissional ? slot.codigo_profissional === filtro.codigo_profissional : !slot.codigo_profissional)
  ) ?? null;
}
