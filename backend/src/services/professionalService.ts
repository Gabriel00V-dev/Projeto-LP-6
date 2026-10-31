import { supabase } from '../supabaseClient';
import { AuthenticatedUser, TipoProfissional } from '../middlewares/authMiddleware';
import { prestadorDoProfissional, prestadoresComAddon } from '../middlewares/checkAddon';
import { HttpError } from '../utils/httpError';
import { cpfValido, somenteDigitos } from '../utils/documentos';

export const TIPOS_PROFISSIONAL: TipoProfissional[] = [
  'psicologo',
  'medico',
  'enfermeiro',
  'veterinario',
  'profissional_sus',
];

// O "!coluna" indica a FK a usar no embed. Sem ele o PostgREST acusa
// ambiguidade, porque disponibilidades/consultas/filas_upa também ligam
// profissionais a clínicas (e consultas liga profissionais a especializações).
const SELECT_PROFISSIONAL = `
  codigo, nome, email, fone, registro_profissional, tipo, codigo_clinica,
  codigo_especializacao, bio, imagem, ativo, status_cadastro, motivo_reprovacao,
  clinicas!codigo_clinica(nome, endereco, tipo),
  especializacoes!codigo_especializacao(nome)
`;

function formatar(row: any, comTelemedicina?: Set<string>) {
  const { clinicas, especializacoes, ...profissional } = row;
  const prestador = prestadorDoProfissional(profissional);
  return {
    ...profissional,
    clinica_nome: clinicas?.nome ?? null,
    clinica_endereco: clinicas?.endereco ?? null,
    clinica_tipo: clinicas?.tipo ?? null,
    especializacao_nome: especializacoes?.nome ?? null,
    independente: !profissional.codigo_clinica,
    ...(comTelemedicina ? { telemedicina: comTelemedicina.has(`${prestador.tipo}:${prestador.codigo}`) } : {}),
  };
}

async function prestadoresComTelemedicina(): Promise<Set<string>> {
  const prestadores = await prestadoresComAddon('addon_telemedicina');
  return new Set(prestadores.map((p) => `${p.tipo}:${p.codigo}`));
}

export interface FiltroProfissionais {
  tipo?: string;
  codigo_clinica?: number;
  codigo_especializacao?: number;
  incluir_inativos?: boolean;
  // A clínica vê a própria equipe inteira, inclusive quem está em análise.
  incluir_nao_aprovados?: boolean;
}

export async function listarProfissionais(filtro: FiltroProfissionais = {}) {
  let query = supabase.from('profissionais').select(SELECT_PROFISSIONAL).order('nome');

  if (!filtro.incluir_inativos) query = query.eq('ativo', true);
  if (!filtro.incluir_nao_aprovados) query = query.eq('status_cadastro', 'aprovado');
  if (filtro.tipo) query = query.eq('tipo', filtro.tipo);
  if (filtro.codigo_clinica) query = query.eq('codigo_clinica', filtro.codigo_clinica);
  if (filtro.codigo_especializacao) query = query.eq('codigo_especializacao', filtro.codigo_especializacao);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const comTelemedicina = await prestadoresComTelemedicina();
  return (data ?? []).map((row) => formatar(row, comTelemedicina));
}

export async function obterProfissional(codigo: number) {
  if (!Number.isInteger(codigo)) throw new HttpError(400, 'Código inválido');

  const { data, error } = await supabase
    .from('profissionais')
    .select(SELECT_PROFISSIONAL)
    .eq('codigo', codigo)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, 'Profissional não encontrado');

  return formatar(data, await prestadoresComTelemedicina());
}

/** O próprio profissional, ou a clínica à qual ele está vinculado. */
export function podeGerenciarProfissional(
  user: AuthenticatedUser,
  profissional: { codigo: number; codigo_clinica?: number | null }
): boolean {
  if (user.role === 'profissional') return user.entityId === profissional.codigo;
  if (user.role === 'clinica') return Boolean(profissional.codigo_clinica) && profissional.codigo_clinica === user.entityId;
  return false;
}

/**
 * A clínica cadastra um profissional vinculado a ela. O profissional não
 * ganha login aqui: a clínica gerencia a agenda dele. Se ele quiser entrar no
 * app, o cadastro de conta é feito à parte com o mesmo e-mail.
 */
export async function criarProfissional(user: AuthenticatedUser, dados: any) {
  if (user.role !== 'clinica') throw new HttpError(403, 'Apenas clínicas cadastram profissionais vinculados.');

  const { nome, email, fone, registro_profissional, tipo, bio, imagem, codigo_especializacao, cpf } = dados ?? {};

  if (!nome || !email) throw new HttpError(400, 'Nome e e-mail são obrigatórios.');
  if (!TIPOS_PROFISSIONAL.includes(tipo)) {
    throw new HttpError(400, `Tipo inválido. Use: ${TIPOS_PROFISSIONAL.join(', ')}`);
  }
  // A prefeitura confere CPF e registro antes de liberar o profissional.
  if (!cpfValido(cpf)) throw new HttpError(400, 'CPF inválido.');
  if (!registro_profissional?.trim()) throw new HttpError(400, 'O registro profissional é obrigatório.');

  const { data, error } = await supabase
    .from('profissionais')
    .insert({
      nome,
      email,
      fone,
      registro_profissional: registro_profissional.trim(),
      cpf: somenteDigitos(cpf),
      tipo,
      bio,
      imagem,
      codigo_especializacao: codigo_especializacao ?? null,
      codigo_clinica: user.entityId,
      // status_cadastro fica no default do banco: 'pendente'.
    })
    .select(SELECT_PROFISSIONAL)
    .single();

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Já existe um profissional com este e-mail ou CPF.');
    throw new Error(error.message);
  }

  return formatar(data);
}

export async function atualizarProfissional(user: AuthenticatedUser, codigo: number, dados: any) {
  const atual = await obterProfissional(codigo);

  if (!podeGerenciarProfissional(user, atual)) {
    throw new HttpError(403, 'Você não pode alterar este profissional.');
  }

  // O e-mail liga a linha à conta do Supabase Auth; trocar só aqui quebraria
  // o login do profissional. Fica de fora, assim como o vínculo com a clínica.
  const permitidos = ['nome', 'fone', 'registro_profissional', 'tipo', 'bio', 'imagem', 'codigo_especializacao'];
  if (user.role === 'clinica') permitidos.push('ativo');

  const update: Record<string, unknown> = {};
  for (const campo of permitidos) {
    if (dados?.[campo] !== undefined) update[campo] = dados[campo];
  }

  if (update.tipo !== undefined && !TIPOS_PROFISSIONAL.includes(update.tipo as TipoProfissional)) {
    throw new HttpError(400, `Tipo inválido. Use: ${TIPOS_PROFISSIONAL.join(', ')}`);
  }

  const { data, error } = await supabase
    .from('profissionais')
    .update(update)
    .eq('codigo', codigo)
    .select(SELECT_PROFISSIONAL)
    .single();

  if (error) throw new Error(error.message);
  return formatar(data);
}
