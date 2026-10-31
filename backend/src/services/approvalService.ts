import { supabase } from '../supabaseClient';
import { AuthenticatedUser, StatusCadastro } from '../middlewares/authMiddleware';
import { HttpError } from '../utils/httpError';
import { cnpjValido, cpfValido, somenteDigitos } from '../utils/documentos';
import { TIPOS_CLINICA } from './clinicService';
import { TIPOS_PROFISSIONAL } from './professionalService';

export type TipoCadastro = 'clinica' | 'profissional';

const STATUS: StatusCadastro[] = ['pendente', 'aprovado', 'reprovado'];
const TABELA: Record<TipoCadastro, string> = { clinica: 'clinicas', profissional: 'profissionais' };

const CAMPOS_ANALISE = 'status_cadastro, motivo_reprovacao, enviado_em, analisado_em';

const SELECT: Record<TipoCadastro, string> = {
  clinica: `codigo, nome, email, fone, endereco, tipo, imagem, atende_unimed, cnpj, responsavel_tecnico, registro_responsavel, ${CAMPOS_ANALISE}`,
  profissional: `codigo, nome, email, fone, tipo, registro_profissional, cpf, bio, codigo_clinica, ${CAMPOS_ANALISE}, clinicas!codigo_clinica(nome)`,
};

// O que o próprio prestador pode corrigir ao reenviar um cadastro reprovado.
const CAMPOS_CORRIGIVEIS: Record<TipoCadastro, string[]> = {
  clinica: ['nome', 'endereco', 'fone', 'tipo', 'cnpj', 'responsavel_tecnico', 'registro_responsavel'],
  profissional: ['nome', 'fone', 'tipo', 'registro_profissional', 'cpf', 'bio'],
};

function formatar(tipo: TipoCadastro, row: any) {
  const { clinicas, ...dados } = row;
  return {
    tipo_cadastro: tipo,
    ...dados,
    ...(tipo === 'profissional' ? { clinica_nome: clinicas?.nome ?? null } : {}),
  };
}

async function registrarHistorico(tipo: TipoCadastro, codigo: number, decisao: string, motivo: string | null, admin?: number) {
  const { error } = await supabase.from('analises_cadastro').insert({
    tipo_cadastro: tipo,
    codigo_cadastro: codigo,
    decisao,
    motivo,
    codigo_administrador: admin ?? null,
  });
  // O histórico é auditoria; não desfaz a decisão se falhar.
  if (error) console.error('[analises_cadastro]', error.message);
}

// ============================================================
// Prefeitura
// ============================================================

export async function listar(filtro: { status?: string; tipo?: string }) {
  const status = (filtro.status ?? 'pendente') as StatusCadastro;
  if (!STATUS.includes(status)) throw new HttpError(400, `status deve ser ${STATUS.join(', ')}.`);
  if (filtro.tipo && !['clinica', 'profissional'].includes(filtro.tipo)) {
    throw new HttpError(400, 'tipo deve ser clinica ou profissional.');
  }

  const tipos: TipoCadastro[] = filtro.tipo ? [filtro.tipo as TipoCadastro] : ['clinica', 'profissional'];

  const listas = await Promise.all(tipos.map(async (tipo) => {
    const { data, error } = await supabase
      .from(TABELA[tipo])
      .select(SELECT[tipo])
      .eq('status_cadastro', status)
      // Pendentes: quem enviou primeiro é analisado primeiro.
      .order(status === 'pendente' ? 'enviado_em' : 'analisado_em', { ascending: status === 'pendente', nullsFirst: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => formatar(tipo, row));
  }));

  const itens = listas.flat().sort((a: any, b: any) =>
    status === 'pendente'
      ? String(a.enviado_em ?? '').localeCompare(String(b.enviado_em ?? ''))
      : String(b.analisado_em ?? '').localeCompare(String(a.analisado_em ?? ''))
  );

  return { itens, contagem: await contagem() };
}

async function contagem() {
  const resultado: Record<StatusCadastro, number> = { pendente: 0, aprovado: 0, reprovado: 0 };

  await Promise.all(STATUS.flatMap((status) => (['clinica', 'profissional'] as TipoCadastro[]).map(async (tipo) => {
    const { count } = await supabase
      .from(TABELA[tipo])
      .select('codigo', { count: 'exact', head: true })
      .eq('status_cadastro', status);
    resultado[status] += count ?? 0;
  })));

  return resultado;
}

export async function decidir(admin: AuthenticatedUser, tipo: string, codigo: number, decisao: string, motivo?: string) {
  if (tipo !== 'clinica' && tipo !== 'profissional') throw new HttpError(400, 'tipo deve ser clinica ou profissional.');
  if (decisao !== 'aprovado' && decisao !== 'reprovado') throw new HttpError(400, 'decisao deve ser aprovado ou reprovado.');
  if (decisao === 'reprovado' && (motivo ?? '').trim().length < 5) {
    throw new HttpError(400, 'Explique o motivo da reprovação: o prestador vai ler e corrigir.');
  }

  const { data: atual, error: erroBusca } = await supabase
    .from(TABELA[tipo])
    .select('codigo, status_cadastro')
    .eq('codigo', codigo)
    .maybeSingle();

  if (erroBusca) throw new Error(erroBusca.message);
  if (!atual) throw new HttpError(404, 'Cadastro não encontrado');
  if (atual.status_cadastro === decisao) throw new HttpError(409, `Este cadastro já está ${decisao}.`);

  const { data, error } = await supabase
    .from(TABELA[tipo])
    .update({
      status_cadastro: decisao,
      motivo_reprovacao: decisao === 'reprovado' ? motivo!.trim() : null,
      analisado_em: new Date().toISOString(),
      analisado_por: admin.entityId,
    })
    .eq('codigo', codigo)
    .select(SELECT[tipo])
    .single();

  if (error) throw new Error(error.message);
  await registrarHistorico(tipo, codigo, decisao, decisao === 'reprovado' ? motivo!.trim() : null, admin.entityId);
  return formatar(tipo, data);
}

// ============================================================
// Prestador acompanhando o próprio cadastro
// ============================================================

function tipoDoUsuario(user: AuthenticatedUser): TipoCadastro {
  if (user.role === 'clinica' || user.role === 'profissional') return user.role;
  throw new HttpError(403, 'Apenas clínicas e profissionais passam por aprovação.');
}

export async function meuCadastro(user: AuthenticatedUser) {
  const tipo = tipoDoUsuario(user);

  const [{ data, error }, { data: historico }] = await Promise.all([
    supabase.from(TABELA[tipo]).select(SELECT[tipo]).eq('codigo', user.entityId).single(),
    supabase
      .from('analises_cadastro')
      .select('decisao, motivo, criado_em')
      .eq('tipo_cadastro', tipo)
      .eq('codigo_cadastro', user.entityId)
      .order('criado_em', { ascending: false })
      .limit(10),
  ]);

  if (error) throw new Error(error.message);
  return { ...formatar(tipo, data), historico: historico ?? [] };
}

/** Cadastro reprovado: o prestador corrige o que foi apontado e volta para a fila. */
export async function reenviar(user: AuthenticatedUser, dados: any) {
  const tipo = tipoDoUsuario(user);
  const atual = await meuCadastro(user);

  if (atual.status_cadastro !== 'reprovado') {
    throw new HttpError(409, 'Só é possível reenviar um cadastro reprovado.');
  }

  const update: Record<string, unknown> = {};
  for (const campo of CAMPOS_CORRIGIVEIS[tipo]) {
    if (dados?.[campo] !== undefined) update[campo] = typeof dados[campo] === 'string' ? dados[campo].trim() : dados[campo];
  }

  if (update.cnpj !== undefined) {
    if (!cnpjValido(String(update.cnpj))) throw new HttpError(400, 'CNPJ inválido.');
    update.cnpj = somenteDigitos(String(update.cnpj));
  }
  if (update.cpf !== undefined) {
    if (!cpfValido(String(update.cpf))) throw new HttpError(400, 'CPF inválido.');
    update.cpf = somenteDigitos(String(update.cpf));
  }
  if (update.tipo !== undefined) {
    const validos: string[] = tipo === 'clinica' ? TIPOS_CLINICA : TIPOS_PROFISSIONAL;
    if (!validos.includes(String(update.tipo))) throw new HttpError(400, 'Tipo inválido.');
  }
  if (update.nome !== undefined && !update.nome) throw new HttpError(400, 'O nome é obrigatório.');

  const { error } = await supabase
    .from(TABELA[tipo])
    .update({
      ...update,
      status_cadastro: 'pendente',
      motivo_reprovacao: null,
      enviado_em: new Date().toISOString(),
    })
    .eq('codigo', user.entityId);

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Este CNPJ/CPF já está em outro cadastro.');
    throw new Error(error.message);
  }

  await registrarHistorico(tipo, user.entityId, 'reenviado', null);
  return meuCadastro(user);
}
