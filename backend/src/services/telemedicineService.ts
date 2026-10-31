import { randomBytes } from 'crypto';
import { supabase } from '../supabaseClient';
import { AuthenticatedUser } from '../middlewares/authMiddleware';
import { Prestador, prestadorDoProfissional, prestadoresComAddon, prestadorTemAddon } from '../middlewares/checkAddon';
import { HttpError } from '../utils/httpError';
import { agoraLocal, normalizarDataHora, paraMs, somarMinutos } from '../utils/horario';
import { listarSlotsLivres } from './availabilityService';
import {
  ehPrestadorDaConsulta,
  getAppointmentById,
  podeVerConsulta,
  transicionar,
} from './appointmentService';

// Janela de acesso à sala (plano, 7.6). Configurável por variável de ambiente.
const MINUTOS_ANTES = Number(process.env.TELEMEDICINA_MINUTOS_ANTES ?? 10);
const TOLERANCIA_MINUTOS = Number(process.env.TELEMEDICINA_TOLERANCIA_MINUTOS ?? 15);

// Protótipo: Jitsi público. Em produção, apontar para o Jitsi self-hosted.
const JITSI_BASE_URL = (process.env.JITSI_BASE_URL || 'https://meet.jit.si').replace(/\/$/, '');
const PREFIXO_SALA = process.env.JITSI_ROOM_PREFIX || 'saude-municipal';

const STATUS_ENCERRADOS = ['cancelada', 'concluida', 'faltou'];

// ============================================================
// Vitrine: só prestadores com o add-on valendo
// ============================================================

export async function listarPrestadores() {
  const prestadores = await prestadoresComAddon('addon_telemedicina');
  const codigosClinicas = prestadores.filter((p) => p.tipo === 'clinica').map((p) => p.codigo);
  const codigosProfissionais = prestadores.filter((p) => p.tipo === 'profissional').map((p) => p.codigo);

  const [clinicas, profissionaisDasClinicas, independentes, horariosOnline] = await Promise.all([
    codigosClinicas.length
      ? supabase
          .from('clinicas')
          .select('codigo, nome, endereco, imagem, tipo, clinicas_especializacoes(especializacao:especializacoes(codigo, nome))')
          .in('codigo', codigosClinicas)
          .eq('status_cadastro', 'aprovado')
      : Promise.resolve({ data: [], error: null }),
    codigosClinicas.length
      ? supabase
          .from('profissionais')
          .select('codigo, nome, tipo, codigo_clinica, codigo_especializacao, especializacoes!codigo_especializacao(nome)')
          .in('codigo_clinica', codigosClinicas)
          .eq('ativo', true)
          .eq('status_cadastro', 'aprovado')
      : Promise.resolve({ data: [], error: null }),
    codigosProfissionais.length
      ? supabase
          .from('profissionais')
          .select('codigo, nome, tipo, registro_profissional, bio, imagem, codigo_especializacao, especializacoes!codigo_especializacao(nome)')
          .in('codigo', codigosProfissionais)
          .is('codigo_clinica', null)
          .eq('ativo', true)
          .eq('status_cadastro', 'aprovado')
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('disponibilidades')
      .select('codigo_clinica, codigo_profissional')
      .eq('modalidade', 'telemedicina')
      .eq('ativo', true),
  ]);

  for (const resultado of [clinicas, profissionaisDasClinicas, independentes, horariosOnline]) {
    if (resultado.error) throw new Error(resultado.error.message);
  }

  const online = (horariosOnline.data ?? []) as any[];
  const temOnline = (filtro: (row: any) => boolean) => online.some(filtro);

  const listaClinicas = ((clinicas.data ?? []) as any[]).map((clinica) => {
    const profissionais = ((profissionaisDasClinicas.data ?? []) as any[])
      .filter((p) => p.codigo_clinica === clinica.codigo)
      .map(({ especializacoes, ...p }) => ({
        ...p,
        especializacao_nome: especializacoes?.nome ?? null,
        tem_horarios_online: temOnline((row) => row.codigo_profissional === p.codigo),
      }));

    const { clinicas_especializacoes, ...dados } = clinica;
    return {
      tipo_prestador: 'clinica' as const,
      ...dados,
      especializacoes: (clinicas_especializacoes ?? []).map((ce: any) => ce.especializacao).filter(Boolean),
      profissionais,
      tem_horarios_online: temOnline((row) => row.codigo_clinica === clinica.codigo),
    };
  });

  const listaIndependentes = ((independentes.data ?? []) as any[]).map(({ especializacoes, ...profissional }) => ({
    tipo_prestador: 'profissional' as const,
    ...profissional,
    especializacao_nome: especializacoes?.nome ?? null,
    tem_horarios_online: temOnline((row) => row.codigo_profissional === profissional.codigo),
  }));

  // Quem já configurou horários online aparece primeiro.
  return [...listaClinicas, ...listaIndependentes].sort((a, b) =>
    Number(b.tem_horarios_online) - Number(a.tem_horarios_online) || a.nome.localeCompare(b.nome)
  );
}

/**
 * Horários online livres de um prestador. Para clínica, junta a agenda geral
 * e a de cada profissional (o slot traz o profissional correspondente).
 */
export async function horariosDoPrestador(tipo: string, codigo: number, data: string, codigoEspecializacao?: number) {
  if (tipo !== 'clinica' && tipo !== 'profissional') throw new HttpError(400, 'tipo deve ser clinica ou profissional.');

  if (tipo === 'profissional') {
    const { data: profissional } = await supabase
      .from('profissionais')
      .select('codigo, codigo_clinica')
      .eq('codigo', codigo)
      .maybeSingle();
    if (!profissional) throw new HttpError(404, 'Profissional não encontrado');
    if (!(await prestadorTemAddon(prestadorDoProfissional(profissional), 'addon_telemedicina'))) return [];
    return listarSlotsLivres({ codigo_profissional: codigo, data, modalidade: 'telemedicina' });
  }

  if (!(await prestadorTemAddon({ tipo: 'clinica', codigo }, 'addon_telemedicina'))) return [];
  const slots = await listarSlotsLivres({ codigo_clinica: codigo, data, modalidade: 'telemedicina' });
  if (!codigoEspecializacao) return slots;

  // Filtro por especialidade: mantém a agenda geral e os profissionais dela.
  const { data: daEspecialidade } = await supabase
    .from('profissionais')
    .select('codigo')
    .eq('codigo_clinica', codigo)
    .eq('codigo_especializacao', codigoEspecializacao);
  const permitidos = new Set((daEspecialidade ?? []).map((p) => p.codigo));
  return slots.filter((slot) => !slot.codigo_profissional || permitidos.has(slot.codigo_profissional));
}

// ============================================================
// Validação de acesso (plano, 7.6)
// ============================================================

function prestadorDaConsulta(consulta: any): Prestador {
  return consulta.codigo_profissional
    ? prestadorDoProfissional({ codigo: consulta.codigo_profissional, codigo_clinica: consulta.codigo_clinica })
    : { tipo: 'clinica', codigo: consulta.codigo_clinica };
}

function janela(consulta: any) {
  const inicio = normalizarDataHora(consulta.data_hora);
  return {
    abre_em: somarMinutos(inicio, -MINUTOS_ANTES),
    fecha_em: somarMinutos(inicio, (consulta.duracao_minutos ?? 60) + TOLERANCIA_MINUTOS),
  };
}

/**
 * Usuário autenticado (garantido pela rota), consulta existente, usuário
 * vinculado à consulta, modalidade telemedicina e prestador com add-on.
 * O horário é checado à parte, porque criar a sala pode ser feito antes.
 */
async function validarConsulta(user: AuthenticatedUser, codigoConsulta: number) {
  if (!Number.isInteger(codigoConsulta)) throw new HttpError(400, 'Consulta inválida');

  const consulta = await getAppointmentById(codigoConsulta);
  if (!consulta) throw new HttpError(404, 'Consulta não encontrada');
  if (!podeVerConsulta(user, consulta)) throw new HttpError(403, 'Você não participa desta consulta.');
  if (consulta.modalidade !== 'telemedicina') throw new HttpError(409, 'Esta consulta é presencial.', 'NOT_TELEMEDICINE');
  if (STATUS_ENCERRADOS.includes(consulta.status)) {
    throw new HttpError(409, 'Esta consulta já foi encerrada ou cancelada.', 'APPOINTMENT_CLOSED');
  }
  if (!(await prestadorTemAddon(prestadorDaConsulta(consulta), 'addon_telemedicina'))) {
    throw new HttpError(403, 'O prestador desta consulta não está com a telemedicina ativa.', 'ADDON_NOT_ACTIVE');
  }

  return consulta;
}

async function buscarSala(codigoConsulta: number) {
  const { data, error } = await supabase
    .from('salas_telemedicina')
    .select('*')
    .eq('codigo_consulta', codigoConsulta)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function obterOuCriarSala(codigoConsulta: number) {
  const existente = await buscarSala(codigoConsulta);
  if (existente) return existente;

  // room_id imprevisível: conhecer o código da consulta não basta para achar a sala.
  const roomId = `${PREFIXO_SALA}-${codigoConsulta}-${randomBytes(12).toString('hex')}`;
  const { data, error } = await supabase
    .from('salas_telemedicina')
    .insert({ codigo_consulta: codigoConsulta, room_id: roomId, meeting_url: `${JITSI_BASE_URL}/${roomId}` })
    .select('*')
    .single();

  // Paciente e prestador entrando juntos: quem perdeu a corrida usa a sala criada.
  if (error?.code === '23505') return (await buscarSala(codigoConsulta))!;
  if (error) throw new Error(error.message);
  return data;
}

// ============================================================
// Operações
// ============================================================

/** "Gerar ou abrir a sala" pelo prestador (pode ser antes do horário). */
export async function criarSala(user: AuthenticatedUser, codigoConsulta: number) {
  const consulta = await validarConsulta(user, codigoConsulta);
  if (!ehPrestadorDaConsulta(user, consulta)) throw new HttpError(403, 'Apenas o prestador cria a sala.');
  return obterOuCriarSala(codigoConsulta);
}

/** Estado da sala para a tela decidir se libera o botão. Não expõe o link. */
export async function statusDaSala(user: AuthenticatedUser, codigoConsulta: number) {
  const consulta = await validarConsulta(user, codigoConsulta);
  const sala = await buscarSala(codigoConsulta);
  const { abre_em, fecha_em } = janela(consulta);
  const agora = paraMs(agoraLocal());

  const antes = agora < paraMs(abre_em);
  const depois = agora > paraMs(fecha_em);
  const encerrada = Boolean(sala?.encerrada_em);

  let mensagem = 'A sala está liberada.';
  if (encerrada) mensagem = 'Esta teleconsulta já foi encerrada.';
  else if (antes) mensagem = `A sala será liberada ${MINUTOS_ANTES} minutos antes do atendimento.`;
  else if (depois) mensagem = 'O horário desta teleconsulta já passou.';

  return {
    codigo_consulta: codigoConsulta,
    possui_sala: Boolean(sala),
    liberada: !antes && !depois && !encerrada,
    encerrada,
    abre_em,
    fecha_em,
    mensagem,
  };
}

export async function entrarNaSala(user: AuthenticatedUser, codigoConsulta: number) {
  const status = await statusDaSala(user, codigoConsulta);
  if (!status.liberada) throw new HttpError(403, status.mensagem, 'ROOM_NOT_AVAILABLE');

  const consulta = (await getAppointmentById(codigoConsulta))!;
  const sala = await obterOuCriarSala(codigoConsulta);
  const agora = new Date().toISOString();

  // Registro de acesso à consulta (plano, 13).
  await supabase.from('acessos_salas').insert({
    codigo_sala: sala.codigo,
    auth_user_id: user.id,
    papel: user.role,
    codigo_entidade: user.entityId,
  });

  if (!sala.liberada_em) {
    await supabase.from('salas_telemedicina').update({ liberada_em: agora }).eq('codigo', sala.codigo);
  }

  // O prestador entrar na sala é o início do atendimento.
  if (ehPrestadorDaConsulta(user, consulta) && ['agendada', 'confirmada'].includes(consulta.status)) {
    await transicionar(user, codigoConsulta, 'iniciar');
  }

  const nome = user.role === 'paciente'
    ? consulta.paciente_nome
    : consulta.profissional_nome ?? consulta.clinica_nome;

  return {
    meetingUrl: nome ? `${sala.meeting_url}#userInfo.displayName=${encodeURIComponent(JSON.stringify(nome))}` : sala.meeting_url,
    roomId: sala.room_id,
    fecha_em: status.fecha_em,
  };
}

export async function encerrarSala(user: AuthenticatedUser, codigoConsulta: number) {
  const consulta = await getAppointmentById(codigoConsulta);
  if (!consulta) throw new HttpError(404, 'Consulta não encontrada');
  if (!ehPrestadorDaConsulta(user, consulta)) throw new HttpError(403, 'Apenas o prestador encerra a teleconsulta.');

  if (!STATUS_ENCERRADOS.includes(consulta.status)) {
    // Finalizar a consulta também fecha a sala (appointmentService.transicionar).
    return transicionar(user, codigoConsulta, 'finalizar');
  }

  await supabase
    .from('salas_telemedicina')
    .update({ encerrada_em: new Date().toISOString() })
    .eq('codigo_consulta', codigoConsulta)
    .is('encerrada_em', null);

  return consulta;
}
