import { randomBytes } from 'crypto';
import { supabase } from '../supabaseClient';
import { AuthenticatedUser } from '../middlewares/authMiddleware';
import { HttpError } from '../utils/httpError';
import { hojeLocal } from '../utils/horario';

export type StatusFila =
  | 'aguardando_triagem'
  | 'em_triagem'
  | 'aguardando_atendimento'
  | 'em_atendimento'
  | 'finalizado'
  | 'cancelado';

export type ClassificacaoRisco = 'vermelho' | 'amarelo' | 'verde' | 'azul';

const STATUS_ATIVOS: StatusFila[] = ['aguardando_triagem', 'em_triagem', 'aguardando_atendimento', 'em_atendimento'];
const STATUS_ESPERA: StatusFila[] = ['aguardando_triagem', 'em_triagem', 'aguardando_atendimento'];
const CLASSIFICACOES: ClassificacaoRisco[] = ['vermelho', 'amarelo', 'verde', 'azul'];

// Quem ainda não passou pela triagem fica depois de qualquer classificado.
const PRIORIDADE: Record<string, number> = { vermelho: 0, amarelo: 1, verde: 2, azul: 3 };
const prioridade = (classificacao: string | null) => (classificacao ? PRIORIDADE[classificacao] : 4);

// Sem histórico de chamadas recentes, a estimativa usa este tempo por pessoa.
const MINUTOS_POR_PACIENTE = 15;
const JANELA_ESTIMATIVA_HORAS = 6;
const DURACAO_PLANTAO_HORAS = 12;

// Só quem atende pode classificar risco (plano, 4.3).
const TIPOS_QUE_CLASSIFICAM = ['medico', 'enfermeiro', 'profissional_sus'];

const TRANSICOES: Record<StatusFila, StatusFila[]> = {
  aguardando_triagem: ['em_triagem', 'cancelado'],
  em_triagem: ['aguardando_atendimento', 'cancelado'],
  aguardando_atendimento: ['em_atendimento', 'cancelado'],
  em_atendimento: ['finalizado', 'aguardando_atendimento'],
  finalizado: [],
  cancelado: [],
};

// ============================================================
// Permissões
// ============================================================

/** A conta da própria UPA ou um profissional vinculado a ela. */
export function ehEquipeDaUnidade(user: AuthenticatedUser | undefined, codigoUnidade: number): boolean {
  if (!user) return false;
  if (user.role === 'clinica') return user.entityId === codigoUnidade;
  if (user.role === 'profissional') return user.codigoClinica === codigoUnidade;
  return false;
}

function podeClassificar(user: AuthenticatedUser, codigoUnidade: number): boolean {
  return (
    user.role === 'profissional' &&
    user.codigoClinica === codigoUnidade &&
    TIPOS_QUE_CLASSIFICAM.includes(user.tipoProfissional ?? '')
  );
}

// ============================================================
// Unidades e lotação
// ============================================================

async function obterUnidade(codigo: number) {
  if (!Number.isInteger(codigo)) throw new HttpError(400, 'Código de unidade inválido');

  const { data, error } = await supabase
    .from('clinicas')
    .select('codigo, nome, endereco, fone, imagem, tipo, aceita_fila_online, status_cadastro')
    .eq('codigo', codigo)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.tipo !== 'upa' || data.status_cadastro !== 'aprovado') {
    throw new HttpError(404, 'Unidade de UPA não encontrada');
  }
  return data;
}

function ordenarFila<T extends { status: string; classificacao_risco: string | null; entrada_em: string }>(fila: T[]): T[] {
  const ordemStatus: Record<string, number> = { em_atendimento: 0, em_triagem: 1, aguardando_atendimento: 2, aguardando_triagem: 3 };
  return [...fila].sort((a, b) =>
    (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9) ||
    prioridade(a.classificacao_risco) - prioridade(b.classificacao_risco) ||
    a.entrada_em.localeCompare(b.entrada_em)
  );
}

/** Posição de espera (1 = próximo). Só conta quem ainda não foi chamado. */
function posicaoNaFila(fila: any[], codigo: number): number | null {
  const espera = fila
    .filter((item) => STATUS_ESPERA.includes(item.status))
    .sort((a, b) =>
      prioridade(a.classificacao_risco) - prioridade(b.classificacao_risco) ||
      a.entrada_em.localeCompare(b.entrada_em)
    );
  const indice = espera.findIndex((item) => item.codigo === codigo);
  return indice === -1 ? null : indice + 1;
}

async function filaAtivaDasUnidades(codigos: number[]) {
  if (codigos.length === 0) return [];
  const { data, error } = await supabase
    .from('filas_upa')
    .select('codigo, codigo_clinica, status, classificacao_risco, entrada_em')
    .in('codigo_clinica', codigos)
    .in('status', STATUS_ATIVOS);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Média porta-médico das chamadas recentes, por unidade (em minutos). */
async function esperaMediaRecente(codigos: number[]): Promise<Map<number, number>> {
  const desde = new Date(Date.now() - JANELA_ESTIMATIVA_HORAS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('filas_upa')
    .select('codigo_clinica, entrada_em, chamado_em')
    .in('codigo_clinica', codigos)
    .gte('chamado_em', desde);

  if (error) throw new Error(error.message);

  const somas = new Map<number, { total: number; n: number }>();
  for (const item of data ?? []) {
    const minutos = (Date.parse(item.chamado_em) - Date.parse(item.entrada_em)) / 60_000;
    if (!Number.isFinite(minutos) || minutos < 0) continue;
    const atual = somas.get(item.codigo_clinica) ?? { total: 0, n: 0 };
    somas.set(item.codigo_clinica, { total: atual.total + minutos, n: atual.n + 1 });
  }

  const medias = new Map<number, number>();
  somas.forEach(({ total, n }, codigo) => medias.set(codigo, Math.round(total / n)));
  return medias;
}

function resumo(codigoUnidade: number, fila: any[], esperaMedia?: number) {
  const daUnidade = fila.filter((item) => item.codigo_clinica === codigoUnidade);
  const aguardando = daUnidade.filter((item) => STATUS_ESPERA.includes(item.status)).length;
  const porClassificacao = Object.fromEntries(
    [...CLASSIFICACOES, 'sem_classificacao'].map((c) => [
      c,
      daUnidade.filter((item) =>
        STATUS_ESPERA.includes(item.status) &&
        (item.classificacao_risco ?? 'sem_classificacao') === c
      ).length,
    ])
  );

  return {
    aguardando,
    em_atendimento: daUnidade.filter((item) => item.status === 'em_atendimento').length,
    por_classificacao: porClassificacao,
    tempo_estimado_minutos: esperaMedia ?? aguardando * MINUTOS_POR_PACIENTE,
    estimativa_por_historico: esperaMedia !== undefined,
  };
}

export async function listarUnidades() {
  const { data, error } = await supabase
    .from('clinicas')
    .select('codigo, nome, endereco, fone, imagem, aceita_fila_online')
    .eq('tipo', 'upa')
    .eq('status_cadastro', 'aprovado')
    .order('nome');

  if (error) throw new Error(error.message);

  const codigos = (data ?? []).map((u) => u.codigo);
  const [fila, medias] = await Promise.all([filaAtivaDasUnidades(codigos), esperaMediaRecente(codigos)]);

  return (data ?? []).map((unidade) => ({ ...unidade, ...resumo(unidade.codigo, fila, medias.get(unidade.codigo)) }));
}

/**
 * Cidadão (ou visitante) vê só a lotação. A equipe da unidade vê a fila
 * completa, com nomes, e a produção do plantão.
 */
export async function obterFila(user: AuthenticatedUser | undefined, codigoUnidade: number) {
  const unidade = await obterUnidade(codigoUnidade);
  const [fila, medias] = await Promise.all([filaAtivaDasUnidades([codigoUnidade]), esperaMediaRecente([codigoUnidade])]);
  const lotacao = { unidade, ...resumo(codigoUnidade, fila, medias.get(codigoUnidade)) };

  if (!ehEquipeDaUnidade(user, codigoUnidade)) return lotacao;

  const { data, error } = await supabase
    .from('filas_upa')
    .select(`
      codigo, protocolo, status, classificacao_risco, setor, sintomas,
      entrada_em, triado_em, chamado_em, codigo_profissional,
      pacientes(nome, datan, fone),
      profissionais(nome)
    `)
    .eq('codigo_clinica', codigoUnidade)
    .in('status', STATUS_ATIVOS);

  if (error) throw new Error(error.message);

  const itens = ordenarFila((data ?? []).map(({ pacientes, profissionais, ...item }: any) => ({
    ...item,
    paciente_nome: pacientes?.nome ?? null,
    paciente_nascimento: pacientes?.datan ?? null,
    paciente_fone: pacientes?.fone ?? null,
    profissional_nome: profissionais?.nome ?? null,
  })));

  return {
    ...lotacao,
    fila: itens.map((item) => ({ ...item, posicao: posicaoNaFila(itens, item.codigo) })),
    producao_plantao: await producaoDoPlantao(codigoUnidade),
    pode_classificar: user ? podeClassificar(user, codigoUnidade) : false,
  };
}

async function producaoDoPlantao(codigoUnidade: number) {
  const desde = new Date(Date.now() - DURACAO_PLANTAO_HORAS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('filas_upa')
    .select('status, entrada_em, chamado_em, finalizado_em, classificacao_risco')
    .eq('codigo_clinica', codigoUnidade)
    .gte('entrada_em', desde);

  if (error) throw new Error(error.message);
  const itens = data ?? [];
  const chamados = itens.filter((i) => i.chamado_em);
  const esperas = chamados.map((i) => (Date.parse(i.chamado_em) - Date.parse(i.entrada_em)) / 60_000);

  return {
    horas: DURACAO_PLANTAO_HORAS,
    entradas: itens.length,
    atendidos: chamados.length,
    finalizados: itens.filter((i) => i.status === 'finalizado').length,
    cancelados: itens.filter((i) => i.status === 'cancelado').length,
    tempo_medio_porta_medico_minutos: esperas.length ? Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length) : null,
  };
}

// ============================================================
// Cidadão: entrar na fila e acompanhar
// ============================================================

function gerarProtocolo(codigoUnidade: number): string {
  const sufixo = randomBytes(3).toString('hex').toUpperCase();
  return `UPA${codigoUnidade}-${hojeLocal().replace(/-/g, '')}-${sufixo}`;
}

export async function entrarNaFila(user: AuthenticatedUser, codigoUnidade: number, sintomas?: string) {
  if (user.role !== 'paciente') throw new HttpError(403, 'Apenas pacientes entram na fila.');

  const unidade = await obterUnidade(codigoUnidade);
  if (!unidade.aceita_fila_online) {
    throw new HttpError(409, 'Esta unidade não aceita entrada na fila pelo aplicativo. Dirija-se à recepção.', 'QUEUE_CLOSED');
  }

  const { data: ativa } = await supabase
    .from('filas_upa')
    .select('protocolo, codigo_clinica')
    .eq('codigo_paciente', user.entityId)
    .in('status', STATUS_ATIVOS)
    .maybeSingle();

  if (ativa) {
    throw new HttpError(409, `Você já está em uma fila (protocolo ${ativa.protocolo}).`, 'ALREADY_IN_QUEUE');
  }

  // O protocolo é aleatório; em caso raro de colisão, tenta de novo.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await supabase
      .from('filas_upa')
      .insert({
        codigo_paciente: user.entityId,
        codigo_clinica: codigoUnidade,
        protocolo: gerarProtocolo(codigoUnidade),
        sintomas: sintomas?.trim() || null,
        status: 'aguardando_triagem',
      })
      .select('codigo')
      .single();

    if (!error) return consultarProtocoloPorCodigo(data.codigo);
    if (error.code !== '23505') throw new Error(error.message);
    if (error.message.includes('paciente_ativo')) {
      throw new HttpError(409, 'Você já está em uma fila.', 'ALREADY_IN_QUEUE');
    }
  }

  throw new HttpError(500, 'Não foi possível gerar o protocolo. Tente novamente.');
}

const SELECT_ENTRADA = `
  codigo, codigo_paciente, codigo_clinica, protocolo, status, classificacao_risco,
  setor, sintomas, entrada_em, triado_em, chamado_em, finalizado_em,
  clinicas(nome, endereco, fone)
`;

async function comPosicao(entrada: any) {
  const { clinicas, ...item } = entrada;
  const ativa = STATUS_ATIVOS.includes(item.status);
  let posicao: number | null = null;
  let tempoEstimado: number | null = null;

  if (ativa) {
    const [fila, medias] = await Promise.all([filaAtivaDasUnidades([item.codigo_clinica]), esperaMediaRecente([item.codigo_clinica])]);
    posicao = posicaoNaFila(fila, item.codigo);
    if (posicao !== null) {
      tempoEstimado = medias.get(item.codigo_clinica) ?? (posicao - 1) * MINUTOS_POR_PACIENTE;
    }
  }

  return {
    ...item,
    unidade_nome: clinicas?.nome ?? null,
    unidade_endereco: clinicas?.endereco ?? null,
    unidade_fone: clinicas?.fone ?? null,
    posicao,
    tempo_estimado_minutos: tempoEstimado,
    foi_chamado: item.status === 'em_atendimento',
  };
}

async function consultarProtocoloPorCodigo(codigo: number) {
  const { data, error } = await supabase.from('filas_upa').select(SELECT_ENTRADA).eq('codigo', codigo).single();
  if (error) throw new Error(error.message);
  return comPosicao(data);
}

export async function consultarProtocolo(user: AuthenticatedUser, protocolo: string) {
  const { data, error } = await supabase
    .from('filas_upa')
    .select(SELECT_ENTRADA)
    .eq('protocolo', protocolo.trim().toUpperCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, 'Protocolo não encontrado');

  const ehDono = user.role === 'paciente' && data.codigo_paciente === user.entityId;
  if (!ehDono && !ehEquipeDaUnidade(user, data.codigo_clinica)) {
    throw new HttpError(403, 'Este protocolo não é seu.');
  }

  return comPosicao(data);
}

export async function minhasEntradas(user: AuthenticatedUser) {
  if (user.role !== 'paciente') throw new HttpError(403, 'Apenas pacientes têm protocolos.');

  const { data, error } = await supabase
    .from('filas_upa')
    .select(SELECT_ENTRADA)
    .eq('codigo_paciente', user.entityId)
    .order('entrada_em', { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(comPosicao));
}

// ============================================================
// Equipe: triagem, risco, chamada e encerramento
// ============================================================

async function obterEntrada(codigo: number) {
  const { data, error } = await supabase.from('filas_upa').select('*').eq('codigo', codigo).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, 'Registro da fila não encontrado');
  return data;
}

function carimbosDaTransicao(user: AuthenticatedUser, para: StatusFila) {
  const agora = new Date().toISOString();
  const campos: Record<string, unknown> = { status: para, atualizado_em: agora };
  if (para === 'aguardando_atendimento') campos.triado_em = agora;
  if (para === 'em_atendimento') {
    campos.chamado_em = agora;
    if (user.role === 'profissional') campos.codigo_profissional = user.entityId;
  }
  if (para === 'finalizado' || para === 'cancelado') campos.finalizado_em = agora;
  return campos;
}

export async function atualizarStatus(user: AuthenticatedUser, codigo: number, dados: { status?: StatusFila; setor?: string }) {
  const entrada = await obterEntrada(codigo);
  const ehDono = user.role === 'paciente' && entrada.codigo_paciente === user.entityId;
  const ehEquipe = ehEquipeDaUnidade(user, entrada.codigo_clinica);

  // O cidadão só pode desistir da própria fila enquanto não foi chamado.
  if (ehDono && !ehEquipe) {
    if (dados.status !== 'cancelado' || dados.setor !== undefined) {
      throw new HttpError(403, 'Você só pode desistir da fila.');
    }
    if (!STATUS_ESPERA.includes(entrada.status)) {
      throw new HttpError(409, 'Você já foi chamado; fale com a equipe da unidade.');
    }
  } else if (!ehEquipe) {
    throw new HttpError(403, 'Apenas a equipe da unidade altera a fila.');
  }

  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (dados.status && dados.status !== entrada.status) {
    if (!TRANSICOES[entrada.status as StatusFila]?.includes(dados.status)) {
      throw new HttpError(409, `Não é possível passar de ${entrada.status} para ${dados.status}.`);
    }
    if (dados.status === 'aguardando_atendimento' && entrada.status === 'em_triagem' && !entrada.classificacao_risco) {
      throw new HttpError(409, 'Classifique o risco antes de encaminhar para atendimento.');
    }
    Object.assign(update, carimbosDaTransicao(user, dados.status));
  }

  // Transferência de setor não muda o status.
  if (dados.setor !== undefined) {
    if (!STATUS_ATIVOS.includes(entrada.status)) throw new HttpError(409, 'Atendimento já encerrado.');
    update.setor = dados.setor?.trim() || null;
  }

  const { data, error } = await supabase
    .from('filas_upa')
    .update(update)
    .eq('codigo', codigo)
    .eq('status', entrada.status) // evita sobrescrever uma mudança feita em paralelo
    .select('codigo')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(409, 'A fila foi alterada por outra pessoa. Atualize e tente de novo.');
  return consultarProtocoloPorCodigo(codigo);
}

export async function classificarRisco(user: AuthenticatedUser, codigo: number, classificacao: ClassificacaoRisco) {
  const entrada = await obterEntrada(codigo);

  if (!podeClassificar(user, entrada.codigo_clinica)) {
    throw new HttpError(403, 'Apenas médicos, enfermeiros e profissionais do SUS desta unidade classificam risco.');
  }
  if (!CLASSIFICACOES.includes(classificacao)) {
    throw new HttpError(400, `Classificação inválida. Use: ${CLASSIFICACOES.join(', ')}`);
  }
  if (!STATUS_ATIVOS.includes(entrada.status)) throw new HttpError(409, 'Atendimento já encerrado.');

  const { error } = await supabase
    .from('filas_upa')
    .update({ classificacao_risco: classificacao, atualizado_em: new Date().toISOString() })
    .eq('codigo', codigo);

  if (error) throw new Error(error.message);
  return consultarProtocoloPorCodigo(codigo);
}

/**
 * "Chamar próximo": na triagem, o mais antigo que chegou; no atendimento, o
 * de maior risco (e, no empate, o que espera há mais tempo).
 */
export async function chamarProximo(user: AuthenticatedUser, codigoUnidade: number, etapa: 'triagem' | 'atendimento') {
  if (!ehEquipeDaUnidade(user, codigoUnidade)) throw new HttpError(403, 'Apenas a equipe da unidade chama pacientes.');
  if (etapa !== 'triagem' && etapa !== 'atendimento') throw new HttpError(400, 'etapa deve ser triagem ou atendimento.');

  const de: StatusFila = etapa === 'triagem' ? 'aguardando_triagem' : 'aguardando_atendimento';
  const para: StatusFila = etapa === 'triagem' ? 'em_triagem' : 'em_atendimento';

  // Duas pessoas podem clicar ao mesmo tempo; quem perder a corrida pega o seguinte.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await supabase
      .from('filas_upa')
      .select('codigo, status, classificacao_risco, entrada_em')
      .eq('codigo_clinica', codigoUnidade)
      .eq('status', de);

    if (error) throw new Error(error.message);
    const proximo = ordenarFila(data ?? [])[0];
    if (!proximo) throw new HttpError(404, etapa === 'triagem' ? 'Ninguém aguardando triagem.' : 'Ninguém aguardando atendimento.');

    const { data: atualizado, error: updateError } = await supabase
      .from('filas_upa')
      .update(carimbosDaTransicao(user, para))
      .eq('codigo', proximo.codigo)
      .eq('status', de)
      .select('codigo')
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (atualizado) return consultarProtocoloPorCodigo(atualizado.codigo);
  }

  throw new HttpError(409, 'A fila está muito movimentada. Tente de novo.');
}
